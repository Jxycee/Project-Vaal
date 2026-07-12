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
  ]),
]);

export default eslintConfig;
