# Passive tree data — provenance

- Source: https://github.com/grindinggear/poe2-skilltree-export (Grinding Gear Games)
- Release tag: skilltree-0.5.2 (latest as of 2026-07-06; "Runes of Aldur")
- Files to vendor into this folder: `data.json` + the entire `assets/` folder
  (skills, skills-disabled, frame, line, background-<class>, group-background,
  jewel, jewel-radius, mastery-effect-active/disabled — .webp + .json pairs).

This is GGG's sanctioned passive-tree export — the stated exception to their
data-access rules — and its node-sprite atlases are used under the scoped §15
exception recorded in the plan doc (§12, 2026-07-06). Self-hosted so WebGL
textures stay same-origin. Re-vendor per patch; the folder name is the version
and is what the loader/tests discover dynamically.

## Data shape (verified 2026-07-06, from the real file)

- `nodes`: object keyed by numeric skill id (string keys equal to each node's
  `skill`), plus one special key `"root"` (structural graph root → the six
  class-start nodes; excluded by the parser).
- Node coordinates are pre-computed: every real node has absolute `x`,`y`.
- Adjacency: per-node `out`/`in` (neighbour id strings) and a top-level
  `edges` array; the parser builds undirected neighbours from `out ∪ in`.
- Class starts: six nodes carry a two-element `classStartIndex` (PoE2's 12
  classes pair onto 6 attribute origins), resolved to `TreeClass.startNodeId`.
- Stats are display strings with `[Token|Text]` markup (parsed in Stage 4).
- Point economy is in-data: `grantedPassivePoints`, and Weapon Master
  (skill 8272) `weaponPassivePointsGranted: 100 / passivePointsGranted: -100`.
