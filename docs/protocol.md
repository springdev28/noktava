# NKTV audio carrier formats

This implementation follows the supplied noktava. brief's quadratic-pattern / DCT-QIM concept. It defines its own bounded binary layout; compatibility with another implementation is not implied.

## Current v4 processing

The 18 November 2026 revision of the project brief requires the note schedule, payload length and decoding parameters to be encrypted inside the audio signal. New exports implement that requirement as NKTV v4. V1, v2 and v3 remain readable, but are no longer generated. The brief defines the method, not a byte-level interchange format; the framing and control-band allocation below are application format decisions.

1. Parse bounded RIFF/WAVE chunks and read supported PCM/float samples. Average stereo to mono. On encryption only, resample to 48 kHz. Source uploads are limited to 50 MiB and ten minutes; decoder inputs allow 60 MiB.
2. Canonicalize note timing to integer samples, rhythm to float32 for timed notes, and QIM strength to four decimal places. Capacity uses these exact serialized values and reserves all control blocks before counting message slots.
3. Generate a fresh random 32-byte key and 12-byte control IV. Encrypt the control packet with AES-256-GCM and a 128-bit tag. Its AAD is the ASCII domain `NKTV4:control` followed by the complete bootstrap.
4. Encrypt the UTF-8 message with the same key and a distinct IV, obtained by XORing the final control-IV byte with 1. Its AAD is the ASCII domain `NKTV4:message`, the complete bootstrap and the encrypted control packet including its tag. Thus the two GCM invocations have distinct IVs and the message is bound to the exact control ciphertext.
5. Embed the bootstrap and encrypted control in the predetermined blocks below. Embed the message and its tag using the original note-adaptive quadratic-pattern / DCT-QIM rule.
6. Export ordinary PCM16 mono WAV with only `fmt ` and `data` chunks. Notes, timing, message length, settings, secret key and plaintext are not written to filenames or readable WAV metadata. Before embedding, scale peaks above 0.70 to 0.70 to reserve headroom for the sixteen control bands. No normalization is applied on decode.
7. The receiver needs only this WAV and the key. Read the bootstrap, bound-check the control length, verify and decrypt the control packet, then parse its schedule. Extract and authenticate the message. No note details or plaintext are returned until both checks succeed.

Native `SubtleCrypto` handles AES. The custom audio transport has not undergone independent security review. The bootstrap marker, version, IV and control ciphertext size remain observable. This is not a claim that the carrier is undetectable. Authentication covers the two packets and their framing, not every audio sample; changes outside the carrier bits may not be detected.

## V4 bootstrap

All multibyte fields are little-endian. The bootstrap occupies 28 bytes, embedded one bit per 1024-sample block in blocks 0 through 223. It uses fixed q₀, DCT bins 256 through 271 and step 0.10. Bits are most significant first.

| Offset | Size | Field |
| --- | --- | --- |
| 0 | 4 | ASCII `NKTV` |
| 4 | 1 | Version `4` |
| 5 | 3 | Reserved, zero |
| 8 | 4 | Encrypted control length including its 16-byte tag |
| 12 | 4 | Reserved, zero |
| 16 | 12 | Random control IV |

Control length is restricted to 42 through 106536 bytes and must fit in the actual PCM recording before allocation. Reserved fields must be zero. The message length, note count, timing and decoding settings are inside the encrypted control, not in this bootstrap. The ciphertext size can still reveal the size of the control packet.

## V4 encrypted control

Starting at block 224, each block carries up to sixteen control bits. Lane `l`, from 0 to 15, uses fixed q₀ over the disjoint DCT bins `256 + 16*l` through `271 + 16*l`, with step 0.10. Control bit `i` is in block `224 + floor(i/16)` and lane `i mod 16`. Unused lanes in the final block are left unchanged. Disjoint DCT bands are orthogonal, so modifying one does not overwrite another. This density avoids reserving one whole audio block for every MIDI metadata bit. It does not change the message's two-bits-per-note rule.

The control plaintext has this layout:

