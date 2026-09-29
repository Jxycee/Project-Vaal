// In-page navigation helpers shared by the tab strip (BuildTabs), the header's
// Edit toggle (BuildPage) and the Overview's calls to action. Everything here
// uses the History API directly — Next syncs pushState/replaceState into
// useSearchParams — so nothing reaches the server and nothing remounts: an
// unsaved edit survives any of these. Never swap them for <Link> or router.push.
import { patchQuery, type BuildTab } from '@/lib/build/buildPage';

/** Switches tab with pushState (Back returns to the previous tab). Overview is the default, so it carries no `?tab=`. */
export function selectTab(tab: BuildTab): void {
  const query = patchQuery(window.location.search, { tab: tab === 'overview' ? null : tab });
  window.history.pushState(null, '', `${window.location.pathname}${query}`);
}

/** Enters edit mode with replaceState — entering edit is not something Back should step through. */
export function enterEdit(): void {
  const query = patchQuery(window.location.search, { edit: '1' });
  window.history.replaceState(null, '', `${window.location.pathname}${query}`);
}
