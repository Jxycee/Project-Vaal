// Username rules shared by the dashboard control (live feedback) and the
// setUsername Server Function (the authority). The format mirrors the
// user_profiles_display_name_format CHECK in
// supabase/migrations/20260929121949_usernames.sql - keep them in step.
import {
  DataSet,
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
} from 'obscenity';

export const USERNAME_RE = /^[A-Za-z0-9_-]{3,20}$/;
export const USERNAME_FORMAT_ERROR = '3–20 characters: letters, numbers, _ or -';
export const USERNAME_OFFENSIVE_ERROR = "That name isn't allowed.";
export const USERNAME_CHANGE_WINDOW_DAYS = 7;

export type UsernameValidation = { ok: true; value: string } | { ok: false; error: string };

export function validateUsername(name: unknown): UsernameValidation {
  if (typeof name !== 'string') return { ok: false, error: USERNAME_FORMAT_ERROR };
  const value = name.trim();
  if (!USERNAME_RE.test(value)) return { ok: false, error: USERNAME_FORMAT_ERROR };
  if (isOffensive(value)) return { ok: false, error: USERNAME_OFFENSIVE_ERROR };
  return { ok: true, value };
}

// The `obscenity` English dataset (v0.4) mixes slurs with everyday profanity.
// Product decision: usernames may contain ordinary swearing and crude-but-
// non-hateful anatomy words; they may NOT contain slurs (racial, ethnic,
// homophobic, transphobic, ableist, misogynist-targeting) or sexual-violence /
// explicit-sex terms. Entries are the dataset's `originalWord` values.
//
// ALLOWED (removed from the matcher): general profanity and crude insults.
export const ALLOWED_PROFANITY: ReadonlySet<string> = new Set([
  'ass',
  'arse',
  'bastard',
  'bitch',
  'bollocks',
  'boob',
  'cock',
  'dick',
  'fuck',
  'piss',
  'prick',
  'shit',
  'tit',
  'turd',
  'twat',
  'wank',
]);
// STILL BLOCKED (everything else in the dataset), by category:
//   racial/ethnic slurs: abo, abeed, africoon, arabush, boonga, chingchong, chink, kike, negro, nigger
//   homophobic/transphobic: dyke, fag, tranny
//   ableist / demeaning: retard, spastic, cuck, slut, whore, hooker, cunt
//   sexual violence / abuse: rape, bestiality, incest
//   explicit sexual: anal, anus, blowjob, cum, deepthroat, dildo, doggystyle, double penetration,
//     ejaculate, felch, fellatio, finger bang, fisting, gangbang, handjob, hentai, jerk off, jizz,
//     lubejob, masturbate, orgasm, orgy, penis, porn, pussy, scat, semen, sex, buttplug, vagina

const matcher = new RegExpMatcher({
  // removePhrasesIf MUTATES the dataset it is called on, so work on a copy:
  // englishDataset is a shared module singleton.
  ...new DataSet()
    .addAll(englishDataset)
    .removePhrasesIf((p) => ALLOWED_PROFANITY.has(p.metadata?.originalWord ?? '')).build(),
  ...englishRecommendedTransformers,
});

// '_' is a word character to the matcher, so a term glued between underscores
// ("x_<term>_y") would slip past its word-boundary patterns. Match the raw
// name AND a copy with the separators turned into spaces.
export function isOffensive(name: string): boolean {
  return matcher.hasMatch(name) || matcher.hasMatch(name.replace(/[_-]/g, ' '));
}
