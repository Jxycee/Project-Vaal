// Throwaway spike (Slice 0, Task 4). Replaced by a tested module in Slice 2.
// Decodes a real PoB2 share code and answers the three questions the import
// design depends on. Run: npx tsx scripts/spike-decode-pob.ts
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const raw = readFileSync('src/lib/pob/__fixtures__/sample-pob2-code.txt', 'utf8').trim();
const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
const xml = inflateSync(Buffer.from(b64, 'base64')).toString('utf8');
process.stdout.write(xml);
