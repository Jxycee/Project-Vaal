# Spike: run Path of Building 2's Lua engine inside our JS stack (wasmoon)

Date 2026-10-08. Branch `spike/pob-lua-wasm`. Harness: `spike/pob-lua-wasm/`. PoB2 checkout: `dev` at bb52d6b368 (PoB 0.23.1, 2026-07-28), MIT.

## Verdict: feasible with caveats

PoB2's own calculation engine boots and computes a full build from its XML inside Node via wasmoon (Lua 5.4 compiled to WebAssembly). All 27 oracle builds with a PoB code loaded and calculated. Core defence and attribute stats match the PlayerStat lines inside the same XML exactly. The caveats are real: PoB2 is not stock-Lua-compatible (it needs a source rewrite step), the output differs from the poe.ninja-exported XML on a minority of derived stats for reasons not yet isolated, and the runtime is heavy (about 3 s cold start, about 385 MB RSS).

## What worked

1. Clone: 1,135 Lua files. `src/` 415 MB, but 366 PNG and 173 zst files are art. Lua only is 41.9 MB over 1,071 files, 48.6 MB with the few txt/json files and `runtime/lua` (dkjson, base64, sha). `src/Data` 53 MB (32 MB is Skills), `src/TreeData` 353 MB (all but ~12 MB of Lua is textures; five tree versions, latest `0_5/tree.lua` 2.8 MB). `runtime/` is 29 MB of Windows DLLs we do not need. Gzipped, everything PoB needs to calculate is 6.2 MB.
2. `HeadlessWrapper.lua` (PoB's own entry point, used by its CI via busted on LuaJIT) stubs the whole SimpleGraphic API in `_SimpleGraphic.def.lua`: drawing, images, file search, `Inflate`/`Deflate` (return empty strings), `GetTime` (returns 0), `LaunchSubScript` (no-op). It exposes `loadBuildFromXML(xml, name)`; the result is `build.calcsTab.mainOutput`. We used it unmodified apart from a first-line fix (below).
3. Harness (`harness.mjs`): mounts the Lua files into wasmoon's in-memory FS (src at `/`, `runtime/lua` at `/rt`), runs `prelude.lua` (shims) then the wrapper, then for each fixture decodes `pob` (base64url, zlib) to XML, calls `loadBuildFromXML`, forces a recalc frame, dumps every numeric field of `mainOutput` as JSON.
4. `compare.mjs` scores against (a) the PlayerStat lines in the XML, (b) poe.ninja `defensiveStats`, (c) our engine's `results.json`.

## Blockers and fixes (in the order hit)

PoB2 source is not stock Lua and not plain LuaJIT either. It is written in a Lua dialect with extensions that stock Lua 5.4 rejects. Every one was fixed with a text rewrite at mount time (`harness.mjs` `lowerSyntax` plus `lower-continue.mjs`); no PoB file is modified on disk.

| # | Failure | Cause | Fix |
|---|---|---|---|
| 1 | `unexpected symbol near '#'` | HeadlessWrapper line 1 is `#@` | blank the line |
| 2 | `syntax error near '+'` (Main.lua:340) | compound assignment `x += 1`, `s ..= "a"` (13 sites, 9 files) | regex rewrite to `x = x + (1)`; plus an inline form (`then depth += 1 elseif`) |
| 3 | `unexpected symbol near '?'` | optional chaining `a?.b`, `a?.[k]` (ModParser, GemTooltip) | rewrite to `(a and a.b)` |
| 4 | `unexpected symbol near '|'` | lambda `\|_, key\| -> expr` (one site, CalcOffence:5191) | rewrite to `function(_, key) return expr end` |
| 5 | `syntax error near 'end'` | `continue` statement (Item.lua x3, BuildExportPoE2) | token-aware lowering to `goto`, label inserted before the loop's `end` (existing `goto continue` labels left alone) |
| 6 | `global 'arg' nil` | wrapper environment | `arg = {}` in prelude |
| 7 | `m_atan2` nil (PassiveTree) | LuaJIT/5.1 `math.atan2` | shim, plus `cosh/sinh/tanh/ldexp/pow/mod/log10` |
| 8 | `bad argument to 'format' (number has no integer representation)` | 5.1 truncates `%d` args, 5.4 errors | wrapper around `string.format` that truncates for `%d/%i/%u/%c/%x/%o` |
| 9 | `attempt to concatenate a nil value (field 'cappedBuffer')` | `string.len(100.0)` is 5 in Lua 5.4 ("100.0"), 3 in LuaJIT ("100") | override `tostring` and `string.len` for floats |
| - | other 5.1 names | `unpack`, `loadstring`, `table.getn/maxn`, `setfenv/getfenv`, `bit.*`, `jit`, `lua-utf8` | one-line shims; `bit` rebuilt on 5.4 integer operators with 32-bit signed wrap; `lua-utf8` replaced by an ASCII-level stand-in (only used for number formatting); `lcurl.safe` already stubbed by the wrapper |

Not fixable from Lua and left as a known divergence: implicit number to string coercion in `..` still renders integral floats as `100.0`. It only affects text (breakdown strings, tooltips), not computed numbers, but it is the type of 5.1 versus 5.4 difference that can silently change output. `string.format("%d")`, `math.floor` result type, `//` and integer division, and `#` on tables with holes also differ between LuaJIT and 5.4 in principle. We found no numeric symptom, but we cannot prove their absence (no reference LuaJIT run was possible here: no compiler, no Docker).

Also observed:
- `Export/` and `Assets/` are not mounted (not needed); every missing PNG logs a "not found" line (harmless).
- `loadfile` over all 1,000 files in one engine crashed wasm with "memory access out of bounds" on a file that loads fine alone. Not seen in normal runs; cause unknown (suspect wasmoon allocation behaviour). A real integration should watch for this.
- One build (ordinary-life-1) logged `Failed to process skill: Spear Throw`; cause not investigated.
- The oracle XMLs were produced by poe.ninja's exporter, not by this PoB checkout, so they are not a perfect reference (see accuracy).

## Accuracy

28 fixtures in `docs/superpowers/oracle/`; 27 carry a PoB code and all 27 ran. Full per-build table: `spike/pob-lua-wasm/results-2026-10-08.txt`.

Against the PlayerStat lines PoB wrote into each XML (the closest thing to ground truth for "what PoB computes"), relative tolerance 1e-6: **2,455 of 2,822 stats match (87.0%)**. By stat family (builds matched of 27):

| Stat | match | Stat | match |
|---|---|---|---|
| EnergyShield | 27 | HitChance | 27 |
| Armour | 27 | Speed | 25 |
| Evasion | 27 | CritMultiplier | 26 |
| Str / Dex / Int | 27 each | LifeRegenRecovery | 26 |
| Life | 25 | ManaRegenRecovery | 23 |
| Spirit | 25 | ManaCost | 19 |
| Mana | 24 | CritChance | 11 / 21 |
| TotalEHP | 11 | TotalDPS | 9 |
| Phys/Fire max hit taken | 13 | CombinedDPS | 8 / 26 |

Against poe.ninja `defensiveStats` (13 stats per build: life, mana, ES, armour, evasion, spirit, three attributes, four resistances; rounded equality): **PoB-in-wasm 330 of 351; our engine 343 of 351**. The 21 PoB misses are mostly small (life 7806 vs 7904, mana +1-2%, spirit 181 vs 203) plus chaos resistance on Chaos Inoculation builds, where poe.ninja shows 100 and PoB (both wasm and the exporter's own PlayerStat) computes 7 to 25. Our engine already matches ninja there, so on that stat PoB is the less accurate one against the live game.

What the mismatches are is not settled. Hypotheses, in descending likelihood: (1) the XMLs were exported by a different PoB build than dev head (rounded `CritChance 58.752` versus `58.75`, `ManaCost 246.93` versus `247`, `Spec:ArmourInc` -7 versus 0 look like data or version drift, not arithmetic); (2) Lua 5.4 versus LuaJIT semantics we have not found; (3) our lowering regexes mangled some construct. Separating (1) from (2) needs a reference run of the same checkout on real LuaJIT, which was not possible here. Treat 87% as a lower bound on fidelity of the port and an upper bound on drift.

Also note PoB is not an oracle for the live game either: our hand-written engine beats it on poe.ninja numbers (343 versus 330 of 351), because ninja applies in-game truth PoB lacks (CI chaos resistance) and a few unique and rune lines.

## Measurements (this machine, Node 26, wasmoon 1.16)

| What | Value |
|---|---|
| Files mounted | 1,015 files, 48.6 MB (after dialect rewrite) |
| Mount into wasm FS | about 0.8 s |
| PoB init (`OnInit`, data, tree, mod parsing, first frame) | about 2.2 to 2.4 s |
| **Cold start total** | **about 3.0 to 3.2 s** |
| Load + calc one build | 0.3 to 1.9 s (median about 0.6 s); an extra recalc 0.1 to 1.4 s |
| Peak RSS, init + one build | 385 MB (380 MB after init; includes about 40 MB Node) |
| RSS after 27 builds in one process | 715 MB (about +12 MB per build; PoB caches per build; needs periodic engine reset) |
| JS heap | about 10 MB (all the weight is wasm linear memory) |
| What ships | 6.2 MB gzipped / 48.6 MB raw of Lua + 270 KB wasm + wasmoon 150 KB |

Vercel: size is no problem (50 MB against 250 MB unzipped). Memory fits the default 1 GB (2 GB gives headroom for the leak). The cost is cold start (about 3 s on this machine, likely 4 to 6 s on a cold serverless CPU) paid on every cold instance, with no way to keep PoB warm across invocations except Fluid compute / instance reuse. It could run in a serverless function if latency of the first request after idle (5 to 8 s including the build) is acceptable behind a cache; it fits a long-lived worker (a single Node process on Fly or Railway holding one warm engine and a queue) much better. Next.js file tracing has to be told to include the Lua tree (`outputFileTracingIncludes`), and wasmoon needs its wasm file resolvable at runtime.

## Integration sketch

- Code: `src/lib/pob-engine/` with `lower.ts` (the dialect rewrite, run at build time, not per request, writing a prebuilt `pob-lowered.tar.gz` or a directory of lowered files), `prelude.lua`, `engine.ts` (singleton wasmoon engine, `calcBuild(xml): Promise<Record<string, number>>`).
- Call path: a server action or route handler `calcBuild(pobCode)` decodes with the existing `src/lib/pob/decode.ts`, hashes the XML (sha256), looks up a `build_stats` cache row (key: xml hash + PoB commit sha), otherwise runs the engine and writes the row. Computation happens at import/save time, never on a page view.
- Import/save path: on import, call the engine once and store the output next to the build (JSONB, about 700 numeric keys; keep the 50 we show). Reader pages read the stored JSON. If PoB version changes, bump the cache key and lazily recompute.
- Unique items and anything the importer synthesises must still be expressed in PoB item text; this is a build-to-XML problem we already solve for PoB export.
- Run in a worker process rather than in the Next.js request path: one engine per process, recreate it every N builds to cap memory.

## Licence

PathOfBuilding-PoE2 is MIT. We would redistribute (modified) copies of its Lua and data, so the MIT notice and copyright line must ship in the repo and in the deployed bundle (a `THIRD_PARTY_NOTICES` entry and the PoB `LICENSE.md`). The game data inside PoB's `Data/` and `TreeData/` is derived from GGG exports; we would use no art (only Lua and tables), so the existing GGG-art rule is not engaged, but the data licence question should be asked once with the maintainers.

## Maintenance cost

Real. PoB2 is pre-1.0 and changes weekly; the dialect keeps growing (this spike hit five extensions in a 1,000-file codebase, and each PoB commit can add more). Per game patch: pull the new PoB tag, rerun the lowering, rerun the 27-build oracle, triage new mismatches. The regex lowering is brittle (it rewrote `?.` and `+=` textually, including possibly inside strings); the durable fix is to compile PoB with a real Pluto/LuaJIT-with-extensions toolchain to wasm, or to use a proper parser (for example Pluto's own transpiler, if one exists) instead of regex. Estimate: one to two days of work per PoB bump until the lowering is a real parser, then hours.

## Recommendation

Do not replace the hand-written engine with this now. Treat PoB-in-wasm as a validation oracle and a possible later "exact mode" for DPS, which is the one area (TotalDPS match 9 of 27, and DPS is by far the hardest part to reimplement) where it clearly has more to offer than our engine; our defensive numbers already beat PoB against poe.ninja (343 versus 330 of 351).

What a follow-up must do, in order:
1. Establish the reference: run the exact same checkout on real LuaJIT (CI container, or a WSL build) over the 27 builds, so mismatches split cleanly into port bugs versus data drift. If the port reproduces LuaJIT exactly, the 87% is purely exporter-version drift and fidelity is effectively 100%.
2. Replace regex lowering with a parser-based transform, and add a check that fails the build when an unknown dialect construct appears.
3. Pin the oracle fixtures to a known PoB commit (re-export XMLs from this checkout, not poe.ninja) so the oracle can be exact rather than approximate.
4. Prove DPS: pick 5 attack and 5 spell builds, compare TotalDPS and CombinedDPS against a LuaJIT run, and against what we display.
5. Decide the host (worker versus serverless) with a measured cold start on Vercel, and add engine recycling and an error budget (`Failed to process skill` on one build and the unexplained wasm out-of-bounds in bulk `loadfile`).
6. Only then wire it into import/save behind a feature flag, keeping our engine as the fallback and the source of the in-game-truth rules PoB lacks (CI chaos resistance and similar).

## Reproduce

```
# scratch dir outside the repo
npm init -y && npm i wasmoon
git clone --depth 1 -b dev https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2.git pob
POB_SCRATCH=<scratch dir> OUT=out.json node spike/pob-lua-wasm/harness.mjs <scratch>/pob docs/superpowers/oracle/ordinary-*.json
node spike/pob-lua-wasm/compare.mjs out.json docs/superpowers/oracle
```
