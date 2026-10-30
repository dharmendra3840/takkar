// Squad rules shared by the app and the server (design/03 §3.2, Phase 2).
import { hashString } from './engine/rng.js?v=403d9c56d9';

export const SQUAD_MAX = 20; // members in the beta
export const SQUADS_PER_PLAYER = 5; // squads one player can be in
export const SQUADS_OWNED = 3; // squads one player can run
// Six preset reactions; no free text (safety).
export const REACTIONS = ['Well played', 'Rematch?', 'Let’s go', 'Study time', 'On it', 'Nice one'];
// Invite codes avoid letters and digits that look alike (0/O, 1/I/L).
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;

/** Weekly mission: correct answers together, growing with the squad. */
export const missionTarget = (members) => Math.max(30, members * 15);

/** Today's squad duel: the same ten questions for every member, all day (IST). */
export const squadSeed = (squadId, day) => hashString(`squad:${squadId}:${day}`) >>> 0;

/** Clean an invite code someone typed or pasted: upper case, no spaces or dashes. */
export const cleanCode = (text) => String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);
