# Noktava

An audio editor and encrypted-message application with Turkish and English interfaces. All audio processing, editing, encryption and decoding run locally in the browser. Visual styling follows the supplied [Dribbble reference](https://dribbble.com/shots/27899319-AI-Cybersecurity-website).

## Run locally

Requires Node.js 20.19+ or 22.12+.

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

Web Crypto requires localhost or HTTPS. The production files are generated in `dist/`.

## Deployment

Noktava is hosted on [Hostinger](https://devoted-darkseagreen-snake-20.hostingersite.com/). The deployment target is saved in `.hostinger/site.json`.

Build with `npm run build`, then deploy the contents of `dist/` to that site as a static website. Include the generated `.htaccess` so direct links and refreshes work on every page. Deployment is manual; GitHub auto-deployment is not configured.

## Brand and languages

The [Figma file](https://www.figma.com/design/CLb4yxWNUk33Qe5yxZ93BQ) contains the logo, brand palette and page layouts. The site uses orange and dark green, a revised wordmark, and a TR/EN switch on every page. Language changes preserve the current session; the preference persists across visits. See [brand notes](docs/design/brand.md).

## Pages

| URL | Page |
| --- | --- |
| `/` | Home |
| `/studio` | Audio studio |
| `/encode` | Message encryption |
| `/decode` | Message decoding and header inspection |
| `/guide` | Usage guide |

Each page has its own URL. Internal navigation and browser back/forward preserve the in-memory working audio. Refreshing or closing the page clears the session. The included `public/.htaccess` configures Hostinger's static hosting to serve `index.html` for application routes. Vite's development and preview servers already do this. The old `/#workspace` address opens `/studio`.

## Audio studio

- Cached peak/RMS overview and a separate detail waveform with labeled time/amplitude axes, cursor-anchored zoom down to individual samples, draggable selection edges and numeric region inputs. Files open with no active selection.
- A computed spectrogram using a 1024-point Hann-windowed FFT, with a 0–12 kHz frequency axis.
- Playback, seeking, selection playback, selection looping, playback speed and listening volume. Playback settings do not alter exported samples.
- Direct sample drawing with automatic close zoom, plus trim to selection, copy, cut, paste at cursor, duplicate, silence, reverse, linear fades, dB gain and normalization to -1 dBFS. Gain that would clip is rejected.
- Undo, redo, restore original, original waveform overlay and WAV export. The bounded history retains up to eight buffers within an approximate 64 MiB history budget, with at least one undo buffer for large files.
- MIDI import with track selection, tempo-map timing, note and octave preview, editable start times and durations, and optional repetition. No automatic audio-to-MIDI transcription.

The studio uses mono 48 kHz working audio and exports 16-bit PCM WAV. Stereo is averaged to mono; other sample rates are linearly resampled. This is not a mastering-quality resampler. MP3 is decoded with Web Audio in the browser. Imported MP3 and PCM16/24/32 or float32 WAV files must be no larger than 50 MiB and no longer than 10 minutes.

## Encryption

The default sender flow is upload MP3/WAV, write a message, choose notes or import MIDI, encrypt, then download the WAV and copy the generated key. Technical controls are collapsed under Advanced options. The separate sound studio is optional.

- AES-256-GCM using browser Web Crypto, fresh random 256-bit key, 96-bit IV and 128-bit tag.
- Note-adaptive or fixed quadratic patterns; selectable QIM strength from 0.02 to 0.20 and harmonic bands 2–6.
- A bounded embedding region, UTF-8 byte capacity, waveform comparison and encrypted WAV export.
- Hex key display, copying and direct transfer to the decoder for verification.

The public header is authenticated as GCM additional data. Timed notes and MIDI use NKTV v3 with authenticated note timing in a RIFF chunk. The existing repeating pattern uses v2. V1, v2 and v3 remain readable. See [protocol details](docs/protocol.md).

## Decoding

- Separate encrypted WAV input and Hex/Base64 key input.
- Keyless structural header inspection with explicit unverified status until GCM succeeds.
- Public note, tempo, strength and harmonic metadata; raw header/ciphertext hex; measured QIM decision margin.
- Manual header offset in samples for carriers with an added prefix. This cannot reconstruct deleted or re-encoded data and never bypasses authentication.
- Verified plaintext display, clipboard copy and TXT export.

## Limits

This is an experimental research implementation, not an audited messaging product. Audio changes can be audible; compression, trimming, normalization and other edits can destroy the embedded message. Whole-recording integrity is not authenticated: GCM covers the header and message, not every audio sample. QIM decision margin is a signal diagnostic, not proof of authenticity.

Only two bits are embedded per note, so message capacity is intentionally small. It depends on duration, tempo, note lengths, the selected interval and header overhead. The UI calculates the available UTF-8 bytes.

No server, account, analytics or third-party font requests are used. Keys and sessions are not saved. Export the WAV and store the key separately before leaving the browser.

## Validation

47 automated tests cover WAV round trips, wrong-key rejection, authenticated-header tampering, region bounds, PCM editing, FFT calibration, silent input, advanced settings, legacy v1 decoding, manual offset recovery key-format validation, MIDI tempo maps, track selection, timed-note round trips, overlapping notes, note-metadata tampering clipboard edits, waveform extrema/RMS, viewport precision and sample drawing. Browser checks include drawing changing exported PCM, byte-identical undo/redo, view preservation, both languages at 320 to 1440 pixels, selection handles, trimming, undo/redo, spectrogram rendering, cross-page state, advanced encoding, decoding, mobile navigation and responsive layouts.

## Implementation

React, TypeScript, Vite, Web Crypto, Web Workers, Canvas 2D and local fonts. No API credentials are required. Deployment publishes the built `dist/` directory; source code, tests and local session files are excluded.

The [project brief](https://docs.google.com/document/d/1PDQVUpXmfDefXpSFndYF8YgIKCNy5UxySh5_5KZCpQ0/edit) guided the mathematical method. The binary formats are specific to this application.
