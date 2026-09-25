/**
 * The one place the e2e server's address is derived.
 *
 * Two callers need it and only one of them gets it for free. playwright.config
 * uses it to start and address the dev server; helpers.ts needs it because a
 * browser context built inside an `afterAll` hook inherits none of the
 * project's `use` options — `baseURL` included — and a cleanup page without one
 * cannot resolve `/builds` at all.
 *
 * Functions rather than constants because the config parses .env.local into
 * process.env at load time, which happens after this module is first imported.
 */
export function e2ePort(): number {
  return Number(process.env.E2E_PORT ?? 3100);
}

export function e2eBaseUrl(): string {
  return `http://localhost:${e2ePort()}`;
}
