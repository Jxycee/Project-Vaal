# PoE2 Accessibility, Stability, Monetization & Platform Notes — Research

## Last updated
September 16, 2026 (patch 0.5.5 "Forbidden Rites," event league on base 0.5.0 "Return of the Ancients"; 1.0 targeted Dec 11, 2026)

## Method note
`pathofexile.com`, `maxroll.gg`, `game8.co`, `gamespot.com` all blocked by sandbox egress proxy (WebFetch → `EGRESS_BLOCKED`). All findings below sourced via WebSearch snippet synthesis, not direct page fetch. Treat forum-thread contents and exact bug lists as secondhand — verify against primary source (forum thread URLs given) before hard-citing in app copy.

---

## 1. Accessibility & quality-of-life settings

**Colorblind support**
- No confirmed dedicated colorblind mode/palette-swap in settings menu. Multiple community threads ask for one (Steam "Colour Blind Conundrum," PoE1-era forum thread from a colorblind player) — pattern suggests still unaddressed as of research date.
- Workaround in practice: custom loot-filter files can reassign item-label colors, but this is a community-driven filter hack, not a built-in accessibility feature, and doesn't touch UI/map/skill-effect colors.

**Text size / UI scale**
- General UI scale option exists but not fine-grained per-element text sizing. Complaints: on 4K displays UI art/text render oversized; on Xbox, HUD text described as unreadably tiny from typical couch/TV viewing distance. Steam thread "HUD Font Size" tracks this specifically.
- Visually-impaired players report the game currently unplayable for them absent better scaling (Facebook community post, dedicated forum thread "Accessibility features for the blind").

**Subtitles**
- Full voice-over with subtitles on by default. No confirmed subtitle size/color/background customization found — open question.

**Control remapping (console)**
- Native support for DualSense, DualShock 4, Xbox Wireless Controllers, and generic XInput pads; auto-detects controller layout, manual override available.
- Depth of custom button remapping is a known gap: EA-era forum thread explicitly titled "POE 2 please let us map our buttons on controller" (pathofexile.com/forum/view-thread/3601524) indicates full custom rebinding was requested-not-delivered at time of posting. Current 0.5.5 status unconfirmed — re-verify.
- No mid-session input-device hot-swap: switching between controller and keyboard/mouse requires manually toggling input mode (no auto-detect on touch, unlike Diablo 4 / BG3). Console has no KB+M option at all, so this mainly affects PC, but confirms remapping/input-mode systems are not adaptive.
- Physical-accessibility complaint: some control schemes require pressing multiple simultaneous buttons; forum requests exist for accessibility-friendly single-button alternatives for players with limited dexterity.
- PS5 UI-legend complaint: contextual button-prompt legend (e.g., "Triangle to sell/drop") in shop/inventory screens is not always visible or adjustable, forcing guesswork on inputs.

