import { esc, blobs, icon, num } from '../ui.js?v=91402d5159';
import { totals, verdict, maxScore, TOPIC_LABELS, LEVEL_LABELS, MARKING_LABELS } from '../game.js?v=91402d5159';
import { getExam } from '../exams.js?v=91402d5159';

export function resultScreen({ duel, code, leagueNote }) {
  const t = totals(duel);
  const v = duel.status === 'finished' ? verdict(duel) : null;
  const target = duel.kind === 'challenge' ? duel.challenge.score : duel.them;
  const opponent = duel.kind === 'challenge' ? esc(duel.challenge.nickname) : 'the rival';

  let heading;
  if (duel.kind === 'practice') heading = duel.status === 'abandoned' ? 'Practice stopped.' : `${t.right} of ${duel.questions.length} right.`;
  else if (duel.status === 'abandoned') heading = 'Duel left.';
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

  // The topic with the most misses: one tap to practise it.
  const missedBy = {};
  for (const a of missed) { const q = duel.questions[a.index]; const k = `${q.topic}|${q.label}`; missedBy[k] = (missedBy[k] || 0) + 1; }
  const [weakKey] = Object.entries(missedBy).sort((x, y) => y[1] - x[1])[0] || [];
  const [weakTopic, weakLabel] = weakKey ? weakKey.split('|') : [];
  const practiseBtn = weakLabel && duel.kind !== 'practice'
    ? `<button class="btn btn--glass mt-12" type="button" data-action="practice-topic" data-label="${esc(weakLabel)}" data-topic="${esc(weakTopic)}">Practise ${esc(weakLabel.toLowerCase())}: 10 questions</button>` : '';

  const kindNote = duel.status === 'abandoned' ? '' : {
    rematch: 'Rematches never count for ranks, leagues or squad missions.',
    challenge: 'Challenge duels count for your streak, not your weekly rank.',
    league: leagueNote || '',
    practice: `Practice: ${esc(duel.practiceTopic || '')}. Unlimited, and never counts for ranks.`,
    solo: duel.level === 'exam' && duel.marking === 'exam' ? 'Counts for your weekly rank (best 3 a day).' : 'Only exam level duels with exam marking count for weekly ranks.',
  }[duel.kind];

  return `
  <div class="screen screen--lobby">
    ${blobs()}
    <div class="screen__body" style="padding-bottom:calc(var(--safe-bottom) + 32px)">
      <div class="dgrid dgrid--result">
      <div class="ga-a">
      <div class="row row--between">
        <button class="icon-btn glass" type="button" data-action="go" data-to="${duel.kind === 'practice' ? 'practice' : duel.kind === 'league' ? 'league' : 'home'}" aria-label="Close">${icon('close')}</button>
        <span class="tag">${getExam(duel.exam) ? `${esc(getExam(duel.exam).short)} · ` : ''}${duel.kind === 'practice' ? esc(duel.practiceTopic || '') : `${TOPIC_LABELS[duel.topic]}, ${LEVEL_LABELS[duel.level].toLowerCase()}`}</span>
      </div>

      <h1 class="verdict mt-20">${heading}</h1>
      <p class="mt-8" style="font-size:20px;font-weight:600">
        <span style="color:#2A3BE8">${num(duel.you)}</span>${duel.kind === 'practice' ? '' : ` to <span style="color:#B84700">${num(target)}</span>`}
        <span class="muted" style="font-weight:400">out of ${maxScore(duel.marking, duel.exam, duel.questions.length)}</span>
      </p>
      ${tieNote}
      ${duel.status === 'abandoned' ? '<p class="notice mt-12">Unfinished duels are marked abandoned and do not count for ranks.</p>' : ''}

      </div>
      <div class="stats mt-16 ga-b">
        <div class="stat tint"><div class="stat__label">Correct</div><div class="stat__value" style="color:#0B6B50">${t.right}</div></div>
        <div class="stat tint"><div class="stat__label">Wrong</div><div class="stat__value" style="color:#B3261E">${t.wrong}</div></div>
        <div class="stat tint"><div class="stat__label">Skipped</div><div class="stat__value">${t.skipped}</div></div>
      </div>
      ${kindNote ? `<p class="small muted mt-12 ga-c">${kindNote}</p>` : ''}

      ${duel.status === 'finished' && duel.kind !== 'practice' ? `
      <section class="card--lg glass mt-16 ga-d" aria-labelledby="share-title">
        <h2 class="card__title" id="share-title" style="font-size:20px">${duel.kind === 'challenge' ? `Challenge ${opponent} back` : 'Challenge a friend'}</h2>
        <p class="small muted mt-8">They get the same ten questions and try to beat ${num(duel.you)}.</p>
        <div class="code-box"><span class="code-box__code" id="challenge-code">${esc(code)}</span>
          <button class="btn btn--sm btn--glass" type="button" data-action="copy-code" aria-label="Copy challenge code">${icon('copy')}</button></div>
        <button class="btn btn--cobalt mt-12" type="button" data-action="share-code">${icon('share')} Share the challenge</button>
      </section>` : ''}

      <div class="ga-e">${missed.length ? `<h2 class="mt-24" style="font-size:22px">Your mistakes, with the steps</h2>${practiseBtn}<div class="mt-12">${reviews}</div>` : duel.status === 'finished' ? '<p class="notice mt-16" style="background:rgba(95,214,181,0.18);color:#0B6B50">Ten out of ten. No mistakes to review.</p>' : ''}</div>

      <div class="btn-row mt-24 ga-f">
        <button class="btn btn--glass" type="button" data-action="rematch">${duel.kind === 'practice' ? 'Practise again' : 'Rematch'}</button>
        <button class="btn btn--saffron" type="button" data-action="go" data-to="${duel.kind === 'practice' ? 'practice' : 'home'}">${duel.kind === 'practice' ? 'Back to Practice' : 'Back home'}</button>
      </div>
      </div>
    </div>
  </div>`;
}
