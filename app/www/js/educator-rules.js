// Educator verification rules shared by the app and the server (Live tests tab, EDU-01 to EDU-08).
// We check that a tutor controls the channel or centre they name, not their identity documents.

export const EDUCATOR_TERMS_VERSION = '2026-10-beta';
export const PROOF_DAYS = 7; // an ownership code expires after this
export const REAPPLY_DAYS = 30; // after a rejection
export const MAX_EXAMS = 3;

// How a tutor proves the channel or centre is theirs. In person = met by the founder.
export const PLATFORMS = {
  youtube: { label: 'YouTube channel', where: 'your channel description', hosts: ['youtube.com', 'm.youtube.com', 'www.youtube.com'] },
  instagram: { label: 'Instagram account', where: 'your Instagram bio', hosts: ['instagram.com', 'www.instagram.com'] },
  telegram: { label: 'Telegram channel', where: 'a pinned post in your channel', hosts: ['t.me', 'telegram.me'] },
  website: { label: 'Centre website', where: 'a page on your website', hosts: null },
  in_person: { label: 'Met the Takkar team in person', where: '', hosts: [] },
};

/** How the admin confirmed it, recorded with the approval. */
export const VERIFIED_BY = {
  code: 'Ownership code found',
  domain: 'Website domain checked',
  call: 'Video call (not recorded)',
  in_person: 'Met in person',
};

export const needsLink = (platform) => platform !== 'in_person';

/** '' when fine, else the message to show. */
export function centreNameError(name) {
  const n = String(name ?? '').trim();
  if (n.length < 3 || n.length > 60) return 'Use 3 to 60 characters.';
  if (!/^[\p{L}\p{N}][\p{L}\p{N} .,&'()-]*$/u.test(n)) return 'Use letters, numbers, spaces and . , & \' ( ) - only.';
  return '';
}

export function linkError(platform, link) {
  if (!needsLink(platform)) return '';
  let url;
  try { url = new URL(String(link ?? '').trim()); } catch { return 'Paste the full link, starting with https://'; }
  if (url.protocol !== 'https:') return 'The link must start with https://';
  const p = PLATFORMS[platform];
  if (p?.hosts && !p.hosts.includes(url.hostname.toLowerCase())) return `That isn't a ${p.label.toLowerCase()} link.`;
  if (url.pathname.length < 2 && platform !== 'website') return 'Paste the link to your own channel or account.';
  return '';
}

export function audienceError(n) {
  const v = Number(n);
  if (!Number.isInteger(v) || v < 0 || v > 100000000) return 'Enter a whole number.';
  return '';
}
