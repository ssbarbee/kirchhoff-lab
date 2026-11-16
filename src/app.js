/* =====================================================================
   APP — state, routing, minimap, chrome
   ===================================================================== */
const S = { level: 2, seed: 1, circ: null, dirs: [], loopDirs: [], model: null, page: 'ex', returnTo: null, symbol: 'iec', ground: null, answers: {}, revealed: new Set(), quiz: false, seen: new Set() };
let PAGES = [];
let curEl = null, mmView = null, hashLock = null;

function pref(k, v) {
  try { if (v === undefined) return localStorage.getItem('kirchhoff-' + k); localStorage.setItem('kirchhoff-' + k, v); } catch (e) { /* storage blocked */ }
  return null;
}
const code = () => `L${S.level}-${S.seed}`;
function parseCode(s) { const m = /^\s*L?\s*([1-4])\s*[-\s_.]?\s*(\d{1,6})\s*$/i.exec(s || ''); return m ? { level: +m[1], seed: +m[2] } : null; }
const randSeed = () => 1 + Math.floor(Math.random() * 9999);

function pageList() {
  const c = S.circ, P = [
    { id: 'ex', title: 'The exercise', build: pgExercise },
    { id: 'rules', title: 'The two rules', build: pgRules },
    { id: 'map', title: 'Read the circuit', build: pgMap },
    { id: 'dirs', title: 'Choose directions', build: pgDirs },
  ];
  if (c.junctions.length) P.push({ id: 'kcl', title: 'Junction rule', build: pgKCL });
  c.loops.forEach((_, l) => P.push({ id: 'loop' + (l + 1), title: c.nL === 1 ? 'Loop rule' : `Loop ${l + 1}`, build: el => pgLoop(el, l) }));
  if (c.nB > 1) P.push({ id: 'system', title: 'All equations', build: pgSystem });
  P.push({ id: 'solve', title: 'Solve', build: pgSolve },
    { id: 'answer', title: 'Read the answer', build: pgAnswer },
    { id: 'pot', title: 'Potential map', build: pgPotential },
    { id: 'energy', title: 'Double-check', build: pgEnergy },
    { id: 'recap', title: 'Recap', build: pgRecap });
  return P;
}

function load(level, seed) {
  S.level = level; S.seed = seed;
  S.circ = generate(level, seed);
  S.dirs = S.circ.dir0.slice(); S.loopDirs = S.circ.loops.map(() => 1);
  S.model = buildModel(S.circ, S.dirs, S.loopDirs);
  S.ground = S.circ.ground; S.answers = {}; S.revealed = new Set(); S.returnTo = null; S.seen = new Set();
  PAGES = pageList();
  drawMinimap();
}
function newCircuit(level) { load(level, randSeed()); go('ex', { instant: S.page === 'ex' }); }

function drawMinimap() {
  const host = $('#mmBody'); host.innerHTML = '';
  if (mmView) mmView.unsub();
  mmView = new CircuitView(host, S.circ, { dirs: S.circ.dir0, arrows: 'assumed' });
}

function go(id, opts = {}) {
  let idx = PAGES.findIndex(p => p.id === id);
  if (idx < 0) { idx = 0; id = 'ex'; }
  const oldIdx = PAGES.findIndex(p => p.id === S.page);
  const dir = idx >= oldIdx ? 'f' : 'b';
  CLEAN.forEach(f => { try { f(); } catch (e) { console.error(e); } });
  CLEAN = [];
  if (id !== 'ex') S.returnTo = null;
  S.page = id; S.seen.add(id);
  const stage = $('#stage');
  if (curEl) {
    const old = curEl;
    if (opts.instant) old.remove();
    else { old.classList.add('leave-' + dir); setTimeout(() => old.remove(), 300); }
  }
  const el = document.createElement('section');
  el.className = 'page' + (opts.instant ? '' : ' enter-' + dir);
  el.setAttribute('aria-label', PAGES[idx].title);
  stage.appendChild(el); curEl = el;
  try { PAGES[idx].build(el); }
  catch (e) { console.error(e); el.innerHTML = `<div class="inner"><div class="callout warn"><b>Oops</b>This step could not be drawn: ${String(e.message || e)}</div></div>`; }
  el.addEventListener('scroll', () => $('#minimap').classList.toggle('min', el.scrollTop > 40), { passive: true });
  $('#minimap').classList.remove('min');
  renderChrome();
  setHash();
}
const curIdx = () => PAGES.findIndex(p => p.id === S.page);
function next() { const i = curIdx(); if (i < PAGES.length - 1) go(PAGES[i + 1].id); }
function prev() { const i = curIdx(); if (i > 0) go(PAGES[i - 1].id); }

