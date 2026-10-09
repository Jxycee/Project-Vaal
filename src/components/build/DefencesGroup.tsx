'use client';

// The derived defence stats (evade, deflection, Runic Ward, regeneration, recharge, movement speed, charges,
// effective health pool, maximum hits) as a quiet group under the Stats tab's main rows.
//
// How this can fail (decided first):
//   1. A stat that is undefined / NaN (an empty build, a sheet from before the engine had `derived`): every value goes
//      through `whole`, which prints an em dash for anything not finite and never "NaN"; a missing `derived` hides the group.
//   2. A hit nothing can kill is Infinity (Chaos Inoculation vs chaos, 100% resist): printed "Immune", never "Infinity".
//   3. A huge number (maximum hits can reach 2147483647 territory) pushes the value column off a 375px screen: values
//      are plain digits in a shrink-wrapped right-aligned column and the label column takes the rest (min-w-0, wraps).
//   4. A hint that cannot be reached on a phone (hover-only tooltips): one 44px "What do these mean?" button toggles every
//      explanation; `title` is set on each label as well for a mouse. Rows are NOT buttons: a 44px button per row made
//      them twice as tall as the main stat rows, so the sheet looked like two lists.
//   5. Builds with Chaos Inoculation or Mind over Matter: the engine already folds both into the effective health pool
//      and maximum hits, so this only has to say so in the hint rather than recompute anything.
//   6. A reader seeing different numbers from the owner: nothing here is editable and nothing is derived locally; the
//      values are the engine's, formatted the same for everyone.
// Zero-valued Runic Ward and (with no Energy Shield) the recharge rows are hidden to keep the group quiet.
import { useState } from 'react';
import type { DerivedStats } from '@/lib/build/stats/engine';

/** Whole number as plain digits (like the main rows); not finite -> a dash, Infinity -> "Immune" is handled by `hit`. */
export function whole(n: number | undefined): string {
  return typeof n === 'number' && Number.isFinite(n) ? String(Math.round(n)) : '—';
}

function hit(n: number | undefined): string {
  return n === Infinity ? 'Immune' : whole(n);
}

// Row ids whose figure is close to Path of Building 2's but not yet exact. Measured by the multi-oracle run
// (docs/superpowers/oracle/results.json, 37 real builds): EHP and the physical/fire/cold/lightning max hits run 2-10%
// low on most builds, chaos max hit, life regen, mana regen and evade chance miss on 13-16 of 37. Deflection, charges
// and ES recharge match. Remove an id here when the oracle matches that stat; this set should shrink over time.
const APPROXIMATE: ReadonlySet<string> = new Set([
  'stat-evade-chance',
  'stat-life-regen',
  'stat-mana-regen',
  'stat-ehp',
  'stat-maxhit-physical',
  'stat-maxhit-fire',
  'stat-maxhit-cold',
  'stat-maxhit-lightning',
  'stat-maxhit-chaos',
]);

const APPROX_HINT = "Close to Path of Building's figure but not exact yet; known gaps: block, suppression, damage-taken modifiers, conversion.";

/** Marks a row approximate: "≈" before a real number (not "Immune" or a dash) and the extra hint sentence. */
function flagApprox(r: Row): Row {
  if (!APPROXIMATE.has(r.id)) return r;
  const numeric = r.value !== 'Immune' && !r.value.includes('—');
  return { ...r, value: numeric ? `≈${r.value}` : r.value, hint: `${r.hint} ${APPROX_HINT}` };
}

interface Row {
  id: string;
  label: string;
  value: string;
  hint: string;
}

