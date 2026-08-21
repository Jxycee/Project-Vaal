import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // public/sw.js is Serwist's generated service worker bundle (compiled
    // from src/sw.ts via `next build --webpack`) — minified third-party
    // Workbox/Serwist runtime code, not hand-written source. Everything
    // under public/ is a static asset or build output; none of it should
    // ever be linted.
    "public/**",
    // Git worktrees live under .claude/worktrees/<name>/ alongside this
    // checkout. The patterns above only match the top-level .next/, out/,
    // build/, and public/ — not a worktree's own nested copies of them —
    // so a worktree's build output gets linted as if it were hand-written
    // source. Ignore the whole tree; a worktree lints itself independently
    // when the session is inside it.
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