function renderChrome() {
  const i = curIdx(), N = PAGES.length;
  document.body.classList.toggle('on-exercise', S.page === 'ex');
  $('#lvlChip').textContent = `Level ${S.level} · ${LEVELS[S.level].name}`;
  $('#progress').innerHTML = PAGES.map((p, k) => `<button class="pdot${k === i ? ' on' : S.seen.has(p.id) ? ' seen' : ''}" data-go="${p.id}" aria-label="${p.title}"><span class="tip">${k === 0 ? 'Exercise' : `${k}. ${p.title}`}</span></button>`).join('');
  $('#where').innerHTML = i === 0 ? `<b>The exercise</b> <span class="hint">· code ${code()}</span>` : `<b>Step ${i} of ${N - 1}</b> · ${PAGES[i].title} <span class="hint">· ← → keys work too</span>`;
  $('#prevBtn').disabled = i === 0;
  const nb = $('#nextBtn');
  nb.disabled = i === N - 1;
  nb.firstChild.textContent = i === 0 ? 'Solve together' : 'Next';
  let pill = $('#returnPill');
  if (S.page === 'ex' && S.returnTo) {
    const rp = PAGES.find(p => p.id === S.returnTo);
    if (!pill) { pill = document.createElement('button'); pill.id = 'returnPill'; pill.className = 'btn primary return-pill'; document.body.appendChild(pill); pill.addEventListener('click', () => go(S.returnTo)); }
    pill.textContent = `Back to step ${PAGES.indexOf(rp)}: ${rp.title} →`;
    pill.hidden = false;
  } else if (pill) pill.hidden = true;
  $('#symBtn').textContent = S.symbol === 'iec' ? 'IEC' : 'US';
}

function setHash() {
  const h = `#${code()}/${S.page}`;
  if (location.hash === h) return;
  hashLock = h;
  try { history.replaceState(null, '', h); } catch (e) { location.hash = h; }
}
function fromHash() {
  const m = /^#(L[1-4]-\d+)(?:\/([\w-]+))?$/.exec(location.hash || '');
  if (!m) return false;
  const p = parseCode(m[1]);
  if (!p) return false;
  if (!S.circ || p.level !== S.level || p.seed !== S.seed) load(p.level, p.seed);
  go(m[2] || 'ex', { instant: true });
  return true;
}

function copyText(txt) {
  const done = () => toast(`Copied ${txt}`);
  const fallback = () => { const ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { toast(txt); } ta.remove(); };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(done, fallback); else fallback();
}

function applyTheme(t) {
  if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
}
function effectiveTheme() {
  const t = document.documentElement.dataset.theme;
  if (t) return t;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function redrawAll() { drawMinimap(); go(S.page, { instant: true }); }

function init() {
  applyTheme(pref('theme'));
  S.symbol = pref('symbol') === 'us' ? 'us' : 'iec';
  $('#prevBtn').addEventListener('click', prev);
  $('#nextBtn').addEventListener('click', next);
  $('#brand').addEventListener('click', () => go('ex'));
  $('#lvlChip').addEventListener('click', () => go('ex'));
  $('#progress').addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); });
  const mm = $('#minimap');
  const openEx = () => { const from = S.page; go('ex'); S.returnTo = from; renderChrome(); };
  mm.addEventListener('click', openEx);
  mm.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEx(); } });
  $('#themeBtn').addEventListener('click', () => { const t = effectiveTheme() === 'dark' ? 'light' : 'dark'; applyTheme(t); pref('theme', t); });
  $('#symBtn').addEventListener('click', () => { S.symbol = S.symbol === 'iec' ? 'us' : 'iec'; pref('symbol', S.symbol); redrawAll(); });
  const fs = () => { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) { /* not allowed */ } };
  $('#fsBtn').addEventListener('click', fs);
  addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
    else if (e.key === 'f' || e.key === 'F') fs();
    else if (e.key === 'Escape' && S.page === 'ex' && S.returnTo) go(S.returnTo);
  });
  addEventListener('hashchange', () => { if (location.hash === hashLock) return; fromHash(); });
  if (!fromHash()) { load(2, randSeed()); go('ex', { instant: true }); }
}
init();
