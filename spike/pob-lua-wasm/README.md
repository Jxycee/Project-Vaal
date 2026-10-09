# PoB2 reference probe (Lua in WebAssembly)

Project Vaal keeps its own TypeScript defence engine (`src/lib/build/stats/`). This directory runs Path of Building 2's own
Lua (stock Lua 5.4 compiled to wasm via wasmoon) so engineers can ask "what does PoB compute for this build, and from which
modifiers?" where our engine has a gap. **Results are a REFERENCE: a hint of where to read PoB's source, never the answer.**

- `probe.mjs`: the CLI (this is the tool).
- `engine.mjs`, `probe.lua`: engine bootstrap and the Lua-side collector used by `probe.mjs`.
- `prelude.lua`, `lower-continue.mjs`: LuaJIT-dialect shims and rewrite, shared with the spike.
- `harness.mjs`, `compare.mjs`, `results-2026-10-08.txt`: the original accuracy spike (untouched). See
  `docs/superpowers/specs/2026-10-08-pob-lua-wasm-spike.md`.

## Setup on a fresh machine

The PoB clone and wasmoon live OUTSIDE the repo, in a scratch directory. Never `npm install` inside the repo for this.

```
# 1. pick the scratch dir (the default is the Claude session scratchpad: <...>/scratchpad/pobwasm)
export POBWASM_DIR=/some/dir/pobwasm        # optional; probe.mjs defaults to DEFAULT_SCRATCH in engine.mjs
mkdir -p "$POBWASM_DIR" && cd "$POBWASM_DIR"

# 2. PoB2 checkout, dev branch, exactly this folder name (older spike runs used "pob"; that name is also accepted)
git clone --depth 1 -b dev https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2.git PathOfBuilding-PoE2

# 3. wasmoon, installed next to it (engine.mjs resolves it from $POBWASM_DIR/node_modules)
npm init -y && npm i wasmoon
```

Default `POBWASM_DIR`:
`C:/Users/jayce/AppData/Local/Temp/claude/C--Dev-project-vaal/1a790016-19e4-4a1a-ba66-68045d354a26/scratchpad/pobwasm`
(that machine's checkout is still in the folder named `pob`, which the probe falls back to). Needs Node 20+ and about 400 MB
of RAM (+12 MB per extra build in one run). Cold start is about 3 s, then 0.3 to 1.8 s per build.

## Usage

```
node spike/pob-lua-wasm/probe.mjs <fixture.json|code.txt|build.xml>... [--stats A,B,*Pattern] [--pools Life,Evasion] [--out report.json]
```

- Inputs: an oracle fixture (`docs/superpowers/oracle/*.json`, uses its `pob` field), a file holding a raw PoB code, or PoB
  XML. Several inputs reuse one engine. A build that fails to load prints the Lua/JS error and the run continues.
- `--stats`: PoB output-table names, exact match (case-insensitive) or glob with `*` (`*MaximumHitTaken`). Default is life, mana,
  ES, armour, evasion, spirit, attributes, four resistances. NaN/inf values (for example CI `ChaosMaximumHitTaken`) are omitted.
- `--pools`: modDB names to break down (default `Life,Evasion`).
- `--out`: full JSON report (same data as the text, plus PoB's `configPlaceholder`).

What it prints per build:

1. Requested stats, plus always the derived/intermediate ones: `TotalEHP`, `TotalNumberOfHits`, `*MaximumHitTaken`, enemy damage
   per type, `EvadeChance`/`DeflectChance`, `Ward`, life/mana/ES regen and recharge, `MovementSpeedMod`, resist totals and overcap.
2. Enemy assumptions: level, `EnemyAccuracy` (`round(calcLib.val(enemyDB, "Accuracy"))`), the monster tables at that level, boss
   preset, per-type configured vs placeholder damage, and PoB's own max-hit/evade breakdown text.
3. Per pool: base sum, increased sum, more product, each mod with its SOURCE label (`Item:<slot>:<name>`, `Tree:<id> <node name>`,
   `Quest:...`, `Skill:...`, `Base`) and tags (`Condition:`, `Multiplier:`, `PerStat:`), plus PoB's per-slot gear base breakdown
   (`breakdown.<Stat>.slots`). Gear base defences (item armour/evasion/ES) are NOT modDB mods, so they appear only in the slot lines.
4. The Config inputs PoB parsed from the XML, the conditions set on the player modDB (moving, charges, ...), non-zero multipliers,
   and conditions on the enemy.

PoB APIs used (all in the PoB2 source, `src/`): `build.calcsTab.mainOutput` (output table), `mainEnv.player.modDB`/`enemyDB`
(`ModStore:Tabulate`, `Classes/ModStore.lua`, which evaluates tags the way PoB does), `calcLib.val`, `build.calcsTab.calcsEnv.player.breakdown`
(only the "CALCS" pass fills it), `env.configInput`/`configPlaceholder` (`Modules/CalcSetup.lua`), `data.monster*Table`
and `data.misc` (`Modules/Data.lua`). Enemy damage logic: `Modules/CalcDefence.lua` around `EnemyDamage` and `MaximumHitTaken`.

## Examples

```
node spike/pob-lua-wasm/probe.mjs docs/superpowers/oracle/ordinary-deadeye.json --pools Life,Evasion
node spike/pob-lua-wasm/probe.mjs docs/superpowers/oracle/ordinary-ci-disciple.json docs/superpowers/oracle/armour-life-gemling.json --stats TotalEHP,Life,*MaximumHitTaken --pools EnergyShield --out report.json
node spike/pob-lua-wasm/probe.mjs mycode.txt --stats Spirit,MovementSpeedMod --pools Spirit
```

## Caveats

- PoB2 is not stock Lua. Its Lua dialect (`+=`, `?.`, lambdas, `continue`) and LuaJIT/5.1 behaviours are patched by regex at mount
  time (`engine.mjs` `lowerSyntax`, `prelude.lua`). The regexes are brittle, and 5.4 differs from LuaJIT in ways we cannot fully
  rule out (for example `100.0` versus `100` in text coercion). No PoB file is modified on disk.
- Version drift: poe.ninja's exported XML came from some PoB build, not this checkout (`dev` of 2026-07-28 in the spike). Expect
  small differences; the spike measured 87% exact agreement with the PlayerStat lines inside the exports.
- Chaos Inoculation: PoB computes chaos resistance as 7 to 25 for CI builds where the game (and poe.ninja, and our engine) shows
  100. Do not use PoB for that stat.
- PoB is not the live game. Our engine already beats PoB against poe.ninja on resistances and some uniques. Use the probe to find
  which PoB source file/line to read, then implement in our engine from the rule, not by copying the number.
- Memory grows about 12 MB per build in one process; probe a handful of builds per run.
- PoB prints `Image ... not found` noise while loading; the probe swallows it.
