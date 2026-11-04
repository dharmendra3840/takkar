// Tutor leagues, shared by the app and the server (Live tests tab, LIVE-14, LIVE-16, LIVE-17).
// A league is one tutor's batch preparing for one exam; its exam pattern is fixed when it is created.
import { CODE_ALPHABET } from './squad-rules.js?v=55de1a644f';

export const LEAGUE_CODE_LENGTH = 7;
export const LEAGUES_JOINED_MAX = 10; // leagues one student can be in
export const EDUCATOR_LEAGUES_DEFAULT = 2; // beta plan; the admin setting decides
export const LEAGUE_MEMBERS_DEFAULT = 50; // beta; the admin setting decides

/** Upper case, without spaces, dashes or letters the codes never use; a link may carry it in any case. */
export const cleanLeagueCode = (raw) => String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
export const isLeagueCode = (code) => code.length === LEAGUE_CODE_LENGTH && [...code].every((ch) => CODE_ALPHABET.includes(ch));

/** '' when fine. A student's real name, as their tutor will see it. */
export function realNameError(name) {
  const n = String(name ?? '').trim().replace(/\s+/g, ' ');
  if (n.length < 2 || n.length > 60) return 'Use 2 to 60 letters.';
  if (!/^[\p{L}][\p{L}\p{M} .'-]*$/u.test(n)) return 'Use letters, spaces, dots, apostrophes and hyphens only.';
  return '';
}
export const cleanRealName = (name) => String(name ?? '').trim().replace(/\s+/g, ' ');
