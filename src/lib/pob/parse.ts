// src/lib/pob/parse.ts
// =============================================================================
// Path of Building 2 XML -> typed data.
//
// Faithful and ignorant: this module reads what a PoB2 export contains and
// knows nothing about our tree, gems or items. Deciding what maps, what is
// dropped and what gets reported is mapBuild's job. Nothing here is guessed —
// a missing or malformed number comes back as null.
//
// Element and attribute names follow PoB2's own writer, read from its MIT
// source (src/Classes/PassiveSpec.lua Save) and confirmed against a real
// exported build (docs/superpowers/plans/2026-09-24-slice2-pob-import.md,
// "Verified facts"):
//
//   <Build level className ascendClassName mainSocketGroup>
//   <Tree activeSpec>
//     <Spec title nodes …>
//       <WeaponSet1 nodes/> <WeaponSet2 nodes/>      set-specific nodes only
//       <Sockets><Socket nodeId itemId/></Sockets>    jewels
//       <Overrides><AttributeOverride strNodes dexNodes intNodes/></Overrides>
//   <Skills activeSkillSet><SkillSet id><Skill label enabled><Gem …/></Skill>
//   <Items activeItemSet><Item id>clipboard text</Item><ItemSet id><Slot name itemId/>
//   <Notes>text</Notes>
//   <Config activeConfigSet><ConfigSet id><Input name string|boolean|number/>
// =============================================================================

import { DOMParser } from '@xmldom/xmldom';
import type { ConfigInput } from '@/lib/build/stats/buildConfig';

export interface PobGem {
  gemId: string | null;
  nameSpec: string | null;
  level: number | null;
  quality: number | null;
  enabled: boolean;
}

export interface PobSkillGroup {
  /**
   * 1-based position among ALL <Skill> elements of the skill set, empty label
   * rows included — because that is what Build@mainSocketGroup counts.
   */
  index: number;
  label: string;
  enabled: boolean;
  /** A group a passive, item or ascendancy grants (a `source` attribute): not a gem the player sockets. */
  granted?: boolean;
  gems: PobGem[];
}

export interface PobSpec {
  title: string;
  /** Every allocated node. */
  nodes: number[];
  /** Nodes tied to weapon set 1 only. Nodes in neither list are shared. */
  weaponSet1: number[];
  weaponSet2: number[];
  /** Which attribute each "+attribute" passive was set to. */
  attributeOverrides: { str: number[]; dex: number[]; int: number[] };
  jewelSockets: Array<{ nodeId: number; itemId: number }>;
}

export interface PobItem {
  id: number;
  /** The item's clipboard text, trimmed. */
  raw: string;
}

export interface PobSlot {
  name: string;
  itemId: number;
}

export interface PobBuild {
  level: number | null;
  className: string | null;
  ascendClassName: string | null;
  mainSocketGroup: number | null;
  /** 1-based index into `specs`. */
  activeSpec: number | null;
  specs: PobSpec[];
  skillGroups: PobSkillGroup[];
  items: PobItem[];
  /** Occupied slots of the active item set only; a slot holding item 0 is empty. */
  slots: PobSlot[];
  notes: string | null;
  /**
   * String-valued <Input>s named "quest..." in the active <ConfigSet>: PoB2's
   * chosen quest rewards (see mapQuests). Values keep PoB's own line breaks.
   */
  questInputs: { name: string; value: string }[];
  /**
   * Every other <Input> of the active <ConfigSet> (conditions, counts), or null when the export has no Config at
   * all. null is "unknown", an empty list is "nothing ticked": the difference matters (buildConfig.ts).
   */
  configInputs: ConfigInput[] | null;
  /**
   * The weapon set PoB had active when the code was made: the active <ItemSet>'s (else <Items>') useSecondWeaponSet.
   * Decides whose weapons and set-only passives PoB's own numbers include; "nil" or absent is the first set.
   */
  useSecondWeaponSet: boolean;
}

export type ParseError = 'malformed-xml' | 'no-build';

// xmldom's DOM types differ from lib.dom's; these are the few members used.
interface XmlElement {
  tagName: string;
  getAttribute(name: string): string | null;
  childNodes: { length: number; [index: number]: XmlNode };
  textContent: string | null;
}
interface XmlNode {
  nodeType: number;
}

