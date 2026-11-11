// Question language (design/01-exam-patterns.md §1.5): English or Hindi. Only what the player reads
// changes (the question, options, steps and topic); the answer's place, the scoring and every
// code stay the same, so a Hindi player and an English one can duel on the same questions.

export const TOPIC_HI = { quant: 'गणित', reasoning: 'तर्कशक्ति' };

/** The question as shown in this language (falls back to English when there is no Hindi). */
export function inLang(q, lang) {
  if (lang !== 'hi' || !q?.hi) return q;
  return { ...q, text: q.hi.text, options: q.hi.options, answerText: q.hi.answerText || q.answerText, steps: q.hi.steps?.length ? q.hi.steps : q.steps, label: q.hi.label || q.label, view: q.hi.view, isHi: true };
}

/** The हिंदी / EN switch on a question, like the real exam's language toggle. */
export function langSwitch(lang, { dark = true } = {}) {
  const btn = (value, text, extra = '') => `<button class="qlang__btn ${lang === value ? 'is-on' : ''}" type="button" data-action="qlang" data-value="${value}" aria-pressed="${lang === value}" ${extra}>${text}</button>`;
  return `<div class="qlang ${dark ? '' : 'qlang--light'}" role="group" aria-label="Question language">${btn('hi', 'हिंदी', 'lang="hi"')}${btn('en', 'EN', 'aria-label="English"')}</div>`;
}