function rowsOf(d: DerivedStats, energyShield: number): Row[] {
  const rows: Row[] = [
    { id: 'stat-evade-chance', label: 'Evade chance', value: `${whole(d.evadeChance)}%`, hint: 'Chance to avoid a hit completely, against an average boss-level enemy.' },
    { id: 'stat-deflection-rating', label: 'Deflection rating', value: whole(d.deflectionRating), hint: 'Rating that gives a chance to deflect a hit, so it deals less damage. Comes from Evasion and Armour on some gear and passives.' },
    { id: 'stat-deflect-chance', label: 'Deflect chance', value: `${whole(d.deflectChance)}%`, hint: 'Chance a hit is deflected, from the rating above.' },
  ];
  if (Number.isFinite(d.ward) && d.ward > 0) {
    rows.push({ id: 'stat-ward', label: 'Runic Ward', value: whole(d.ward), hint: 'A pool from Runeforged armour that soaks damage before Life.' });
  }
  rows.push(
    { id: 'stat-life-regen', label: 'Life regen', value: `${whole(d.lifeRegen)}/s`, hint: 'Life restored every second.' },
    { id: 'stat-mana-regen', label: 'Mana regen', value: `${whole(d.manaRegen)}/s`, hint: 'Mana restored every second.' },
  );
  if (energyShield > 0) {
    rows.push(
      { id: 'stat-es-recharge', label: 'ES recharge', value: `${whole(d.esRecharge)}/s`, hint: 'Energy Shield restored every second once recharge has started.' },
      { id: 'stat-es-delay', label: 'ES recharge delay', value: `${Number.isFinite(d.esRechargeDelay) ? d.esRechargeDelay : '—'}s`, hint: 'Seconds after taking damage before Energy Shield starts to recharge.' },
    );
  }
  rows.push(
    { id: 'stat-move-speed', label: 'Movement speed', value: `${whole(d.movementSpeed)}%`, hint: 'How fast you move, as a percent of the base speed (100% is normal).' },
    { id: 'stat-endurance-charges', label: 'Endurance charges', value: whole(d.enduranceCharges), hint: 'The most Endurance charges you can hold.' },
    { id: 'stat-frenzy-charges', label: 'Frenzy charges', value: whole(d.frenzyCharges), hint: 'The most Frenzy charges you can hold.' },
    { id: 'stat-power-charges', label: 'Power charges', value: whole(d.powerCharges), hint: 'The most Power charges you can hold.' },
    {
      id: 'stat-ehp',
      label: 'Effective health pool',
      value: hit(d.effectiveHealthPool),
      hint: 'Life and Energy Shield adjusted for resistances and armour, against an average hit. With Chaos Inoculation Life counts as 1; with Mind over Matter part of each hit comes off Mana first.',
    },
  );
  const types = [
    ['physical', 'Physical'],
    ['fire', 'Fire'],
    ['cold', 'Cold'],
    ['lightning', 'Lightning'],
    ['chaos', 'Chaos'],
  ] as const;
  for (const [type, name] of types) {
    rows.push({
      id: `stat-maxhit-${type}`,
      label: `Max ${name.toLowerCase()} hit`,
      value: hit(d.maxHit?.[type]),
      hint: `The biggest single ${name.toLowerCase()} hit you survive from full Life and Energy Shield. "Immune" means no hit of this type can kill you.`,
    });
  }
  return rows;
}

export default function DefencesGroup({ derived, energyShield }: { derived: DerivedStats | undefined; energyShield: number }) {
  const [helpOpen, setHelpOpen] = useState(false);
  if (!derived) return null;
  const rows = rowsOf(derived, energyShield).map(flagApprox);
  return (
    <section className="border-t border-border" data-testid="stat-defences">
      <h3 className="px-3 pt-3 text-xs text-foreground">Defences</h3>
      {/* Same grid, type size and row spacing as the main stat rows above (StatsPanel), so the sheet reads as one list. */}
      <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-3 py-3 text-sm">
        {rows.map((r) => (
          <div key={r.id} className="contents">
            <dt data-testid={`${r.id}-label`} title={r.hint} className="min-w-0 text-muted-foreground">
              {r.label}
            </dt>
            <dd data-testid={r.id} className="text-right text-foreground tabular-nums">
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
      {/* One 44px control for every explanation, instead of a 44px button per row (which made these rows twice as tall as the rest of the sheet). */}
      <div className="px-3">
        <button
          type="button"
          aria-expanded={helpOpen}
          aria-controls="stat-defences-help"
          onClick={() => setHelpOpen((o) => !o)}
          className="flex min-h-11 w-full items-center justify-between text-left text-xs text-muted-foreground"
          data-testid="stat-defences-help-toggle"
        >
          <span>What do these mean?</span>
          <span aria-hidden="true">{helpOpen ? '−' : '+'}</span>
        </button>
        {helpOpen ? (
          <dl id="stat-defences-help" data-testid="stat-defences-help" className="flex flex-col gap-2 pb-3 text-xs text-muted-foreground">
            {rows.map((r) => (
              <div key={r.id} data-testid={`${r.id}-hint`}>
                <dt className="text-foreground">{r.label}</dt>
                <dd>{r.hint}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
      <p className="px-3 pb-3 text-xs text-muted-foreground" data-testid="stat-defences-not-counted">
        Not counted: block, suppression, damage taken modifiers and damage conversion. Figures assume Path of Building&apos;s default enemy, a level 82 boss.
      </p>
    </section>
  );
}
