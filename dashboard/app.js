// Token Radar's dashboard: one static page over the board in ../data.js. No fetch, no network.
//
// The page recomputes every row's implied value from the same numbers the program used — the
// row's TVL, its category multiple, its 7-day change, its age and its chain count — and the
// detail view shows that recomputation, so the page and the board are visibly the same arithmetic.

const DATA = window.RADAR;
const $ = (id) => document.getElementById(id);
const M = DATA.model;

/** A dollar amount in short form. */
function money(n) {
  if (n === null || n === undefined) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${Math.round(n)}`;
}

/** A dollar amount in full, for the detail view. */
function moneyFull(n) {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

/** An age in days, as years or days. */
function ageText(days) {
  if (days === null || days === undefined) return '—';
  if (days >= 365) return `${(days / 365).toFixed(1)}y`;
  return `${days}d`;
}

/** A 7-day change, signed and coloured. */
function changeHtml(v) {
  if (v === null || v === undefined) return '<span>—</span>';
  const cls = v > 0 ? 'up' : v < 0 ? 'down' : '';
  return `<span class="${cls}">${v > 0 ? '+' : ''}${v.toFixed(2)}%</span>`;
}

/** The implied value of a row, recomputed here from the same numbers the program used. */
function impliedOf(row) {
  const growthPct = Math.min(M.growth_cap, Math.max(M.growth_floor, row.change_7d ?? 0));
  const growthMult = 1 + (growthPct / 100) * M.growth_weight;
  const age = row.age_days ?? M.unknown_age_days;
  const maturityMult = M.maturity_floor + (Math.min(Math.max(age, 0), M.maturity_days) / M.maturity_days) * M.maturity_range;
  const breadthMult = 1 + Math.min(Math.max(row.chains.length - 1, 0), M.breadth_max_steps) * M.breadth_step;
  return Math.max(1, Math.round(row.tvl_usd * row.multiple * growthMult * maturityMult * breadthMult));
}

/** The five factors of one row, for the detail view's breakdown. */
function factorsOf(row) {
  const growthPct = Math.min(M.growth_cap, Math.max(M.growth_floor, row.change_7d ?? 0));
  const growthMult = 1 + (growthPct / 100) * M.growth_weight;
  const age = row.age_days ?? M.unknown_age_days;
  const maturityMult = M.maturity_floor + (Math.min(Math.max(age, 0), M.maturity_days) / M.maturity_days) * M.maturity_range;
  const breadthMult = 1 + Math.min(Math.max(row.chains.length - 1, 0), M.breadth_max_steps) * M.breadth_step;
  return { growthPct, growthMult, maturityMult, breadthMult, age };
}

/** The state the page holds in the hash: filters, tab, sort, and the open row. */
function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  return {
    q: p.get('q') || '',
    category: p.get('category') || '',
    chain: p.get('chain') || '',
    band: p.get('band') || '',
    tab: p.get('tab') || 'pre',
    sort: p.get('sort') || 'rank',
    dir: p.get('dir') || 'asc',
    p: p.get('p') || '',
  };
}
function writeHash(s) {
  const p = new URLSearchParams();
  if (s.q) p.set('q', s.q);
  if (s.category) p.set('category', s.category);
  if (s.chain) p.set('chain', s.chain);
  if (s.band) p.set('band', s.band);
  if (s.tab !== 'pre') p.set('tab', s.tab);
  if (s.sort !== 'rank') p.set('sort', s.sort);
  if (s.dir !== 'asc') p.set('dir', s.dir);
  if (s.p) p.set('p', s.p);
  const h = p.toString();
  history.replaceState(null, '', h ? `#${h}` : location.pathname + location.search);
}

let state = readHash();
const maxImplied = Math.max(...DATA.rows.map((r) => r.implied_value_usd));

/** The value band one row falls in. */
function bandOf(row) {
  const v = row.implied_value_usd;
  if (v >= 1e9) return 'b1';
  if (v >= 1e8) return 'b100m';
  if (v >= 1e7) return 'b10m';
  return 'b0';
}

