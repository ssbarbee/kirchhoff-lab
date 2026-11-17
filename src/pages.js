/* =====================================================================
   PAGES — every step is generated from the current circuit
   ===================================================================== */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const SUBD = '₀₁₂₃₄₅₆₇₈₉';
const subNum = n => String(n).split('').map(d => SUBD[+d] || d).join('');
const elName = e => (e.type === 'R' ? 'R' : 'ℰ') + subNum(e.num);
const elM = e => M(elTex(e));
const IM = b => M(Itex(b));
const valM = e => M(`${elTex(e)} = ${e.val}\\unit{${elUnit(e)}}`);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

let CLEAN = [];
const onLeave = f => CLEAN.push(f);
function view(host, opts) { const v = new CircuitView(host, S.circ, opts); onLeave(() => v.unsub && v.unsub()); return v; }
function header(kicker, title, lede) {
  return `<header class="ph"><div class="kicker">${kicker}</div><h1>${title}</h1>${lede ? `<p class="lede">${lede}</p>` : ''}</header>`;
}
function kick(short) {
  const i = PAGES.findIndex(p => p.id === S.page);
  return `Step ${i} of ${PAGES.length - 1} · ${short}`;
}
function mlines(lines, fresh) {
  return `<div class="mlines">${lines.map(l => `<div class="ln${fresh ? ' fresh' : ''}"><div class="note">${l.note || ''}</div><div class="eq">${M(l.tex)}</div><div class="tag">${l.tag || ''}</div></div>`).join('')}</div>`;
}
const sumTex = list => (list.length ? list.map(Itex).join(' + ') : '0');
const nodeWord = id => { const n = S.circ.nodeById[id]; return n.junction ? `junction <b>${id}</b>` : 'the top-left corner'; };
function actualWay(b) {
  const c = S.circ, br = c.branches[b], I = c.Itrue[b];
  if (br.from === br.to) return I > 0 ? 'clockwise' : 'counter-clockwise';
  return I > 0 ? `from ${br.from} to ${br.to}` : `from ${br.to} to ${br.from}`;
}
function arrowWay(b, d) {
  const br = S.circ.branches[b];
  if (br.from === br.to) return d > 0 ? 'clockwise' : 'counter-clockwise';
  return d > 0 ? `from ${br.from} to ${br.to}` : `from ${br.to} to ${br.from}`;
}
function branchNodes(b) { const br = S.circ.branches[b]; return [br.from, br.to]; }
function loopNodes(l) { const c = S.circ; return [...new Set(c.loops[l].items.flatMap(it => branchNodes(it.b)))]; }
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 1800); }

/* ---------- Exercise ---------- */
function pgExercise(el) {
  const c = S.circ, lv = LEVELS[S.level];
  const want = c.Itrue.map((v, b) => v * c.dir0[b]);
  const unknowns = c.branches.map((_, b) => IM(b)).join(', ');
  el.innerHTML = `<div class="inner">
    <div class="ex-head"><div>
      <div class="kicker">Exercise · Level ${S.level} — ${lv.name}</div>
      <h1>${c.nB === 1 ? 'Find the current' : 'Find every current'}</h1>
      <p class="lede">Before solving, you need two directions, and they are separate choices:</p>
      <div class="choices">
        <div class="choice"><b><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>Current ${c.nB === 1 ? 'arrow' : 'arrows'}<small>chosen for you</small></b>We picked a direction for ${unknowns} before solving: the coloured ${c.nB === 1 ? 'arrow' : 'arrows'}. It's only a guess. If a current really flows the other way, its answer comes out negative. Answer for ${c.nB === 1 ? 'this arrow' : 'these arrows'}.</div>
        <div class="choice"><b><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg>Loop ${c.nL === 1 ? 'direction' : 'directions'}<small>your choice</small></b>Pick which way to walk around ${c.nL === 1 ? 'the loop' : 'each loop'} when you add up voltages. It doesn't have to match the current arrows, and it doesn't change the answers.</div>
      </div>
    </div>
    <div class="ex-actions"><button class="btn big" data-act="new" title="Same level, new numbers (N)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg>New circuit</button><button class="btn primary big" data-act="solve">Let's solve it together <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div></div>
    <div class="ex-grid">
      <div class="card hero"><div class="hero-host"></div></div>
      <div class="ex-side">
        <div class="card"><h3>Difficulty</h3>
          <div class="levels">${Object.entries(LEVELS).map(([n, L]) => `<button class="lvl${+n === S.level ? ' on' : ''}" data-lvl="${n}"><b>${n} · ${L.name}</b><span>${L.tag}</span></button>`).join('')}</div>
          <p class="small" style="margin:8px 0 0">${lv.blurb}</p>
        </div>
        <div class="card"><h3>Your answer</h3>
          <div class="ans">${c.branches.map((_, b) => `<div class="ans-row" data-b="${b}"><label for="ans${b}">${M(Itex(b) + ' =')}</label><input id="ans${b}" inputmode="decimal" autocomplete="off" spellcheck="false" placeholder="?" value="${S.answers[b] ?? ''}"><span>${M('\\mathrm{A}')}</span><span class="mark"></span></div>`).join('')}</div>
          <div class="row" style="margin-top:12px"><button class="btn primary" data-act="check">Check</button></div>
          <div class="fb"></div>
          <div class="rv-box">
            <div class="rv-head"><span>Stuck? Peek at one answer</span><button class="linkbtn" data-act="revealAll"></button></div>
            <div class="rv-grid">${want.map((v, b) => `<button class="rv${S.revealed.has(b) ? ' open' : ''}" data-rv="${b}" aria-pressed="${S.revealed.has(b)}" aria-label="Reveal the answer for I${subNum(b + 1)}"><span class="rv-q">${M(Itex(b) + ' = ?')}<small>click to reveal</small></span><span class="rv-a">${M(`${Itex(b)} = ${fmtN(v)}\\unit{A}`)}</span></button>`).join('')}</div>
          </div>
        </div>
        <div class="card soft"><h3>${onWeb ? 'Share this circuit' : 'Circuit code'}</h3>
          <p class="small" style="margin-top:0">${onWeb ? 'Send the link and everyone gets exactly this circuit, handy for a class. Or type the code below.' : 'Everyone who opens this code gets exactly this circuit, handy for a class.'}</p>
          <div class="code-box"><span class="code">${code()}</span><button class="btn ${onWeb ? '' : 'ghost'}" data-act="copy">${onWeb ? 'Copy link' : 'Copy'}</button></div>
          <div class="code-box" style="margin-top:8px"><input id="codeIn" placeholder="L3-1234" aria-label="Circuit code"><button class="btn" data-act="load">Open</button></div>
        </div>
      </div>
    </div></div>`;
  view($('.hero-host', el), { dirs: c.dir0, arrows: 'assumed' });
  const fb = $('.fb', el);
  const parse = s => { s = String(s).replace(/[−–]/g, '-').replace(',', '.').replace(/[aA\s]/g, ''); if (!s) return null; const v = Number(s); return Number.isFinite(v) ? v : NaN; };
  $$('.ans-row input', el).forEach(inp => inp.addEventListener('input', () => { S.answers[+inp.closest('.ans-row').dataset.b] = inp.value; inp.closest('.ans-row').className = 'ans-row'; inp.closest('.ans-row').querySelector('.mark').textContent = ''; }));
  $$('.ans-row input', el).forEach(inp => inp.addEventListener('keydown', e => { if (e.key === 'Enter') check(); }));
  function check() {
    let ok = 0, sign = [], empty = 0;
    c.branches.forEach((_, b) => {
      const row = $(`.ans-row[data-b="${b}"]`, el), v = parse($('input', row).value), mk = $('.mark', row);
      if (v === null) { empty++; row.className = 'ans-row'; mk.textContent = ''; return; }
      if (Math.abs(v - want[b]) < 0.011) { ok++; row.className = 'ans-row ok'; mk.textContent = '✓'; }
      else if (Math.abs(v + want[b]) < 0.011) { sign.push(b); row.className = 'ans-row sign'; mk.textContent = '±'; }
      else { row.className = 'ans-row no'; mk.textContent = '✗'; }
    });
    if (ok === c.nB) { fb.innerHTML = `<span style="color:var(--good);font-weight:700">All correct, well done!</span> The walkthrough still shows every step, plus an energy check at the end.`; c.branches.forEach((_, b) => setTimeout(() => setRv(b, true), 150 + b * 160)); }
    else if (empty === c.nB) fb.textContent = 'Type a number into each box first (negative answers are allowed).';
    else {
      let s = `${ok} of ${c.nB} correct.`;
      if (sign.length) s += ` For ${sign.map(IM).join(', ')} the size is right but the sign is wrong. Check the sign rule for walking with or against an arrow.`;
      else s += ' Peek at one answer below, or press <b>Let\u2019s solve it together</b> to work through it step by step.';
      fb.innerHTML = s;
    }
  }
  el.addEventListener('click', e => {
    const rv = e.target.closest('[data-rv]'); if (rv) { const b = +rv.dataset.rv; setRv(b, !S.revealed.has(b)); return; }
    const t = e.target.closest('[data-act],[data-lvl]'); if (!t) return;
    if (t.dataset.lvl) { newCircuit(+t.dataset.lvl); return; }
    const a = t.dataset.act;
    if (a === 'solve') next();
    if (a === 'new') newCircuit(S.level);
    if (a === 'check') check();
    if (a === 'revealAll') { const show = S.revealed.size < c.nB; c.branches.forEach((_, b) => setTimeout(() => setRv(b, show), b * 110)); }
    if (a === 'copy') shareCircuit();
    if (a === 'load') { const p = parseCode($('#codeIn', el).value); if (!p) { toast('Codes look like L2-4821'); return; } load(p.level, p.seed); go('ex', { instant: true }); }
  });
  function setRv(b, on) {
    if (on) S.revealed.add(b); else S.revealed.delete(b);
    const card = $(`.rv[data-rv="${b}"]`, el);
    if (card) { card.classList.toggle('open', on); card.setAttribute('aria-pressed', on); }
    syncRvAll();
  }
  function syncRvAll() { const all = S.revealed.size === c.nB; $('[data-act="revealAll"]', el).textContent = all ? 'Hide all' : 'Reveal all'; $('.rv-head span', el).textContent = all ? 'The answers' : 'Stuck? Peek at one answer'; }
  syncRvAll();
  $('#codeIn', el).addEventListener('keydown', e => { if (e.key === 'Enter') $('[data-act="load"]', el).click(); });
}

