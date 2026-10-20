import { esc, blobs, icon, num } from '../ui.js';
import { totals, verdict, maxScore, TOPIC_LABELS, LEVEL_LABELS, MARKING_LABELS } from '../game.js';

export function resultScreen({ duel, code, leagueNote }) {
  const t = totals(duel);
  const v = duel.status === 'finished' ? verdict(duel) : null;
  const target = duel.kind === 'challenge' ? duel.challenge.score : duel.them;
  const opponent = duel.kind === 'challenge' ? esc(duel.challenge.nickname) : 'the rival';

  let heading;
  if (duel.status === 'abandoned') heading = 'Duel left.';
  else if (v === 'won') heading = duel.kind === 'challenge' ? `You beat ${opponent}.` : 'You won.';
  else if (v === 'lost') heading = duel.kind === 'challenge' ? `${opponent} holds on.` : 'The rival won.';
  else heading = 'A tie.';

  const tieNote = v && duel.you === target && duel.kind !== 'challenge'
    ? `<p class="small muted mt-8">Equal scores, so the faster total time decides.</p>` : '';

  const missed = duel.answers.filter((a) => !a.correct);
  const reviews = missed.map((a) => {
    const q = duel.questions[a.index];
    const yours = a.choice === null ? (a.timedOut ? 'Time ran out' : 'Skipped') : `You chose ${esc(q.options[a.choice])}`;
    return `
      <details class="review tint">
        <summary class="review__q" style="cursor:pointer">Q${a.index + 1}. ${esc(q.text)}</summary>
        <p class="review__a"><span style="color:#B3261E;font-weight:600">${icon('cross', 'small')} ${yours}.</span> <span style="color:#0B6B50;font-weight:600">Correct: ${esc(q.answerText)}</span></p>
        <ol class="small mt-8" style="padding-left:20px;margin-bottom:0">${q.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      </details>`;
  }).join('');

  const kindNote = {
    rematch: 'Rematches never count for ranks, leagues or squad missions.',
    challenge: 'Challenge duels count for your streak, not your weekly rank.',
    league: leagueNote || '',
    solo: duel.level === 'exam' && duel.marking === 'exam' ? 'Counts for your weekly rank (best 3 a day).' : 'Only exam level duels with exam marking count for weekly ranks.',
  }[duel.kind];

  return `
  <div class="screen screen--lobby">
    ${blobs()}
    <div class="screen__body" style="padding-bottom:calc(var(--safe-bottom) + 32px)">
      <div class="row row--between">
        <button class="icon-btn glass" type="button" data-action="go" data-to="home" aria-label="Back home">${icon('close')}</button>
        <span class="tag">${TOPIC_LABELS[duel.topic]}, ${LEVEL_LABELS[duel.level].toLowerCase()}, ${MARKING_LABELS[duel.marking].toLowerCase()}</span>
      </div>

      <h1 class="verdict mt-20">${heading}</h1>
      <p class="mt-8" style="font-size:20px;font-weight:600">
        <span style="color:#2A3BE8">${num(duel.you)}</span> to <span style="color:#B84700">${num(target)}</span>
        <span class="muted" style="font-weight:400">out of ${maxScore(duel.marking)}</span>
      </p>
      ${tieNote}
      ${duel.status === 'abandoned' ? '<p class="notice mt-12">Unfinished duels are marked abandoned and do not count for ranks.</p>' : ''}

      <div class="stats mt-16">
        <div class="stat tint"><div class="stat__label">Correct</div><div class="stat__value" style="color:#0B6B50">${t.right}</div></div>
        <div class="stat tint"><div class="stat__label">Wrong</div><div class="stat__value" style="color:#B3261E">${t.wrong}</div></div>
        <div class="stat tint"><div class="stat__label">Skipped</div><div class="stat__value">${t.skipped}</div></div>
      </div>
      ${kindNote ? `<p class="small muted mt-12">${kindNote}</p>` : ''}

      ${duel.status === 'finished' ? `
      <section class="card--lg glass mt-16" aria-labelledby="share-title">
        <h2 class="card__title" id="share-title" style="font-size:20px">${duel.kind === 'challenge' ? `Challenge ${opponent} back` : 'Challenge a friend'}</h2>
        <p class="small muted mt-8">They get the same ten questions and try to beat ${num(duel.you)}.</p>
        <div class="code-box"><span class="code-box__code" id="challenge-code">${esc(code)}</span>
          <button class="btn btn--sm btn--glass" type="button" data-action="copy-code" aria-label="Copy challenge code">${icon('copy')}</button></div>
        <button class="btn btn--cobalt mt-12" type="button" data-action="share-code">${icon('share')} Share on WhatsApp or Telegram</button>
      </section>` : ''}

      ${missed.length ? `<h2 class="mt-24" style="font-size:22px">Your mistakes, with the steps</h2><div class="mt-12">${reviews}</div>` : duel.status === 'finished' ? '<p class="notice mt-16" style="background:rgba(95,214,181,0.18);color:#0B6B50">Ten out of ten. No mistakes to review.</p>' : ''}

      <div class="btn-row mt-24">
        <button class="btn btn--glass" type="button" data-action="rematch">Rematch</button>
        <button class="btn btn--saffron" type="button" data-action="go" data-to="home">Back home</button>
      </div>
    </div>
  </div>`;
}