/** The rows the board shows under the current filters and sort. */
function filteredRows() {
  let rows = DATA.rows;
  if (state.tab === 'live') return DATA.live;
  const q = state.q.trim().toLowerCase();
  if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q));
  if (state.category) rows = rows.filter((r) => (r.category ?? 'Other') === state.category);
  if (state.chain) rows = rows.filter((r) => r.chains.includes(state.chain));
  if (state.band) rows = rows.filter((r) => bandOf(r) === state.band);
  const dir = state.dir === 'desc' ? -1 : 1;
  const key = state.sort;
  const val = (r) => {
    if (key === 'name') return r.name.toLowerCase();
    if (key === 'category') return (r.category ?? 'Other').toLowerCase();
    if (key === 'change_7d') return r.change_7d ?? -Infinity;
    if (key === 'age_days') return r.age_days ?? -Infinity;
    return r[key];
  };
  return [...rows].sort((a, b) => {
    const x = val(a), y = val(b);
    if (x < y) return -1 * dir;
    if (x > y) return 1 * dir;
    return (a.rank - b.rank) * 1;
  });
}

/** One board row, as HTML. The value bar is on a log scale: the board spans $300K to $1.3B, and a linear bar would leave every row below the top few invisible. */
function rowHtml(r) {
  const pct = Math.max(2, Math.round((Math.log10(r.implied_value_usd) / Math.log10(maxImplied)) * 100));
  return `<tr data-slug="${r.slug}">
    <td class="rank num">#${r.rank}</td>
    <td><span class="name">${escapeHtml(r.name)}</span><span class="why">${escapeHtml(r.why)}</span></td>
    <td class="cat">${escapeHtml(r.category ?? 'Other')}</td>
    <td class="num">${money(r.tvl_usd)}</td>
    <td class="num">${changeHtml(r.change_7d)}</td>
    <td class="num">${ageText(r.age_days)}</td>
    <td class="num"><strong>${money(r.implied_value_usd)}</strong><span class="bar"><i style="width:${pct}%"></i></span></td>
  </tr>`;
}