/* ---------- The two rules ---------- */
function demoCircuit() {
  const t = topology(1);
  const br = { ...t.branches[0], idx: 0, I: 2, els: [{ type: 'R', val: 4, seg: 0 }, { type: 'R', val: 2, seg: 1 }, { type: 'E', val: 12, plus: 'to', seg: 3 }] };
  return finalize({ level: 1, seed: 0, ...t, branches: [br], dir0: [1] });
}
function signSVG(kind, right) {
  const W = 'stroke:var(--wire)';
  let s = '<svg viewBox="0 0 96 54" aria-hidden="true">';
  if (kind === 'R') s += `<path d="M4 34H30M66 34H92" style="${W};stroke-width:2.6;fill:none"/><rect x="30" y="27" width="36" height="14" style="fill:var(--card);${W};stroke-width:2.6"/><path d="M90 34l-10-5.5v11z" style="fill:var(--c1)"/><text x="76" y="52" style="fill:var(--c1);font:italic 700 12px var(--serif)">I</text>`;
  else s += `<path d="M4 34H43M54 34H92" style="${W};stroke-width:2.6"/><path d="M44 26v16" style="${W};stroke-width:6"/><path d="M53 19v30" style="${W};stroke-width:2.4"/><text x="32" y="50" style="fill:var(--muted);font:700 13px var(--sans)">−</text><text x="58" y="50" style="fill:var(--muted);font:700 13px var(--sans)">+</text>`;
  s += right ? '<path d="M14 9H74" style="stroke:var(--hot);stroke-width:2.6;stroke-dasharray:5 4"/><path d="M84 9l-10-5.5v11z" style="fill:var(--hot)"/>'
    : '<path d="M22 9H82" style="stroke:var(--hot);stroke-width:2.6;stroke-dasharray:5 4"/><path d="M12 9l10-5.5v11z" style="fill:var(--hot)"/>';
  return s + '</svg>';
}
function signTiles() {
  return `<div class="signs">
    <div class="sign-tile">${signSVG('R', true)}<div class="r">Walk <b>with</b> the current arrow through a resistor: ${M('-IR')} <span class="badge down">drop</span></div></div>
    <div class="sign-tile">${signSVG('R', false)}<div class="r">Walk <b>against</b> the current arrow: ${M('+IR')} <span class="badge up">rise</span></div></div>
    <div class="sign-tile">${signSVG('E', true)}<div class="r">Through a battery from <b>−</b> to <b>+</b> (short plate to long plate): ${M('+\\emf')} <span class="badge up">rise</span></div></div>
    <div class="sign-tile">${signSVG('E', false)}<div class="r">Through a battery from <b>+</b> to <b>−</b>: ${M('-\\emf')} <span class="badge down">drop</span></div></div>
  </div>
  <p class="small" style="margin-top:8px">The dashed orange arrow is the direction you <i>walk</i>. The battery's sign depends only on which plate you reach first, not on the current.</p>`;
}
function pgRules(el) {
  el.innerHTML = `<div class="inner">${header(kick('The toolkit'), 'Two rules are all you need', 'Gustav Kirchhoff (1845) noticed two things that are always true in a circuit. One is about <b>junctions</b>, the other about <b>loops</b>. Together they give exactly as many equations as there are unknown currents.')}
    <div class="two">
      <div class="card junction-demo"><h3><span class="num">Rule 1</span>Junction rule</h3>
        <p>Whatever current flows <b>into</b> a junction must flow <b>out</b> again. Charge cannot pile up anywhere, just like water at a pipe split.</p>
        <div style="text-align:center">${MD('\\sum I_{\\text{in}} = \\sum I_{\\text{out}}')}</div>
        <svg viewBox="0 0 420 210" class="jd">
          <path d="M20 130H210M210 16V130M210 130H400" style="stroke:var(--wire);stroke-width:4;fill:none;stroke-linecap:round"/>
          <path class="jf" data-k="a" d="M20 130H206" style="stroke:var(--c1)"/><path class="jf" data-k="b" d="M210 16V126" style="stroke:var(--c2)"/><path class="jf" data-k="o" d="M214 130H400" style="stroke:var(--c3)"/>
          <circle cx="210" cy="130" r="8" style="fill:var(--wire)"/>
          <text x="60" y="160" class="jt" style="fill:var(--c1)">in: <tspan data-v="a"></tspan></text>
          <text x="225" y="50" class="jt" style="fill:var(--c2)">in: <tspan data-v="b"></tspan></text>
          <text x="290" y="160" class="jt" style="fill:var(--c3)">out: <tspan data-v="o"></tspan></text>
        </svg>
        <div class="slider-row"><span style="color:var(--c1)">left in</span><input type="range" min="0" max="5" step="0.5" value="2" data-s="a"><span data-o="a"></span></div>
        <div class="slider-row"><span style="color:var(--c2)">top in</span><input type="range" min="0" max="5" step="0.5" value="3" data-s="b"><span data-o="b"></span></div>
        <div class="jeq" style="text-align:center"></div>
      </div>
      <div class="card loop-demo"><h3><span class="num">Rule 2</span>Loop rule</h3>
        <p>Walk once around any closed loop and add up every voltage <b>rise</b> and <b>drop</b>. You come back to the same point, so you are back at the same "height": the total is zero.</p>
        <div style="text-align:center">${MD('\\sum \\Delta V = 0')}</div>
        <div class="dhost"></div>
        <div class="chost"></div>
        <p class="small">Like a rollercoaster: the battery is the lift hill (+12 V), the resistors are the drops (−8 V, −4 V). One lap is ${M('12 - 8 - 4 = 0')}.</p>
      </div>
    </div>
    <div class="card" style="margin-top:18px"><h3>The four signs for the loop walk</h3>${signTiles()}</div>
    <div class="callout" style="margin-top:18px"><b>How we'll use them</b>For a circuit with ${M('b')} branches (unknown currents) and ${M('n')} junctions: the junction rule gives ${M('n-1')} new equations and the loop rule gives the remaining ${M('b-n+1')}. That is ${M('b')} equations for ${M('b')} unknowns.</div>
  </div>`;
  // junction demo
  const val = { a: 2, b: 3 };
  const flows = $$('.jf', el);
  flows.forEach(f => { f.setAttribute('fill', 'none'); f.style.strokeWidth = 8; f.style.strokeLinecap = 'round'; f.style.strokeDasharray = '0 24'; });
  const upd = () => {
    val.o = val.a + val.b;
    for (const k of ['a', 'b', 'o']) { $(`[data-v="${k}"]`, el).textContent = `${fmtN(val[k])} A`; const o = $(`[data-o="${k}"]`, el); if (o) o.textContent = `${fmtN(val[k])} A`; }
    $('.jeq', el).innerHTML = MD(`\\cl{ci1}{${fmtN(val.a)}} + \\cl{ci2}{${fmtN(val.b)}} = \\cl{ci3}{${fmtN(val.o)}}\\unit{A}`);
  };
  $$('input[type=range]', el).forEach(r => r.addEventListener('input', () => { val[r.dataset.s] = +r.value; upd(); }));
  upd();
  onLeave(Anim.add(t => flows.forEach(f => { f.style.strokeDashoffset = String((-(t / 1000) * val[f.dataset.k] * 22) % 24); })));
  // loop demo
  const d = demoCircuit();
  const v = new CircuitView($('.dhost', el), d, { dirs: [1], arrows: 'actual', flow: true });
  onLeave(() => v.unsub());
  const route = routeGeometry(d, loopItems(d.loops[0], 1));
  const marks = route.elems.map(r => ({ s: r.s, h: r.e.type === 'R' ? r.h : 3, label: elName(r.e), dv: r.t * elDeltaFwd(r.e, d.branches[r.b].I) }));
  const co = new Coaster($('.chost', el), coasterProfile(d, route, 12), { marks, color: 'var(--hot)' });
  const tour = new Tour(v, route, { coaster: co, color: 'var(--hot)' });
  tour.loop(170, 900);
  onLeave(() => tour.stop());
}