**Commonly requested QoL (community "ask GGG" list, 2025-2026)**
- In-game LFG/party-finder (currently none — see §4).
- Console import support for shared Build Planner codes (PC-only as of 0.5.x; console can browse/edit the in-game planner natively but can't import a community `.build`-style code).
- Dead-summary / death-recap tool showing exact damage source and type after a death — **delivered in 0.5.5** after long-standing requests.
- UI quick-use shortcuts for Strongboxes/Essences without opening inventory — in progress/delivered per 0.5.x notes.
- Reduced campaign-replay burden at league start (veterans frustrated re-running 30-50 hrs of story each league).
- Better controller cursor persistence in stash (cursor resets position after every item move — long-standing complaint carried over from PoE1).
- Full tab-list overview in stash UI (currently heavy scrolling to find a tab).

---

## 2. Known bugs / stability issues (as of 2026)

**How GGG communicates known issues**
- Official pinned forum thread: "Early Access Bug Reports - Known Issues" — pathofexile.com/forum/view-thread/3594260. Lists **high-priority issues only**; absence from the list does not mean GGG is unaware of a bug.
- Bug reporting channels: in-game `/bug` chat command for quickly-reproducible issues; forum post for issues needing detailed repro steps.
- No public issue-tracker (no GitHub-style tracker) — the forum thread is the closest thing to a status board.

**Notable 2025-2026 issues (from community/patch discussion)**
- Post-"Dawn of the Hunt" update: crash-on-launch bug for a subset of players, acknowledged and hotfixed by GGG.
- "Unknown object type serialized by server" error on zone load — hotfixed but reportedly persisted for some players afterward.
- Missing data file tied to the passive tree caused **server-side crashes** for characters with a radius Jewel covering newly-added tree nodes (server-authoritative bug, affected everyone near that node, not just the Jewel owner).
- Windows 24H2-specific PC crash (platform/OS-driver interaction, not console).
- SSF (Solo Self-Found) → trade-league character migration failures.
- Delirium encounters occasionally spawning no monsters (broken reward loop).
- Ritual Altars sometimes failing to activate.

**Save/data corruption**
- PoE2 characters are server-authoritative (online-only) — "save corruption" in practice is mostly local client cache/config corruption, not lost server-side character data. Most-cited trigger: forced shutdown or interrupted install during a patch update leaving local files incomplete/corrupted, causing crash-on-launch until a verify/reinstall.

**Console-specific stability**
- Distinct PS5/Xbox crash or frame-rate data is thin in available sources — most stutter/FPS discussion found is PC-centric (shader-compile stutter, asset-streaming hitches, GPU/driver regressions). **Flag as weak/unverified for console specifically** — do not assume PC performance findings transfer 1:1 to console hardware.
- General trend: stability has improved patch-over-patch through 2026; GGG has stated commitment to broader stability passes in major (0.x.0) releases.

---

## 3. Monetization

**Model**
- Confirmed free-to-play with no pay-to-win: Steam store page states "Fair-To-Play. Never Pay-To-Win."
- **Important EA/1.0 distinction**: during Early Access (Dec 2024 – Dec 10, 2026), entry requires purchasing a Supporter/Founder Pack starting at **$30**, which bundles 300 MTX-shop points. This is a temporary EA-access paywall, not the permanent model.
- At **1.0 launch (Dec 11, 2026)**, this paywall is removed entirely — full six-act campaign, all classes (including the new Duelist, PoE2's first sword-class, launching with 1.0), and endgame become free with no purchase required. This matches original PoE1's permanent monetization model (cosmetics + stash tabs only).

**What's actually monetized**
- Cosmetic MTX: character skins, weapon effects, portal effects, companion pets, (presumably) hideout decorations — no stat/gameplay effect.
- Stash tabs: convenience/organization purchase, not power. Confirmed point prices found: Extra Tab 30 pts, Premium Tab 40 pts, Currency Tab 75 pts, Map Tab 150 pts. (Gem, Fragment, Divination Card, and Unique tabs also exist per shop listings — exact prices for those not confirmed in this research pass.)
- Higher-tier Supporter Packs: more cosmetics + more points, on top of the base $30 tier.
- Points bought directly via in-client MTX shop or the website shop.
- Recurring Stash Tab Sales: roughly every 3 weeks, running ~4 days, with tabs discounted (e.g., normal Extra Tab commonly down to ~20 pts from 30).

**2025-2026 monetization complaints/controversies**
- "Pay for convenience, not pay-to-win" is the community's own framing, but stash tabs (esp. Currency tab) are widely described as functionally mandatory for comfortable endgame play — a recurring friction point even though it's not power-gated.
- Complaint: the Currency Tab (most-needed tab) was reportedly excluded from a stash sale while other tabs were discounted — some players called this a deliberate omission.
- Complaint: sale timing seen as unfair to brand-new EA buyers vs. veterans who'd already bought tabs pre-sale to reach endgame.
- Cosmetic pricing complaints: specific examples cited around $45 for a single skin, drawing "predatory pricing" style criticism in community discussion (no evidence of actual pay-to-win items, complaint is purely about price level).
- Cross-platform purchase lock (see §4) is itself a recurring monetization-adjacent complaint: PlayStation MTX/stash-tab purchases do not carry to PC/Xbox, effectively forcing a rebuy for players who switch primary platform.

---

## 4. Cross-platform account/social features

**Crossplay**
- Full crossplay across PC, PS5, and Xbox Series X|S — party together, run campaign/endgame/leagues together regardless of platform mix. **PS4 not supported** (last-gen excluded; crossplay is current-gen + PC only).
- Party size: up to 6 players, cross-platform.
- PC: crossplay always on, no opt-out.
- PS5/Xbox: crossplay can be disabled at the **console's own system level** (Account/Network settings), not an in-game PoE2 toggle — opts the player out of cross-platform matchmaking/parties.

**Cross-progression (cross-save)**
- Characters, items, and league progress carry across PC/PS5/Xbox once each platform account is linked to the player's PoE account. Available since EA launch (Dec 2024) — not a late addition.

**Friends / adding players**
- Add by **PoE account name**, not platform gamertag/PSN ID — no automatic sync with a platform's native friends list. Search account name in the social menu, send party invite; works across platforms since it's account-based, not platform-based.

**Guilds**
- Same guilds, same global chat, and trading work identically regardless of platform — guild membership is account-based like everything else, no console-specific restriction found.

**Party finder / LFG**
- **No native in-game LFG or party-finder system.** Players rely on third-party tools (Discord communities, LFG-network.com, Guilded) to organize groups outside the client. This is a long-standing PoE1 pattern carried into PoE2.

**What does NOT cross platforms**
- Purchased MTX/cosmetics and stash tabs are **platform-locked**: PlayStation purchases stay on PlayStation only; PC and Xbox purchases are shared with each other. This is the one meaningful crossplay/cross-progression carve-out.

---

## 5. Twitch / streaming integration

- **Twitch Drops** exist and are the extent of confirmed streaming integration — no evidence found of deeper integration (channel-point redemptions, Twitch Extensions overlays, in-stream event voting).
- Cosmetic-only rewards, no gameplay advantage — consistent with the no-pay-to-win stance. Examples seen: "Blade of the Champion" pet cosmetic tied to the 0.5.5 "Forbidden Rites" event; "Lightbringer Hood" from an earlier campaign.
- Reward types vary by campaign: helmet attachments, weapon effects, portal effects, pet cosmetics.
- Watch-time thresholds vary per campaign/tier: examples range from ~30 minutes up to 2-3 hours of watch time on a participating channel.
- Setup: link Twitch account via pathofexile.com → account management → "Social Connections." Then watch any channel streaming in the PoE2 Twitch category with drops enabled during the active campaign window; progress and rewards apply automatically via the linked account.
- Drops are typically tied to promotional windows around major content drops/events (e.g., tied to 0.5.5 launch), not a permanently-running program.

---

## Open questions / re-verify

- Whether a native colorblind mode/filter has shipped in any settings menu as of 0.5.5 — evidence found is all "please add this," none confirming it exists.
- Current (0.5.5, Sept 2026) status of full custom controller button remapping — sourced request thread predates this patch; may have shipped since.
- Subtitle customization options (size/color/background) — not found either way.
- PS5/Xbox-specific frame-rate and crash telemetry — available sources skew PC-centric; console-specific performance claims here are weak and should be re-verified against console-focused threads/patch notes directly.
- Exact point prices for Gem Tab, Fragment Tab, Divination Card Tab, and Unique Tab (only Extra/Premium/Currency/Map confirmed here).
- Granularity of the console-level crossplay opt-out — unclear whether disabling it still allows matchmaking within the same console platform (e.g., PS5-only pool) or disables all multiplayer.
- Whether GGG has stated plans for a native in-game LFG/party-finder system beyond community requests.
- All pathofexile.com forum thread contents cited here are from search-snippet summaries, not direct fetch (blocked) — re-verify direct thread text before quoting GGG language verbatim in-app.

---

## Sources

- https://steamcommunity.com/app/2694490/discussions/0/596260925367953989/ (HUD Font Size)
- https://www.facebook.com/groups/pathofexile2officialcommunity/posts/1238389924110718/ (Accessibility Issues for Visually Impaired)
- https://steamcommunity.com/app/2694490/discussions/0/594008890765574204/ (Accessibility)
- https://steamcommunity.com/app/2694490/discussions/0/594008890765518467/ (The accessibility of the game (so bad))
- https://en.wikipedia.org/wiki/Path_of_Exile_2
- https://www.pathofexile.com/forum/view-thread/3662049 (Feedback and Favorites: Accessibility & More in PoE2 EA)
- https://pathofexile2.wiki.fextralife.com/Controls
- https://steamcommunity.com/app/2694490/discussions/0/598515152383398974/ (Xbox Elite 2 controller button mapping)
- https://game8.co/games/Path-of-Exile-2/archives/488469 (Is There Controller Support?)
- https://www.sportskeeda.com/mmo/path-exile-2-poe2-controller-support-guide
- https://www.pathofexile.com/forum/view-thread/3601524 (POE 2 please let us map our buttons on controller)
- https://noping.com/blog/how-to-fix-path-of-exile-2-crashing-on-pc
- https://www.exitlag.com/blog/path-of-exile-2-crashing/
- https://www.pcgamesn.com/path-of-exile-2/downtime-server-crash-dump
- https://game8.co/games/Path-of-Exile-2/archives/507743 (List of Known Bugs and Errors)
- https://boostmatch.gg/blog/poe-2/articles/path-of-exile-2-deadlock-detected-fix
- https://maxroll.gg/poe2/news/known-issues-update
- https://www.pathofexile.com/forum/view-thread/3594260 (Early Access Bug Reports - Known Issues)
- https://devtrackers.gg/pathofexile/p/e4547121-known-issues-faq
- https://game8.co/games/Path-of-Exile-2/archives/490434 (Stash Tab Sale Schedule and Prices)
- https://pathofexile2.com/shop/stash-tabs
- https://soren.com/en/news/path-of-exile/2026-04-03-path-of-exile-stash-tab-sale-includes-sequel
- https://www.switchbladegaming.com/path-of-exile-2/is-worth-it/
- https://game8.co/games/Path-of-Exile-2/archives/493578 (Extra Stash Tab)
- https://game8.co/games/Path-of-Exile-2/archives/493582 (Currency Stash Tab)
- https://game8.co/games/Path-of-Exile-2/archives/493579 (Premium Stash Tab)
- https://game8.co/games/Path-of-Exile-2/archives/500002 (Map Stash Tab)
- https://www.exitlag.com/blog/path-of-exile-2-cross-platform/
- https://www.poe-vault.com/poe2/news/path-of-exile-2-crossplay-and-cross-progression-explained
- https://www.gamespot.com/articles/path-of-exile-2-cross-play-explained/1100-6527844/
- https://www.gamespot.com/articles/path-of-exile-2-cross-play-co-op-and-friend-invites-explained/1100-6528326/
- https://maxroll.gg/poe2/news/path-of-exile-2-crossplay-and-split-screen-co-op
- https://allthings.how/path-of-exile-2-crossplay-and-cross-progression-on-pc-ps5-and-xbox/
- https://www.gfinityesports.com/article/path-of-exile-2-how-to-enable-or-disable-crossplay
- https://game8.co/games/Path-of-Exile-2/archives/513795 (All PoE 2 Twitch Drops)
- https://www.thegamer.com/path-of-exile-2-twitch-drops-return-of-the-ancients-how-to-unlock-redeem-rewards/
- https://www.sportskeeda.com/mmo/path-exile-2-forbidden-rites-0-5-5-twitch-drop-preview-get
- https://twitchdrops.app/game/path-of-exile-2
- https://www.mmoexp.com/News/poe-2-twitch-drops-event-how-to-get-the-free-lightbringer-hood-before-it-ends.html
- https://massivelyop.com/2026/01/14/path-of-exile-2-tackles-bug-fixes-adjustments-and-quality-of-life-changes-this-week/
- https://gamerant.com/path-of-exile-2-quality-of-life-improvements-item-filter-stash-tabs/
- https://www.ingamenews.com/2026/06/path-of-exile-2-update-what-we-are.html
- https://game8.co/games/Path-of-Exile-2/archives/486090 (Is Path of Exile 2 Free to Play?)
- https://www.gamespot.com/articles/path-of-exile-2-is-finally-getting-its-full-release-and-itll-be-free-to-play/
- https://store.steampowered.com/app/2694490/Path_of_Exile_2/
- https://www.techtimes.com/articles/325599/20260826/path-exile-2-drops-paywall-dec-11-full-campaign-duelist-class-go-free.htm
- https://www.gosugamers.net/entertainment/news/79049-path-of-exile-2-gets-free-to-play-1-0-launch-in-december-2026-adds-new-duelist-class
- https://www.consolemonster.com/news/path-of-exile-2-launches-1-0-version-on-11-december-with-free-to-play-access/
- https://www.pathofexile.com/forum/view-thread/3652275 (Accessibility features for the blind)
- https://www.pathofexile.com/forum/view-thread/3592177 (Question from a color blind person)
