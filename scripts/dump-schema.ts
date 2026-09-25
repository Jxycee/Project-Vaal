// scripts/dump-schema.ts
// =============================================================================
// `npm run db:schema` — dump the live public schema to an untracked file.
//
// This exists because the hand-maintained supabase/schema.sql did not. That
// file carried a "GENERATED FROM THE LIVE DATABASE" header while nothing
// generated it, so it went stale silently every time a migration ran, and
// twice someone trusted the header. It was deleted on 2026-09-23.
//
// The output here is deliberately NOT committed. A committed snapshot is a
// promise to keep it current, and that promise is what failed before. The
// authoritative record is supabase/migrations/; this is a convenience view of
// the live database, generated on demand and thrown away.
//
// Requires SUPABASE_DB_URL in .env.local — see the error text below.
// =============================================================================

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = 'supabase/schema.generated.sql';
const ENV_FILE = '.env.local';
const VAR = 'SUPABASE_DB_URL';

/**
 * Minimal `.env.local` reader. Deliberately not a dependency: this script
 * needs exactly one variable, and the value is a database password we would
 * rather not hand to more code than necessary.
 *
 * Handles `KEY=value`, optional `export ` prefix, surrounding single or double
 * quotes, and `#` comments on their own line. It does not handle multi-line
 * values or interpolation, because a connection URI needs neither.
 */
function readEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).replace(/^export\s+/, '').trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const dbUrl = process.env[VAR] ?? readEnvFile(resolve(ENV_FILE))[VAR];

if (!dbUrl) {
  console.error(`
${VAR} is not set, so there is nothing to dump.

Add it to ${ENV_FILE} (already gitignored):

  ${VAR}=postgresql://postgres.<ref>:<password>@<host>:5432/postgres

Get the URI from the Supabase dashboard: Project Settings -> Database ->
Connection string -> URI. Either the direct connection or the session pooler
works.

Two things worth knowing before you paste it in:

  * This is a full Postgres superuser connection. It is strictly more
    powerful than SUPABASE_SERVICE_ROLE_KEY — it bypasses RLS entirely and
    can drop tables. Treat it as the most sensitive value in the file.
  * Nothing in the running app reads it. It is only ever used by this
    script, which runs locally and never prints it.

To use it for a single command without storing it, set it in your shell
first and then run ${'`'}npm run db:schema${'`'} as a separate command. Do not paste an
assignment and the command onto one line into ${ENV_FILE} — the whole line
becomes the value.
`);
  process.exit(1);
}

// Validate the shape before spending a spawn on it. This exists because the
// first value ever put in .env.local was a documentation placeholder pasted
// verbatim — "postgresql://...' npm run db:schema" — and the failure surfaced
// three layers down as the Supabase CLI rejecting "npm", "run", "db:schema"
// as positional arguments. That cost far more than this check does.
const looksLikeUri = /^postgres(ql)?:\/\/[^\s/@]+:[^\s@]+@[^\s:/]+:\d+\/\S+$/.test(dbUrl);
if (!looksLikeUri) {
  const redacted = dbUrl.replace(/:\/\/([^:]+):[^@]*@/, '://$1:<REDACTED>@');
  console.error(`
${VAR} is set but is not a Postgres connection URI.

  got: ${redacted}

Expected: postgresql://USER:PASSWORD@HOST:PORT/DATABASE

Common causes:
  * A placeholder such as "postgresql://..." was copied from documentation
    rather than a real value.
  * A whole example line was pasted, so the command ended up inside the value.
  * The value spans more than one line. It must be a single line.

If the password contains @ : / # or ?, percent-encode it (@ -> %40), and if
it contains # wrap the whole value in quotes so it is not read as a comment.
`);
  process.exit(1);
}

let migrationCount = 'unknown';
try {
  const { readdirSync } = await import('node:fs');
  migrationCount = String(readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).length);
} catch {
  // Directory missing is not fatal — the dump is still useful.
}

console.log(`Dumping the public schema to ${OUT} ...`);

try {
  // execFileSync with shell: false. Two reasons, both load-bearing:
  //
  // 1. The URL carries a password. A shell string would expose it to shell
  //    history and to anything reading the command line, and would need
  //    quoting rules that differ per platform.
  // 2. Under `npm run`, npm exports its own lifecycle variables (npm_config_*,
  //    npm_lifecycle_script). With a shell, npx re-reads those and appends the
  //    parent's argv to the child, so the supabase CLI received
  //    `npm run db:schema` as positional arguments and rejected them. Stripping
  //    npm_config_argv and spawning npx.cmd directly avoids both the shell and
  //    the inheritance.
  // shell: true is required on Windows and is not a free choice. Since the
  // CVE-2024-27980 hardening, Node refuses to spawn a .cmd — which is all npx
  // is on Windows — without a shell, failing EINVAL. Verified here, not
  // assumed.
  //
  // The honest consequence: the connection string appears on the child
  // process's command line while the dump runs, so another process on this
  // machine could read it. That is true of any spawn, shell or not; the shell
  // only widens it to cmd.exe as well. Acceptable for a local-only script,
  // and the reason this file never writes the URL anywhere persistent.
  execFileSync(
    'npx',
    ['--yes', 'supabase@2.117.0', 'db', 'dump', '--db-url', dbUrl, '--schema', 'public', '-f', OUT],
    { stdio: ['ignore', 'inherit', 'inherit'], shell: true },
  );
} catch (err) {
  // The CLI's own stderr is inherited above, so its message has already been
  // printed. Report only the spawn-level failure code — never the error
  // object, whose message can echo the full command line including the
  // password.
  const code = (err as NodeJS.ErrnoException)?.code;
  if (code) console.error(`\nspawn failed: ${code}`);
  // The CLI has already printed its own error. Do not re-throw it: its message
  // can contain the connection string.
  console.error(`\nDump failed. ${VAR} may be wrong, or the database unreachable.`);
  process.exit(1);
}

const header = `-- ${OUT}
--
-- GENERATED, AND NOT COMMITTED. Regenerate with: npm run db:schema
--
-- Generated:  ${new Date().toISOString()}
-- Source:     the live database named by SUPABASE_DB_URL
-- Migrations: ${migrationCount} files in supabase/migrations/
--
-- This is a read-only convenience view. The authoritative record of every
-- schema change is supabase/migrations/. Do not edit this file, and do not
-- commit it — its predecessor, supabase/schema.sql, was hand-maintained under
-- a "generated" header and stated the inverse of the privacy model for five
-- days before anyone noticed.

`;

const { writeFileSync } = await import('node:fs');
writeFileSync(OUT, header + readFileSync(OUT, 'utf8'), 'utf8');

console.log(`Done. ${OUT} is gitignored — read it, do not commit it.`);
