// Marks calculator (/marks-calculator): score = right × marks − wrong × the penalty, for the exam picked.
// The page already shows a worked example, so it reads fine without this script.
const form = document.querySelector('[data-calc]');
if (form) {
  const out = form.querySelector('[data-calc-out]');
  const fmt = (n) => String(Math.round(n * 100) / 100);
  const neg = (n) => (Math.abs(n - 1 / 3) < 1e-9 ? '⅓' : fmt(n));
  const wanted = new URLSearchParams(location.search).get('exam');
  if (wanted && [...form.exam.options].some((o) => o.value === wanted)) form.exam.value = wanted;

  const update = () => {
    const opt = form.exam.selectedOptions[0];
    const total = Number(opt.dataset.questions), marks = Number(opt.dataset.marks), penalty = Number(opt.dataset.negative);
    const right = Math.max(0, Math.floor(Number(form.right.value) || 0));
    const wrong = Math.max(0, Math.floor(Number(form.wrong.value) || 0));
    if (right + wrong > total) {
      out.textContent = `${opt.textContent} has ${total} questions: right and wrong answers add up to more than that.`;
      return;
    }
    out.innerHTML = '';
    const score = document.createElement('strong');
    score.textContent = fmt(right * marks - wrong * penalty);
    out.append(score, ` out of ${total * marks} · ${right} × ${marks} − ${wrong} × ${neg(penalty)} · ${total - right - wrong} not answered`);
    if (opt.dataset.note) out.append(document.createElement('br'), opt.dataset.note);
  };
  form.addEventListener('input', update);
  form.addEventListener('submit', (e) => e.preventDefault());
  update();
}
