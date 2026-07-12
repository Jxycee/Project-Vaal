'use client';

// Loads GGG's official atlas sheets (vendored under public/data/tree/<version>/assets)
// into the RenderResources shape @poe2-toolkit/tree-react expects, plus the
// per-class centre art (portrait + ring) it draws separately via centreSprites.
//
// Manifest keys: each atlas's own JSON prefixes its sprite keys with the
// atlas's filename (e.g. "frame:KeystoneFrameAllocated", "line:Orbit3Active")
// EXCEPT skills.json and mastery-effect-active.json, whose keys already match
// what spriteKeys.ts (iconKeyFor/effectKeyFor) expects verbatim (the prefix
// there is the icon *variant*, e.g. "normalActive:", not an atlas id). So the
// rule per atlas is either "strip `<atlasId>:`" or "keep as-is" — never both.
import { useEffect, useState } from 'react';
import type { RenderResources } from '@poe2-toolkit/tree-react';
import type { SpriteFrame } from '@poe2-toolkit/tree-core';

interface TpFrame {
  frame: { x: number; y: number; w: number; h: number };
}
interface TpJson {
  frames: Record<string, TpFrame>;
}

const BASE = (version: string) => `/data/tree/${version}/assets`;

// Atlases feeding the SpriteManifest (node icons/frames/connectors/effects).
// `strip: true` removes the atlas's own `${id}:` key prefix; `strip: false`
// keeps GGG's key exactly as spriteKeys.ts produces it.
const MANIFEST_ATLASES: { id: string; strip: boolean }[] = [
  { id: 'skills', strip: false },
  { id: 'frame', strip: true },
  { id: 'line', strip: true },
  { id: 'mastery-effect-active', strip: false },
];

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });
}

async function loadAtlas(version: string, id: string): Promise<{ id: string; json: TpJson; image: HTMLImageElement }> {
  const [json, image] = await Promise.all([
    fetch(`${BASE(version)}/${id}.json`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} loading ${id}.json`);
      return r.json() as Promise<TpJson>;
    }),
    loadImage(`${BASE(version)}/${id}.webp`),
  ]);
  return { id, json, image };
}

/** Loads the base manifest (icons/frames/connectors/effects) — shared by every class. */
export function useTreeResources(version: string): RenderResources | null {
  const [resources, setResources] = useState<RenderResources | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all(MANIFEST_ATLASES.map((a) => loadAtlas(version, a.id)))
      .then((atlasResults) => {
        if (cancelled) return;

        const frames: Record<string, SpriteFrame> = {};
        const atlases: Record<string, HTMLImageElement> = {};

        for (const { id, json, image } of atlasResults) {
          atlases[id] = image;
          const strip = MANIFEST_ATLASES.find((a) => a.id === id)!.strip;
          const prefix = `${id}:`;

          for (const [rawKey, entry] of Object.entries(json.frames)) {
            const key = strip && rawKey.startsWith(prefix) ? rawKey.slice(prefix.length) : rawKey;
            frames[key] = { atlas: id, x: entry.frame.x, y: entry.frame.y, w: entry.frame.w, h: entry.frame.h };
          }
        }

        setResources({ manifest: { frames }, atlases });
      })
      .catch((e: unknown) => {
        // Leave resources null — PassiveTree falls back to TreeView's vector
        // render (discs + rails, no art) rather than a hard failure.
        console.error('[tree] failed to load sprite atlases', e);
      });

    return () => {
      cancelled = true;
    };
  }, [version]);

  return resources;
}

export interface ClassCentreSprites {
  portrait: { url: string; sx: number; sy: number; sw: number; sh: number };
  ringStatic: { url: string; sx: number; sy: number; sw: number; sh: number };
  ringActive: { url: string; sx: number; sy: number; sw: number; sh: number };
}

// The gold ring frame is identical for every class (group-background.webp);
// only the portrait differs per class (background-<class>.webp).
let ringCache: Promise<TpJson> | null = null;
function ringJson(version: string): Promise<TpJson> {
  if (!ringCache) {
    ringCache = fetch(`${BASE(version)}/group-background.json`).then((r) => r.json());
  }
  return ringCache;
}

/**
 * Centre art for one class: the static ring, the active (rotating gold) ring,
 * and the class's own portrait crop. `ascendancyInternalId` (e.g. "Witch2")
 * selects that ascendancy's portrait variant; omit for the base portrait.
 *
 * Portrait mapping: background-<class>.webp bundles 5 sub-images, Class0..4.
 * Class0 is the base (no ascendancy chosen); Class{N} is the Nth ascendancy's
 * portrait, where N is the trailing digit of its internal id (Witch2 -> Class2).
 * Verified against the vendored background-<class>.json sub-rects (5x 1500²
 * frames matching CentreArt.art's stable 1500² size) for 0.5.2.
 */
export function useClassCentreSprites(
  version: string,
  className: string,
  ascendancyInternalId: string | undefined,
  // False for classes GGG hasn't released ascendancies for yet (the legacy
  // Marauder/Duelist/Shadow/Templar attribute-origin slots still present in
  // the raw export). We only vendor background-<class> art for the 8 real
  // PoE2 classes, so fetching for anything else is a guaranteed 404 — this
  // is the same "has ascendancies" check the class picker already filters
  // on, so it stays correct automatically as GGG ships new classes/patches.
  enabled: boolean,
): ClassCentreSprites | null {
  const [sprites, setSprites] = useState<ClassCentreSprites | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    const slug = className.toLowerCase();

    Promise.all([
      ringJson(version),
      fetch(`${BASE(version)}/background-${slug}.json`).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status} loading background-${slug}.json`);
        return r.json() as Promise<TpJson>;
      }),
    ])
      .then(([ring, portraitAtlas]) => {
        if (cancelled) return;

        const ringActive = ring.frames['startNode:MainCircleActive'].frame;
        const ringStatic = ring.frames['startNode:MainCircle'].frame;

        const classKey = `class${className}`; // e.g. "classWitch"
        const n = ascendancyInternalId?.match(/\d+/)?.[0] ?? '0';
        const portraitKey = `${classKey}:Class${n}`;
        const portrait =
          portraitAtlas.frames[portraitKey]?.frame ?? portraitAtlas.frames[`${classKey}:Class0`].frame;

        setSprites({
          portrait: { url: `${BASE(version)}/background-${slug}.webp`, sx: portrait.x, sy: portrait.y, sw: portrait.w, sh: portrait.h },
          ringStatic: { url: `${BASE(version)}/group-background.webp`, sx: ringStatic.x, sy: ringStatic.y, sw: ringStatic.w, sh: ringStatic.h },
          ringActive: { url: `${BASE(version)}/group-background.webp`, sx: ringActive.x, sy: ringActive.y, sw: ringActive.w, sh: ringActive.h },
        });
      })
      .catch((e: unknown) => {
        console.error('[tree] failed to load class centre art', e);
      });

    return () => {
      cancelled = true;
    };
  }, [version, className, ascendancyInternalId, enabled]);

  return sprites;
}
