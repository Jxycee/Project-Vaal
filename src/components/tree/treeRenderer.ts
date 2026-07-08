// Stage 1a passive-tree renderer (PixiJS v8).
// Scope: render the MAIN tree (ascendancy + decoration excluded) as kind-coloured
// markers with arced/straight connections, plus pan/zoom with a persisted viewport.
// Stage 1b replaces the placeholder markers with the GGG sprite atlases and adds
// the central-circle ascendancy composite.

import { Application, Container, Graphics } from 'pixi.js';
import type { NodeKind, TreeModel, TreeNode } from '@/lib/tree/types';
import {
  clampScale,
  loadViewport,
  saveViewport,
  type Viewport,
} from '@/lib/tree/viewport-persistence';

// Placeholder palette (Stage 1a only — sprites replace this in 1b). Numeric because
// Pixi needs colours, not CSS tokens; 1b's atlas art makes these moot.
const EDGE_COLOR = 0x6b5a2e;
const NODE_STROKE = 0x120f0a;
const KIND_COLOR: Record<NodeKind, number> = {
  small: 0xb9932f,
  attribute: 0xa8862b,
  notable: 0xe8c874,
  keystone: 0xf4e2a6,
  jewelSocket: 0x7fa8c4,
  classStart: 0xffffff,
  ascendancyStart: 0xd8b45a,
  mastery: 0x8a7a45,
};
const KIND_RADIUS: Record<NodeKind, number> = {
  small: 16,
  attribute: 16,
  notable: 32,
  keystone: 46,
  jewelSocket: 40,
  classStart: 44,
  ascendancyStart: 28,
  mastery: 20,
};
const ZOOM_STEP = 1.12;
const SAVE_DEBOUNCE_MS = 400;

export class TreeRenderer {
  private app: Application | null = null;
  private world: Container | null = null;
  private parent: HTMLElement | null = null;
  private destroyed = false;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly model: TreeModel) {}

  async mount(parent: HTMLElement): Promise<void> {
    const app = new Application();
    await app.init({
      resizeTo: parent,
      background: 0x0b0a08,
      antialias: true,
      resolution: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
      autoDensity: true,
      preference: 'webgl',
    });
    if (this.destroyed) {
      app.destroy({ removeView: true }, { children: true });
      return;
    }
    this.app = app;
    this.parent = parent;
    parent.appendChild(app.canvas);

    const world = new Container();
    app.stage.addChild(world);
    this.world = world;

    this.drawTree(world);
    this.applyInitialViewport(app, world);
    this.attachInteraction(app.canvas);
  }

  private drawTree(world: Container): void {
    const { nodes, groups } = this.model;
    const isMain = (n: TreeNode) => !n.ascendancyId;

    // --- connections (one Graphics for the whole edge layer) ---
    const edges = new Graphics();
    for (const n of nodes.values()) {
      if (!isMain(n)) continue;
      for (const nbId of n.neighbors) {
        if (nbId <= n.id) continue; // draw each undirected edge once
        const m = nodes.get(nbId);
        if (!m || !isMain(m)) continue;
        const sameOrbit =
          n.group === m.group && n.orbit === m.orbit && n.orbit > 0 && groups.has(n.group);
        if (sameOrbit) {
          const g = groups.get(n.group)!;
          const r = Math.hypot(n.x - g.x, n.y - g.y);
          const a0 = Math.atan2(n.y - g.y, n.x - g.x);
          const a1 = Math.atan2(m.y - g.y, m.x - g.x);
          let delta = a1 - a0;
          while (delta <= -Math.PI) delta += 2 * Math.PI;
          while (delta > Math.PI) delta -= 2 * Math.PI;
          edges.moveTo(n.x, n.y).arc(g.x, g.y, r, a0, a1, delta < 0);
        } else {
          edges.moveTo(n.x, n.y).lineTo(m.x, m.y);
        }
      }
    }
    edges.stroke({ width: 6, color: EDGE_COLOR, alpha: 0.85 });
    world.addChild(edges);

    // --- node markers, batched by kind (skip ascendancy + decoration) ---
    const byKind = new Map<NodeKind, TreeNode[]>();
    for (const n of nodes.values()) {
      if (!isMain(n) || n.isDecoration) continue;
      const list = byKind.get(n.kind);
      if (list) list.push(n);
      else byKind.set(n.kind, [n]);
    }
    for (const [kind, list] of byKind) {
      const g = new Graphics();
      const r = KIND_RADIUS[kind];
      for (const n of list) g.circle(n.x, n.y, r);
      g.fill(KIND_COLOR[kind]).stroke({ width: 3, color: NODE_STROKE, alpha: 0.9 });
      world.addChild(g);
    }
  }

  private applyInitialViewport(app: Application, world: Container): void {
    const saved = loadViewport();
    if (saved) {
      world.scale.set(saved.scale);
      world.position.set(saved.x, saved.y);
      return;
    }
    const { minX, minY, maxX, maxY } = this.model.bounds;
    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    const cw = app.screen.width;
    const ch = app.screen.height;
    const scale = clampScale(Math.min(cw / spanX, ch / spanY) * 0.9);
    world.scale.set(scale);
    world.position.set(
      cw / 2 - ((minX + maxX) / 2) * scale,
      ch / 2 - ((minY + maxY) / 2) * scale,
    );
  }

  private attachInteraction(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointerleave', this.onPointerUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.dragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.dragging || !this.world) return;
    this.world.x += e.clientX - this.lastX;
    this.world.y += e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };

  private onPointerUp = (): void => {
    if (!this.dragging) return;
    this.dragging = false;
    this.queueSave();
  };

  private onWheel = (e: WheelEvent): void => {
    if (!this.world || !this.app) return;
    e.preventDefault();
    const rect = this.app.canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const s0 = this.world.scale.x;
    const wx = (px - this.world.x) / s0;
    const wy = (py - this.world.y) / s0;
    const s1 = clampScale(s0 * (e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP));
    this.world.scale.set(s1);
    this.world.x = px - wx * s1;
    this.world.y = py - wy * s1;
    this.queueSave();
  };

  private queueSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      if (this.world) saveViewport(this.currentViewport());
    }, SAVE_DEBOUNCE_MS);
  }

  private currentViewport(): Viewport {
    const w = this.world!;
    return { x: w.x, y: w.y, scale: w.scale.x };
  }

  destroy(): void {
    this.destroyed = true;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    const canvas = this.app?.canvas;
    if (canvas) {
      canvas.removeEventListener('pointerdown', this.onPointerDown);
      canvas.removeEventListener('pointermove', this.onPointerMove);
      canvas.removeEventListener('pointerup', this.onPointerUp);
      canvas.removeEventListener('pointerleave', this.onPointerUp);
      canvas.removeEventListener('wheel', this.onWheel);
    }
    if (this.world) saveViewport(this.currentViewport());
    this.app?.destroy({ removeView: true }, { children: true });
    this.app = null;
    this.world = null;
    this.parent = null;
  }
}
