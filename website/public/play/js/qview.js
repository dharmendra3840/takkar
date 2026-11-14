// A question's main text on the question screens (duel, practice, mini mock, live test). Set-3 types (seating,
// puzzles, data interpretation) carry `view` (engine/bank.js): the data as a table or the clues as a numbered
// list, then the question itself. Other questions are their text.
import { esc } from './ui.js?v=a9e7f3de4a';

export function questionHtml(q, langAttr = '') {
  const v = q.view;
  if (!v) return `<h1 class="question" id="question-text"${langAttr}>${esc(q.text)}</h1>`;
  const body = v.table
    ? `<div class="qview__wrap"><table class="qview__table"><thead><tr>${v.table.head.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${v.table.rows.map((r) => `<tr>${r.map((c, i) => (i ? `<td>${esc(c)}</td>` : `<th scope="row">${esc(c)}</th>`)).join('')}</tr>`).join('')}</tbody></table></div>`
    : `<ol class="qview__clues">${v.clues.map((c) => `<li>${esc(c)}</li>`).join('')}</ol>`;
  return `<div class="qview"${langAttr}><p class="qview__intro">${esc(v.intro)}</p>${body}</div>
        <h1 class="question" id="question-text"${langAttr}>${esc(v.ask)}</h1>`;
}
