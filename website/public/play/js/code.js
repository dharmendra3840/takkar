// Challenge codes (CHAL-01 to CHAL-03), prototype version.
// The prototype has no server, so a code carries the duel seed, settings,
// score and nickname, sealed with a checksum: editing any character breaks it.
// The MVP replaces this with an ID signed by the server (SEC-12).
import { hashString } from './engine/rng.js?v=5a018ff99f';
import { istDay } from './time.js?v=5a018ff99f';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32
const SALT = 'takkar-prototype-v1';
const TOPICS = ['quant', 'reasoning', 'mixed'];
const LEVELS = ['easy', 'exam', 'hard'];
const MARKINGS = ['exam', 'speed'];
const DAY_ZERO = 20454; // 1 Jan 2026 as an IST day number
export const CHALLENGE_DAYS = 7;
// Version 2 codes carry the exam and a score in twelfths (−0.25, −⅓ and −0.5 marks are exact).
// Version 1 codes (before exams) still open.
const EXAM_CODES = [null, 'ssc-cgl', 'ibps-po', 'rrb-ntpc'];
const SCORE_OFFSET = 4096;

function toBase32(bytes) {
  let bits = 0; let value = 0; let out = '';
  for (const b of bytes) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function fromBase32(text) {
  let bits = 0; let value = 0; const out = [];
  for (const ch of text) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) return null;
    value = (value << 5) | v; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return out;
}

function checksum(bytes) {
  const h = hashString(SALT + bytes.join(','));
  return [(h >>> 8) & 255, h & 255];
}

/**
 * Version 2 check: CRC-16 (CCITT) over the salt and the bytes. A CRC catches every error
 * that touches at most 16 neighbouring bits, and one mistyped character changes only 5,
 * so every single-character edit is caught, not just almost every one.
 */
function crc16(bytes) {
  let crc = 0xFFFF;
  for (const b of [...SALT].map((c) => c.charCodeAt(0)).concat(bytes)) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
  }
  return [(crc >>> 8) & 255, crc & 255];
}

export function encodeChallenge({ seed, topic, level, marking, score, nickname, exam = null }) {
  const day = istDay() - DAY_ZERO;
  const name = [...nickname].slice(0, 12).map((c) => c.charCodeAt(0) & 127);
  const twelfths = Math.round(score * 12) + SCORE_OFFSET;
  const bytes = [
    2,
    (seed >>> 24) & 255, (seed >>> 16) & 255, (seed >>> 8) & 255, seed & 255,
    (TOPICS.indexOf(topic) << 4) | (LEVELS.indexOf(level) << 1) | MARKINGS.indexOf(marking),
    Math.max(0, EXAM_CODES.indexOf(exam)),
    (twelfths >>> 8) & 255, twelfths & 255,
    (day >>> 8) & 255, day & 255,
    ...name,
  ];
  const code = toBase32([...bytes, ...crc16(bytes)]);
  return 'TK-' + code.match(/.{1,5}/g).join('-');
}

/** The code format from before exams (version 1). Kept so tests can prove old codes still open. */
export function encodeChallengeV1({ seed, topic, level, marking, score, nickname }) {
  const day = istDay() - DAY_ZERO;
  const name = [...nickname].slice(0, 12).map((c) => c.charCodeAt(0) & 127);
  const bytes = [1, (seed >>> 24) & 255, (seed >>> 16) & 255, (seed >>> 8) & 255, seed & 255,
    (TOPICS.indexOf(topic) << 4) | (LEVELS.indexOf(level) << 1) | MARKINGS.indexOf(marking), score + 20, (day >>> 8) & 255, day & 255, ...name];
  const code = toBase32([...bytes, ...checksum(bytes)]);
  return 'TK-' + code.match(/.{1,5}/g).join('-');
}

/** Returns { ok: true, challenge } or { ok: false, reason }. */
export function decodeChallenge(input) {
  // People paste the whole WhatsApp message, so find the code inside it first. Only a
  // leading "TK" is the prefix; the code's own characters can contain "TK" too.
  const text = String(input || '').toUpperCase();
  const found = text.match(/\bTK-?([0-9A-Z]{1,5}(?:-?[0-9A-Z]{1,5}){3,})/);
  const clean = (found ? found[1] : text.replace(/^\s*TK-?/, ''))
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0').replace(/[IL]/g, '1');
  if (clean.length < 16) return { ok: false, reason: 'That code looks too short. Check you copied all of it.' };
  const all = fromBase32(clean);
  if (!all || all.length < 12) return { ok: false, reason: 'That is not a Takkar challenge code.' };
  const bytes = all.slice(0, -2);
  const [c1, c2] = all.slice(-2);
  const version = bytes[0];
  const [e1, e2] = version === 2 ? crc16(bytes) : checksum(bytes);
  // CHAL-01: the code must be exactly the canonical one, so even the unused
  // padding bits in the last character cannot be changed.
  // A version 2 code whose version marker was edited to 1 would be judged by the weaker old
  // check; catch that exact case (its CRC as version 2 still matches).
  const forgedV1 = version === 1 && crc16([2, ...bytes.slice(1)]).every((b, i) => b === [c1, c2][i]);
  if (c1 !== e1 || c2 !== e2 || (version !== 1 && version !== 2) || forgedV1 || toBase32(all) !== clean) {
    return { ok: false, reason: 'This code has been changed or mistyped, so it will not work.' };
  }
  const seed = ((bytes[1] << 24) | (bytes[2] << 16) | (bytes[3] << 8) | bytes[4]) >>> 0;
  const flags = bytes[5];
  const v2 = version === 2;
  const day = (v2 ? (bytes[9] << 8) | bytes[10] : (bytes[7] << 8) | bytes[8]) + DAY_ZERO;
  const exam = v2 ? EXAM_CODES[bytes[6]] : null;
  const challenge = {
    seed,
    topic: TOPICS[(flags >> 4) & 3],
    level: LEVELS[(flags >> 1) & 7],
    marking: MARKINGS[flags & 1],
    exam: exam || null,
    score: v2 ? (((bytes[7] << 8) | bytes[8]) - SCORE_OFFSET) / 12 : bytes[6] - 20,
    day,
    nickname: String.fromCharCode(...bytes.slice(v2 ? 11 : 9)),
  };
  if (!challenge.topic || !challenge.level || !challenge.marking || (v2 && bytes[6] >= EXAM_CODES.length)) {
    return { ok: false, reason: 'That is not a Takkar challenge code.' };
  }
  if (istDay() - day > CHALLENGE_DAYS) {
    return { ok: false, reason: `This challenge from ${challenge.nickname} has expired. Challenges last ${CHALLENGE_DAYS} days.` };
  }
  return { ok: true, challenge };
}