const ELEMENT_NODE = 1;

function childElements(parent: XmlElement, tagName?: string): XmlElement[] {
  const found: XmlElement[] = [];
  for (let i = 0; i < parent.childNodes.length; i += 1) {
    const node = parent.childNodes[i];
    if (node.nodeType !== ELEMENT_NODE) continue;
    const element = node as unknown as XmlElement;
    if (tagName === undefined || element.tagName === tagName) found.push(element);
  }
  return found;
}

function firstChild(parent: XmlElement, tagName: string): XmlElement | null {
  return childElements(parent, tagName)[0] ?? null;
}

/** A non-negative integer attribute, or null. Never a guess. */
function intAttr(element: XmlElement | null, name: string): number | null {
  const value = element?.getAttribute(name);
  return value !== null && value !== undefined && /^\d+$/.test(value) ? Number(value) : null;
}

/** A string attribute, with an absent or empty value read as null. */
function strAttr(element: XmlElement, name: string): string | null {
  const value = element.getAttribute(name);
  return value ? value : null;
}

/** "1,x,3,,4.5,-2,7" -> [1, 3, 7]. Only plain non-negative integers are node ids. */
function idList(value: string | null | undefined): number[] {
  if (!value) return [];
  return value
    .split(',')
    .map((token) => token.trim())
    .filter((token) => /^\d+$/.test(token))
    .map(Number);
}

/** The element whose id matches `activeId`, else the first — PoB's own fallback. */
function pickActive(sets: XmlElement[], activeId: number | null): XmlElement | null {
  if (sets.length === 0) return null;
  if (activeId !== null) {
    const match = sets.find((set) => intAttr(set, 'id') === activeId);
    if (match) return match;
  }
  return sets[0];
}

function parseSpec(spec: XmlElement): PobSpec {
  const overrides = firstChild(spec, 'Overrides');
  const attributes = overrides ? firstChild(overrides, 'AttributeOverride') : null;
  const sockets = firstChild(spec, 'Sockets');

  return {
    title: spec.getAttribute('title') ?? '',
    nodes: idList(spec.getAttribute('nodes')),
    weaponSet1: idList(firstChild(spec, 'WeaponSet1')?.getAttribute('nodes')),
    weaponSet2: idList(firstChild(spec, 'WeaponSet2')?.getAttribute('nodes')),
    attributeOverrides: {
      str: idList(attributes?.getAttribute('strNodes')),
      dex: idList(attributes?.getAttribute('dexNodes')),
      int: idList(attributes?.getAttribute('intNodes')),
    },
    jewelSockets: sockets
      ? childElements(sockets, 'Socket')
          .map((socket) => ({ nodeId: intAttr(socket, 'nodeId'), itemId: intAttr(socket, 'itemId') }))
          .filter((s): s is { nodeId: number; itemId: number } => s.nodeId !== null && s.itemId !== null && s.itemId > 0)
      : [],
  };
}

function parseGem(gem: XmlElement): PobGem {
  return {
    gemId: strAttr(gem, 'gemId'),
    nameSpec: strAttr(gem, 'nameSpec'),
    level: intAttr(gem, 'level'),
    quality: intAttr(gem, 'quality'),
    enabled: gem.getAttribute('enabled') !== 'false',
  };
}