| Offset | Size | Field |
| --- | --- | --- |
| 0 | 1 | Timing mode: 0 repeating pitch/duration phrase, 1 absolute timeline, 2 repeating timed sequence |
| 1 | 1 | Harmonic, 2 through 6 |
| 2 | 1 | Pattern: 0 note-adaptive, 1 fixed q₀ |
| 3 | 1 | Reserved, zero |
| 4 | 2 | BPM |
| 6 | 2 | QIM step times 10000, 200 through 2000 |
| 8 | 4 | Encrypted message length including its 16-byte tag |
| 12 | 4 | First eligible message block |
| 16 | 4 | Exclusive end sample of the message region |
| 20 | 2 | Note count |
| 22 | 2 | Reserved, zero |
| 24 | Variable | Note records |

Mode 0 stores two bytes per note: MIDI pitch and integer duration in eighth-note units. It permits 1 through 16 notes and 40 through 240 BPM. Modes 1 and 2 use 13-byte records: pitch uint8, start sample uint32, duration samples uint32, rhythm in eighth notes float32. They permit up to 8192 notes and 1 through 999 BPM. Timed notes use the same absolute-time, loop and overlap rules documented below for v3. Control size is `24 + recordSize * noteCount + 16` bytes including the tag. All records, including unused or skipped notes, are encrypted and authenticated.

The first message block is at least `224 + ceil(controlCiphertextBytes / 2)` and at least `ceil(selectedStartSeconds * 48000 / 1024)`. All message blocks must fit within the selected end and the recording. The decoded message length is bounded to 17 through 4096 bytes. Invalid timing, counts, reserved fields, region bounds and out-of-range settings are rejected after control authentication, before message extraction.

Each control band's QIM correction has magnitude at most `0.10 * 4 * sqrt(2/1024)` per sample. Sixteen bands plus the 0.70 source peak remain below 1, including the separate single-band message region. Tests cover full-scale input, PCM16 conversion, independent packet recovery and tampering. This bound prevents clipping; it is not an audibility or sound-quality guarantee.

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

## Legacy v2 header

Older advanced exports use version byte `2`. Bytes 0–27 retain their v1 meaning, followed by:

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

V4 keyless inspection returns only framing and a locked status. Note details, message length and settings are returned only after both GCM checks succeed. Legacy inspection can still return its public metadata and ciphertext without a key, explicitly marked unauthenticated. The average QIM decision margin is `mean(0.5 - abs(p/step - round(p/step)))`, clamped at zero, on extracted payload blocks. It measures distance from a QIM decision boundary and is not a cryptographic confidence score. There is no authentication bypass or damaged-message plaintext display.

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

With the configured step Δ (0.10 for v1 and for every bootstrap/control band), projection `p`, and desired bit `b`:

```text
target = Δ × (2 × round((p / Δ - b) / 2) + b)
block' = block + (target - p) × weightedBasis
bit = nonNegativeModulo(round(projection(block') / Δ), 2)
```

The maximum projection adjustment equals the configured step, at most 0.2. Source peak headroom prevents clipping under this bounded update. PCM16 rounding error is small relative to the QIM interval; round-trip tests exercise the serialized WAV, not just floating point buffers.

## Capacity and limitations

One note carries two encrypted bits. The bootstrap, encrypted control packet and both GCM tags are overhead. A long MIDI score can consume the available audio even when its message is short; the UI reports zero capacity rather than moving control information into metadata. Available plaintext bytes are `max(0, floor(availableNoteBlocks / 8) - 16)`. UTF-8 byte length, rather than JavaScript string length, controls the limit.

There is no error-correction code, redundancy, automatic pitch extraction, or defense against file edits. The editor’s RMS and peak levels are signal measurements, not perceptual audio-quality guarantees. This is a research implementation. The exact illustrative tags in the brief use a different header and are not expected to match this format.

## References

- [noktava. project brief](https://docs.google.com/document/d/1PDQVUpXmfDefXpSFndYF8YgIKCNy5UxySh5_5KZCpQ0/edit)
- [NIST SP 800-38D, GCM](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf)
- [MDN: AesGcmParams](https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams)
- [MDN: SubtleCrypto.encrypt](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt)
- [MDN: SubtleCrypto.decrypt](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/decrypt)

## Legacy timed-note v3 format

Earlier MIDI and edited-note exports used version 3. The 36-byte audio bootstrap retains the v2 fields except version is 3, byte 5 is zero, and there are no inline note pairs. BPM is an informational integer from 1 to 999. MIDI tempo changes are already reflected in the stored absolute sample times.

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
