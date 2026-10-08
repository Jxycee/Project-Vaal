// Pulls real public characters from poe.ninja's JSON API into docs/superpowers/oracle/*.json.
// Each fixture keeps: the PoB2 code poe.ninja exports for the character, the stats poe.ninja shows
// (a Path of Building simulation of that character, NOT the raw in-game sheet), which weapon set is
// active, and per-skill DPS. Items and the rest of the payload are dropped.
//
// Run: node scripts/fetch-oracle-builds.mjs   (network; rewrites the fixtures)
// The data version below is poe.ninja's current index for the league; update it from
// https://poe.ninja/poe2/api/data/index-state if the API answers 404.
import { mkdirSync, writeFileSync } from 'node:fs';

const VERSION = '0223-20261008-34370';
const LEAGUE = 'forbidden-rites';
const CHARACTERS = [
  { slug: 'armour-life-gemling', account: 'flyinghigh42-0275', name: 'StickyOildUp' },
  { slug: 'es-life-stormweaver', account: 'nameking-0380', name: '%E5%97%B6%E5%93%A9%E4%BD%90%E5%BE%B7%E5%B0%8F%E6%B1%BD%E8%BB%8A' },
  { slug: 'evasion-deadeye', account: 'olleyDE-4339', name: 'chillamaggiTTVsGlatze' },
  { slug: 'hybrid-tactician', account: 'pjf5845203344-2325', name: '%E5%A4%A9%E7%A9%BA%E6%87%92%E7%8B%BC%E8%93%9D' },
];

mkdirSync('docs/superpowers/oracle', { recursive: true });
for (const c of CHARACTERS) {
  const url = `https://poe.ninja/poe2/api/builds/${VERSION}/character?account=${c.account}&name=${c.name}&overview=${LEAGUE}&timeMachine=`;
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  const j = await res.json();
  const fixture = {
    source: `https://poe.ninja/poe2/builds/${LEAGUE.replace('-', '')}/character/${c.account}/${c.name}`,
    fetchedAt: new Date().toISOString(),
    class: j.class,
    level: j.level,
    useSecondWeaponSet: Boolean(j.useSecondWeaponSet),
    pob: j.pathOfBuildingExport,
    defensiveStats: j.defensiveStats,
    skills: (j.skills ?? []).map((s) => ({
      name: s.allGems?.[0]?.name ?? null,
      dps: (s.dps ?? []).map((d) => ({ name: d.name, dps: d.dps, dotDps: d.dotDps })),
    })),
  };
  writeFileSync(`docs/superpowers/oracle/${c.slug}.json`, JSON.stringify(fixture));
  console.log(c.slug, j.class, j.level, fixture.pob.length);
}
