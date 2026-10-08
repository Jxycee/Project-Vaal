# DPS engine: scoping (2026-10-08)

Question (board item 27): should Project Vaal compute a DPS number the way poe.ninja, pobb.in and Maxroll do?

## What I measured

- **Our skill data has no damage model.** Of 496 non-support gems in `public/data/wiki/2026-08-25/skills/`, 290 carry any per-level stat lines, only 111 mention "Damage" at all, and of the 220 Attack-tagged gems only **2** state a base damage figure. Lightning Arrow's level table has empty stat lists at every level. There is no per-level damage multiplier, no damage effectiveness, no base hit.
- **Weapon base damage is present** on items, but a skill hit also needs the skill's own multiplier, attack time, crit, conversion and extra-damage mods, and the support multipliers.
- **The oracle exists.** poe.ninja's character JSON gives per-skill `dps` and `dotDps` plus the mod breakdown PoB used (`skills[].dps[].offensive`), e.g. the Deadeye fixture: Twister 199,761, Whirling Slash 13,463. Saved under `docs/superpowers/oracle/*.json`, so any engine can be scored against PoB2 on four builds.
- **Our defence engine agrees with PoB2 on 0 to 4 of 13 stats on these four public builds** (9 of 12 on momentsZX), mostly because item mods we cannot read yet (17 "Effect of Prefixes" jewel lines, charm slots, enchantments, RELIC rarity). Offence reads the same mod pool and would inherit every one of those gaps, then add its own.

## Recommendation

Do not build a DPS calculator now. A wrong DPS number is worse than none (players gear against it). The honest order:

1. Raise item/mod coverage first (it lifts defence accuracy too). Top gaps from the four oracle builds are listed in `results.json` and the board.
2. Then extract the missing skill data from Path of Building 2's MIT source (`Data/Skills/*.lua`: per-level `baseMultiplier`, `damageEffectiveness`, attack/cast time), the same way `scripts/sync-pob-gem-ids.ts` already pulls gem ids.
3. Only then build offence, scored against the oracle fixtures, and show DPS only for a build where the number is within a stated tolerance of PoB2's.

## Cheaper parity step (needs your call)

For builds imported from a poe.ninja link, show poe.ninja's own DPS as a labelled, sourced figure ("from poe.ninja") next to the planner. Cheap, accurate, and honest about where it came from, but it goes stale and only exists for imported public characters.
