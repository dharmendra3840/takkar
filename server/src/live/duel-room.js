// DuelRoom: one live friend duel (design/03-duels-squads-leagues-rooms.md §3.1, 06-data-and-api.md §6.3).
// Holds both players' WebSockets (hibernating, so idle duels cost nothing), the lobby and ready state,
// each player's questions one at a time with a server clock, the scores, and writes the result to D1.
//
// The Worker opens a connection only after checking a one-minute ticket; it passes who the player is
// in x-takkar-* headers, which nothing outside the Worker can reach.
//
// Messages from the app: ready · answer { i, choice } · next · leave
// Messages to the app:   lobby · countdown · question · reveal · opp · done · expired · error
import { DurableObject } from 'cloudflare:workers';
import { generateDuel, orderForPlayer } from '../../../app/www/js/engine/index.js';
import { EXAMS } from '../../../app/www/js/exams.js';
import { randomId } from '../lib/crypto.js';
import { istDay } from '../lib/http.js';
import { rebuildStreak } from '../routes/player.js';

const COUNTDOWN_MS = 3000;
const GRACE_MS = 1500; // network slack on each question's clock
const REVEAL_MS = 30000; // reading the steps; then the next question comes anyway
const DONE_KEEP_MS = 24 * 3600 * 1000;
const tidy = (n) => Math.round(n * 12) / 12;
const ROLES = ['host', 'guest'];

export class DuelRoom extends DurableObject {
  async load() {
    if (!this.s) this.s = (await this.ctx.storage.get('s')) || null;
    return this.s;
  }
  async save() { await this.ctx.storage.put('s', this.s); }

