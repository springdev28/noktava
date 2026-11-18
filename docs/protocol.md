# NKTV audio carrier formats

This implementation follows the supplied Noktava brief's quadratic-pattern / DCT-QIM concept. It defines its own bounded binary layout; compatibility with another implementation is not implied.

## Processing

1. Parse RIFF/WAVE chunks with length and format validation. Read supported PCM/float samples; average stereo to mono. Reject non-finite samples, files above 50 MiB, and durations above 10 minutes.
2. On encryption only, resample to 48 kHz if necessary. Reserve one 1024-sample block per public-header bit, starting at sample zero.
3. Use the browser's cryptographic random generator for a fresh 32-byte key and a fresh 12-byte IV. Encrypt UTF-8 plaintext with AES-256-GCM (128-bit tag). Authenticate the entire public header as additional authenticated data.
4. Embed the header with the fixed quadratic pattern in DCT bins 256–271. Embed the encrypted message and tag in the note-adaptive bins described below.
5. Write a standard PCM16 mono WAV. Before embedding, if the source peak exceeds 0.8, scale it to 0.8 to leave ample room for the QIM perturbation. No audio normalization is applied during decoding.
6. On decode, recover and bound-check the header, reconstruct the note schedule, extract the ciphertext, and verify GCM authentication. Return text only after successful authentication. A wrong key, altered authenticated header, or damaged ciphertext rejects the message.

Native `SubtleCrypto` handles AES; no custom cryptographic primitive is used. The custom audio transport has not undergone independent security review. An attacker can inspect the public format or remove the carrier. Changes outside the authenticated carrier bits are not detected, so successful authentication is **not** an integrity check for the entire audio recording.

## Legacy v1 public header (little-endian)

| Offset | Size | Field |
| --- | --- | --- |
| 0 | 4 | ASCII `NKTV` |
| 4 | 1 | Version `1` |
| 5 | 1 | Number of notes, 1–16 |
| 6 | 2 | Tempo, integer 40–240 BPM |
| 8 | 4 | Ciphertext length, including 16-byte GCM tag |
| 12 | 4 | First block of the note sequence |
| 16 | 12 | Random GCM IV |
| 28 | 2 × note count | MIDI pitch (36–84), duration in eighth notes (1–8) |

For v1, header size is `28 + 2 × noteCount` bytes. The notes, timing, IV and message length are public. The secret key and plaintext are never embedded in the header. The selected note region starts at `max(headerBits, ceil(startSeconds × 48000 / 1024))` blocks. The whole header, including all notes, is GCM AAD.

Before allocation, decoding bounds the ciphertext to 17–4096 bytes, validates the note count, pitches, durations, tempo and first block, and bounds every carrier position to the PCM data. Physical capacity is substantially smaller than 4096 bytes under the application's duration limit.

## Advanced v2 header

New files made by the advanced application use version byte `2`. Bytes 0–27 retain their v1 meaning, followed by:

| Offset | Size | Field |
| --- | --- | --- |
| 28 | 2 | QIM step multiplied by 10,000, little-endian; valid range 200–2000 |
| 30 | 1 | Harmonic multiplier, 2–6 |
| 31 | 1 | Pattern: 0 for note-adaptive, 1 for fixed q₀ |
| 32 | 4 | Exclusive end sample of the embedding interval, little-endian |
| 36 | 2 × note count | MIDI pitch and eighth-note duration pairs |

V2 header size is `36 + 2 × noteCount` bytes. The whole header is authenticated as additional data. Header embedding always uses the fixed q₀ basis, DCT bins 256–271 and step 0.10 so that it can be discovered before reading the advanced settings. The stored first block must follow the complete header. Payload blocks must end within both the selected interval and the physical recording.

Encoding strength is rounded to four decimal places before embedding, matching its header representation. V1 retains its original step 0.10, fourth harmonic and note-adaptive pattern.

## Manual alignment and diagnostics

The decoder accepts an optional non-negative integer `headerOffsetSamples`, up to 2,880,000 samples (60 seconds at 48 kHz) and strictly within the file. The offset is removed from the view before header extraction and all subsequent carrier indexing. This supports an intact recording with a prefixed section; no audio resampling or normalization is performed during decoding.

Structural inspection returns metadata, public header hex and ciphertext hex without a key. It is explicitly unauthenticated until AES-GCM succeeds. The average QIM decision margin is `mean(0.5 - abs(p/step - round(p/step)))`, clamped at zero, on extracted payload blocks. It measures distance from a QIM decision boundary and is not a cryptographic confidence score. There is no authentication bypass or damaged-message plaintext display.

## Quadratic weights and note positions

For each note, `a = (currentMidi - previousMidi) mod 2` (non-negative modulo) and `b = durationEighths mod 2`. The first note has `a = 0`. Iterate four-bit inputs in big-endian order from `0000` through `1111`:

```text
q(x) = x1*x2 + x3*x4 + a*x1 + b*x2 (mod 2)
c[j] = (-1)^q / 4
```

