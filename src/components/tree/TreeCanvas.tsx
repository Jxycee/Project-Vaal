'use client';

// Thin React lifecycle wrapper around the imperative Pixi renderer.
// Mounts on the host div, tears down on unmount (StrictMode-safe via the
// renderer's destroyed guard).
import { useEffect, useRef } from 'react';
import type { TreeModel } from '@/lib/tree/types';
import { TreeRenderer } from './treeRenderer';

export default function TreeCanvas({ model }: { model: TreeModel }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const renderer = new TreeRenderer(model);
    void renderer.mount(host);
    return () => renderer.destroy();
  }, [model]);

  return <div ref={hostRef} className="absolute inset-0" />;
}
