import { expect, test, type Page, type Request, type TestInfo } from '@playwright/test';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

// The landing hero's shader backdrop (src/components/landing/), end to end.
//
// Written BEFORE the component (AGENTS.md). Every case is aimed at a way this
// spike could fail rather than at "the page loads":
//
//   no WebGPU      the page must look right with the CSS fallback alone, never
//                  load the shader chunk, and never paint a canvas
//   WebGPU present the canvas mounts once, animates, and is gone again after
//                  navigating away (no leaked GPU devices / stacked canvases)
//   reduced motion the shader must not load at all, even with WebGPU available
//   leakage        /prices and /login must never request the shader chunk —
//                  the passive tree route shares their bundle rules
//   layout         no CLS, the LCP element is still the emblem, the canvas
//                  never intercepts a tap on a CTA, no horizontal scroll
//   privacy        `shaders` ships telemetry on by default; the landing page
//                  must make zero requests to any origin but its own
//
// Branches are FORCED, not detected: no-WebGPU deletes navigator.gpu before
// any script runs; WebGPU-present launches Chromium with the unsafe-WebGPU
// flags and SKIPS (with a recorded reason) if the sandbox still hands back no
// adapter — a skip is honest, a faked pass is not.
//
// The artifact: each test attaches `shader-report.json` (branch, adapter, chunk
// URLs and sizes per route, CLS/LCP, canvas counts, console errors, foreign
// origins). It lands in playwright-report/results.json beside every other spec.

// Dev (webpack) names chunks after their source path: shader-layer.tsx and
// node_modules/shaders|typegpu. A name here that matches nothing would make the
// no-leak assertions vacuous, so the WebGPU test also requires a hit on landing.
const SHADER_CHUNK = /shader-layer|shaders|typegpu/i;
// URL names alone are blind to a STATIC import, which folds the engine into a
// shared bundle (e.g. app/layout.js) whose name says nothing. So every script
// response body is also scanned for the engine's module paths — proven by a
// mutation check: importing shader-layer from src/app/layout.tsx must turn the
// leak assertions red.
const SHADER_BODY = /node_modules[\\/](typegpu|shaders)[\\/]/;
const BACKDROP = '[data-testid="hero-backdrop"]';
const CANVAS = `${BACKDROP} canvas`;

type Report = Record<string, unknown>;

async function attachReport(testInfo: TestInfo, report: Report) {
  await testInfo.attach('shader-report.json', {
    body: JSON.stringify(report, null, 2),
    contentType: 'application/json',
  });
}

/** Records every request and console/page error from now on. */
function watch(page: Page) {
  const requests: string[] = [];
  const consoleErrors: string[] = [];
  const onRequest = (r: Request) => requests.push(r.url());
  page.on('request', onRequest);
  const bodyHits: Promise<string | null>[] = [];
  page.on('response', (res) => {
    if (res.request().resourceType() !== 'script') return;
    bodyHits.push(
      res
        .text()
        .then((t) => (SHADER_BODY.test(t) ? res.url() : null))
        .catch(() => null),
    );
  });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') consoleErrors.push(`${m.type()}: ${m.text()}`);
  });
  return {
    requests,
    consoleErrors,
    shaderRequests: async () => {
      const byBody = (await Promise.all(bodyHits.splice(0))).filter((u): u is string => !!u);
      return [...new Set([...requests.filter((u) => SHADER_CHUNK.test(u)), ...byBody])];
    },
    // Vercel Analytics (<Analytics/> in the root layout) is the site's own,
    // pre-existing third party and is allowed; anything else is new — notably
    // the `shaders` telemetry beacon, which disableTelemetry must keep off.
    foreignOrigins: (origin: string) =>
      [...new Set(requests.map((u) => new URL(u).origin))].filter(
        (o) =>
          o !== origin &&
          o !== 'https://va.vercel-scripts.com' &&
          !o.startsWith('data:') &&
          !o.startsWith('blob:'),
      ),
    reset: () => {
      requests.length = 0;
      consoleErrors.length = 0;
    },
  };
}

