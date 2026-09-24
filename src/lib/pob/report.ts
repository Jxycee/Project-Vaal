// src/lib/pob/report.ts
// =============================================================================
// What an import kept, dropped and inferred — a first-class output, not a log.
//
// The import report is the honest answer to "did everything come across?".
// PoB2 carries data we do not model (rolled mods, attribute choices, a third
// ring slot), so a silent import would produce a build that looks complete
// and is not. Every mapper returns its entries here instead of discarding.
// =============================================================================

export type ReportArea = 'build' | 'tree' | 'gems' | 'items' | 'notes';

/**
 * dropped  — PoB had it; the imported build does not.
 * inferred — we filled something PoB does not state (a checkpoint's level, a
 *            magic item's base). True to the best of the data, not certain.
 * note     — neither lost nor guessed, but worth knowing (gear shared across
 *            checkpoints because PoB stores one item set).
 */
export type ReportKind = 'dropped' | 'inferred' | 'note';

export interface ReportEntry {
  kind: ReportKind;
  area: ReportArea;
  message: string;
  /** 1-based PoB spec number, when the entry is about one checkpoint. */
  checkpoint?: number;
}
