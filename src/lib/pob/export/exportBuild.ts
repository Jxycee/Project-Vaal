// src/lib/pob/export/exportBuild.ts
// =============================================================================
// Our build -> Path of Building 2 XML, plus the report of what could not go.
// The inverse of mapBuild; the round-trip test (roundTrip.data.test.ts) holds
// the two together.
//
// Formats are PoB2's own, read from its MIT source on 2026-10-06 and from the
// real exports in this repo:
//
// - <Spec>: PassiveSpec.lua Load/Save. It needs `nodes` plus a class. We write
//   the NEW format, `classInternalId` (the tree export's class index) and
//   `ascendancyInternalId` ("Mercenary2", "" for none): Load prefers them, and
//   the legacy `classId` is remapped by `treeVersion` so it cannot be written
//   safely. `treeVersion` is "0_5", PoB2's latest (GameVersions.lua), the tree
//   our data is. Start nodes are NOT listed: SelectClass / SelectAscendClass
//   allocate them. <WeaponSetN nodes> lists only the nodes tied to one set; a
//   node in neither is shared. <URL> is legacy and only read when `nodes` is
//   absent, so it is omitted.
// - <Skills>/<SkillSet>/<Skill>/<Gem>: SkillsTab.lua Load. A gem is found by
//   its full `gemId` (gemsByGameId) and `variantId`; both come from
//   pobGemIds.json (scripts/sync-pob-gem-ids.ts).
// - <Config>: ConfigOptions.lua quest list: <Input name=quest... string=reward>.
//
// PoB2 keeps ONE item set and ONE skill set for the whole build, so gear and
// gems come from the active checkpoint only, and the report says so. Jewels
// are socketed on every spec.
// =============================================================================

import { deflateSync } from 'node:zlib';
import { MAX_NOTES_LENGTH } from '@/lib/build/constants';
import { GEAR_SLOTS, type GearItem, type GearSlot } from '@/lib/build/gearSlots';
import type { GearState } from '@/lib/build/gearState';
import type { GemState } from '@/lib/build/gemState';
import { CHOICE_QUEST_BY_ID } from '@/lib/build/stats/campaign';
import type { PassiveState } from '@/lib/build/types';
import type { Catalogue } from '../catalogue';
import { levelInTitle } from '../mapBuild';
import { POB_SLOT_NAME } from '../mapItems';
import type { ReportEntry } from '../report';
import { itemText } from './exportItems';
import gemIds from './pobGemIds.json';

/** PoB2's latest tree version (GameVersions.lua treeVersionList) - the tree our data is. */
const TREE_VERSION_TAG = '0_5';
/** PoB2's live target version (GameVersions.lua liveTargetVersion). */
const TARGET_VERSION = '0_1';
const MAX_CHECKPOINT_NAME_LENGTH = 80;

export interface ExportCheckpoint {
  name: string;
  level: number;
  passive_state: PassiveState;
  gear_state: GearState;
  gem_state: GemState;
}

export interface ExportInput {
  build: { name: string; class: string; ascendancy: string | null; level: number; notes: string | null };
  /** In order. Never empty. */
  checkpoints: ExportCheckpoint[];
  /** The checkpoint whose gear and gems PoB2's single item set and skill set take. */
  activeIndex: number;
}

export type ExportResult = { ok: true; xml: string; report: ReportEntry[] } | { ok: false; error: string };

interface PobGemIds {
  gameId: string;
  variantId: string;
  grantedEffectId: string;
}
const GEM_IDS = gemIds as Record<string, PobGemIds>;

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** The checkpoint's name as PoB2's title, with " (Level N)" appended only when the title would not already read as that level. */
function specTitle(name: string, level: number): string {
  if (levelInTitle(name) === level) return name;
  const suffix = ` (Level ${level})`;
  return name.slice(0, MAX_CHECKPOINT_NAME_LENGTH - suffix.length).trimEnd() + suffix;
}

function nodeList(ids: Iterable<number>): string {
  return [...new Set(ids)].sort((a, b) => a - b).join(',');
}