async function hasAdapter(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
    if (!gpu) return false;
    try {
      return (await gpu.requestAdapter()) != null;
    } catch {
      return false;
    }
  });
}

// launchOptions cannot be set per describe (it forces a new worker), so the
// WebGPU flags apply file-wide. Harmless to the no-WebGPU branch, which deletes
// navigator.gpu itself before any page script runs.
test.use({
  storageState: { cookies: [], origins: [] },
  launchOptions: {
    args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-angle=swiftshader'],
  },
});

// --------------------------------------------------------------------------
test.describe('no WebGPU', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true });
    });
  });

  test('CSS fallback carries the hero: no canvas, no shader chunk, no hydration noise, no foreign origins', async (
    { page, baseURL },
    testInfo,
  ) => {
    const w = watch(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Project Vaal' })).toBeVisible();
    await page.waitForLoadState('networkidle');

    const backdrop = page.locator(BACKDROP);
    await expect(backdrop).toBeVisible();
    // Painted, not merely present: a transparent fallback under a transparent
    // canvas is the silent failure this layer exists to prevent.
    const bg = await backdrop.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { image: cs.backgroundImage, color: cs.backgroundColor };
    });
    const painted =
      bg.image !== 'none' || (bg.color !== 'rgba(0, 0, 0, 0)' && bg.color !== 'transparent');
    expect(painted, `fallback is transparent: ${JSON.stringify(bg)}`).toBe(true);

    await expect(page.locator(CANVAS)).toHaveCount(0);
    expect(await w.shaderRequests()).toEqual([]);
    expect(w.consoleErrors.filter((m) => /hydrat|did not match/i.test(m))).toEqual([]);
    const foreign = w.foreignOrigins(new URL(baseURL!).origin);
    expect(foreign, 'landing page called a third-party origin').toEqual([]);

    await attachReport(testInfo, {
      branch: 'no-webgpu',
      adapter: false,
      shaderRequests: await w.shaderRequests(),
      consoleErrors: w.consoleErrors,
      foreignOrigins: foreign,
      fallbackBackground: bg,
    });
    await testInfo.attach('landing-nogpu.png', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  test('layout: CLS ~0, LCP is still the emblem, CTA is tappable, no horizontal scroll', async (
    { page },
    testInfo,
  ) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __cls: number; __lcp: string };
      w.__cls = 0;
      w.__lcp = '';
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
          if (!e.hadRecentInput) w.__cls += e.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver((list) => {
        const last = list.getEntries().at(-1) as unknown as { element?: Element } | undefined;
        const el = last?.element;
        if (el) w.__lcp = el.getAttribute('src') ?? el.tagName;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const metrics = await page.evaluate(() => {
      const w = window as unknown as { __cls: number; __lcp: string };
      return {
        cls: w.__cls,
        lcp: decodeURIComponent(w.__lcp),
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      };
    });
    expect(metrics.cls).toBeLessThan(0.01);
    expect(metrics.lcp).toContain('vaal-emblem');
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth);

    // The backdrop sits behind everything: whatever is topmost at the centre
    // of the CTA must be the CTA (or inside it), never the backdrop.
    const cta = page.getByRole('link', { name: 'Check prices' });
    const box = (await cta.boundingBox())!;
    const intercepted = await page.evaluate(
      ({ x, y }) => {
        const top = document.elementFromPoint(x, y);
        return !top?.closest('a[href="/prices"]');
      },
      { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    );
    expect(intercepted, 'something sits on top of the Check prices link').toBe(false);

    await attachReport(testInfo, { branch: 'no-webgpu/layout', ...metrics });
  });
});

