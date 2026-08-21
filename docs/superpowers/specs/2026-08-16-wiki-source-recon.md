# Wiki Source Recon — `@poe2-toolkit` extractors

**Superseded target:** this recon replaces the original plan's Task 0 (poe2wiki.net MediaWiki/Cargo recon), obsoleted when D1–D5 resolution moved the data source to `@poe2-toolkit`. See `docs/superpowers/specs/2026-08-16-wiki-design.md` for why.

Method: installed the real packages (`--no-save`, in `.claude/worktrees/feature+wiki-m1`) and read their shipped `.d.ts` files directly — not README summaries. Packages confirmed at npm, all published at `1.0.0`:

- `@poe2-toolkit/ggpk@1.0.0`
- `@poe2-toolkit/item-extractor@1.0.0`
- `@poe2-toolkit/gem-extractor@1.0.0`
- `@poe2-toolkit/mod-extractor@1.0.0`

## Acquisition layer: `createCdnSource`

```ts
import { createCdnSource } from '@poe2-toolkit/ggpk';

const source = await createCdnSource({
  patch: '4.5.4.10',        // concrete version string, e.g. "4.5.3.1.7" shape
  cacheDir: './.cache',      // downloaded bundles cached here, <patch>/ subdir
  tablesDir: './tables/English', // pre-decoded pathofexile-dat table JSON — see below
});
```

No auth, no Steam/game install. Network access is to GGG's own patch CDN, deferred until the first file/sprite request; table reads only touch the local `tablesDir`.

**`tablesDir` is not produced by `@poe2-toolkit/ggpk` itself.** It must be pre-decoded by the separate `pathofexile-dat` package (CLI or library), driven by a `config.json` listing exact table names and columns. This is a real two-stage pipeline:

1. `pathofexile-dat` decodes specific tables from the patch CDN into `<tablesDir>/<TableName>.json` (per a `config.json` you author).
2. `@poe2-toolkit/*-extractor` packages join those decoded tables into flat, typed output.

Confirmed CI-safe: no Steam install, network-only, both stages.

## `config.json` for `pathofexile-dat` — verified working

Pulled verbatim from `poe2-toolkit`'s own `scripts/golden-fixtures/config.json` (the config the toolkit's authors use to test their own extractors against real data — this is the authoritative, version-matched table/column list, not a guess):