/** One live-token row, as HTML. */
function liveHtml(r) {
  return `<tr data-slug="${r.slug}">
    <td class="rank num">—</td>
    <td><span class="name">${escapeHtml(r.name)}</span><span class="why">Already trades: market cap ${money(r.mcap_usd)} on TVL ${money(r.tvl_usd)}.</span></td>
    <td class="cat">${escapeHtml(r.category ?? 'Other')}</td>
    <td class="num">${money(r.tvl_usd)}</td>
    <td class="num">${changeHtml(r.change_7d)}</td>
    <td class="num">—</td>
    <td class="num"><strong>${money(r.mcap_usd)}</strong></td>
  </tr>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** The board, the count, and the header sort marks, under the current state. */
function render() {
  const rows = filteredRows();
  const tbody = $('rows');
  if (state.tab === 'live') {
    tbody.innerHTML = rows.length ? rows.map(liveHtml).join('') : '<tr><td colspan="7" class="empty">No live-token protocol matches.</td></tr>';
    $('count').textContent = `${rows.length} live-token protocols, by market cap. The board ranks pre-token protocols; this view shows what already trades.`;
  } else {
    tbody.innerHTML = rows.length ? rows.map(rowHtml).join('') : '<tr><td colspan="7" class="empty">No pre-token protocol matches these filters.</td></tr>';
    $('count').textContent = `${rows.length} of ${DATA.board_size} pre-token protocols. Click a row for its value breakdown and farm plan.`;
  }
  document.querySelectorAll('#board thead th').forEach((th) => {
    const k = th.dataset.sort;
    th.setAttribute('aria-sort', k === state.sort ? (state.dir === 'desc' ? 'descending' : 'ascending') : 'none');
    th.textContent = th.textContent.replace(/ [▲▼]$/, '') + (k === state.sort ? (state.dir === 'desc' ? ' ▼' : ' ▲') : '');
  });
  $('tab-pre').setAttribute('aria-selected', state.tab === 'pre' ? 'true' : 'false');
  $('tab-live').setAttribute('aria-selected', state.tab === 'live' ? 'true' : 'false');
  $('q').value = state.q;
  $('category').value = state.category;
  $('chain').value = state.chain;
  $('band').value = state.band;
}

/** The detail dialog for one pre-token row: breakdown, comparables, farm plan. */
function openDetail(slug) {
  const r = DATA.rows.find((x) => x.slug === slug);
  if (!r) return;
  const f = factorsOf(r);
  const base = r.tvl_usd * r.multiple;
  const afterGrowth = base * f.growthMult;
  const afterMaturity = afterGrowth * f.maturityMult;
  const implied = impliedOf(r);
  const match = implied === r.implied_value_usd;
  const comp = DATA.comparables[r.category ?? 'Other'];
  const cat = r.category ?? 'Other';
  $('detail-body').innerHTML = `
    <h2>#${r.rank} ${escapeHtml(r.name)}</h2>
    <p class="sub">${escapeHtml(cat)} · ${r.chains.length ? escapeHtml(r.chains.join(', ')) : 'one chain'} · TVL ${money(r.tvl_usd)} · ${ageText(r.age_days)} old · no token on record</p>
    <p>${escapeHtml(r.why)}</p>
    <dl class="kv">
      <div><dt>Implied value</dt><dd>${moneyFull(r.implied_value_usd)}</dd></div>
      <div><dt>TVL</dt><dd>${moneyFull(r.tvl_usd)}</dd></div>
      <div><dt>Multiple</dt><dd>${r.multiple.toFixed(3)}×</dd></div>
      <div><dt>7-day change</dt><dd>${r.change_7d === null ? '—' : `${r.change_7d > 0 ? '+' : ''}${r.change_7d.toFixed(2)}%`}</dd></div>
    </dl>
    <h3>How the value is worked out</h3>
    <table class="breakdown">
      <tr><td>TVL × ${r.multiple.toFixed(3)} multiple</td><td>${moneyFull(base)}</td></tr>
      <tr><td>× ${f.growthMult.toFixed(3)} growth (${f.growthPct > 0 ? '+' : ''}${f.growthPct.toFixed(2)}% over 7 days)</td><td>${moneyFull(afterGrowth)}</td></tr>
      <tr><td>× ${f.maturityMult.toFixed(3)} maturity (${f.age} days)</td><td>${moneyFull(afterMaturity)}</td></tr>
      <tr><td>× ${f.breadthMult.toFixed(3)} breadth (${r.chains.length} chain${r.chains.length === 1 ? '' : 's'})</td><td><strong>${moneyFull(implied)}</strong></td></tr>
    </table>
    <p class="small">${match ? 'The page recomputes this row from the same numbers and matches the board.' : 'The page recomputes this row and does not match the board — a bug, not a judgement.'}</p>
    <h3>What grounds the multiple</h3>
    <p>${comp ? `${escapeHtml(cat)} tokens trade at a median ${comp.median.toFixed(2)}× TVL across ${comp.count} token${comp.count === 1 ? '' : 's'} — ${comp.examples.map(escapeHtml).join(' and ')} — and the radar uses ${r.multiple.toFixed(3)}× after shrinking toward the global median ${M.global_median.toFixed(3)}×.` : `No token-bearing ${escapeHtml(cat)} protocol sits in this snapshot, so the radar uses the global median ${M.global_median.toFixed(3)}×.`}</p>
    <h3>Farm plan</h3>
    <ol class="steps">${r.farm_steps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>`;
  const d = $('detail');
  if (!d.open) d.showModal();
}

/** The header, the lede, and the model panel, from the data. */
function renderMeta() {
  $('meta').textContent = `Snapshot ${DATA.as_of} · ${DATA.source.replace(/^https?:\/\//, '')} · floor ${money(DATA.floor_usd)}`;
  $('lede').innerHTML = `<strong>${DATA.board_size} pre-token protocols, ranked.</strong> ${DATA.watchlist_size} on the watchlist and ${DATA.early_size} below the ${money(DATA.floor_usd)} floor, each with an implied value, a why, and a farm plan. The top row is <strong>${escapeHtml(DATA.rows[0].name)}</strong> at ${money(DATA.rows[0].implied_value_usd)}.`;
  $('lede-note').textContent = `The floor is not the whole board: ${DATA.early_size} of the ${DATA.board_size} rankable protocols sit below it. Live-token protocols are shown apart, at the market's own values, so a token that already trades never crowds out a protocol that has not launched.`;
  $('model-text').innerHTML = `Implied value = TVL × the category's multiple × growth × maturity × breadth. The multiple comes from the snapshot's own token-bearing comparables (median market-cap-to-TVL, shrunk toward the global median ${M.global_median.toFixed(3)}× and clamped to ${M.multiple_min}–${M.multiple_max}). The other factors come from the protocol's own record: its 7-day change, its age, and how many chains it runs on.`;
  $('formula-notes').innerHTML = `
    <li><strong>Multiple</strong> — the category's calibrated multiple; a thin category leans on the global median.</li>
    <li><strong>Growth</strong> — 1 + the 7-day change, clamped to ${M.growth_floor}%…+${M.growth_cap}%, times ${M.growth_weight}.</li>
    <li><strong>Maturity</strong> — ${M.maturity_floor} + min(age, ${M.maturity_days} days) / ${M.maturity_days} × ${M.maturity_range}; age unknown counts as ${M.unknown_age_days} days.</li>
    <li><strong>Breadth</strong> — 1 + min(chains − 1, ${M.breadth_max_steps}) × ${M.breadth_step}, up to ${(1 + M.breadth_max_steps * M.breadth_step).toFixed(2)}.</li>`;
  const cats = Object.entries(DATA.multiples).sort((a, b) => b[1] - a[1]);
  $('multiples').querySelector('tbody').innerHTML = cats.map(([c, mult]) => {
    const comp = DATA.comparables[c];
    return `<tr><td>${escapeHtml(c)}</td><td class="num">${mult.toFixed(2)}×</td><td class="num">${comp ? comp.median.toFixed(2) : '—'}×</td><td class="num">${comp ? comp.count : '—'}</td><td>${comp ? escapeHtml(comp.examples.join(', ')) : '—'}</td></tr>`;
  }).join('');
  $('footer').innerHTML = `<p>Model ${DATA.model_version}. Snapshot ${DATA.as_of}, from ${escapeHtml(DATA.source)}; the board is derived from that snapshot alone. The radar ranks pre-token protocols by implied value; it is not investment advice, and a high implied value is a launch the market has not yet priced, not a promise it will.</p>`;
  // The filter lists, from the data itself.
  const cats2 = [...new Set(DATA.rows.map((r) => r.category ?? 'Other'))].sort();
  $('category').innerHTML = '<option value="">All categories</option>' + cats2.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  const chainCounts = new Map();
  for (const r of DATA.rows) for (const ch of r.chains) chainCounts.set(ch, (chainCounts.get(ch) ?? 0) + 1);
  const chains = [...chainCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([c]) => c);
  $('chain').innerHTML = '<option value="">All chains</option>' + chains.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
}

// Wire the controls to the hash, and the hash to the render.
$('q').addEventListener('input', (e) => { state.q = e.target.value; state.p = ''; writeHash(state); render(); });
$('category').addEventListener('change', (e) => { state.category = e.target.value; state.p = ''; writeHash(state); render(); });
$('chain').addEventListener('change', (e) => { state.chain = e.target.value; state.p = ''; writeHash(state); render(); });
$('band').addEventListener('change', (e) => { state.band = e.target.value; state.p = ''; writeHash(state); render(); });
$('tab-pre').addEventListener('click', () => { state.tab = 'pre'; state.p = ''; writeHash(state); render(); });
$('tab-live').addEventListener('click', () => { state.tab = 'live'; state.p = ''; writeHash(state); render(); });
document.querySelectorAll('#board thead th').forEach((th) => {
  th.addEventListener('click', () => {
    const k = th.dataset.sort;
    if (state.sort === k) state.dir = state.dir === 'desc' ? 'asc' : 'desc';
    else { state.sort = k; state.dir = k === 'rank' ? 'asc' : 'desc'; }
    writeHash(state); render();
  });
});
$('rows').addEventListener('click', (e) => {
  const tr = e.target.closest('tr[data-slug]');
  if (!tr) return;
  if (state.tab === 'live') return;
  state.p = tr.dataset.slug; writeHash(state); openDetail(state.p);
});
$('detail-close').addEventListener('click', () => { state.p = ''; writeHash(state); $('detail').close(); });
$('detail').addEventListener('close', () => { if (state.p) { state.p = ''; writeHash(state); } });
window.addEventListener('hashchange', () => { state = readHash(); render(); if (state.p) openDetail(state.p); });

renderMeta();
render();
if (state.p) openDetail(state.p);
