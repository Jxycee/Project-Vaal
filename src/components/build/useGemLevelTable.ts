'use client';

// The gem level-requirement table (fetchGemLevelRequirements), or null while it
// loads or if it could not be read. Callers treat null as "no gating".
import { useEffect, useState } from 'react';
import type { GemLevelTable } from '@/lib/build/gemLevels';
import { fetchGemLevelRequirements } from '@/lib/wiki/fetchGemLevelRequirements';

export function useGemLevelTable(): GemLevelTable | null {
  const [table, setTable] = useState<GemLevelTable | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchGemLevelRequirements().then((t) => {
      if (!cancelled) setTable(t);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return table;
}
