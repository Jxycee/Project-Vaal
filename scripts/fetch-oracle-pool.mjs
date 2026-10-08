// Downloads a pool of public poe.ninja characters (Forbidden Rites by default, any league via pairsFile) into a
// scratch directory, so the best oracle candidates can be ranked by how well our engine already matches them.
//
// Run: node scripts/fetch-oracle-pool.mjs <outDir> [pairsFile]
// pairsFile: one "<overview> <account>/<name>" per line (overview = forbidden-rites | runes-of-aldur); default is PAIRS below.
// A character already saved in outDir is skipped, and a 429 is retried with a growing wait, so a re-run resumes a pool; a long Retry-After stops the run instead of hammering.
// The data version comes from https://poe.ninja/poe2/api/data/index-state; the character list comes from
// the builds page, which is rendered client-side, so the (account, name) pairs are given below (copied from
// the page's links on 2026-10-08).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const VERSION = '0223-20261008-34370';
const LEAGUE = 'forbidden-rites';
const PAIRS = `
heygyus-0416/ResurrectResurrected
dota2enjoyer-1809/KingPinUwU_Youtube
perceptionofreality-7468/BABYROSHANCOM
Aengus-2685/amAengus
Olsen1-5361/LetsGetDoryaniTonight
sky5602-5664/%EB%B0%94_%EB%9D%BC_%EC%8B%9C%ED%83%80
morloxIC-1573/morlox_v_v
aerowalk1337-5368/PigGrunt
Shaelmao-0831/Rakurimosa
hagarfloss-9464/DayLaConMot
Whiteyang123456-2065/%E7%9C%8B%E7%9C%8B%E6%88%91%E7%9A%84%E7%89%9B%E5%8F%AA
Nijtyak-5658/sok_dobrii
peerbaza-5894/pebzgemling
KingFud-1121/KingFud_Djinn_FR
HoangLong1101-3050/DOANXIEMm
lionheart832-6022/EightChallengeOneRegret
ADDii-3319/AddiDeadeyeiRemastered
CaptainDance9-3222/%EC%97%90%EC%8A%A4%ED%8C%8C
qianqi77-5717/JokerBD
l3il2DDy-5168/anotherbird
a136681423-9651/%E4%B9%9D%E7%90%83%E5%A4%A9%E5%90%8E%E8%8E%89%E8%8E%89%E4%B8%9D
1605981374-6725/%E5%85%A8%E9%83%A8%E6%AF%81%E7%81%AD%E5%8F%AD
Devotika-3542/BananaProjectiles
brazwv-1435/ArkkFR
fishoppa-1492/lullabyTurnBackTime
Tomikpomik-4685/forbidden_vivod
Pocky18BaTH-3565/IPY_myscreen
cclemon-4830/wednesdeey
zclzcl881204-7657/GhostGod
WOSHICHINESE-3392/Arites
WOualey-0844/BowberKurw%C3%A0
`
  .trim()
  .split('\n');

const out = process.argv[2];
if (!out) throw new Error('usage: node scripts/fetch-oracle-pool.mjs <outDir> [pairsFile]');
// Optional pairsFile: one "<overview> <account>/<name>" per line (overview = forbidden-rites | runes-of-aldur), so a pool
// for other leagues or classes needs no edit here. Without it the PAIRS list above is fetched from LEAGUE.
const fromFile = process.argv[3]
  ? readFileSync(process.argv[3], 'utf8').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => l.split(' '))
  : PAIRS.map((p) => [LEAGUE, p]);
mkdirSync(out, { recursive: true });
let n = 0;
for (const [overview, pair] of fromFile) {
  const [account, name] = pair.split('/');
  const url = `https://poe.ninja/poe2/api/builds/${VERSION}/character?account=${account}&name=${name}&overview=${overview}&timeMachine=`;
  const file = `${out}/${account}__${decodeURIComponent(name).replace(/[^A-Za-z0-9_-]/g, '_')}.json`;
  if (existsSync(file)) continue; // re-runs resume after a rate limit
  let res;
  for (let attempt = 0; attempt < 3; attempt++) {
    await new Promise((r) => setTimeout(r, 2000)); // poe.ninja answers 429 to a fast burst
    res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
    if (res.status !== 429) break;
    // The limit lasts ~30 minutes (Retry-After); hammering extends it, so wait it out once, then give up on the rest.
    const wait = Number(res.headers.get('retry-after') ?? 60);
    if (wait > 900) {
      console.log('rate limited for', wait, 's: stop here and re-run later (saved characters are skipped)');
      process.exit(2);
    }
    await new Promise((r) => setTimeout(r, (wait + 5) * 1000));
  }
  if (!res.ok) {
    console.log('skip', pair, res.status);
    continue;
  }
  const j = await res.json();
  writeFileSync(
    `${out}/${account}__${decodeURIComponent(name).replace(/[^A-Za-z0-9_-]/g, '_')}.json`,
    JSON.stringify({
      source: `https://poe.ninja/poe2/builds/${overview.replace(/-/g, "")}/character/${account}/${name}`,
      fetchedAt: new Date().toISOString(),
      class: j.class,
      level: j.level,
      useSecondWeaponSet: Boolean(j.useSecondWeaponSet),
      pob: j.pathOfBuildingExport,
      defensiveStats: j.defensiveStats,
      breakdowns: j.breakdowns,
      skills: (j.skills ?? []).map((s) => ({ name: s.allGems?.[0]?.name ?? null, dps: (s.dps ?? []).map((d) => ({ name: d.name, dps: d.dps, dotDps: d.dotDps })) })),
    }),
  );
  n++;
}
console.log('saved', n, 'to', out);