```json
{
  "patch": "4.5.4.10",
  "translations": ["English"],
  "files": [],
  "tables": [
    { "name": "BaseItemTypes", "columns": ["Id", "Name", "ItemClass", "Tags", "ItemVisualIdentity", "DropLevel", "ModDomain", "IsCorrupted", "Implicit_Mods", "FlavourText"] },
    { "name": "ItemClasses", "columns": ["Id", "Name", "ItemClassCategory"] },
    { "name": "ItemVisualIdentity", "columns": ["Id", "DDSFile", "AOFile"] },
    { "name": "UniqueStashLayout", "columns": ["WordsKey", "ItemVisualIdentityKey", "UniqueStashTypesKey"] },
    { "name": "Words", "columns": ["Text"] },
    { "name": "UniqueStashTypes", "columns": ["Id"] },
    { "name": "FlavourText", "columns": ["Id", "Text"] },
    { "name": "AttributeRequirements", "columns": ["BaseItemType", "ReqStr", "ReqDex", "ReqInt"] },
    { "name": "ArmourTypes", "columns": ["BaseItemType", "Armour", "Evasion", "EnergyShield", "Ward"] },
    { "name": "ShieldTypes", "columns": ["BaseItemType", "Block"] },
    { "name": "WeaponTypes", "columns": ["BaseItemType", "CritChance", "Speed", "DamageMin", "DamageMax", "RangeMax", "ReloadTime"] },
    { "name": "ItemSpirit", "columns": ["BaseItemType", "SpiritGranted"] },
    { "name": "Tags", "columns": ["Id", "DisplayString"] },
    { "name": "Stats", "columns": ["Id"] },
    { "name": "Mods", "columns": ["Id", "Name", "Level", "Domain", "GenerationType", "ModType", "Families", "SpawnWeight_Tags", "SpawnWeight_Values", "Stat1", "Stat2", "Stat3", "Stat4", "Stat5", "Stat6", "Stat1Value", "Stat2Value", "Stat3Value", "Stat4Value", "Stat5Value", "Stat6Value", "IsEssenceOnlyModifier", "CraftingItemClassRestrictions"] },
    { "name": "ModType", "columns": ["Name"] },
    { "name": "ModFamily", "columns": ["Id"] },
    { "name": "SkillGems", "columns": ["BaseItemType", "StrengthRequirementPercent", "DexterityRequirementPercent", "IntelligenceRequirementPercent", "GemType", "GemColour", "MinLevelReq", "GemEffects", "UI_Image", "Tier", "BaseSkillGem"] },
    { "name": "ActiveSkills", "columns": ["Id", "DisplayedName", "Description", "ShortDescription", "Icon_DDSFile", "GrantedEffect", "ActiveSkillTypes", "WebsiteDescription"] },
    { "name": "GrantedEffects", "columns": ["Id", "ActiveSkill", "IsSupport", "SupportGemLetter", "StatSet", "CastTime", "AllowedActiveSkillTypes"] },
    { "name": "GrantedEffectsPerLevel", "columns": ["GrantedEffect", "Level", "ActorLevel", "CostAmounts", "CostMultiplier", "AttackTime", "Cooldown", "Reservation", "EffectOnPlayer"] },
    { "name": "SupportGems", "columns": ["SkillGem", "Icon", "Family", "FlavourText", "VisualIdentity", "IsLineage"] },
    { "name": "GemEffects", "columns": ["Id", "Name", "GrantedEffect", "SupportText", "SupportName", "GemTags", "ItemColor", "AdditionalGrantedEffects"] },
    { "name": "GemTags", "columns": ["Id", "Name"] },
    { "name": "GrantedEffectStatSets", "columns": ["Id", "ConstantStats", "ConstantStatsValues"] },
    { "name": "GrantedEffectStatSetsPerLevel", "columns": ["StatSet", "GemLevel", "SpellCritChance", "AttackCritChance", "BaseResolvedValues", "AdditionalStatsValues", "FloatStats", "AdditionalStats"] },
    { "name": "GrantedEffectQualityStats", "columns": ["GrantedEffect", "Stats", "StatsValuesPermille", "AltStats", "AltStatValuesPermille"] }
  ]
}
```

(Trimmed to items/gems/mods — dropped the source's tree-only tables: `PassiveSkills`, `PassiveSkillMasteryGroups`, `Ascendancy`, `SoulCores`, etc., not needed for this feature and already vendored separately for the tree.)

## Extractor APIs — verified from shipped `.d.ts`

```ts
import { extractItems } from '@poe2-toolkit/item-extractor'; // (source: ItemSource) => Promise<{ data: ItemData; icons: ItemIconsResult }>
import { extractGems } from '@poe2-toolkit/gem-extractor';   // (source: GemSource) => Promise<{ data: GemData; icons: GemIconsResult }>
import { extractMods } from '@poe2-toolkit/mod-extractor';   // (source: GgpkSource) => Promise<{ data: ModData }>
```

**Correction from Task 1's real fixture capture (2026-08-21):** both open questions above are resolved. `extractGems` DOES bundle data + icons in one call, exactly like `extractItems` (`GemBundle = { data: GemData; icons: GemIconsResult }`) — `buildGems`/`buildGemIcons` are the lower-level pieces it composes, still exported separately but not needed for the normal path. `extractMods` also exists (contrary to this doc's earlier claim that mod-extractor has no bundled wrapper) — it wraps `buildMods` in a `ModBundle = { data: ModData }`, just with no `icons` field since mods carry no art. `scripts/wiki/capture-fixtures.mjs` used `extractItems`/`extractGems`/`extractMods` uniformly and all three worked as documented here.

`ItemData = Record<string, Item>` — keyed by **display name**, first base wins on name collision, uniques added after (never overwrite a base).
`GemData.gems = Record<string, Gem>` — keyed by the **last path segment of the gem's base item id** (PoB's `normalizeGemId`, e.g. `SkillGemIceNova`).
`ModData = Record<string, Mod>` — keyed by `Mods.Id` (e.g. `LocalIncreasedPhysicalDamagePercent8`).

