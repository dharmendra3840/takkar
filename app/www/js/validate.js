// ONB-04 and MOD-02: nickname and name rules, with an English, Hindi and
// Hinglish word filter. The full app lets the admin extend the list.

const RESERVED = ['admin', 'takkar', 'moderator', 'support', 'official', 'system'];
const BLOCKED = [
  'fuck', 'shit', 'bitch', 'bastard', 'dick', 'pussy', 'slut', 'whore', 'porn', 'sex', 'nude', 'rape',
  'chutiya', 'chutia', 'madarchod', 'mc', 'bc', 'behenchod', 'bhenchod', 'bhosdi', 'bhosda', 'gandu',
  'gaandu', 'randi', 'harami', 'haramkhor', 'kamina', 'kutta', 'kutti', 'lund', 'lavda', 'lauda',
  'chod', 'jhatu', 'tatti', 'saala', 'saali',
];

const normalise = (text) => text.toLowerCase()
  .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't').replace(/@/g, 'a');

function containsBlocked(text) {
  const plain = normalise(text).replace(/[^a-z]/g, '');
  return BLOCKED.some((word) => (word.length <= 2 ? plain === word : plain.includes(word)));
}

/** Returns an error message, or '' when the nickname is fine. */
export function nicknameError(raw) {
  const name = (raw || '').trim();
  if (!name) return 'Pick a nickname your rival will see.';
  if (!/^[A-Za-z0-9]+$/.test(name)) return 'Use letters and numbers only, no spaces or symbols.';
  if (name.length < 3) return 'Use at least 3 letters or numbers.';
  if (name.length > 12) return 'Use 12 letters or numbers at most.';
  if (RESERVED.some((word) => name.toLowerCase().includes(word))) return 'That name is reserved. Try another.';
  if (containsBlocked(name)) return 'That name is not allowed. Try another.';
  return '';
}

/** LEAG-01: league names are 3 to 30 characters and pass the word filter. */
export function leagueNameError(raw) {
  const name = (raw || '').trim();
  if (name.length < 3) return 'Use at least 3 characters.';
  if (name.length > 30) return 'Use 30 characters at most.';
  if (!/^[\p{L}\p{N} &'.\-]+$/u.test(name)) return 'Use letters, numbers and spaces.';
  if (containsBlocked(name)) return 'That name is not allowed. Try another.';
  return '';
}