// --------------------------------------------------------------------------
test.describe('WebGPU present', () => {
  test('shader loads once and ends live or cleanly unavailable; never leaks to /prices or /login', async (
    { page, baseURL },
    testInfo,
  ) => {
    const w = watch(page);
    await page.goto('/?backdrop=debug');
    test.skip(!(await hasAdapter(page)), 'sandbox Chromium returned no WebGPU adapter; branch not exercised');

    // Two honest outcomes. A real GPU ends 'shader · live' with one canvas. The
    // software adapter in CI/sandboxes makes the library report `device-lost`,
    // and the page must then fall back to CSS and drop the canvas — verified
    // here, not skipped, because that is exactly what a GPU reset does to a user.
    const status = page.getByTestId('hero-backdrop-status');
    await expect(status).toHaveText(/^(shader · live|css · shader unavailable)/, { timeout: 30_000 });
    const outcome = (await status.textContent())!;
    const live = outcome === 'shader · live';
    const canvas = page.locator(CANVAS);
    await expect(canvas).toHaveCount(live ? 1 : 0);
    await expect(page.locator(BACKDROP)).toBeVisible();
    const size = live ? (await canvas.boundingBox())! : null;
    if (size) {
      expect(size.width).toBeGreaterThan(100);
      expect(size.height).toBeGreaterThan(100);
    }

    // Pixel readback of a WebGPU canvas is NOT asserted: under the software
    // adapter this sandbox has, a mounted, ready canvas reads back all-zero
    // (and element screenshots are byte-identical across frames), so any
    // "it animates" assert here would be either vacuous or permanently red.
    // It is recorded in the report instead, so a run on a real GPU shows it.
    const readback = async () =>
      page.evaluate(
        () =>
          new Promise<{ hash: number; nonZero: number }>((resolve) =>
            requestAnimationFrame(() => {
              const c = document.querySelector('[data-testid="hero-backdrop"] canvas') as HTMLCanvasElement;
              const o = document.createElement('canvas');
              o.width = o.height = 64;
              const x = o.getContext('2d')!;
              x.drawImage(c, 0, 0, 64, 64);
              const d = x.getImageData(0, 0, 64, 64).data;
              let hash = 0;
              let nonZero = 0;
              for (let i = 0; i < d.length; i++) {
                hash = (hash * 31 + d[i]) | 0;
                if (i % 4 < 3 && d[i]) nonZero++;
              }
              resolve({ hash, nonZero });
            }),
          ),
      );
    let readbackReport: unknown = 'shader not live: no canvas to read back';
    if (live) {
      const frameA = await readback();
      await page.waitForTimeout(1500);
      const frameB = await readback();
      readbackReport = { frameA, frameB, animated: frameA.hash !== frameB.hash };
      // What IS asserted: a blank or broken shader must not hide the fallback.
      const blend = await page.locator(`${BACKDROP} .mix-blend-screen`).evaluate(
        (el) => getComputedStyle(el).mixBlendMode,
      );
      expect(blend).toBe('screen');
    }

    const onLanding = await w.shaderRequests();
    expect(onLanding.length, 'shader ran or failed but its chunk was never fetched').toBeGreaterThan(0);
    const foreign = w.foreignOrigins(new URL(baseURL!).origin);
    expect(foreign, 'shader telemetry or other third-party call').toEqual([]);

    const perRoute: Record<string, { shaderRequests: string[]; canvases: number }> = {};
    for (const route of ['/prices', '/login']) {
      w.reset();
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      perRoute[route] = {
        shaderRequests: await w.shaderRequests(),
        canvases: await page.locator('canvas').count(),
      };
      expect(perRoute[route].shaderRequests, `${route} pulled the shader chunk`).toEqual([]);
      expect(perRoute[route].canvases, `${route} has a canvas`).toBe(0);
    }

    // Round trip: leaving and returning must not stack canvases.
    await page.goto('/?backdrop=debug');
    await expect(page.getByTestId('hero-backdrop-status')).toHaveText(
      /^(shader · live|css · shader unavailable)/,
      { timeout: 30_000 },
    );
    expect(await page.locator(CANVAS).count()).toBeLessThanOrEqual(1);

    await attachReport(testInfo, {
      branch: 'webgpu',
      adapter: true,
      outcome,
      canvasBox: size,
      readback: readbackReport,
      landingShaderRequests: onLanding,
      perRoute,
      foreignOrigins: foreign,
    });
    await testInfo.attach('landing-webgpu.png', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  test.describe('reduced motion', () => {
    test.use({ contextOptions: { reducedMotion: 'reduce' } });

    test('never loads the shader even though WebGPU is available', async ({ page }, testInfo) => {
      const w = watch(page);
      await page.goto('/');
      test.skip(!(await hasAdapter(page)), 'sandbox Chromium returned no WebGPU adapter; branch not exercised');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      await expect(page.locator(BACKDROP)).toBeVisible();
      await expect(page.locator(CANVAS)).toHaveCount(0);
      expect(await w.shaderRequests()).toEqual([]);
      await attachReport(testInfo, { branch: 'reduced-motion', adapter: true, shaderRequests: await w.shaderRequests() });
    });
  });
});

// --------------------------------------------------------------------------
// Visibility. The first cut of this backdrop passed every test above and was
// still invisible: gradients at ~50% over a 0.16-lightness page under an 85%
// veil read as plain black, so "nothing changed" was the honest review.
// Structure tests cannot catch that, so this one measures pixels: it hides the
// foreground, screenshots the page, and samples an 8x6 grid.
test.describe('visibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true });
    });
  });

  test('the CSS backdrop is clearly visible: colour and light/dark variation across the page', async (
    { page },
    testInfo,
  ) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.addStyleTag({ content: 'main{visibility:hidden !important}' });
    const png = (await page.screenshot()).toString('base64');
    const stats = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const x = c.getContext('2d')!;
      x.drawImage(img, 0, 0);
      const cols = 8;
      const rows = 6;
      const cells: { r: number; g: number; b: number }[] = [];
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const d = x.getImageData(
            Math.floor(((i + 0.5) / cols) * c.width) - 4,
            Math.floor(((j + 0.5) / rows) * c.height) - 4,
            8,
            8,
          ).data;
          let r = 0, g = 0, b = 0;
          for (let k = 0; k < d.length; k += 4) { r += d[k]; g += d[k + 1]; b += d[k + 2]; }
          const n = d.length / 4;
          cells.push({ r: r / n, g: g / n, b: b / n });
        }
      }
      const lum = cells.map((p) => 0.2126 * p.r + 0.7152 * p.g + 0.0722 * p.b);
      const chroma = cells.map((p) => Math.max(p.r, p.g, p.b) - Math.min(p.r, p.g, p.b));
      return {
        maxLum: Math.max(...lum),
        lumRange: Math.max(...lum) - Math.min(...lum),
        maxChroma: Math.max(...chroma),
      };
    }, png);

    await attachReport(testInfo, { branch: 'visibility', ...stats });
    // Thresholds are 8-bit channel values. The invisible first cut sat near
    // maxLum ~20, lumRange ~10, maxChroma ~12 — plain page background.
    expect(stats.maxChroma, 'no visible colour anywhere').toBeGreaterThan(35);
    expect(stats.lumRange, 'backdrop is flat').toBeGreaterThan(25);
    expect(stats.maxLum, 'backdrop never rises above near-black').toBeGreaterThan(55);
  });

  test('?backdrop=debug says which branch is running', async ({ page }) => {
    await page.goto('/?backdrop=debug');
    await expect(page.getByTestId('hero-backdrop-status')).toHaveText(/css · no webgpu/i);
  });
});