### `Item` (item-extractor) — fields actually present

`rarity: 'normal'|'unique'`, `icon: string|null` (raw DDS path), `itemClass: string|null`, `category: string|null` (uniques only), `twoHanded: boolean`, `req: {str,dex,int}`, `armour: ItemArmour|null`, `weapon: ItemWeapon|null`, `spirit: number`, `dropLevel: number`, `flavourText: string[]|null` (uniques only), `modDomain: string|null`, `tags: string[]`.

**No mods field.** Confirmed via `exile2exile`'s own README: they source unique affix values from Path of Building's community data, not GGPK — `.dat` has no unique→rolled-affix link. **`WikiItemDetail` cannot show a unique's actual mod lines from this pipeline.** See design spec's "known limitation."

### `Gem` (gem-extractor) — fields actually present

`name`, `kind: 'active'|'support'|'spirit'`, `color: 'r'|'g'|'b'|'w'`, `tags: string[]` (bbcode-stripped), `description: string|null`, `req: {str,dex,int,level}` (headline, percent-weight), `icon: string|null`, `hoverImage: string|null`. Separately, `GemData.requirements` (per-level attribute curve, PoB-formula-verbatim) and `GemData.scaling` (per-level cost/castTime/cooldown/reservation/crit/translated stat lines, `GemStatLine[]`) are keyed the same way but may be **omitted** for a given gem (e.g. many supports have no per-level curve).

### `Mod` (mod-extractor) — fields actually present

`name: string|null`, `domain`, `generationType`, `group: string|null`, `tier: number|null`, `level: number`, `stats: string[]` (rendered, e.g. `"+(9-16) to Armour"`), `rolls: {stat,min,max}[]`, `families: string[]`, `spawnWeights: {tag,weight}[]`.

Items and mods join on `(Item.modDomain === Mod.domain)` then `Item.tags` matching the first `spawnWeights` entry with a positive weight for a tag the item carries — useful for a future "mods that can roll on this item" cross-link, not required for M1.

## Patch version

No public "give me the current PoE2 patch" HTTP endpoint found. `poe-tool-dev/latest-patch-version`'s `latest.txt` returns a PoE1-format version (`3.29.3.1.4`) — not applicable. `poe2-toolkit`'s own build resolves `"patch": "latest"` via a raw two-byte handshake against `patch.pathofexile2.com:13060`, implemented in a `current-patch.mjs` not fetched in this recon (out of scope for M1 — see design spec's open items). **Decision: pin `WIKI_PATCH_VERSION` as a manual constant**, same manual-but-PR-reviewed pattern as `WIKI_DATA_VERSION`.

**Correction from Task 1's real fixture capture (2026-08-21):** the value above, `4.5.4.10` (per `poe2-toolkit`'s docs dated 2026-08-15), was already stale one day later — `https://patch-poe2.poecdn.com/4.5.4.10/Bundles2/_.index.bin` 404s. Task 1 replicated the two-byte handshake this doc describes (connect to `patch.pathofexile2.com:13060`, write `[1,6,1,0,0,0,1,0]`, parse the UTF-16LE URL in the response) and got back `https://patch-poe2.poecdn.com/4.5.4.10.2/`, i.e. current patch `4.5.4.10.2` (five segments, not four — `WIKI_PATCH_VERSION`'s format regex already tolerated this). That value 200s and is what `WIKI_PATCH_VERSION`, `scripts/wiki/pathofexile-dat.config.json`, and the fixtures in `src/lib/wiki/__fixtures__/` were captured against. Confirms this field really does need hand-bumping on a short cadence (same-day-to-next-day drift observed here) — the weekly sync PR should re-run this handshake, not just eyeball a doc.

## Entity counts / payload size

**Not measured** — would require actually running the extractors against the live patch server, which this recon didn't do (network cost + time). Task 1 of the implementation plan measures this for real against captured fixtures before Task 5's SSG/ISR threshold decision.