The squared weights sum to one. The fixed header basis uses `a = b = 0`. A note's fundamental frequency is `440 × 2^((midi - 69)/12)` Hz. Center its 16 DCT coefficients at `round(2 × 1024 × hf / 48000)`, where h is the configured harmonic (4 for v1), using bins `center - 7 … center + 8`.

Repeat the user-provided phrase through the remaining audio. Each note's duration is `durationEighths × 30 / bpm` seconds. Use `floor(noteMidpoint / 1024)` and the next block for one bit each. Skip any block that cannot fit completely. The first bit of each byte is the most significant bit.

Instead of calculating the entire DCT, precompute a weighted sum of the 16 orthonormal DCT basis vectors. Dotting an audio block with this vector gives the same weighted coefficient projection. The inverse weighted vector applies the update without a full inverse transform.

## QIM

With the configured step Δ (0.10 for v1 and for either version’s header), projection `p`, and desired bit `b`:

```text
target = Δ × (2 × round((p / Δ - b) / 2) + b)
block' = block + (target - p) × weightedBasis
bit = nonNegativeModulo(round(projection(block') / Δ), 2)
```

The maximum projection adjustment equals the configured step, at most 0.2. Source peak headroom prevents clipping under this bounded update. PCM16 rounding error is small relative to the QIM interval; round-trip tests exercise the serialized WAV, not just floating point buffers.

## Capacity and limitations

One note carries two encrypted bits. Header and the GCM tag are overhead. Available plaintext bytes are `max(0, floor(availableNoteBlocks / 8) - 16)`. UTF-8 byte length, rather than JavaScript string length, controls the limit.

There is no error-correction code, redundancy, automatic pitch extraction, or defense against file edits. The editor’s RMS and peak levels are signal measurements, not perceptual audio-quality guarantees. This is a research implementation. The exact illustrative tags in the brief use a different header and are not expected to match this format.

## References

- [Noktava project brief](https://docs.google.com/document/d/1PDQVUpXmfDefXpSFndYF8YgIKCNy5UxySh5_5KZCpQ0/edit)
- [MDN: SubtleCrypto.encrypt](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt)
- [MDN: SubtleCrypto.decrypt](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/decrypt)

## Timed-note v3 format

Imported MIDI and edited note times use version 3. V1 and v2 decoding remains supported. The 36-byte audio bootstrap retains the v2 fields except version is 3, byte 5 is zero, and there are no inline note pairs. BPM is an informational integer from 1 to 999. MIDI tempo changes are already reflected in the stored absolute sample times.

A single `nktm` RIFF chunk follows the PCM data. Its payload is included in AES-GCM AAD immediately after the complete 36-byte bootstrap. It contains public note metadata, never the key or plaintext. Missing, duplicate, truncated or invalid metadata is rejected. Altering even a note outside the embedded payload makes authentication fail. Ordinary WAV players can skip the unknown chunk; resaving audio in another program may strip it and prevent decoding.

| Offset | Size | Field |
| --- | --- | --- |
| 0 | 4 | Bytes `4e 54 4d 01` |
| 4 | 1 | 0 = absolute timeline, 1 = repeating sequence |
| 5 | 1 | Reserved, must be zero |
| 6 | 2 | Note count, 1 to 8192 |
| 8 | 13 per note | Pitch uint8, start sample uint32, duration samples uint32, duration in eighth-note units float32 |

All multibyte fields are little-endian. Sample times use 48 kHz; timing is quantized to the nearest sample before embedding. MIDI note durations in beats are retained separately from elapsed seconds, so tempo changes preserve both timing and rhythm. Fractional eighth-note durations are rounded to the nearest integer for the quadratic parity `b`. Notes are ordered by start time, then pitch.

For each note, take the pair starting at `max(ceil(startSample / 1024), floor(midpoint / 1024) - 1)`. Both blocks must fit inside the note, the selected region and the file, and follow the audio bootstrap. Each audio block is used once: overlapping later notes are skipped rather than overwriting prior bits. Notes whose harmonic band does not fit inside DCT bins 1 to 1023 are also skipped. All skipped notes remain in authenticated metadata and the preview.

Absolute MIDI timing is measured from the beginning of the audio and does not repeat by default. Loop mode starts its sequence at the selected first block after the bootstrap and repeats with a period ending at the last note. Note intervals shorter than two blocks provide no capacity. Work is bounded to one million candidate note events. The UI reports capacity before encryption and rejects oversized messages.

MIDI files are limited to 1 MiB, 128 tracks, 8192 notes per track and 10 minutes. SMF formats 0 and 1 with PPQ timing are supported; SMPTE and asynchronous format 2 are rejected with an explanation. `@tonejs/midi` parses note events and tempo maps. Users select a track; percussion tracks are identified. There is no audio-to-MIDI transcription.

Source MP3/WAV uploads are limited to 50 MiB. MP3 decoding uses Web Audio locally at 48 kHz, with stereo downmixed to mono. WAV carrier reads allow 60 MiB to accommodate a ten-minute PCM16 output plus note metadata. Encoded output must be shared as the original WAV.