  /** The Worker forwards a checked WebSocket upgrade here. */
  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    const h = (k) => request.headers.get(`x-takkar-${k}`);
    const role = h('role');
    if (!ROLES.includes(role)) return new Response('Bad role', { status: 400 });
    await this.load();
    if (!this.s) {
      const duel = JSON.parse(h('duel'));
      const exam = EXAMS[duel.exam_id];
      this.s = {
        id: duel.id, code: duel.code, seed: duel.seed, set: duel.set_version, squadId: duel.squad_id || null,
        exam: { id: exam.id, short: exam.short, marks: exam.marks, negative: exam.negative, seconds: exam.seconds },
        status: 'lobby', expiresAt: Date.parse(duel.expires_at), startAt: null, paused: [],
        players: { host: null, guest: null },
      };
      await this.ctx.storage.setAlarm(this.s.expiresAt);
    }
    const p = this.s.players[role] || { index: -1, phase: 'lobby', answers: [], score: 0, ready: false, left: false };
    Object.assign(p, { id: h('user'), nickname: decodeURIComponent(h('nickname') || ''), username: h('username') || null });
    this.s.players[role] = p;
    await this.save();

    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1], [role]);
    this.sendState(role, pair[1]);
    this.broadcastLobby();
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  // ---------- sending ----------
  send(role, msg, only = null) {
    for (const ws of only ? [only] : this.ctx.getWebSockets(role)) {
      try { ws.send(JSON.stringify(msg)); } catch { /* closed */ }
    }
  }
  other(role) { return role === 'host' ? 'guest' : 'host'; }
  lobbyMsg(role) {
    const players = {};
    for (const r of ROLES) {
      const p = this.s.players[r];
      players[r] = p ? { nickname: p.nickname, username: p.username, ready: p.ready, here: this.ctx.getWebSockets(r).length > 0 } : null;
    }
    return { t: 'lobby', you: role, code: this.s.code, exam: this.s.exam, players, status: this.s.status, expiresAt: this.s.expiresAt, startAt: this.s.startAt };
  }
  broadcastLobby() { for (const r of ROLES) this.send(r, this.lobbyMsg(r)); }

  /** On (re)connecting: whatever this player needs to carry on. */
  sendState(role, ws) {
    const s = this.s;
    if (s.status === 'expired') return this.send(role, { t: 'expired' }, ws);
    if (s.status === 'lobby' || s.status === 'countdown') return this.send(role, this.lobbyMsg(role), ws);
    if (s.status === 'done') return this.send(role, this.doneMsg(role), ws);
    const p = s.players[role];
    this.send(role, this.lobbyMsg(role), ws);
    this.send(role, this.oppMsg(role), ws);
    if (p.phase === 'question') this.send(role, this.questionMsg(role), ws);
    else if (p.phase === 'reveal') this.send(role, this.revealMsg(role, p.answers[p.answers.length - 1]), ws);
  }

  // ---------- questions ----------
  questions(role) {
    if (!this.qs) this.qs = generateDuel(this.s.seed, 'mixed', 'exam', this.s.paused, EXAMS[this.s.exam.id].weights, this.s.set);
    const key = this.s.players[role].id;
    return this.qs.map((q, i) => orderForPlayer(q, key, i));
  }
  questionMsg(role) {
    const p = this.s.players[role];
    const q = this.questions(role)[p.index];
    return { t: 'question', i: p.index, total: this.qs.length, q: { text: q.text, options: q.options, label: q.label, topic: q.topic, type: q.type, tier: q.tier }, limitMs: this.s.exam.seconds * 1000, leftMs: Math.max(0, p.deadline - GRACE_MS - Date.now()) };
  }
  revealMsg(role, a) {
    const q = this.questions(role)[a.i];
    return { t: 'reveal', i: a.i, choice: a.choice, timedOut: a.timedOut, correct: a.correct, points: a.points, answerIndex: q.answerIndex, answerText: q.answerText, steps: q.steps, score: this.s.players[role].score, last: a.i === this.qs.length - 1 };
  }
  oppMsg(role) {
    const o = this.s.players[this.other(role)];
    return { t: 'opp', answered: o ? o.answers.length : 0, score: o ? o.score : 0, left: !!o?.left, done: o?.phase === 'done' };
  }

  serve(role, at = Date.now()) {
    const p = this.s.players[role];
    p.index += 1;
    p.phase = 'question';
    p.servedAt = at;
    p.deadline = at + this.s.exam.seconds * 1000 + GRACE_MS;
    this.send(role, this.questionMsg(role));
  }

  answer(role, i, choice, timedOut = false) {
    const p = this.s.players[role];
    if (p.phase !== 'question' || i !== p.index) return;
    const now = Date.now();
    const late = now > p.deadline;
    const picked = late || timedOut || choice === null || choice === undefined ? null : Number(choice);
    if (picked !== null && !(Number.isInteger(picked) && picked >= 0 && picked <= 3)) return;
    const q = this.questions(role)[i];
    const correct = picked !== null && picked === q.answerIndex;
    const points = correct ? this.s.exam.marks : picked === null ? 0 : -this.s.exam.negative;
    const a = { i, type: q.type, topic: q.topic, label: q.label, choice: picked, timedOut: picked === null && (late || timedOut), correct, points, timeMs: Math.min(this.s.exam.seconds * 1000, now - p.servedAt) };
    p.answers.push(a);
    p.score = tidy(p.score + points);
    p.phase = i === this.qs.length - 1 ? 'done' : 'reveal';
    p.deadline = now + REVEAL_MS;
    this.send(role, this.revealMsg(role, a));
    this.send(this.other(role), this.oppMsg(this.other(role)));
  }

  // ---------- the clock ----------
  async alarm() {
    await this.load();
    const s = this.s;
    if (!s) return;
    const now = Date.now();
    if (s.status === 'lobby' && now >= s.expiresAt) return this.expire();
    if (s.status === 'countdown' && now >= s.startAt) {
      s.status = 'live';
      await this.env.DB.prepare("UPDATE friend_duels SET status = 'live', started_at = ?1 WHERE id = ?2").bind(new Date(s.startAt).toISOString(), s.id).run();
      for (const r of ROLES) this.serve(r, s.startAt);
    } else if (s.status === 'live') {
      for (const r of ROLES) {
        const p = s.players[r];
        if (p.phase === 'question' && now >= p.deadline) this.answer(r, p.index, null, true);
        else if (p.phase === 'reveal' && now >= p.deadline) this.serve(r);
      }
    } else if (s.status === 'done' && now >= (s.finishedAt || 0) + DONE_KEEP_MS) {
      await this.ctx.storage.deleteAll();
      this.s = null;
      return;
    }
    if (s.status === 'live' && ROLES.every((r) => s.players[r].phase === 'done')) await this.finish();
    await this.save();
    await this.schedule();
  }

  async schedule() {
    const s = this.s;
    if (!s) return;
    const times = s.status === 'lobby' ? [s.expiresAt] : s.status === 'countdown' ? [s.startAt]
      : s.status === 'live' ? ROLES.map((r) => s.players[r]).filter((p) => p.phase !== 'done').map((p) => p.deadline)
        : s.status === 'done' ? [s.finishedAt + DONE_KEEP_MS] : [];
    if (times.length) await this.ctx.storage.setAlarm(Math.min(...times));
  }

  // ---------- messages ----------
  async webSocketMessage(ws, raw) {
    await this.load();
    const s = this.s;
    const [role] = this.ctx.getTags(ws);
    if (!s || !role || !s.players[role]) return;
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    const p = s.players[role];

    if (m.t === 'ready' && s.status === 'lobby') {
      p.ready = true;
      if (ROLES.every((r) => s.players[r]?.ready && this.ctx.getWebSockets(r).length > 0)) {
        s.status = 'countdown';
        s.startAt = Date.now() + COUNTDOWN_MS;
        const { results } = await this.env.DB.prepare("SELECT id FROM templates WHERE status != 'active'").all();
        s.paused = results.map((t) => t.id);
        this.qs = null;
      }
      this.broadcastLobby();
    } else if (m.t === 'unready' && s.status === 'lobby') {
      p.ready = false;
      this.broadcastLobby();
    } else if (m.t === 'answer' && s.status === 'live') {
      this.answer(role, Number(m.i), m.choice === null ? null : m.choice);
      if (ROLES.every((r) => s.players[r].phase === 'done')) await this.finish();
    } else if (m.t === 'next' && s.status === 'live' && p.phase === 'reveal') {
      this.serve(role);
    } else if (m.t === 'leave') {
      if (s.status === 'live' && p.phase !== 'done') {
        // Leaving mid-duel: the rest counts as skipped, and it is a loss whatever the scores.
        p.left = true;
        const qs = this.questions(role);
        while (p.answers.length < qs.length) {
          const i = p.answers.length;
          const q = qs[i];
          p.answers.push({ i, type: q.type, topic: q.topic, label: q.label, choice: null, timedOut: false, correct: false, points: 0, timeMs: 0 });
        }
        p.phase = 'done';
        p.index = qs.length - 1;
        this.send(this.other(role), this.oppMsg(this.other(role)));
        await this.finish();
      } else if (s.status === 'lobby' || s.status === 'countdown') {
        p.ready = false;
        if (s.status === 'countdown') { s.status = 'lobby'; s.startAt = null; }
        ws.close(1000, 'left');
        this.broadcastLobby();
      }
    }
    await this.save();
    await this.schedule();
  }

  async webSocketClose(ws) {
    await this.load();
    const s = this.s;
    const [role] = this.ctx.getTags(ws);
    if (!s || !role) return;
    // In the lobby a player who goes is no longer ready; mid-duel their clock keeps running and they can reconnect.
    if ((s.status === 'lobby' || s.status === 'countdown') && this.ctx.getWebSockets(role).filter((w) => w !== ws).length === 0) {
      if (s.players[role]) s.players[role].ready = false;
      if (s.status === 'countdown') { s.status = 'lobby'; s.startAt = null; }
      await this.save();
      await this.schedule();
      this.broadcastLobby();
    }
  }
  async webSocketError(ws) { await this.webSocketClose(ws); }

  // ---------- the end ----------
  async expire() {
    this.s.status = 'expired';
    await this.env.DB.prepare("UPDATE friend_duels SET status = 'expired' WHERE id = ?1 AND status = 'lobby'").bind(this.s.id).run();
    for (const r of ROLES) for (const ws of this.ctx.getWebSockets(r)) { try { ws.send(JSON.stringify({ t: 'expired' })); ws.close(1000, 'expired'); } catch { /* gone */ } }
    this.s.finishedAt = Date.now();
    await this.save();
    await this.schedule();
  }

  verdict(role) {
    const me = this.s.players[role], them = this.s.players[this.other(role)];
    if (me.left && !them.left) return 'lost';
    if (them.left && !me.left) return 'won';
    return me.score > them.score ? 'won' : me.score < them.score ? 'lost' : 'tied';
  }

  doneMsg(role) {
    const me = this.s.players[role], them = this.s.players[this.other(role)];
    const qs = this.questions(role);
    return {
      t: 'done', verdict: this.verdict(role), you: me.score, them: them.score, youLeft: me.left, themLeft: them.left,
      opponent: { nickname: them.nickname, username: them.username },
      review: qs.map((q, i) => ({ text: q.text, options: q.options, answerIndex: q.answerIndex, answerText: q.answerText, steps: q.steps, label: q.label, topic: q.topic, type: q.type, you: me.answers[i] || null, themCorrect: !!them.answers[i]?.correct })),
      duelIds: this.s.duelIds?.[role] || null,
    };
  }

  async finish() {
    const s = this.s;
    if (s.status === 'done') return;
    s.status = 'done';
    s.finishedAt = Date.now();
    const at = new Date(s.finishedAt).toISOString();
    const day = istDay();
    const both = ROLES.every((r) => !s.players[r].left);
    const host = s.players.host, guest = s.players.guest;
    const winner = this.verdict('host') === 'won' ? host.id : this.verdict('guest') === 'won' ? guest.id : null;
    const left = host.left ? host.id : guest.left ? guest.id : null;
    s.duelIds = {};
    const stmts = [env => env.DB.prepare(
      "UPDATE friend_duels SET status = 'done', finished_at = ?1, host_score = ?2, guest_score = ?3, winner_id = ?4, left_id = ?5 WHERE id = ?6"
    ).bind(at, host.score, guest.score, winner, left, s.id)];
    for (const r of ROLES) {
      const p = s.players[r], o = s.players[this.other(r)];
      const id = randomId('duel_');
      s.duelIds[r] = id;
      const count = (f) => p.answers.filter(f).length;
      stmts.push((env) => env.DB.prepare(
        `INSERT INTO duels (id, user_id, seed, topic, level, marking, exam_id, kind, rival, day, started_at, finished_at, status, score, rival_score,
           right_count, wrong_count, skipped_count, time_ms, counted, verdict, squad_id)
         VALUES (?1, ?2, ?3, 'mixed', 'exam', 'exam', ?4, 'live', NULL, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)`
      ).bind(id, p.id, s.seed, s.exam.id, day, new Date(s.startAt).toISOString(), at, p.left ? 'abandoned' : 'finished', p.score, o.score,
        count((a) => a.correct), count((a) => a.choice !== null && !a.correct), count((a) => a.choice === null), p.answers.reduce((t, a) => t + a.timeMs, 0),
        both ? 1 : 0, p.left ? null : this.verdict(r), s.squadId));
      p.answers.forEach((a, i) => stmts.push((env) => env.DB.prepare(
        `INSERT INTO duel_answers (duel_id, q_index, template, served_at, answered_at, choice, correct, points, time_ms)
         VALUES (?1, ?2, ?3, ?4, ?4, ?5, ?6, ?7, ?8)`
      ).bind(id, i, a.type, at, a.choice, a.correct ? 1 : 0, a.points, a.timeMs)));
    }
    await this.env.DB.batch(stmts.map((f) => f(this.env)));
    for (const r of ROLES) if (!s.players[r].left) await rebuildStreak(this.env, s.players[r].id);
    for (const r of ROLES) this.send(r, this.doneMsg(r));
  }
}
