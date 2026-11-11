// A question's text for the website (guides, practice pages, question of the day). Set-3 types (seating, puzzles,
// data interpretation) carry `view`: the data as a table or the clues as a list, with the question apart.
// Without one, the plain text.
export function questionTextHtml(q, esc) {
  const v = q.view;
  if (!v) return `<p class="sample__text">${esc(q.text).replace(/\n/g, '<br>')}</p>`;
  const body = v.table
    ? `<div class="qview__wrap"><table class="qview__table"><thead><tr>${v.table.head.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>
          <tbody>${v.table.rows.map((r) => `<tr>${r.map((c, i) => (i ? `<td>${esc(c)}</td>` : `<th scope="row">${esc(c)}</th>`)).join('')}</tr>`).join('')}</tbody></table></div>`
    : `<ol class="qview__clues">${v.clues.map((c) => `<li>${esc(c)}</li>`).join('')}</ol>`;
  return `<div class="qview"><p class="qview__intro">${esc(v.intro)}</p>${body}</div>
          <p class="sample__text">${esc(v.ask)}</p>`;
}