function specXml(
  cp: ExportCheckpoint,
  classIndex: number,
  ascendancyId: string | null,
  jewelSockets: { nodeId: string; itemId: number }[],
): string {
  const p = cp.passive_state;
  const set1 = new Set(p.set1);
  const set2 = new Set(p.set2);
  const only1 = p.set1.filter((id) => !set2.has(id));
  const only2 = p.set2.filter((id) => !set1.has(id));
  const choices = p.attributeChoices ?? {};
  const by = (attr: string) =>
    nodeList(
      Object.entries(choices)
        .filter(([, c]) => c === attr)
        .map(([id]) => Number(id)),
    );

  const attrs = [
    `title="${esc(specTitle(cp.name, cp.level))}"`,
    `treeVersion="${TREE_VERSION_TAG}"`,
    `classInternalId="${classIndex}"`,
    `ascendancyInternalId="${esc(ascendancyId ?? '')}"`,
    `secondaryAscendClassId="0"`,
    `nodes="${nodeList([...p.set1, ...p.set2, ...p.ascendancyNodes])}"`,
    `masteryEffects=""`,
  ];
  const children = [
    only1.length > 0 ? `\t\t\t<WeaponSet1 nodes="${nodeList(only1)}"/>` : '',
    only2.length > 0 ? `\t\t\t<WeaponSet2 nodes="${nodeList(only2)}"/>` : '',
    jewelSockets.length === 0
      ? '\t\t\t<Sockets/>'
      : `\t\t\t<Sockets>\n${jewelSockets.map((s) => `\t\t\t\t<Socket nodeId="${s.nodeId}" itemId="${s.itemId}"/>`).join('\n')}\n\t\t\t</Sockets>`,
    `\t\t\t<Overrides>\n\t\t\t\t<AttributeOverride strNodes="${by('str')}" dexNodes="${by('dex')}" intNodes="${by('int')}"/>\n\t\t\t</Overrides>`,
  ].filter(Boolean);
  return `\t\t<Spec ${attrs.join(' ')}>\n${children.join('\n')}\n\t\t</Spec>`;
}