/* ---------- Junctions, branches, loops ---------- */
function pgMap(el) {
  const c = S.circ, n = c.junctions.length, b = c.nB, L = b - n + 1;
  const single = n === 0;
  el.innerHTML = `<div class="inner">${header(kick('Read the circuit'), 'Find the junctions, branches and loops', 'Before writing any equation, take stock: where does the current split, which wires carry their own current, and which loops can we walk around? <span class="small">Hover a list item to highlight it.</span>')}
    <div class="split"><div class="fig"><div class="card fig-card host"></div></div>
    <div class="txt">
      <div class="card"><h3><span class="num">1</span>Junctions</h3>
        ${single ? `<p>There are <b>no junctions</b>: nowhere do three or more wires meet. The current has only one path, so it is the <b>same everywhere</b> in the loop: one unknown, ${IM(0)}.</p>`
      : `<p>A junction is a point where <b>three or more</b> wires meet (the big dots). This circuit has ${plural(n, 'junction', 'junctions')}: ${c.junctions.map(j => `<b>${j.id}</b>`).join(', ')}.</p>
        <ul class="hoverlist">${c.junctions.map(j => `<li data-n="${j.id}"><b>${j.id}</b>: ${plural(c.branches.filter(br => br.from === j.id || br.to === j.id).length, 'branch meets', 'branches meet')} here</li>`).join('')}</ul>
        ${S.level === 4 ? `<p class="small">Junctions <b>A</b> and <b>C</b> are drawn stretched out: the plain wires between their points have no resistor or battery, so every point on them is the same junction. Junction C is the whole bottom wire.</p>` : ''}`}
      </div>
      <div class="card"><h3><span class="num">2</span>Branches</h3>
        ${single ? `<p>The whole loop is one branch, containing ${c.branches[0].els.map(elM).join(', ')}.</p>`
      : `<p>A branch is a path from one junction to the next. All its elements are in series, so <b>one current flows through the whole branch</b>. We give each branch its own name.</p>
        <ul class="hoverlist">${c.branches.map((br, i) => `<li data-b="${i}"><span style="color:${curColor(i)};font-weight:700">${IM(i)}</span> flows between ${br.from} and ${br.to}, through ${br.els.map(elM).join(', ')}</li>`).join('')}</ul>`}
      </div>
      <div class="card"><h3><span class="num">3</span>Loops</h3>
        <p>${c.nL === 1 ? 'There is one loop to walk around.' : `We use the ${plural(c.nL, 'window', 'windows')} of the circuit as loops. Each window contains at least one branch the others don't, so each gives a <b>new</b> equation. (The big outer loop works too, but it is just the windows added together.)`}</p>
        <ul class="hoverlist">${c.loops.map((_, l) => `<li data-l="${l}"><b style="color:${loopColor(l)}">Loop ${l + 1}</b>: through ${c.loops[l].items.map(it => IM(it.b)).join(', ')}</li>`).join('')}</ul>
      </div>
      <div class="card soft"><h3>Count equations and unknowns</h3>
        ${single ? mlines([{ tex: '1 \\text{ unknown current } \\I{1}', note: 'unknowns' }, { tex: '1 \\text{ loop equation}', note: 'loop rule' }])
      : mlines([
        { tex: `b = ${b}`, note: 'branches', tag: `${b} unknowns` },
        { tex: `n - 1 = ${n} - 1 = ${n - 1}`, note: 'junction rule', tag: plural(n - 1, 'equation', 'equations') },
        { tex: `b - n + 1 = ${b} - ${n} + 1 = ${L}`, note: 'loop rule', tag: plural(L, 'equation', 'equations') },
        { tex: `${n - 1} + ${L} = ${b} \\;\\checkmark`, note: 'total', tag: '' },
      ])}
        ${single ? '' : `<p class="small">Why only ${M('n-1')} junction equations? The last junction's equation always follows from the others. You'll see it on the junction page.</p>`}
      </div>
    </div></div></div>`;
  const v = view($('.host', el), { arrows: 'assumed', loops: true });
  $$('[data-n],[data-b],[data-l]', $('.txt', el)).forEach(li => {
    li.addEventListener('mouseenter', () => {
      if (li.dataset.n) { const id = li.dataset.n; v.focus({ n: [id], b: c.branches.map((br, i) => (br.from === id || br.to === id ? i : -1)).filter(i => i >= 0) }); }
      else if (li.dataset.b) { const i = +li.dataset.b; v.focus({ b: [i], n: [] }); }
      else { const l = +li.dataset.l; v.focus({ b: c.loops[l].items.map(it => it.b), n: loopNodes(l) }); v.showBand(l); }
    });
    li.addEventListener('mouseleave', () => { v.focus(null); v.showBand(-1); });
  });
}

/* ---------- Directions ---------- */
function pgDirs(el) {
  const c = S.circ;
  el.innerHTML = `<div class="inner">${header(kick('Choose directions'), 'Give every current an arrow. Any direction will do.', 'We don\u2019t know yet which way the currents really flow, and we don\u2019t need to. <b>Click an arrow</b> to flip it, and <b>click a loop symbol</b> to change the walking direction.')}
    <div class="split"><div class="fig"><div class="card fig-card host"></div>
      <div class="row" style="margin-top:10px"><button class="btn" data-act="reset">Reset to the exercise's arrows</button><span class="kbd-hint">Arrows and loop symbols are clickable</span></div></div>
    <div class="txt">
      <div class="card"><h3>Why guessing is allowed</h3>
        <p>An arrow is just a promise about how we will <b>count</b>: "current in this direction is positive". If the real current flows the other way, the answer comes out <b>negative</b>. The size is still right, and the minus sign tells you the true direction.</p>
        <p>So a negative answer is <b>not a mistake</b>. It is information.</p>
      </div>
      <div class="card"><h3>Loop directions</h3>
        <p>For each loop we also pick a <b>walking direction</b>. Clockwise is the usual habit, but either works: walking the other way just flips every sign in that loop's equation, which says the same thing.</p>
        <div class="loopstate"></div>
      </div>
      <div class="card"><h3>Peek: what the answers would be</h3>
        <p class="small" style="margin-top:0">Hover to reveal. Flip an arrow and watch: only the <b>sign</b> of that current changes, never the size.</p>
        <div class="peek" tabindex="0"></div>
      </div>
      <div class="callout warn dwarn" hidden><b>Heads up</b>Your arrows now differ from the exercise, so some answers will have the opposite sign from the exercise's answers. That's fine: at the end we compare both.</div>
      <div class="callout"><b>Important</b>Once chosen, <b>keep the same arrows</b> for every equation, from the junction rule to the last loop. Changing them halfway is the classic way to get nonsense.</div>
    </div></div></div>`;
  let v;
  const refresh = () => {
    S.model = buildModel(c, S.dirs, S.loopDirs);
    v.draw();
    $('.peek', el).innerHTML = S.model.sol.map((x, b) => `<span class="chip">${M(`${Itex(b)} = ${fmtN(x)}\\unit{A}`)}</span>`).join('');
    $('.loopstate', el).innerHTML = c.loops.map((_, l) => `<span class="chip-l" style="color:${loopColor(l)};font-weight:700">Loop ${l + 1}</span>: ${S.loopDirs[l] === 1 ? 'clockwise' : 'counter-clockwise'}`).join('<br>');
    $('.dwarn', el).hidden = S.dirs.every((d, b) => d === c.dir0[b]);
  };
  v = view($('.host', el), {
    arrows: 'assumed', loops: true,
    onArrow: b => { S.dirs[b] *= -1; refresh(); toast(`${'I' + subNum(b + 1)} now points ${arrowWay(b, S.dirs[b])}`); },
    onLoop: l => { S.loopDirs[l] *= -1; refresh(); },
  });
  refresh();
  $('[data-act="reset"]', el).addEventListener('click', () => { S.dirs = c.dir0.slice(); S.loopDirs = c.loops.map(() => 1); refresh(); });
}

/* ---------- Junction rule ---------- */
function pgKCL(el) {
  const c = S.circ, m = S.model;
  const card = (k, redundant) => {
    const io = `${sumTex(k.inn)} = ${sumTex(k.out)}`;
    const lines = [{ tex: io, note: 'in = out' }];
    if (!redundant) lines.push({ tex: texEq(k), note: 'all on one side', tag: `(${k.label})` });
    let extra = '';
    if (!k.inn.length || !k.out.length) extra = `<p class="small">All our arrows point ${k.inn.length ? 'into' : 'out of'} ${k.node.id}. That can't really happen, so at least one of these currents must come out negative. The equation is still perfectly valid.</p>`;
    let why = '';
    if (redundant) why = m.indep.length === 1 ? `<p>This is equation (${m.indep[0].label}) again, just multiplied by ${M('-1')}. It adds nothing new, so we leave it out.</p>`
      : `<p>Add equations ${m.indep.map(q => `(${q.label})`).join(' and ')} and flip the sign: you get exactly this one. Nothing new, so we leave it out.</p>`;
    return `<div class="card focusable-card${redundant ? ' dimcard' : ''}" data-n="${k.node.id}">
      <h3>${redundant ? '<span class="num">not needed</span>' : `<span class="num">(${k.label})</span>`}Junction ${k.node.id}</h3>
      <p>Arrows pointing <b>into</b> ${k.node.id}: ${k.inn.length ? k.inn.map(IM).join(', ') : '<i>none</i>'}. Arrows pointing <b>out</b>: ${k.out.length ? k.out.map(IM).join(', ') : '<i>none</i>'}.</p>
      ${mlines(lines)}${extra}${why}</div>`;
  };
  el.innerHTML = `<div class="inner">${header(kick('Junction rule'), 'Write the junction equations', `At each junction, add the currents whose arrows point in and set them equal to the ones pointing out. We use <b>our arrows</b>, not the true directions, which we don't know yet. With ${M(`n = ${c.junctions.length}`)} junctions we need ${M(`n - 1 = ${c.junctions.length - 1}`)} ${c.junctions.length - 1 === 1 ? 'equation' : 'equations'}.`)}
    <div class="split"><div class="fig"><div class="card fig-card host"></div></div>
    <div class="txt">${m.indep.map(k => card(k, false)).join('')}${m.redundant ? card(m.redundant, true) : ''}
      <div class="callout"><b>Why the last junction is redundant</b>Every branch connects two junctions. It leaves one and enters the other. Adding all junction equations, every current appears once with ${M('+')} and once with ${M('-')}, so the sum is ${M('0 = 0')}. The last equation is always the others in disguise.</div>
    </div></div></div>`;
  const v = view($('.host', el), { arrows: 'assumed' });
  $$('.focusable-card', el).forEach(cd => {
    const k = [...m.kcl].find(q => q.node.id === cd.dataset.n);
    cd.addEventListener('mouseenter', () => v.focus({ n: [k.node.id], b: [...k.inn, ...k.out] }));
    cd.addEventListener('mouseleave', () => v.focus(null));
  });
}

/* ---------- Loop k ---------- */
function termTex(t, sym, first) {
  const sg = first ? (t.sign < 0 ? '-' : '') : t.sign < 0 ? ' - ' : ' + ';
  if (t.type === 'R') return sg + (sym ? `${elTex(t.e)}\\,${Itex(t.b)}` : `${t.e.val === 1 ? '' : t.e.val}${Itex(t.b)}`);
  return sg + (sym ? elTex(t.e) : String(t.e.val));
}
function termWhy(t) {
  const I = IM(t.b);
  if (t.type === 'R') return t.along
    ? `Walking <b>with</b> the arrow of ${I}. Current loses energy in a resistor, so the potential <b>drops</b> by ${M(`${elTex(t.e)}\\,${Itex(t.b)}`)}.`
    : `Walking <b>against</b> the arrow of ${I}. That's uphill against the current, so the potential <b>rises</b> by ${M(`${elTex(t.e)}\\,${Itex(t.b)}`)}.`;
  return t.up ? 'Entering at the short <b>−</b> plate, leaving at the long <b>+</b> plate. The battery lifts the potential: a <b>rise</b>.'
    : 'Entering at the long <b>+</b> plate, leaving at the short <b>−</b> plate: a <b>drop</b>.';
}
function pgLoop(el, l) {
  const c = S.circ, m = S.model, k = m.kvl[l], color = loopColor(l);
  const dirWord = S.loopDirs[l] === 1 ? 'clockwise' : 'counter-clockwise';
  const tag = `(${k.label})`;
  const sym = k.terms.map((t, i) => termTex(t, true, i === 0)).join('') + ' = 0';
  const num = k.terms.map((t, i) => termTex(t, false, i === 0)).join('') + ' = 0';
  const cur = k.zc.map((a, b) => ({ a, b })).filter(p => p.a);
  const lines = [{ tex: sym, note: 'add up all terms' }, { tex: num, note: 'put in values' }];
  if (k.likeTerms || k.nConst > 1) lines.push({ tex: `${texPairs([...cur, { a: k.zr, b: null }])} = 0`, note: 'combine like terms' });
  const moved = { c: k.zc, r: -k.zr };
  lines.push({ tex: texEq(moved), note: 'numbers to the right' });
  const nz = normalize(moved);
  if (nz.d !== 1) lines.push({ tex: texEq(nz.e), note: divNote(nz.d), tag });
  else lines[lines.length - 1].tag = tag;
  const sharedE = k.terms.filter(t => t.type === 'E' && c.loops.filter(L => L.items.some(it => it.b === t.b)).length > 1);
  const title = c.nL === 1 ? 'Walk around the loop' : `Walk around loop ${l + 1}`;
  el.innerHTML = `<div class="inner">${header(kick(c.nL === 1 ? 'Loop rule' : `Loop ${l + 1} of ${c.nL}`), title, `Start at ${nodeWord(k.startNode)} (the dashed circle) and walk ${dirWord}, the way the <span style="color:${color};font-weight:700">loop ${c.nL > 1 ? l + 1 : ''} symbol</span> points. Every time you pass an element, write down a term. Back at the start, the terms must add up to zero.`)}
    <div class="split"><div class="fig"><div class="card fig-card host"></div></div>
    <div class="txt">
      <div class="card"><h3>The walk, element by element</h3>
        <div class="row" style="margin:6px 0 4px">
          <button class="btn primary" data-act="walk"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12-7.5z"/></svg>Walk</button>
          <button class="btn" data-act="step">Next element</button>
          <button class="btn ghost" data-act="reset">Reset</button>
          <button class="btn ghost" data-act="all">Show everything</button>
        </div>
        <label class="row small" style="margin:2px 0 6px;gap:6px;cursor:pointer"><input type="checkbox" class="quiz" ${S.quiz ? 'checked' : ''}> Let me guess each sign (+ or −) before it's shown</label>
        <table class="walk-table"><thead><tr><th></th><th>Element</th><th>What happens</th><th style="text-align:right">Term</th></tr></thead><tbody></tbody></table>
        <p class="small wt-empty" style="margin-bottom:0">Press <b>Walk</b> or <b>Next element</b> to start.</p>
      </div>
      <div class="card eqcard" hidden><h3>Build the equation</h3>
                <div class="eqlines"></div>
        ${nz.d !== 1 ? `<p class="small">Last line: we divided by ${M(fmtN(nz.d))} to make the numbers smaller and the first coefficient positive. Same equation, fewer mistakes.</p>` : ''}
      </div>
      ${k.likeTerms ? `<div class="callout eqx" hidden><b>Like terms</b>Resistors on the same branch carry the same current, so their terms combine: ${M('R_a I + R_b I = (R_a + R_b)\\,I')}.</div>` : ''}
      ${sharedE.length ? `<div class="callout eqx" hidden><b>Shared battery</b>${sharedE.map(t => elM(t.e)).join(', ')} sits in a branch that belongs to two loops. It appears in both loop equations, and its sign in each depends only on which plate you reach first <i>in that walk</i>.</div>` : ''}
      <div class="callout warn eqx" hidden><b>Common trap</b>The sign of an ${M('IR')} term depends only on whether you walk <b>with</b> or <b>against</b> that current's <b>arrow</b>. It doesn't depend on the battery nearby or on which way the current "really" flows.</div>
    </div></div></div>`;
  const v = view($('.host', el), { arrows: 'assumed', loops: [l], startFlag: k.route.pts[0] });
  v.showBand(l);
  v.focusRoute(k.items.map(it => it.b), loopNodes(l), k.route);
  const tour = new Tour(v, k.route, { color });
  onLeave(() => tour.stop());
  tour.place(0);
  const tbody = $('tbody', el);
  let shown = 0, busy = false;
  const elems = k.route.elems;
  function rowHTML(i, guess) {
    const t = k.terms[i];
    const verdict = guess === undefined ? '' : guess === t.sign ? '<span class="badge up">you got it</span> ' : `<span class="badge down">not quite: it's ${t.sign < 0 ? '−' : '+'}</span> `;
    return `<td class="n">${i + 1}</td><td>${valM(t.e)}</td><td class="why">${verdict}${termWhy(t)}</td><td class="term">${M(termTex(t, true, false))}<div class="small">${M(termTex(t, false, false))}</div></td>`;
  }
  function addRow(i, guess) {
    const tr = document.createElement('tr'); tr.className = 'new'; tr.dataset.el = k.terms[i].e.id;
    tr.innerHTML = rowHTML(i, guess);
    tr.addEventListener('mouseenter', () => v.hot(tr.dataset.el)); tr.addEventListener('mouseleave', () => v.hot(null));
    tbody.appendChild(tr);
    $$('tr', tbody).forEach(r => r.classList.toggle('cur', r === tr));
    $('.wt-empty', el).hidden = true;
  }
  function ask(i) {
    return new Promise(res => {
      const tr = document.createElement('tr'); tr.className = 'new cur';
      tr.innerHTML = `<td class="n">${i + 1}</td><td>${valM(k.terms[i].e)}</td><td class="why">Rise or drop? Pick the sign:</td><td class="term"><button class="btn" data-g="1">+</button> <button class="btn" data-g="-1">−</button></td>`;
      tbody.appendChild(tr); $('.wt-empty', el).hidden = true;
      v.hot(k.terms[i].e.id);
      tr.addEventListener('click', e => { const bt = e.target.closest('[data-g]'); if (!bt) return; tr.remove(); v.hot(null); res(+bt.dataset.g); });
    });
  }
  function showEq() {
    const ec = $('.eqcard', el); if (!ec.hidden) return;
    ec.hidden = false; $('.eqlines', el).innerHTML = mlines(lines, true);
    $$('.eqx', el).forEach(x => (x.hidden = false));
    $$('tr', tbody).forEach(r => r.classList.remove('cur'));
  }
  async function stepOnce() {
    if (busy) return false;
    if (shown >= elems.length) { busy = true; await tour.animateTo(k.route.len); busy = false; showEq(); return false; }
    busy = true;
    const i = shown, r = elems[i];
    const tok = tour.token + 1;
    if ($('.quiz', el).checked) {
      await tour.animateTo(Math.max(0, r.s - r.h - 16));
      if (tour.token !== tok) { busy = false; return false; }
      const g = await ask(i);
      await tour.animateTo(r.s + r.h + 16);
      addRow(i, g);
    } else {
      const ok = await tour.animateTo(r.s + r.h + 16);
      if (!ok) { busy = false; return false; }
      addRow(i);
    }
    shown++; busy = false;
    if (shown === elems.length) { busy = true; await tour.animateTo(k.route.len); busy = false; showEq(); }
    return shown < elems.length;
  }
  function reset() { tour.stop(); busy = false; shown = 0; tbody.innerHTML = ''; $('.wt-empty', el).hidden = false; $('.eqcard', el).hidden = true; $$('.eqx', el).forEach(x => (x.hidden = true)); tour.place(0); v.hot(null); }
  el.addEventListener('click', async e => {
    const a = e.target.closest('[data-act]')?.dataset.act; if (!a) return;
    if (a === 'step') stepOnce();
    if (a === 'walk') { if (shown >= elems.length) reset(); while (await stepOnce()); }
    if (a === 'reset') reset();
    if (a === 'all') { tour.stop(); busy = false; tbody.innerHTML = ''; for (let i = 0; i < elems.length; i++) addRow(i); shown = elems.length; tour.place(k.route.len); showEq(); }
  });
  $('.quiz', el).addEventListener('change', e => { S.quiz = e.target.checked; });
}