export function parsePobXml(xml: string): { ok: true; build: PobBuild } | { ok: false; error: ParseError } {
  // xmldom reports problems through this handler rather than throwing, and
  // would otherwise hand back a best-effort document built from broken XML.
  //
  // WARNINGS refuse the input too, not only errors. Verified on 2026-09-24:
  // xmldom 0.8.13 treats a mismatched closing tag
  // (<PathOfBuilding2><Build></PathOfBuilding2>) as a mere warning — with the
  // misleading message "unclosed xml attribute" — and silently auto-closes it.
  // Meanwhile the real 36 KB exported build parses with ZERO warnings, so
  // strictness costs nothing on the evidence available. The trade-off, stated
  // rather than hidden: a future real export that trips some harmless warning
  // would be refused as malformed-xml rather than half-imported. Revisit with
  // that export in hand; do not match on warning text, which is unreliable.
  let failed = false;
  const parser = new DOMParser({
    errorHandler: {
      warning: () => {
        failed = true;
      },
      error: () => {
        failed = true;
      },
      fatalError: () => {
        failed = true;
      },
    },
  });

  let root: XmlElement | null = null;
  try {
    const doc = parser.parseFromString(xml, 'text/xml');
    root = (doc?.documentElement as unknown as XmlElement | null) ?? null;
  } catch {
    failed = true;
  }
  if (failed || !root || root.tagName !== 'PathOfBuilding2') return { ok: false, error: 'malformed-xml' };

  const buildElement = firstChild(root, 'Build');
  if (!buildElement) return { ok: false, error: 'no-build' };

  const tree = firstChild(root, 'Tree');
  const specs = tree ? childElements(tree, 'Spec').map(parseSpec) : [];

  const skills = firstChild(root, 'Skills');
  const skillSet = skills ? pickActive(childElements(skills, 'SkillSet'), intAttr(skills, 'activeSkillSet')) : null;
  const skillGroups: PobSkillGroup[] = skillSet
    ? childElements(skillSet, 'Skill').map((skill, i) => ({
        index: i + 1,
        label: skill.getAttribute('label') ?? '',
        enabled: skill.getAttribute('enabled') !== 'false',
        granted: Boolean(skill.getAttribute('source')),
        gems: childElements(skill, 'Gem').map(parseGem),
      }))
    : [];

  const itemsElement = firstChild(root, 'Items');
  const items: PobItem[] = itemsElement
    ? childElements(itemsElement, 'Item')
        .map((item) => ({ id: intAttr(item, 'id'), raw: (item.textContent ?? '').trim() }))
        .filter((item): item is PobItem => item.id !== null && item.raw !== '')
    : [];
  const itemSet = itemsElement
    ? pickActive(childElements(itemsElement, 'ItemSet'), intAttr(itemsElement, 'activeItemSet'))
    : null;
  const slots: PobSlot[] = itemSet
    ? childElements(itemSet, 'Slot')
        .map((slot) => ({ name: slot.getAttribute('name') ?? '', itemId: intAttr(slot, 'itemId') }))
        .filter((slot): slot is PobSlot => slot.name !== '' && slot.itemId !== null && slot.itemId > 0)
    : [];

  const useSecondWeaponSet = (itemSet?.getAttribute('useSecondWeaponSet') ?? itemsElement?.getAttribute('useSecondWeaponSet')) === 'true';

  const configElement = firstChild(root, 'Config');
  const configSet = configElement ? pickActive(childElements(configElement, 'ConfigSet'), intAttr(configElement, 'activeConfigSet')) : null;
  const questInputs = configSet
    ? childElements(configSet, 'Input')
        .map((input) => ({ name: input.getAttribute('name') ?? '', value: input.getAttribute('string') }))
        .filter((input): input is { name: string; value: string } => input.name.startsWith('quest') && input.value !== null && input.value !== '')
    : [];

  const configInputs: ConfigInput[] | null = configSet
    ? childElements(configSet, 'Input')
        .map((input) => {
          const bool = input.getAttribute('boolean');
          const num = input.getAttribute('number');
          return {
            name: input.getAttribute('name') ?? '',
            boolean: bool === 'true' ? true : bool === 'false' ? false : null,
            number: num !== null && num !== '' && Number.isFinite(Number(num)) ? Number(num) : null,
          };
        })
        .filter((input) => input.name !== '' && !input.name.startsWith('quest'))
    : null;

  const notesText = firstChild(root, 'Notes')?.textContent?.trim() ?? '';

  return {
    ok: true,
    build: {
      level: intAttr(buildElement, 'level'),
      className: strAttr(buildElement, 'className'),
      ascendClassName: strAttr(buildElement, 'ascendClassName'),
      mainSocketGroup: intAttr(buildElement, 'mainSocketGroup'),
      activeSpec: intAttr(tree, 'activeSpec'),
      specs,
      skillGroups,
      items,
      slots,
      notes: notesText === '' ? null : notesText,
      questInputs,
      configInputs,
      useSecondWeaponSet,
    },
  };
}
