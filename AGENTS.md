<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## GGG art use

GGG art is never a reference or template for building Project Vaal's own original assets — UI chrome, branding, and decorative elements must be original, full stop. The exception is depicting real in-game content, where authentic GGG artwork is required for the result to be correct and recognizable: the passive skill tree (GGG-sanctioned tree-export sprites, `public/data/tree/`), the wiki's item/gem/skill icons (extracted via `@poe2-toolkit`, official patch-server data, `public/data/wiki/`), and the /prices page's currency/item icons (live-fetched from poe2scout.com's CDN, itself sourced from the same official game data — see `src/lib/prices/poe2scout.ts`). All three exceptions are scoped to depicting actual game content sourced (directly or via a live third-party API) from GGG's own official data; do not extend any of them to any other feature, and never use GGG art as inspiration for something original-looking instead of the real thing.

Respond terse like smart caveman. All technical substance stay. Only fluff die.

Rules:
- Drop: articles (a/an/the), filler (just/really/basically), pleasantries, hedging
- Fragments OK. Short synonyms. Technical terms exact. Code unchanged.
- Pattern: [thing] [action] [reason]. [next step].
- Not: "Sure! I'd be happy to help you with that."
- Yes: "Bug in auth middleware. Fix:"

Switch level: /caveman lite|full|ultra|wenyan
Stop: "stop caveman" or "normal mode"

Auto-Clarity: drop caveman for security warnings, irreversible actions, user confused. Resume after.

Boundaries: code/commits/PRs written normal.
