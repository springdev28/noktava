# noktava. brand and interface

[Figma design file](https://www.figma.com/design/CLb4yxWNUk33Qe5yxZ93BQ)

The file includes the editable logo, brand board, Turkish and English desktop layouts, and an English mobile layout. The orange mark was created with Figma's vector generation tool and exported as editable SVG. The wordmark uses Space Grotesk and stays on one line with a fixed gap from the mark.

The brand name and wordmark are `noktava.`, including the trailing period. Message encryption and decoding are the primary actions; the sound studio is an optional advanced tool.

## Palette

| Role | Color |
| --- | --- |
| Background | `#091411` |
| Panel | `#111E19` |
| Main text | `#F3F0E5` |
| Secondary text | `#A1AFA6` |
| Brand and actions | `#FF854A` |
| Audio signal | `#78D9B5` |

Space Grotesk is used for the wordmark and headings. Manrope is used for controls and body text. Both fonts are served from the site.

The homepage uses expressive, sound-related copy. Application pages retain literal names: Ses stüdyosu / Sound studio, Mesaj şifrele / Encrypt message, and Mesaj çöz / Decode message. Do not add em dashes or middle-dot separators to the interface.

## Languages

The TR/EN switch is present on the homepage and every application page. Initial language follows the browser unless a saved preference exists. Only the language preference is stored locally. Switching languages preserves audio, edits, selections, messages and keys. Note names use solfège in Turkish and letter names in English. Error messages and the guide are translated too.

Primary assets: `public/brand/noktava-mark.svg`, `public/favicon.svg`, and `src/components/Brand.tsx`. Shared styling: `src/brand.css`. Copy and language behavior: `src/lib/i18n.tsx` and `src/lib/translations.ts`.
