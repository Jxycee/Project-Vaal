// Per-act color identity for the Campaign Tracker header — no artwork, just
// the palette pulled from each act's real final boss (see
// THIRD-PARTY-NOTICES.md and CampaignTracker's footer for where the boss
// data itself comes from). `boss` is the subtitle shown under the act name;
// `base` tints the header wash and icon box, `accent` is the brighter tone
// used for text/border/the "Cleared" pill — legible on the app's dark
// background. Every hue below is deliberately spread out (see the HSL
// check this was tuned against) so no two acts read as the same color at a
// glance — Doryani's devised maroon/purple/gold all landed on top of
// Interlude's red and Epilogue's gold, so Act 3 uses a Vaal-green reading
// of his arcane energy instead, which is at least as on-theme (Vaal
// corruption is one of the series' most established color cues) and frees
// up the hue. Interlude has three tracked final bosses, one per storyline
// (Oswin, then Azmadi, then Zolin and Zelina); the subtitle names all
// three but the color still follows Zolin and Zelina, the one that caps
// the section. Epilogue has no tracked boss fight at all, so it stays on
// the app's own primary gold rather than an invented color.
export interface ActTheme {
  boss: string
  base: string
  accent: string
}

export const ACT_THEME: Record<string, ActTheme> = {
  act1: { boss: 'Count Geonor', base: '#3d5468', accent: '#bfe3f5' },
  act2: { boss: 'Jamanra, the Abomination', base: '#7a5a34', accent: '#c7a9ff' },
  act3: { boss: 'Doryani, Royal Thaumaturge', base: '#163b2a', accent: '#5fdd9e' },
  act4: { boss: 'Tavakai, the Chieftain', base: '#7a4a30', accent: '#ff9a5c' },
  interlude: { boss: 'Oswin, Azmadi, Zolin & Zelina', base: '#3a1015', accent: '#ef6b82' },
  epilogue: { boss: 'Siege Of Oriath', base: 'var(--primary)', accent: 'var(--primary)' },
}