// --------------------------------------------------------------------------
// /login: the desktop brand panel gets the same backdrop (one instance per
// page). Below md that panel is display:none, so the shader must not be loaded
// for a layer nobody can see — the mobile leak assertion in the WebGPU test
// above covers that side; this covers desktop.
test.describe('login panel', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true });
    });
  });

  test('desktop: the brand panel is visibly lit, and the form still works over/beside it', async (
    { page },
    testInfo,
  ) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    const backdrop = page.getByTestId('login-backdrop');
    await expect(backdrop).toBeVisible();

    // The backdrop lives inside the left panel, not over the whole page.
    const box = (await backdrop.boundingBox())!;
    expect(box.x).toBe(0);
    expect(box.width).toBeLessThan(1280 * 0.7);

    await page.addStyleTag({ content: 'main .z-10{visibility:hidden !important} img{visibility:hidden !important}' });
    const png = (await page.screenshot({ clip: { x: 0, y: 0, width: box.width, height: 800 } })).toString('base64');
    const maxChroma = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const x = c.getContext('2d')!;
      x.drawImage(img, 0, 0);
      let best = 0;
      for (let j = 0; j < 6; j++) {
        for (let i = 0; i < 6; i++) {
          const d = x.getImageData(Math.floor(((i + 0.5) / 6) * c.width) - 4, Math.floor(((j + 0.5) / 6) * c.height) - 4, 8, 8).data;
          let r = 0, g = 0, b = 0;
          for (let k = 0; k < d.length; k += 4) { r += d[k]; g += d[k + 1]; b += d[k + 2]; }
          const n = d.length / 4;
          best = Math.max(best, Math.max(r, g, b) / n - Math.min(r, g, b) / n);
        }
      }
      return best;
    }, png);
    await attachReport(testInfo, { branch: 'login-panel', panelWidth: box.width, maxChroma });
    expect(maxChroma, 'login panel backdrop is not visibly coloured').toBeGreaterThan(25);
  });

  test('desktop: sign-in form is untouched and clickable', async ({ page }) => {
    await page.goto('/login');
    const email = page.getByLabel('Email');
    await email.fill('someone@example.com');
    await expect(email).toHaveValue('someone@example.com');
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeEnabled();
  });
});

