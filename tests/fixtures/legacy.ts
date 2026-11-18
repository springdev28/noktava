import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

type Fixture = { version: number; filename: string; key: string; message: string }
// These are public, synthetic test keys. Fixtures were produced before v4 existed.
const fixtures: Fixture[] = JSON.parse(readFileSync(new URL('./legacy.json', import.meta.url), 'utf8'))
export function legacyFixture(version: number) {
  const fixture = fixtures.find(item => item.version === version)!
  const bytes = gunzipSync(readFileSync(new URL(fixture.filename, import.meta.url)))
  return { ...fixture, wav: Uint8Array.from(bytes).buffer }
}