/* ---------- All equations ---------- */
function eqKindLabel(e) {
  return e.kind === 'J' ? `junction ${e.src.node.id}` : S.circ.nL === 1 ? 'loop' : `loop ${e.src.l + 1}`;
}
/* a system of equations with a brace, the way it is written by hand, optional note per row */
function systemTex(rows) {
  return `\\begin{cases} ${rows.map(r => `${r.lhs} = ${r.rhs}${r.note ? ` & \\note{${r.note}}` : ''}`).join(' \\\\ ')} \\end{cases}`;
}
function systemRows(stage) {
  const m = S.model;
  return m.eqs.map(e => {
    if (stage === 'tidy') return { lhs: texLHS(e.c), rhs: fmtN(e.r), note: `(${e.label})` };
    const note = stage === 'sym' ? eqKindLabel(e) : '';
    if (e.kind === 'J') return { lhs: texLHS(e.c), rhs: fmtN(e.r), note };
    return { lhs: e.src.terms.map((t, i) => termTex(t, stage === 'sym', i === 0)).join(''), rhs: '0', note };
  });
}
function pgSystem(el) {
  const c = S.circ, m = S.model;
  el.innerHTML = `<div class="inner">${header(kick('Collect the equations'), `${c.nB} equations, ${c.nB} unknowns`, `Put together, the two rules give a system of equations: one equation for every unknown current. From here on it's pure algebra. The physics is done.`)}
    <div class="split"><div class="fig"><div class="card fig-card host"></div></div>
    <div class="txt">
      <div class="card"><h3>The system</h3>
        <div class="blk"><div class="blk-head">Straight from the two rules</div><div class="sys">${MD(systemTex(systemRows('sym')))}</div></div>
        <div class="blk"><div class="blk-head">Put in the values</div><div class="sys">${MD(systemTex(systemRows('num')))}</div></div>
        <div class="blk"><div class="blk-head">Tidy up: plain numbers to the right, like terms together</div><div class="sys">${MD(systemTex(systemRows('tidy')))}</div></div>
        <p class="small" style="margin-bottom:0">The loop pages show each of these steps in detail. The last system is the one we solve, with substitution and elimination.</p>
      </div>
      <div class="callout"><b>The plan</b>${m.indep.length ? `First use the junction ${m.indep.length === 1 ? 'equation' : 'equations'} to replace ${m.indep.length === 1 ? 'one current' : 'some currents'} (all coefficients there are ±1, so that's easy). ` : ''}Then eliminate currents one at a time until one equation with one unknown is left. Finally work backwards.</div>
    </div></div></div>`;
  view($('.host', el), { arrows: 'assumed', loops: true });
}

/* ---------- Solve ---------- */
function pgSolve(el) {
  const c = S.circ, m = S.model, steps = m.solve.steps;
  const found = {};
  el.innerHTML = `<div class="inner">${header(kick('Solve'), c.nB === 1 ? `Solve for ${IM(0)}` : 'Solve the system step by step', c.nB === 1 ? 'One equation with one unknown: just divide.' : 'Substitute, eliminate, then work backwards. Reveal one step at a time and try to do each step yourself first.')}
    <div class="split split-solve">
      <div class="fig"><div class="card"><h3>Equations</h3>${mlines(m.eqs.map(e => ({ tex: texEq(e), note: eqKindLabel(e), tag: `(${e.label})` })))}
        <h3 style="margin-top:14px">Found so far</h3><div class="found result-grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))"></div></div></div>
      <div class="txt"><div class="steps"></div>
        <div class="row ctl"><button class="btn primary" data-act="next">Next step</button><button class="btn ghost" data-act="all">Show all steps</button><span class="small cnt"></span></div>
        <div class="final" hidden></div>
      </div>
    </div></div>`;
  const host = $('.steps', el);
  const renderFound = () => {
    $('.found', el).innerHTML = c.branches.map((_, b) => `<div class="res" style="border-left-color:${curColor(b)}">${found[b] === undefined ? M(`${Itex(b)} = \\;?`) : M(`${Itex(b)} = ${fmtN(found[b])}\\unit{A}`)}</div>`).join('');
  };
  let shown = 0;
  const show = (i, fresh) => {
    const st = steps[i];
    const title = c.nB === 1 && st.kind === 'one' ? `Solve for ${IM(st.v)}` : st.title;
    const d = document.createElement('div'); d.className = 'card step-card' + (fresh ? ' fresh' : ''); d.style.marginBottom = '14px';
    d.innerHTML = `<h3><span class="num">Step ${i + 1}</span>${title}</h3><p>${st.note}</p>${st.blocks.map(bl => `<div class="blk">${bl.head ? `<div class="blk-head">${bl.head}</div>` : ''}${mlines(bl.lines)}</div>`).join('')}`;
    host.appendChild(d);
    if (st.kind === 'one') found[st.v] = m.solve.values[st.v];
    if (st.kind === 'back') m.solve.values.forEach((x, b) => (found[b] = x));
    renderFound();
    if (fresh) d.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  const finish = () => {
    $('.ctl', el).hidden = true;
    const neg = m.sol.map((x, b) => (x < 0 ? b : -1)).filter(b => b >= 0);
    const f = $('.final', el); f.hidden = false;
    f.innerHTML = `<div class="card"><h3>Result</h3><div class="result-grid">${m.sol.map((x, b) => `<div class="res" style="border-left-color:${curColor(b)}"><div class="big">${M(`\\boxed{${Itex(b)} = ${fmtN(x)}\\unit{A}}`)}</div></div>`).join('')}</div>
      ${neg.length ? `<div class="callout warn" style="margin-top:12px"><b>Negative ${neg.length === 1 ? 'answer' : 'answers'}</b>${neg.map(IM).join(', ')} came out negative. Nothing went wrong: ${neg.length === 1 ? 'that current flows' : 'those currents flow'} <b>against</b> the arrow we drew. The next page shows the real directions.</div>` : '<p class="small">All positive: every arrow guess was right.</p>'}</div>`;
    f.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  const upd = () => { $('.cnt', el).textContent = `${shown} of ${steps.length} shown`; if (shown >= steps.length) finish(); };
  show(0, false); shown = 1; renderFound(); upd();
  el.addEventListener('click', e => {
    const a = e.target.closest('[data-act]')?.dataset.act; if (!a) return;
    if (a === 'next' && shown < steps.length) { show(shown, true); shown++; upd(); }
    if (a === 'all') { while (shown < steps.length) { show(shown, false); shown++; } upd(); }
  });
}

/* ---------- Read the answer ---------- */
function pgAnswer(el) {
  const c = S.circ, m = S.model;
  const pw = powerTable(c);
  const differs = !S.dirs.every((d, b) => d === c.dir0[b]);
  el.innerHTML = `<div class="inner">${header(kick('Read the answer'), 'What the numbers mean', 'The sign of each answer tells us the real direction. Watch the current flow: the dots move the way the current really goes, faster where the current is bigger.')}
    <div class="split"><div class="fig"><div class="card fig-card host"></div>
      <div class="row" style="margin-top:10px">
        <div class="seg" data-g="arrows"><button data-v="assumed">Our arrows</button><button data-v="actual" class="on">Real directions</button></div>
        <div class="seg" data-g="carrier"><button data-v="conv" class="on">Conventional current</button><button data-v="e">Electrons</button></div>
      </div>
      <p class="small carrier-note"></p>
    </div>
    <div class="txt">
      <div class="result-grid">${m.sol.map((x, b) => `<div class="res" style="border-left-color:${curColor(b)}"><div class="big">${M(`${Itex(b)} = ${fmtN(x)}\\unit{A}`)}</div><div class="what">${x > 0 ? `Positive: flows the way the arrow points, ${actualWay(b)}.` : `Negative: really flows <b>against</b> the arrow, ${fmtN(-x)} A ${actualWay(b)}.`}</div></div>`).join('')}</div>
      <div class="card"><h3>What are the batteries doing?</h3>
        <ul class="hoverlist">${pw.filter(r => r.e.type === 'E').map(r => `<li data-el="${r.e.id}">${valM(r.e)}: ${r.role === 'source'
      ? `current leaves at its <b>+</b> plate, so it is <b>delivering energy</b> (discharging).`
      : `current is pushed in at its <b>+</b> plate, backwards. It is <b>being charged</b> by the other ${c.E.length > 2 ? 'batteries' : 'battery'}.`}</li>`).join('')}</ul>
      </div>
      ${differs ? `<div class="callout warn"><b>Compared with the exercise</b>You flipped some arrows, so here are the answers for the exercise's original arrows: ${c.Itrue.map((x, b) => M(`${Itex(b)} = ${fmtN(x * c.dir0[b])}\\unit{A}`)).join(', ')}. Same sizes, and the signs follow the arrows.</div>` : ''}
      ${c.junctions.length ? `<div class="card soft"><h3>Junction check with real directions</h3>${mlines(c.junctions.map(j => { const k = junctionEquation(c, j, c.Itrue.map(x => Math.sign(x))); const ins = k.inn.map(b => fmtN(Math.abs(c.Itrue[b]))).join(' + ') || '0', outs = k.out.map(b => fmtN(Math.abs(c.Itrue[b]))).join(' + ') || '0'; return { tex: `${ins} = ${outs} \\;\\checkmark`, note: `junction ${j.id}` }; }))}<p class="small">In amperes, using the real directions: what flows in flows out.</p></div>` : ''}
    </div></div></div>`;
  const v = view($('.host', el), { arrows: 'actual', flow: true });
  const note = () => { $('.carrier-note', el).innerHTML = v.o.electrons ? 'Electrons are negative, so they drift the <b>opposite</b> way to the conventional current. Physics uses conventional current: the flow of positive charge.' : 'Conventional current: the direction positive charge would move, from + to − outside a battery.'; };
  note();
  $$('.seg', el).forEach(sg => sg.addEventListener('click', e => {
    const bt = e.target.closest('button'); if (!bt) return;
    $$('button', sg).forEach(x => x.classList.toggle('on', x === bt));
    if (sg.dataset.g === 'arrows') v.set({ arrows: bt.dataset.v }); else { v.set({ electrons: bt.dataset.v === 'e' }); note(); }
  }));
  $$('[data-el]', $('.txt', el)).forEach(li => { li.addEventListener('mouseenter', () => v.hot(li.dataset.el)); li.addEventListener('mouseleave', () => v.hot(null)); });
}

/* ---------- Potential map ---------- */
function pgPotential(el) {
  const c = S.circ;
  const canPick = c.junctions.length > 0;
  el.innerHTML = `<div class="inner">${header(kick('Potential map'), 'Voltage everywhere in the circuit', `Now that we know the currents, we know the voltage (potential) at every point. Pick a reference point at ${M('0\\unit{V}')}${canPick ? ': click a junction' : ''}. Colours show the height: <span style="color:var(--vhi);font-weight:700">red is high</span>, <span style="color:var(--vlo);font-weight:700">blue is low</span>.`)}
    <div class="split"><div class="fig"><div class="card fig-card host"></div>
      <div class="legend" style="margin-top:10px"><span class="lo"></span><div class="bar"></div><span class="hi"></span></div>
      ${canPick ? `<div class="row" style="margin-top:10px"><span class="small">Reference (0 V):</span><div class="seg gsel">${c.junctions.map(j => `<button data-g="${j.id}">${j.id}</button>`).join('')}</div></div>` : ''}
    </div>
    <div class="txt">
      <div class="card"><h3>Junction voltages</h3><div class="vlist"></div>
        <p class="small">Changing the reference shifts every voltage by the same amount. The <b>differences</b> between points, which are what physics cares about, stay the same.</p></div>
      <div class="card"><h3>The loop rule as a rollercoaster</h3>
        ${c.nL > 1 ? `<div class="tabs">${c.loops.map((_, l) => `<button data-l="${l}">Loop ${l + 1}</button>`).join('')}</div>` : ''}
        <div class="chost" style="margin-top:8px"></div>
        <p class="small">Follow the dot around the loop: up through batteries walked from − to +, down through resistors walked with the current. It always ends at the height where it started. That <i>is</i> the loop rule: ${M('\\sum \\Delta V = 0')}.</p>
      </div>
    </div></div></div>`;
  let v, tour, curL = 0;
  const draw = () => {
    if (!v) v = view($('.host', el), { arrows: 'actual', potential: { ground: S.ground }, onNode: canPick ? id => { S.ground = id; draw(); } : null });
    else v.set({ potential: { ground: S.ground } });
    const P = v.P;
    $('.legend .lo', el).textContent = `${fmtN(P.min)} V`; $('.legend .hi', el).textContent = `${fmtN(P.max)} V`;
    $$('.gsel button', el).forEach(b => b.classList.toggle('on', b.dataset.g === S.ground));
    $('.vlist', el).innerHTML = canPick ? mlines(c.junctions.map(j => ({ tex: `\\V{${j.id}} = ${fmtN(P.V[j.id])}\\unit{V}`, note: j.id === S.ground ? 'reference' : '' })))
      : `<p>In a single loop, the marked corner is our reference: ${M('0\\unit{V}')}. The rollercoaster below shows the voltage everywhere else.</p>`;
    coaster(curL);
  };
  const coaster = l => {
    curL = l;
    if (tour) tour.stop();
    $$('.tabs button', el).forEach(b => { const on = +b.dataset.l === l; b.classList.toggle('on', on); b.style.background = on ? loopColor(+b.dataset.l) : ''; b.style.borderColor = on ? loopColor(+b.dataset.l) : ''; });
    const k = S.model.kvl[l], P = v.P;
    const marks = k.route.elems.map(r => ({ s: r.s, h: r.e.type === 'R' ? r.h : 3, label: elName(r.e), dv: r.t * elDeltaFwd(r.e, c.branches[r.b].I) }));
    const host = $('.chost', el); host.innerHTML = '';
    const co = new Coaster(host, coasterProfile(c, k.route, P.V[k.startNode]), { marks, color: loopColor(l) });
    v.showBand(l);
    tour = new Tour(v, k.route, { coaster: co, color: loopColor(l) });
    tour.loop(150, 1000);
  };
  onLeave(() => tour && tour.stop());
  $$('.gsel button', el).forEach(b => b.addEventListener('click', () => { S.ground = b.dataset.g; draw(); }));
  $$('.tabs button', el).forEach(b => b.addEventListener('click', () => coaster(+b.dataset.l)));
  draw();
}

/* ---------- Energy check ---------- */
function pgEnergy(el) {
  const c = S.circ, m = S.model, sol = m.sol;
  const plug = e => {
    let s = '', first = true, lhs = 0;
    e.c.forEach((a, j) => {
      if (!a) return;
      lhs += a * sol[j];
      const mag = Math.abs(a), body = (mag === 1 ? '' : fmtN(mag) + '\\cdot ') + par(sol[j]);
      s += first ? (a < 0 ? '-' : '') + body : (a < 0 ? ' - ' : ' + ') + body;
      first = false;
    });
    return `${s} = ${fmtN(lhs)} \\;\\cl{tx-good}{\\checkmark}`;
  };
  const pw = powerTable(c);
  const src = pw.filter(r => r.role === 'source'), use = pw.filter(r => r.role !== 'source');
  const tot = a => a.reduce((s, r) => s + r.P, 0);
  const Iabs = b => Math.abs(c.Itrue[b]);
  const row = r => {
    const I = Iabs(r.b);
    const f = r.e.type === 'R' ? `${Itex(r.b)}^2 ${elTex(r.e)} = ${I}^2 \\cdot ${r.e.val} = ${fmtN(r.P)}\\unit{W}` : `${elTex(r.e)}\\,|${Itex(r.b)}| = ${r.e.val} \\cdot ${I} = ${fmtN(r.P)}\\unit{W}`;
    const role = r.role === 'heat' ? 'turned into heat' : r.role === 'source' ? '<b style="color:var(--good)">supplies</b> energy' : '<b style="color:var(--warn)">stores</b> energy (charging)';
    return `<tr data-el="${r.e.id}"><td>${valM(r.e)}</td><td class="w">${M(f)}</td><td>${role}</td></tr>`;
  };
  const bar = (list, label) => `<div class="pbar"><span>${label}</span><div class="track">${list.map(r => `<span style="flex-grow:${r.P};background:${curColor(r.b)}" title="${elName(r.e)}: ${fmtN(r.P)} W">${elName(r.e)}</span>`).join('')}</div></div>`;
  el.innerHTML = `<div class="inner">${header(kick('Double-check'), 'Check the answer two ways', 'A good habit: plug the answers back in. Then a physics check: every watt a battery delivers must be used somewhere.')}
    <div class="two">
      <div class="card"><h3>1 · Plug the answers into every equation</h3>
        <p class="small" style="margin-top:0">Using ${m.sol.map((x, b) => M(`${Itex(b)} = ${fmtN(x)}`)).join(', ')}.</p>
        ${mlines(m.eqs.map(e => ({ tex: plug(e), note: `(${e.label}) needs ${fmtN(e.r)}`, tag: '' })))}
        ${m.redundant ? `<p class="small">The junction equation we skipped holds too: ${M(`${sumTex(m.redundant.inn)} = ${sumTex(m.redundant.out)}`)} gives ${M(`${m.redundant.inn.map(b => par(sol[b])).join(' + ') || '0'} = ${m.redundant.out.map(b => par(sol[b])).join(' + ') || '0'}`)}.</p>` : ''}
      </div>
      <div class="card"><h3>2 · Energy balance</h3>
        <table class="ptable"><thead><tr><th>Element</th><th style="text-align:right">Power</th><th>Role</th></tr></thead><tbody>${pw.map(row).join('')}
          <tr class="tot"><td>Supplied</td><td class="w">${M(`${fmtN(tot(src))}\\unit{W}`)}</td><td></td></tr>
          <tr class="tot"><td>Used</td><td class="w">${M(`${fmtN(tot(use))}\\unit{W}`)}</td><td>${Math.abs(tot(src) - tot(use)) < 1e-9 ? '<b style="color:var(--good)">balanced ✓</b>' : ''}</td></tr></tbody></table>
        <div class="pbars">${bar(src, 'Supplied')}${bar(use, 'Used')}</div>
        <p class="small">Resistors use ${M('P = I^2 R')}. A battery's power is ${M('P = \\emf I')}: it supplies energy when current leaves its + plate and stores energy when current is forced in at +.</p>
      </div>
    </div></div>`;
}

/* ---------- Recap ---------- */
function pgRecap(el) {
  const c = S.circ;
  el.innerHTML = `<div class="inner">${header(kick('Recap'), 'The recipe, for any circuit', 'You can solve every circuit made of batteries and resistors with these steps.')}
    <div class="two">
      <div class="card"><h3>The recipe</h3><ol class="recipe">
        <li><div><b>Read the circuit.</b> Count junctions ${M('n')} and branches ${M('b')}. Each branch gets one unknown current.</div></li>
        <li><div><b>Draw arrows.</b> Any direction. Pick a walking direction for each loop.</div></li>
        <li><div><b>Junction rule</b> at ${M('n-1')} junctions: ${M('\\sum I_{\\text{in}} = \\sum I_{\\text{out}}')}.</div></li>
        <li><div><b>Loop rule</b> for ${M('b-n+1')} loops: walk around, ${M('\\mp IR')} with/against arrows, ${M('\\pm\\emf')} from −/+ plate, and the total is zero.</div></li>
        <li><div><b>Solve</b> the system: substitute, eliminate, work backwards.</div></li>
        <li><div><b>Interpret</b> the signs: negative means against the arrow. <b>Check</b> by plugging in.</div></li>
      </ol></div>
      <div class="card"><h3>Common traps</h3><ul class="hoverlist">
        <li>Choosing the ${M('IR')} sign from the battery or the "real" direction. It depends only on <b>walk vs. arrow</b>.</li>
        <li>Giving a battery a sign from the current. It depends only on <b>which plate you reach first</b>.</li>
        <li>Writing all ${M('n')} junction equations. The last one is redundant, so you'd be one equation short.</li>
        <li>Thinking a negative answer is wrong. It just means the current flows against the arrow.</li>
        <li>Flipping an arrow halfway. Keep one set of arrows from start to finish.</li>
        <li>Forgetting that resistors on one branch share the same current.</li>
      </ul></div>
    </div>
    <div class="card" style="margin-top:18px;text-align:center"><h3>Again?</h3>
      <p>Every circuit is randomly generated, with whole-number answers. Practise as often as you like.</p>
      <div class="row" style="justify-content:center">
        <button class="btn primary big" data-act="new">New circuit, level ${S.level}</button>
        ${S.level < 4 ? `<button class="btn big" data-act="up">Level up: ${LEVELS[S.level + 1].name}</button>` : ''}
        <button class="btn ghost big" data-act="ex">Back to this exercise</button>
      </div>
      <p class="small">This circuit's code: <span class="code">${code()}</span>${onWeb ? ' <button class="linkbtn" data-act="share">Copy link</button>' : ''}</p>
    </div></div>`;
  el.addEventListener('click', e => {
    const a = e.target.closest('[data-act]')?.dataset.act; if (!a) return;
    if (a === 'new') newCircuit(S.level);
    if (a === 'up') newCircuit(S.level + 1);
    if (a === 'ex') go('ex');
    if (a === 'share') shareCircuit();
  });
}
