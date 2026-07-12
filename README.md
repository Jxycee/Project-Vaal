# Project Vaal

A free, mobile-first companion hub for **Path of Exile 2 console players** (PS5, Xbox Series X/S) who can't run desktop tools like Path of Building, overlays, or mods. PoE2 only — no PoE1 support.

Live at **[project-vaal.xyz](https://www.project-vaal.xyz)**.

Core features: passive skill tree viewer, currency/item price check, item wiki, build sharing, and a campaign tracker. See the [living planning document](./docs/superpowers/plans/) for full feature status, schema, and architecture — it's the single source of truth for this project, kept current with targeted section edits.

## Tech stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS v4 + shadcn/ui (`radix-nova` style)
- **Database/Auth:** Supabase (PostgreSQL + Auth, Row Level Security on every table)
- **Passive tree:** PixiJS (WebGL) via [`@poe2-toolkit`](https://github.com/rajtik76/poe2-toolkit) (`tree-core` + `tree-react`) — see [`THIRD-PARTY-NOTICES.md`](./THIRD-PARTY-NOTICES.md)
- **Search:** Fuse.js (client-side fuzzy search)
- **Hosting/CI:** Vercel + GitHub Actions

Exact dependency versions live in `package.json` — treat that as authoritative over anything written in prose here.

## Getting started

```powershell
# Install dependencies
npm install

# Copy the environment template and fill in real values
Copy-Item .env.local.example .env.local

# Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the result.

You'll need a Supabase project (URL + anon key at minimum) for auth and any data-backed page to work — see `.env.local.example` for the full list of required and optional environment variables, and `supabase/schema.sql` + `supabase/price-check-schema.sql` for the database schema to apply.

## Useful scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run type-check` | `tsc --noEmit` |
| `npm test` | Run the vitest suite once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run db:types` | Regenerate `src/types/database.ts` from the live Supabase schema |

CI (`.github/workflows/ci.yml`) runs type-check + lint on every PR and push to `main`. A separate scheduled workflow (`.github/workflows/price-sync.yml`) calls `/api/prices/sync` every 30 minutes to keep currency/item prices current.

## Project structure

- `src/app/` — routes (App Router). `(auth)` and `(dashboard)` are route groups — organizational only, they don't add a URL segment.
- `src/components/` — UI components (`ui/` primitives, `layout/` app shell, `tree/` passive-tree viewer)
- `src/lib/` — Supabase clients, price-check API client, passive-tree resource loading, and other pure logic
- `public/data/tree/<version>/` — vendored GGG passive-tree export (JSON + sprite atlases), self-hosted per the scoped exception in the plan doc's design-decisions section
- `supabase/` — SQL schema (source of truth for a fresh database setup)
- `patches/` — a reviewed `patch-package` patch for `@poe2-toolkit/tree-react` (applied automatically via `postinstall`)

## License / attribution

Project Vaal is an independent project and is not affiliated with or endorsed by Grinding Gear Games. See [`THIRD-PARTY-NOTICES.md`](./THIRD-PARTY-NOTICES.md) for third-party licenses.
