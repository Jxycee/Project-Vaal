// Static campaign checkpoint data — Acts 1-4 plus the Interlude, one entry per
// notable area/boss reward stop. Hand-authored from the current 0.5.x
// campaign layout (not GGG's own export — there's no official machine-
// readable source for this), so it needs a manual pass each time a patch
// reshuffles acts. Ids are derived from area+boss text, not hand-typed, so
// content edits can't silently break a user's saved progress by drifting
// from whatever id a person typed by hand.

/** What kind of reward a checkpoint grants, purely for the reward chip's styling. */
export type RewardKind = 'passive-point' | 'stat' | 'utility' | 'unknown'

export interface CampaignReward {
  text: string
  kind: RewardKind
}

export interface CampaignArea {
  /** Stable id: `${actId}-${slug(area)}-${slug(boss)}` — this is the key saved to campaign_progress.progress. */
  id: string
  area: string
  boss: string
  rewards: CampaignReward[]
}

export interface CampaignAct {
  id: string
  name: string
  areas: CampaignArea[]
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function stat(text: string): CampaignReward {
  return { text, kind: 'stat' }
}
function point(text: string): CampaignReward {
  return { text, kind: 'passive-point' }
}
function utility(text: string): CampaignReward {
  return { text, kind: 'utility' }
}
function unknown(text: string): CampaignReward {
  return { text, kind: 'unknown' }
}

interface RawArea {
  area: string
  boss: string
  rewards: CampaignReward[]
}
interface RawAct {
  id: string
  name: string
  areas: RawArea[]
}

const RAW: RawAct[] = [
  {
    id: 'act1',
    name: 'Act 1',
    areas: [
      { area: 'Clearfell', boss: 'Beira of the Rotten Pack', rewards: [stat('+10% to Cold Resistance')] },
      { area: 'Hunting Grounds', boss: 'The Crowbell', rewards: [point('Grants Two Weapon Set Passive Skill Points')] },
      { area: 'Freythorn', boss: 'The King in the Mists', rewards: [stat('+30 to Spirit')] },
      { area: 'Ogham Farmlands', boss: "Una's Hut", rewards: [point('Grants Two Weapon Set Passive Skill Points')] },
      { area: 'Ogham Manor', boss: 'Candlemass, the Living Rite', rewards: [stat('+20 to maximum Life')] },
    ],
  },
  {
    id: 'act2',
    name: 'Act 2',
    areas: [
      { area: 'Keth', boss: 'Kabala, Constrictor Queen', rewards: [point('Grants Two Weapon Set Passive Skill Points')] },
      {
        area: 'Valley of the Titans',
        boss: 'Medallion',
        rewards: [stat('30% increased Charm Effect Duration'), stat('+1 Charm Slot')],
      },
      { area: 'Deshar', boss: 'Final Letter', rewards: [point('Grants Two Weapon Set Passive Skill Points')] },
      { area: 'The Spires of Deshar', boss: 'Sisters of Garukhan', rewards: [stat('+10% to Lightning Resistance')] },
    ],
  },
  {
    id: 'act3',
    name: 'Act 3',
    areas: [
      { area: 'Jungle Ruins', boss: 'Mighty Silverfist', rewards: [point('Grants Two Weapon Set Passive Skill Points')] },
      { area: 'The Venom Crypts', boss: 'Venom Draught', rewards: [stat('25% increased Stun Threshold')] },
      { area: "Jiquani's Machinarium", boss: 'Blackjaw, the Remnant', rewards: [stat('+10% to Fire Resistance')] },
      { area: 'The Azak Bog', boss: 'Ignagduk, the Bog Witch', rewards: [stat('+30 to Spirit')] },
      { area: 'The Molten Vault', boss: 'The Molten Vault', rewards: [utility('Reforging Bench')] },
      { area: 'Aggorat', boss: 'Blood Sacrifice', rewards: [point('Grants Two Weapon Set Passive Skill Points')] },
    ],
  },
  {
    id: 'act4',
    name: 'Act 4',
    areas: [
      {
        area: "Journey's End",
        boss: 'Captain Hartlin',
        rewards: [point('Two Weapon Set Passive Skill Points'), utility('Skill Gem (Lv 13)'), utility('Delirium Drop')],
      },
      { area: 'Whakapanu Island', boss: 'Great White One', rewards: [unknown('Not specified — 2 choices')] },
      { area: 'Eye of Hinekora', boss: "Navali's Rest", rewards: [stat('5% increased Maximum Mana')] },
      { area: 'Halls of the Dead', boss: 'Yama The White', rewards: [point('Grants Two Weapon Set Passive Skill Points')] },
      { area: 'Halls of the Dead', boss: "Tawhoa's Test", rewards: [stat('+5% to Lightning Resistance')] },
      { area: 'Abandoned Prison', boss: 'Goddess of Justice', rewards: [stat('30% increased Mana Recovery from Flasks')] },
      { area: 'Halls of the Dead', boss: "Tasalio's Test", rewards: [stat('+5% to Cold Resistance')] },
      { area: 'Halls of the Dead', boss: "Ngamahu's Test", rewards: [stat('+5% to Fire Resistance')] },
      { area: 'Halls of the Dead', boss: 'Tribal Medicine', rewards: [stat('30% increased Armour, Evasion and Energy Shield')] },
    ],
  },
  {
    id: 'interlude',
    name: 'Interlude',
    areas: [
      { area: 'Wolvenhold', boss: 'Oswin, the Dread Warden', rewards: [point('Grants Two Weapon Set Passive Skill Points')] },
      { area: 'The Khari Crossing', boss: 'Akthi and Anundr', rewards: [point('Two Weapon Set Passive Skill Points')] },
      { area: 'The Khari Crossing', boss: 'Molten Shrine', rewards: [stat('5% increased Maximum Life')] },
      { area: 'Qimah', boss: "Tabana's Pillar", rewards: [stat('15% increased Armour, Evasion and Energy Shield')] },
      { area: 'Kriar Village', boss: 'Lythara, the Wayward Spear', rewards: [stat('+40 to Spirit')] },
      { area: 'Howling Caves', boss: 'The Abominable Yeti', rewards: [point('Grants Two Weapon Set Passive Skill Points')] },
    ],
  },
]

export const CAMPAIGN: CampaignAct[] = RAW.map((act) => ({
  id: act.id,
  name: act.name,
  areas: act.areas.map((a) => ({
    id: `${act.id}-${slugify(a.area)}-${slugify(a.boss)}`,
    area: a.area,
    boss: a.boss,
    rewards: a.rewards,
  })),
}))

/** Every checkpoint id across every act, flattened — for total-progress math and reset. */
export const ALL_CHECKPOINT_IDS: string[] = CAMPAIGN.flatMap((act) => act.areas.map((a) => a.id))