export async function exportPobXml(input: ExportInput, catalogue: Catalogue): Promise<ExportResult> {
  const { build, checkpoints } = input;
  const classIndex = catalogue.tree.classIndexOf(build.class);
  if (classIndex === null) return { ok: false, error: `${build.class} is not in this patch's passive tree, so it cannot be exported.` };
  if (checkpoints.length === 0) return { ok: false, error: 'This build has no checkpoints to export.' };
  const activeIndex = Math.min(Math.max(input.activeIndex, 0), checkpoints.length - 1);
  const active = checkpoints[activeIndex];
  const report: ReportEntry[] = [];

  const ascendancyId = build.ascendancy ? catalogue.tree.ascendancyIdFor(build.class, build.ascendancy) : null;
  if (build.ascendancy && !ascendancyId) {
    report.push({ kind: 'dropped', area: 'build', message: `The ascendancy ${build.ascendancy} is not a ${build.class} ascendancy in this patch, so it was left out.` });
  }

  // Our gem slug -> PoB2's ids, through the catalogue's table (GGG id -> gem).
  const pobIdsBySlug = new Map<string, PobGemIds>();
  for (const [key, gem] of catalogue.gems) {
    const ids = GEM_IDS[key];
    if (ids) pobIdsBySlug.set(gem.slug, ids);
  }
  const gemXml = (item: GearItem, level: number, quality: number): string | null => {
    const ids = pobIdsBySlug.get(item.slug);
    if (!ids) {
      report.push({ kind: 'dropped', area: 'gems', message: `${item.name} has no Path of Building 2 id on record, so it was left out.` });
      return null;
    }
    return `\t\t\t\t<Gem enabled="true" level="${level}" quality="${quality}" gemId="${ids.gameId}" variantId="${ids.variantId}" skillId="${ids.grantedEffectId}" nameSpec="${esc(item.name)}" count="1" enableGlobal1="true" enableGlobal2="true"/>`;
  };

  // ---- Items: one numbered <Item> per worn item and per jewel ------------
  const itemXml: string[] = [];
  const slotXml: string[] = [];
  let nextItemId = 1;
  const addItem = async (item: GearItem, where: string): Promise<number> => {
    const id = nextItemId++;
    itemXml.push(`\t\t<Item id="${id}">\n${esc(await itemText(item, where, report))}\n\t\t</Item>`);
    return id;
  };
  for (const slot of GEAR_SLOTS as readonly GearSlot[]) {
    const item = active.gear_state[slot];
    if (!item) continue;
    slotXml.push(`\t\t\t<Slot name="${POB_SLOT_NAME[slot]}" itemId="${await addItem(item, POB_SLOT_NAME[slot])}"/>`);
  }
  const jewelSockets: { nodeId: string; itemId: number }[] = [];
  for (const [nodeId, jewel] of Object.entries(active.gear_state.jewels)) {
    jewelSockets.push({ nodeId, itemId: await addItem(jewel, `jewel socket ${nodeId}`) });
  }

  // ---- Skills: one <Skill> per loadout, no label rows --------------------
  const skillXml: string[] = [];
  let mainGroup = 0;
  for (const loadout of active.gem_state.loadouts) {
    if (!loadout.skill) continue;
    const lead = gemXml(loadout.skill, loadout.level, loadout.quality);
    if (lead === null) continue;
    const gems = [lead, ...loadout.supports.map((s) => gemXml(s, 1, 0))].filter((g): g is string => g !== null);
    skillXml.push(
      `\t\t\t<Skill enabled="true" includeInFullDPS="false" label="" mainActiveSkill="1" mainActiveSkillCalcs="1" set1="${loadout.sets.includes(1)}" set2="${loadout.sets.includes(2)}">\n${gems.join('\n')}\n\t\t\t</Skill>`,
    );
    if (loadout.id === active.gem_state.primaryId) mainGroup = skillXml.length;
  }

  // ---- Quest rewards -----------------------------------------------------
  const questXml: string[] = [];
  for (const [questId, optionId] of Object.entries(active.passive_state.questChoices ?? {})) {
    const quest = CHOICE_QUEST_BY_ID.get(questId);
    const option = quest?.options.find((o) => o.id === optionId);
    if (!quest || !option) continue;
    // PoB2 writes a reward's lines separated by a newline and a tab.
    questXml.push(`\t\t\t<Input name="${esc(quest.pobKey)}" string="${esc(option.text.replace(/ \/ /g, '\n\t'))}"/>`);
  }

  // ---- Tree --------------------------------------------------------------
  const specs = checkpoints.map((cp) => specXml(cp, classIndex, ascendancyId, jewelSockets));

  if (checkpoints.length > 1) {
    report.push({
      kind: 'note',
      area: 'build',
      message: `Path of Building stores one set of gear and one set of skill gems, so those come from "${active.name}"; the other ${checkpoints.length - 1} checkpoint(s) export their passive tree only.`,
    });
  }
  const notes = (build.notes ?? '').slice(0, MAX_NOTES_LENGTH);

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<PathOfBuilding2>',
    `\t<Build level="${build.level}" className="${esc(build.class)}" ascendClassName="${esc(build.ascendancy ?? 'None')}" targetVersion="${TARGET_VERSION}" mainSocketGroup="${mainGroup || 1}" viewMode="TREE"/>`,
    `\t<Tree activeSpec="${activeIndex + 1}">`,
    ...specs,
    '\t</Tree>',
    `\t<Notes>${esc(notes)}</Notes>`,
    '\t<Skills activeSkillSet="1">\n\t\t<SkillSet id="1">',
    ...skillXml,
    '\t\t</SkillSet>\n\t</Skills>',
    '\t<Items activeItemSet="1" useSecondWeaponSet="false">',
    ...itemXml,
    '\t\t<ItemSet id="1" useSecondWeaponSet="false">',
    ...slotXml,
    '\t\t</ItemSet>\n\t</Items>',
    '\t<Config activeConfigSet="1">\n\t\t<ConfigSet id="1" title="Default">',
    ...questXml,
    '\t\t</ConfigSet>\n\t</Config>',
    '</PathOfBuilding2>',
  ].join('\n');
  return { ok: true, xml, report };
}

/** The share code: zlib-deflate the XML, base64, URL-safe. decode.ts run backwards. */
export function encodePobCode(xml: string): string {
  return deflateSync(Buffer.from(xml, 'utf8')).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
}