// --------------------------------------------------------------------------
// Production artifacts. The dev server tests above cannot see chunking or the
// service worker, so this reads what `npm run build` left behind. It skips (with
// a reason) when there is no build, rather than passing on nothing. Found by
// hand first: before next.config.ts named the engine chunk and excluded it,
// public/sw.js precached the ~2.5MB engine for every visitor, GPU or not.
test.describe('production build', () => {
  const root = process.cwd();
  const chunksDir = path.join(root, '.next', 'static', 'chunks');
  const swPath = path.join(root, 'public', 'sw.js');

  test('the shader engine is its own chunk, off the initial manifest and out of the SW precache', async (
    {},
    testInfo,
  ) => {
    test.skip(!existsSync(chunksDir) || !existsSync(swPath), 'no production build (run `npm run build`)');

    const chunks = readdirSync(chunksDir).filter((f) => f.endsWith('.js'));
    const engine = chunks.filter((f) => /^shader-engine\./.test(f));
    expect(engine, 'engine chunk is not named shader-engine (splitChunks cache group lost?)').toHaveLength(1);

    // Whatever else holds the engine's code must not be a *different* chunk.
    const holders = chunks.filter((f) => readFileSync(path.join(chunksDir, f), 'utf8').includes('typegpu'));
    expect(holders, 'engine code leaked into another chunk').toEqual(engine);

    const sw = readFileSync(swPath, 'utf8');
    expect(sw.includes('shader-engine'), 'service worker precaches the shader engine').toBe(false);

    // Initial (synchronous) bundles per route: the engine must be in none.
    const initial = ['build-manifest.json', 'app-build-manifest.json']
      .map((f) => path.join(root, '.next', f))
      .filter(existsSync)
      .map((f) => readFileSync(f, 'utf8'));
    expect(initial.some((m) => m.includes('shader-engine')), 'engine is an initial chunk').toBe(false);

    await attachReport(testInfo, {
      branch: 'production-build',
      engineChunk: engine[0],
      engineBytes: statSync(path.join(chunksDir, engine[0])).size,
      swBytes: sw.length,
      swMentionsEngine: false,
    });
  });
});
