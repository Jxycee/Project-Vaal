'use client';

// Reserved Spirit per weapon set for a gem state (Slice 3), shared by the gem
// sheet and the Slice 5 stat sheet so both read the same number. Scaling is
// fetched per gem slug (fetchReservationScaling, cached); `null` while a
// fetch for the current set of gems is in flight. Keyed by the slug list the
// result is FOR, so a stale response is ignored.

import { useEffect, useState } from 'react';
import type { GemState } from '@/lib/build/gemState';
import { reservedSpirit, type ReservedSpirit } from '@/lib/build/validate';
import { fetchReservationScaling, type ReservationScalingEntry } from '@/lib/wiki/fetchGemScaling';

export interface ReservedSpiritResult {
  total: ReservedSpirit;
  /** Names of gems whose reservation data could not be read. */
  missingNames: string[];
}

export function useReservedSpirit(gemState: GemState): ReservedSpiritResult | null {
  const gems = gemState.loadouts.flatMap((l) => (l.skill ? [l.skill, ...l.supports] : []));
  const key = Array.from(new Set(gems.map((g) => g.slug))).sort().join('|');
  const [result, setResult] = useState<{ key: string; data: Map<string, ReservationScalingEntry[] | null> } | null>(null);

  useEffect(() => {
    if (key === '') return;
    let cancelled = false;
    const wanted = key.split('|');
    Promise.all(wanted.map((slug) => fetchReservationScaling(slug))).then((scalings) => {
      if (!cancelled) setResult({ key, data: new Map(wanted.map((slug, i) => [slug, scalings[i]])) });
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const scaling = key === '' ? new Map<string, ReservationScalingEntry[] | null>() : result?.key === key ? result.data : null;
  if (scaling === null) return null;
  const known = new Map<string, ReservationScalingEntry[]>();
  for (const [slug, entries] of scaling) if (entries) known.set(slug, entries);
  const total = reservedSpirit(gemState, known);
  return { total, missingNames: total.missing.map((slug) => gems.find((g) => g.slug === slug)?.name ?? slug) };
}
