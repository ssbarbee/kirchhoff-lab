/* =====================================================================
   CORE — pure logic, no DOM. (LaTeX→MathML, circuit generator, solver)
   ===================================================================== */

/* ---------- small math helpers ---------- */
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const lcm = (a, b) => Math.abs(a * b) / gcd(a, b);
const gcdAll = arr => arr.reduce((g, v) => gcd(g, v), 0);
const dist = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1]);
const isInt = x => Math.abs(x - Math.round(x)) < 1e-9;

function RNG(seed) {
  let a = (seed >>> 0) || 1;
  const next = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: arr => arr[Math.floor(next() * arr.length)],
    chance: p => next() < p,
    shuffle: arr => { const a2 = arr.slice(); for (let i = a2.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a2[i], a2[j]] = [a2[j], a2[i]]; } return a2; },
  };
}

/* =====================================================================
   TeX → MathML (a small, dependency-free subset of LaTeX)
   ===================================================================== */
const TeX = (() => {
  const GREEK = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ϵ', varepsilon: 'ε', theta: 'θ', lambda: 'λ', mu: 'μ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'ϕ', varphi: 'φ', omega: 'ω', Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Omega: 'Ω' };
  const UPPER = new Set(['Γ', 'Δ', 'Θ', 'Λ', 'Ξ', 'Π', 'Σ', 'Υ', 'Φ', 'Ψ', 'Ω']);
  const OPS = { cdot: '⋅', times: '×', pm: '±', mp: '∓', to: '→', rightarrow: '→', leftarrow: '←', Rightarrow: '⇒', Leftarrow: '⇐', Leftrightarrow: '⇔', implies: '⟹', approx: '≈', neq: '≠', ne: '≠', le: '≤', leq: '≤', ge: '≥', geq: '≥', equiv: '≡', cdots: '⋯', ldots: '…', dots: '…', uparrow: '↑', downarrow: '↓', circlearrowright: '↻', circlearrowleft: '↺', checkmark: '✓', propto: '∝', mid: '∣', colon: ':', langle: '⟨', rangle: '⟩', div: '÷', ast: '∗' };
  const LARGE = { sum: '∑', prod: '∏' };
  const SPACES = { ',': '0.1667em', ':': '0.2222em', ';': '0.2778em', ' ': '0.25em', quad: '1em', qquad: '2em', enspace: '0.5em', '!': '0em' };
  const RAW = new Set(['text', 'textbf', 'mathrm', 'unit', 'cl', 'I', 'R', 'E', 'V', 'J', 'begin', 'end']);
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function tokenize(src) {
    const t = []; let i = 0; const n = src.length;
    while (i < n) {
      const c = src[i];
      if (c === '\\') {
        let j = i + 1, name;
        if (j < n && /[A-Za-z]/.test(src[j])) { while (j < n && /[A-Za-z]/.test(src[j])) j++; name = src.slice(i + 1, j); }
        else { name = src[j] || ''; j++; }
        i = j;
        t.push({ t: 'cmd', v: name });
        if (RAW.has(name)) {
          while (i < n && src[i] === ' ') i++;
          if (src[i] === '{') {
            let depth = 1, k = i + 1;
            while (k < n) { if (src[k] === '{') depth++; else if (src[k] === '}') { depth--; if (!depth) break; } k++; }
            t.push({ t: 'raw', v: src.slice(i + 1, k) }); i = k + 1;
          } else { t.push({ t: 'raw', v: src[i] || '' }); i++; }
        }
        continue;
      }
      if (/\s/.test(c)) { i++; continue; }
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
        let j = i; while (j < n && /[0-9]/.test(src[j])) j++;
        if (src[j] === '.' && /[0-9]/.test(src[j + 1] || '')) { j++; while (j < n && /[0-9]/.test(src[j])) j++; }
        t.push({ t: 'num', v: src.slice(i, j) }); i = j; continue;
      }
      if ('{}^_&'.includes(c)) { t.push({ t: c }); i++; continue; }
      if (/\p{L}/u.test(c)) { t.push({ t: 'id', v: c }); i++; continue; }
      t.push({ t: 'op', v: c }); i++;
    }
    return t;
  }

  function convert(src, display) {
    const toks = tokenize(String(src)); let p = 0;
    const peek = () => toks[p];
    const mrow = arr => arr.length === 0 ? '<mrow></mrow>' : arr.length === 1 ? arr[0].x : `<mrow>${arr.map(a => a.x).join('')}</mrow>`;
    const W = x => ({ x, k: 'ord' });
    const rawArg = () => { const t = peek(); if (t && t.t === 'raw') { p++; return t.v; } return ''; };
    const sub = r => /^\d+$/.test(r) ? `<mn>${r}</mn>` : `<mtext>${esc(r)}</mtext>`;

    function seq(stop) {
      const out = [];
      while (p < toks.length) {
        const t = peek();
        if (t.t === '}') { if (stop === '}') break; p++; continue; }
        if (stop === 'right' && t.t === 'cmd' && t.v === 'right') break;
        if (stop === 'cell' && (t.t === '&' || (t.t === 'cmd' && (t.v === '\\' || t.v === 'end')))) break;
        out.push(scripted(out));
      }
      return out;
    }
    function group() { p++; const s = seq('}'); if (peek() && peek().t === '}') p++; return s; }
    function arg() { const t = peek(); if (!t) return '<mrow></mrow>'; if (t.t === '{') return mrow(group()); return atom([]).x; }

    function scripted(prev) {
      const base = atom(prev);
      let sb = null, sp = null;
      while (peek() && (peek().t === '_' || peek().t === '^')) { const t = toks[p++]; const a = arg(); if (t.t === '_') sb = a; else sp = a; }
      if (!sb && !sp) return base;
      const big = base.k === 'large', k = big ? 'large' : 'ord';
      if (sb && sp) return { x: big ? `<munderover>${base.x}${sb}${sp}</munderover>` : `<msubsup>${base.x}${sb}${sp}</msubsup>`, k };
      if (sb) return { x: big ? `<munder>${base.x}${sb}</munder>` : `<msub>${base.x}${sb}</msub>`, k };
      return { x: big ? `<mover>${base.x}${sp}</mover>` : `<msup>${base.x}${sp}</msup>`, k };
    }

    function atom(prev) {
      const t = toks[p++];
      if (!t) return W('');
      const last = prev.length ? prev[prev.length - 1].k : 'start';
      switch (t.t) {
        case '{': p--; return W(mrow(group()));
        case 'num': return W(`<mn>${t.v}</mn>`);
        case 'id': return W(UPPER.has(t.v) ? `<mi mathvariant="normal">${t.v}</mi>` : `<mi>${esc(t.v)}</mi>`);
        case 'op': return opTok(t.v, last);
        case 'cmd': return cmd(t.v, last);
        case 'raw': return W(`<mtext>${esc(t.v)}</mtext>`);
        default: return W('');
      }
    }

    function opTok(v, last) {
      if (v === '−') v = '-';
      const unary = last === 'start' || last === 'op' || last === 'open' || last === 'large';
      if ((v === '-' || v === '+') && unary) return { x: `<mo form="prefix" lspace="0" rspace="0">${v === '-' ? '−' : '+'}</mo>`, k: 'op' };
      if (v === '-') return { x: '<mo>−</mo>', k: 'op' };
      if (v === '(' || v === '[') return { x: `<mo>${v}</mo>`, k: 'open' };
      if (v === ')' || v === ']') return { x: `<mo>${v}</mo>`, k: 'close' };
      if (v === '|') return { x: '<mo stretchy="false" lspace="0.05em" rspace="0.05em">|</mo>', k: unary ? 'open' : 'close' };
      if (v === "'") return { x: '<mo lspace="0" rspace="0">′</mo>', k: 'ord' };
      if (v === '*') return { x: '<mo>∗</mo>', k: 'op' };
      return { x: `<mo>${esc(v)}</mo>`, k: 'op' };
    }

    function delim() {
      const t = toks[p++]; if (!t) return '';
      if (t.t === 'op') return t.v === '.' ? '' : esc(t.v);
      if (t.t === 'cmd') { if (t.v === '{' || t.v === '}') return t.v; if (OPS[t.v]) return OPS[t.v]; if (t.v === 'lvert' || t.v === 'rvert' || t.v === 'vert') return '|'; }
      return '';
    }

    function env(name) {
      const rows = [[]];
      while (p < toks.length) {
        const cell = seq('cell');
        rows[rows.length - 1].push(mrow(cell));
        const t = peek(); if (!t) break;
        if (t.t === '&') { p++; continue; }
        if (t.t === 'cmd' && t.v === '\\') { p++; rows.push([]); continue; }
        if (t.t === 'cmd' && t.v === 'end') { p++; rawArg(); break; }
      }
      const lastRow = rows[rows.length - 1];
      if (rows.length > 1 && lastRow.length === 1 && lastRow[0] === '<mrow></mrow>') rows.pop();
      const cls = name === 'aligned' ? 'mt-al' : name === 'cases' ? 'mt-cases' : 'mt-mat';
      const table = `<mtable class="${cls}">${rows.map(r => `<mtr>${r.map(c => `<mtd>${c}</mtd>`).join('')}</mtr>`).join('')}</mtable>`;
      const L = { bmatrix: '[', pmatrix: '(', vmatrix: '|', cases: '{' }[name], R = { bmatrix: ']', pmatrix: ')', vmatrix: '|' }[name];
      return W(`<mrow>${L ? `<mo fence="true" form="prefix">${L}</mo>` : ''}${table}${R ? `<mo fence="true" form="postfix">${R}</mo>` : ''}</mrow>`);
    }

    function cmd(name, last) {
      if (GREEK[name]) { const g = GREEK[name]; return W(UPPER.has(g) ? `<mi mathvariant="normal">${g}</mi>` : `<mi>${g}</mi>`); }
      if (OPS[name]) return { x: `<mo>${OPS[name]}</mo>`, k: 'op' };
      if (LARGE[name]) return { x: `<mo largeop="true" movablelimits="true">${LARGE[name]}</mo>`, k: 'large' };
      if (name in SPACES) return { x: `<mspace width="${SPACES[name]}"/>`, k: last === 'start' ? 'op' : last };
      switch (name) {
        case 'frac': case 'dfrac': case 'tfrac': { const a = arg(), b = arg(); return W(`<mfrac${name === 'dfrac' ? ' displaystyle="true"' : ''}>${a}${b}</mfrac>`); }
        case 'sqrt': return W(`<msqrt>${arg()}</msqrt>`);
        case 'text': return W(`<mtext>${esc(rawArg()).replace(/ /g, ' ')}</mtext>`);
        case 'textbf': return W(`<mtext class="tx-bf">${esc(rawArg()).replace(/ /g, ' ')}</mtext>`);
        case 'mathrm': { const r = rawArg(); return W(r.length === 1 ? `<mi mathvariant="normal">${esc(r)}</mi>` : `<mi>${esc(r)}</mi>`); }
        case 'unit': return W(`<mrow><mspace width="0.17em"/><mi mathvariant="normal" class="unit">${esc(rawArg())}</mi></mrow>`);
        case 'cl': { const cls = rawArg(); return W(`<mrow class="${esc(cls)}">${arg()}</mrow>`); }
        case 'boxed': case 'hl': case 'cancel': case 'dim': case 'good': case 'bad': return W(`<mrow class="tx-${name}">${arg()}</mrow>`);
        case 'I': case 'J': { const r = rawArg(); return W(`<msub class="ci ci${esc(r)}"><mi>${name}</mi>${sub(r)}</msub>`); }
        case 'R': { const r = rawArg(); return W(`<msub><mi>R</mi>${sub(r)}</msub>`); }
        case 'E': { const r = rawArg(); return W(`<msub><mi>ℰ</mi>${sub(r)}</msub>`); }
        case 'V': { const r = rawArg(); return W(`<msub><mi>V</mi><mtext>${esc(r)}</mtext></msub>`); }
        case 'emf': return W('<mi>ℰ</mi>');
        case 'left': { const d = delim(); const inner = seq('right'); p++; const d2 = delim(); return W(`<mrow>${d ? `<mo fence="true" form="prefix">${d}</mo>` : ''}${inner.map(a => a.x).join('')}${d2 ? `<mo fence="true" form="postfix">${d2}</mo>` : ''}</mrow>`); }
        case 'right': delim(); return W('');
        case 'overset': { const a = arg(), b = arg(); return { x: `<mover>${b}${a}</mover>`, k: 'op' }; }
        case 'underset': { const a = arg(), b = arg(); return { x: `<munder>${b}${a}</munder>`, k: 'op' }; }
        case 'begin': return env(rawArg());
        case 'end': rawArg(); return W('');
        case '{': return { x: '<mo>{</mo>', k: 'open' };
        case '}': return { x: '<mo>}</mo>', k: 'close' };
        case '\\': return W('');
        case '%': case '#': case '$': case '&': case '_': return W(`<mtext>${esc(name)}</mtext>`);
        case 'degree': return W('<mi mathvariant="normal">°</mi>');
        default: return W(`<mtext class="tx-err">\\${esc(name)}</mtext>`);
      }
    }

    const body = seq(null);
    return `<math${display ? ' display="block"' : ''}>${mrow(body)}</math>`;
  }
  return { convert, esc };
})();
const M = tex => TeX.convert(tex, false);
const MD = tex => TeX.convert(tex, true);

/* ---------- LaTeX snippets for numbers and linear combinations ---------- */
function fmtN(n) {
  if (!isInt(n)) { const s = (Math.round(n * 1000) / 1000).toString(); return s.startsWith('-') ? '-' + s.slice(1) : s; }
  return String(Math.round(n));
}
const par = x => x < 0 ? `(${fmtN(x)})` : fmtN(x);
const Itex = b => `\\I{${b + 1}}`;
function coefTerm(a, body, first) {
  const m = Math.abs(a), s = (m === 1 ? '' : fmtN(m)) + body;
  return first ? (a < 0 ? '-' : '') + s : (a < 0 ? ' - ' : ' + ') + s;
}
/* pairs: [{a, b}] where b = branch index or null (constant) */
function texPairs(pairs) {
  let s = '', first = true;
  for (const { a, b, body } of pairs) {
    if (!a) continue;
    if (b === null || b === undefined) { if (body) { s += coefTerm(a, body, first); } else { s += first ? fmtN(a) : (a < 0 ? ' - ' : ' + ') + fmtN(Math.abs(a)); } }
    else s += coefTerm(a, Itex(b), first);
    first = false;
  }
  return first ? '0' : s;
}
const texLHS = c => texPairs(c.map((a, b) => ({ a, b })));
const texEq = e => `${texLHS(e.c)} = ${fmtN(e.r)}`;
function texExpr(ex, ex0) { const pairs = ex.map((a, b) => ({ a, b })); if (ex0) pairs.push({ a: ex0, b: null }); return texPairs(pairs); }

/* normalise an equation: first nonzero coefficient positive, divide by gcd */
function normalize(e) {
  const nz = e.c.find(v => v !== 0) || 0;
  const g = gcdAll([...e.c, e.r]) || 1;
  const d = (nz < 0 ? -1 : 1) * g;
  if (d === 1) return { e, d: 1 };
  return { e: { ...e, c: e.c.map(v => v / d), r: e.r / d }, d };
}
const divNote = d => d === -1 ? '× (−1)' : d < 0 ? `÷ (−${-d})` : `÷ ${d}`;

/* =====================================================================
   LEVELS & TOPOLOGIES
   ===================================================================== */
const LEVELS = {
  1: { name: 'Warm-up', tag: 'One loop', blurb: 'A single loop: one current, only the loop rule.' },
  2: { name: 'Classic', tag: 'Two loops', blurb: 'Two loops sharing a branch: three currents.' },
  3: { name: 'Tricky', tag: 'Two loops, crowded', blurb: 'Crowded branches, a battery in the middle, arrows pointing any which way.' },
  4: { name: 'Expert', tag: 'Three loops', blurb: 'Three windows, three junctions, five currents.' },
};

function topology(level) {
  if (level === 1) {
    const x0 = 270, x1 = 730, y0 = 130, y1 = 470;
    return {
      view: { w: 1000, h: 600 },
      nodes: [{ id: 'P', pts: [[x0, y0]], wires: [], labels: [] }],
      branches: [{ from: 'P', fp: 0, to: 'P', tp: 0, path: [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]], sides: ['U', 'R', 'D', 'L'] }],
      loops: [{ items: [{ b: 0, t: 1 }], c: [500, 300] }],
      ground: 'P',
    };
  }
  if (level === 2 || level === 3) {
    const xs = [170, 500, 830], y0 = 110, y1 = 490;
    return {
      view: { w: 1000, h: 600 },
      nodes: [
        { id: 'A', pts: xs.map(x => [x, y0]), wires: [[0, 1], [1, 2]], labels: [{ pt: 1, dir: 'U' }] },
        { id: 'B', pts: xs.map(x => [x, y1]), wires: [[0, 1], [1, 2]], labels: [{ pt: 1, dir: 'D' }] },
      ],
      branches: xs.map((x, i) => ({ from: 'A', fp: i, to: 'B', tp: i, path: [[x, y0], [x, y1]], sides: [i === 0 ? 'L' : 'R'] })),
      loops: [{ items: [{ b: 0, t: -1 }, { b: 1, t: 1 }], c: [335, 300] }, { items: [{ b: 1, t: -1 }, { b: 2, t: 1 }], c: [705, 300] }],
      ground: 'B',
    };
  }
  const xs = [130, 380, 700, 950], y0 = 110, y1 = 490;
  return {
    view: { w: 1080, h: 600 },
    nodes: [
      { id: 'A', pts: [[xs[0], y0], [xs[1], y0]], wires: [[0, 1]], labels: [{ pt: 1, dir: 'U' }] },
      { id: 'B', pts: [[xs[2], y0], [xs[3], y0]], wires: [[0, 1]], labels: [{ pt: 0, dir: 'U' }] },
      { id: 'C', pts: xs.map(x => [x, y1]), wires: [[0, 1], [1, 2], [2, 3]], labels: [{ pt: 1, dir: 'D' }, { pt: 2, dir: 'D' }] },
    ],
    branches: [
      { from: 'A', fp: 0, to: 'C', tp: 0, path: [[xs[0], y0], [xs[0], y1]], sides: ['L'] },
      { from: 'A', fp: 1, to: 'C', tp: 1, path: [[xs[1], y0], [xs[1], y1]], sides: ['L'] },
      { from: 'A', fp: 1, to: 'B', tp: 0, path: [[xs[1], y0], [xs[2], y0]], sides: ['U'] },
      { from: 'B', fp: 0, to: 'C', tp: 2, path: [[xs[2], y0], [xs[2], y1]], sides: ['R'] },
      { from: 'B', fp: 1, to: 'C', tp: 3, path: [[xs[3], y0], [xs[3], y1]], sides: ['R'] },
    ],
    loops: [
      { items: [{ b: 0, t: -1 }, { b: 1, t: 1 }], c: [255, 300] },
      { items: [{ b: 1, t: -1 }, { b: 2, t: 1 }, { b: 3, t: 1 }], c: [540, 330] },
      { items: [{ b: 3, t: -1 }, { b: 4, t: 1 }], c: [825, 300] },
    ],
    ground: 'C',
  };
}

function elementPlan(level, rng) {
  if (level === 1) {
    const nR = rng.pick([2, 2, 3]), twoE = rng.chance(0.55);
    const els = [{ type: 'R', seg: 0 }];
    if (nR === 3) els.push({ type: 'R', seg: twoE ? 0 : 2 });
    els.push({ type: 'R', seg: 1 });
    if (twoE) els.push({ type: 'E', fixed: true, seg: 2 });
    els.push({ type: 'E', adj: 0, seg: 3 });
    return [els.sort((a, b) => a.seg - b.seg)];
  }
  const R = () => ({ type: 'R' });
  if (level === 2) return [rng.shuffle([{ type: 'E', adj: 0 }, R()]), [R()], rng.shuffle([{ type: 'E', adj: 1 }, R()])];
  if (level === 3) {
    for (;;) {
      const outer = adj => rng.shuffle([{ type: 'E', adj }, R(), ...(rng.chance(0.5) ? [R()] : [])]);
      const mid = rng.shuffle([R(), ...(rng.chance(0.45) ? [R()] : []), ...(rng.chance(0.75) ? [{ type: 'E', fixed: true }] : [])]);
      const plan = [outer(0), mid, outer(1)];
      if (plan.flat().length >= 7) return plan;
    }
  }
  const maybeE = p => (rng.chance(p) ? [{ type: 'E', fixed: true }] : []);
  return [
    rng.shuffle([{ type: 'E', adj: 0 }, R()]),
    rng.shuffle([R(), ...maybeE(0.35)]),
    rng.shuffle([{ type: 'E', adj: 1 }, R()]),
    rng.shuffle([R(), ...maybeE(0.35)]),
    rng.shuffle([{ type: 'E', adj: 2 }, R()]),
  ];
}

const R_SETS = { 1: [2, 3, 4, 5, 6, 8, 10], 2: [1, 2, 3, 4, 5, 6, 8], 3: [1, 2, 3, 4, 5, 6, 8, 10], 4: [1, 2, 3, 4, 5, 6, 8] };
const EL_HALF = { R: 28, E: 8 };

/* ---------- generate a random circuit with integer-ampere answers ---------- */
function generate(level, seed) {
  const rng = RNG(seed * 7919 + level * 104729);
  const maxE = level === 1 ? 36 : 40;
  for (let attempt = 0; attempt < 20000; attempt++) {
    const topo = topology(level);
    const plan = elementPlan(level, rng);
    const Jset = level === 2 || level === 3 ? [1, 2, 3, 4] : [1, 2, 3];
    // pick "mesh currents" first; branch currents follow and automatically satisfy the junction rule
    const J = topo.loops.map(() => rng.pick(Jset) * (rng.chance(0.5) ? 1 : -1));
    const I = topo.branches.map((_, b) => topo.loops.reduce((s, L, l) => s + L.items.filter(it => it.b === b).reduce((a, it) => a + it.t * J[l], 0), 0));
    if (I.some(v => v === 0 || Math.abs(v) > 6)) continue;
    const branches = topo.branches.map((br, b) => ({ ...br, idx: b, I: I[b], els: plan[b].map(e => ({ ...e, seg: e.seg || 0 })) }));
    for (const br of branches) for (const e of br.els) {
      if (e.type === 'R') e.val = rng.pick(R_SETS[level]);
      else if (e.fixed) { e.val = rng.int(2, 12); e.plus = rng.chance(0.5) ? 'to' : 'from'; }
    }
    const allR = branches.flatMap(b => b.els.filter(e => e.type === 'R').map(e => e.val));
    if (level >= 2 && new Set(allR).size < Math.min(3, allR.length)) continue;
    // each loop owns one battery whose value/polarity we solve for, so the loop rule holds exactly
    let ok = true;
    topo.loops.forEach((L, l) => {
      let S = 0, adj = null, adjT = 0;
      for (const it of L.items) {
        const br = branches[it.b];
        for (const e of br.els) {
          if (e.type === 'E' && e.adj === l) { adj = e; adjT = it.t; continue; }
          if (e.type === 'R') S += -(it.t * br.I) * e.val;
          else S += (e.plus === 'to' ? 1 : -1) * it.t * e.val;
        }
      }
      const A = -S;
      if (!adj || Math.abs(A) < 2 || Math.abs(A) > maxE) { ok = false; return; }
      adj.val = Math.abs(A); adj.plus = Math.sign(A) * adjT > 0 ? 'to' : 'from';
    });
    if (!ok) continue;
    const dir0 = level === 1 ? [1] : level === 2 ? [-1, 1, -1] : branches.map(() => (rng.chance(0.5) ? 1 : -1));
    const ans = I.map((v, b) => v * dir0[b]);
    const wantNeg = level === 1 ? rng.chance(0.3) : rng.chance(0.8);
    if (wantNeg && !ans.some(v => v < 0)) continue;
    if (!wantNeg && level === 1 && ans[0] < 0) continue;
    return finalize({ level, seed, ...topo, branches, dir0 });
  }
  throw new Error('generator failed');
}

/* ---------- geometry, numbering, junction detection ---------- */
function polyCum(pts) { const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i])); return cum; }
function pointAt(pts, cum, s) {
  s = Math.max(0, Math.min(cum[cum.length - 1], s));
  let i = 1; while (i < cum.length - 1 && cum[i] < s) i++;
  const L = cum[i] - cum[i - 1] || 1, f = (s - cum[i - 1]) / L;
  const a = pts[i - 1], b = pts[i];
  return { p: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], u: [(b[0] - a[0]) / L, (b[1] - a[1]) / L], seg: i - 1 };
}
function subPath(pts, cum, s0, s1) {
  const out = [pointAt(pts, cum, s0).p];
  for (let i = 1; i < pts.length - 1; i++) if (cum[i] > s0 && cum[i] < s1) out.push(pts[i]);
  out.push(pointAt(pts, cum, s1).p);
  return out;
}

function finalize(c) {
  c.nodeById = {};
  for (const n of c.nodes) { c.nodeById[n.id] = n; n.ends = n.pts.map(() => 0); }
  c.branches.forEach((br, b) => {
    br.idx = b;
    br.cum = polyCum(br.path); br.len = br.cum[br.cum.length - 1];
    c.nodeById[br.from].ends[br.fp]++; c.nodeById[br.to].ends[br.tp]++;
    // distribute elements evenly on their segment
    const bySeg = {};
    br.els.forEach(e => (bySeg[e.seg] = bySeg[e.seg] || []).push(e));
    for (const seg in bySeg) {
      const list = bySeg[seg], s0 = br.cum[seg], L = br.cum[+seg + 1] - s0;
      list.forEach((e, j) => { e.s = s0 + (L * (j + 1)) / (list.length + 1); });
    }
    br.els.sort((a, b2) => a.s - b2.s);
    br.els.forEach((e, k) => {
      const at = pointAt(br.path, br.cum, e.s);
      e.p = at.p; e.u = at.u; e.seg = at.seg; e.h = EL_HALF[e.type]; e.b = b; e.k = k;
      e.side = br.sides[at.seg];
    });
    // wire pieces between elements
    br.pieces = [];
    let s = 0;
    br.els.forEach(e => { br.pieces.push(subPath(br.path, br.cum, s, e.s - e.h)); s = e.s + e.h; });
    br.pieces.push(subPath(br.path, br.cum, s, br.len));
    // arrow: the middle of the widest free gap (away from elements and corners)
    let best = null;
    for (let x = 14; x <= br.len - 14; x += 3) {
      let score = Math.min(x, br.len - x);
      for (const e of br.els) score = Math.min(score, Math.abs(x - e.s) - e.h - 6);
      for (let i = 1; i < br.cum.length - 1; i++) score = Math.min(score, Math.abs(x - br.cum[i]) + 4);
      if (!best || score > best.score + 0.01) best = { x, score };
    }
    br.arrowS = best.x;
    const at = pointAt(br.path, br.cum, br.arrowS);
    br.arrowP = at.p; br.arrowU = at.u; br.arrowSide = br.sides[at.seg];
  });
  for (const n of c.nodes) {
    n.deg = n.pts.map((_, i) => n.ends[i] + n.wires.filter(w => w[0] === i || w[1] === i).length);
    n.junction = n.ends.reduce((a, v) => a + v, 0) >= 3;
    n.dots = n.pts.map((_, i) => i).filter(i => n.deg[i] >= 3);
  }
  // numbering: resistors in branch/path order, batteries left→right
  const Rs = [], Es = [];
  c.branches.forEach(br => br.els.forEach(e => (e.type === 'R' ? Rs : Es).push(e)));
  Es.sort((a, b) => a.p[0] - b.p[0] || a.p[1] - b.p[1]);
  Rs.forEach((e, i) => { e.num = i + 1; e.id = 'R' + (i + 1); });
  Es.forEach((e, i) => { e.num = i + 1; e.id = 'E' + (i + 1); });
  c.R = Rs; c.E = Es;
  c.Itrue = c.branches.map(br => br.I);
  c.nB = c.branches.length; c.nL = c.loops.length;
  c.junctions = c.nodes.filter(n => n.junction);
  return c;
}

/* ---------- element helpers ---------- */
const elTex = e => (e.type === 'R' ? `\\R{${e.num}}` : `\\E{${e.num}}`);
const elUnit = e => (e.type === 'R' ? 'Ω' : 'V');
const elDeltaFwd = (e, I) => (e.type === 'R' ? -I * e.val : e.plus === 'to' ? e.val : -e.val); // walking from→to

function nodePath(node, i, j) {
  if (i === j) return [node.pts[i]];
  const prev = { [i]: -1 }, q = [i];
  while (q.length) {
    const x = q.shift();
    for (const [a, b] of node.wires) {
      const y = a === x ? b : b === x ? a : null;
      if (y === null || y in prev) continue;
      prev[y] = x; q.push(y);
    }
  }
  const path = []; let x = j;
  while (x !== -1 && x !== undefined) { path.unshift(node.pts[x]); x = prev[x]; }
  return path;
}

/* =====================================================================
   MODEL — equations depend on the chosen arrow & loop directions
   ===================================================================== */
function loopItems(L, ldir) {
  return ldir === -1 ? L.items.slice().reverse().map(it => ({ b: it.b, t: -it.t })) : L.items.map(it => ({ ...it }));
}
const itemStart = (c, it) => { const br = c.branches[it.b]; return it.t === 1 ? [br.from, br.fp] : [br.to, br.tp]; };
const itemEnd = (c, it) => { const br = c.branches[it.b]; return it.t === 1 ? [br.to, br.tp] : [br.from, br.fp]; };

function routeGeometry(c, items) {
  const pts = []; let total = 0; const elems = [];
  const append = poly => { for (const q of poly) { const last = pts[pts.length - 1]; if (last) { if (last[0] === q[0] && last[1] === q[1]) continue; total += dist(last, q); } pts.push(q); } };
  items.forEach((it, k) => {
    const br = c.branches[it.b];
    const path = it.t === 1 ? br.path : br.path.slice().reverse();
    append([path[0]]);
    const start = total;
    append(path);
    for (const e of br.els) elems.push({ e, b: it.b, t: it.t, s: start + (it.t === 1 ? e.s : br.len - e.s), h: e.h });
    const nxt = items[(k + 1) % items.length];
    const [nid, ip] = itemEnd(c, it), [, jp] = itemStart(c, nxt);
    append(nodePath(c.nodeById[nid], ip, jp));
  });
  elems.sort((a, b) => a.s - b.s);
  const cum = polyCum(pts);
  return { pts, cum, len: cum[cum.length - 1], elems };
}

function loopEquation(c, l, dirs, ldir) {
  const L = c.loops[l];
  const items = loopItems(L, ldir);
  const terms = [];
  for (const it of items) {
    const br = c.branches[it.b];
    const els = it.t === 1 ? br.els : br.els.slice().reverse();
    for (const e of els) {
      if (e.type === 'R') { const along = it.t === dirs[it.b]; terms.push({ e, b: it.b, t: it.t, type: 'R', sign: along ? -1 : 1, along }); }
      else { const up = (e.plus === 'to' ? 1 : -1) * it.t > 0; terms.push({ e, b: it.b, t: it.t, type: 'E', sign: up ? 1 : -1, up }); }
    }
  }
  const nB = c.nB, zc = Array(nB).fill(0); let zr = 0;
  for (const t of terms) { if (t.type === 'R') zc[t.b] += t.sign * t.e.val; else zr += t.sign * t.e.val; }
  const raw = { c: zc.map(v => -v || 0), r: zr };
  const { e: std, d } = normalize(raw);
  const [startNode] = itemStart(c, items[0]);
  const perBranchR = {}; terms.filter(t => t.type === 'R').forEach(t => (perBranchR[t.b] = (perBranchR[t.b] || 0) + 1));
  const likeTerms = Object.values(perBranchR).some(v => v > 1);
  const nConst = terms.filter(t => t.type === 'E').length;
  return { l, items, terms, zc, zr, raw, std, d, startNode, likeTerms, nConst, route: routeGeometry(c, items) };
}

function junctionEquation(c, n, dirs) {
  const inn = [], out = [];
  c.branches.forEach((br, b) => {
    if (br.to === n.id) (dirs[b] === 1 ? inn : out).push(b);
    if (br.from === n.id) (dirs[b] === 1 ? out : inn).push(b);
  });
  const co = Array(c.nB).fill(0); inn.forEach(b => co[b] += 1); out.forEach(b => co[b] -= 1);
  return { node: n, inn, out, c: co, r: 0 };
}

function buildModel(c, dirs, loopDirs) {
  const kcl = c.junctions.map(n => junctionEquation(c, n, dirs));
  const indep = kcl.slice(0, Math.max(0, kcl.length - 1));
  const redundant = kcl.length > 1 ? kcl[kcl.length - 1] : null;
  const kvl = c.loops.map((_, l) => loopEquation(c, l, dirs, loopDirs[l]));
  const eqs = [];
  indep.forEach(k => eqs.push({ kind: 'J', c: k.c.slice(), r: 0, src: k, label: 0 }));
  kvl.forEach(k => eqs.push({ kind: 'L', c: k.std.c.slice(), r: k.std.r, src: k, label: 0 }));
  eqs.forEach((e, i) => { e.label = i + 1; e.src.label = i + 1; });
  const sol = c.Itrue.map((v, b) => v * dirs[b]);
  const solve = solveSteps(eqs, c.nB);
  return { kcl, indep, redundant, kvl, eqs, sol, solve };
}

/* =====================================================================
   SOLVER — substitution + elimination, recorded as human-readable steps
   ===================================================================== */
function solveSteps(eqs, nB) {
  const steps = [];
  let sys = eqs.map(e => ({ c: e.c.slice(), r: e.r, name: String(e.label), kind: e.kind }));
  const subs = [];
  const tag = n => `(${n})`;
  const line = (tex, note = '', t = '') => ({ tex, note, tag: t });

  // ---- phase 1: substitute junction equations (all coefficients ±1)
  for (;;) {
    const je = sys.find(e => e.kind === 'J' && e.c.some(v => Math.abs(v) === 1));
    if (!je || sys.length === 1) break;
    const others = sys.filter(e => e !== je);
    const cands = je.c.map((v, j) => ({ j, v, n: others.filter(o => o.c[j] !== 0).length })).filter(o => Math.abs(o.v) === 1);
    cands.sort((a, b) => b.n - a.n || a.j - b.j);
    const { j: v, v: cv } = cands[0];
    const ex = je.c.map((x, j) => (j === v ? 0 : -x / cv || 0)); const ex0 = je.r / cv || 0;
    const step = {
      kind: 'sub', v,
      title: `Express ${M(Itex(v))} with equation ${tag(je.name)}`,
      note: `Every current in junction equation ${tag(je.name)} has a coefficient of ±1, so it is easy to solve it for one current. We pick ${M(Itex(v))} because it shows up in the most other equations — replacing it there removes one unknown in one go.`,
      blocks: [{ lines: [line(texEq(je), 'junction eq.', tag(je.name)), line(`${Itex(v)} = ${texExpr(ex, ex0)}`, `solve for ${M(Itex(v))}`, '')] }],
    };
    const next = [];
    for (const o of others) {
      if (o.c[v] === 0) { next.push(o); continue; }
      const lines = [line(texEq(o), '', tag(o.name))];
      // substituted (show parentheses)
      let s = '', first = true;
      o.c.forEach((a, j) => {
        if (!a) return;
        if (j === v) { const m = Math.abs(a); s += (first ? (a < 0 ? '-' : '') : a < 0 ? ' - ' : ' + ') + (m === 1 ? '' : fmtN(m)) + `\\left(${texExpr(ex, ex0)}\\right)`; }
        else s += coefTerm(a, Itex(j), first);
        first = false;
      });
      lines.push(line(`${s} = ${fmtN(o.r)}`, 'substitute'));
      // expanded
      const pairs = [];
      o.c.forEach((a, j) => {
        if (!a) return;
        if (j !== v) { pairs.push({ a, b: j }); return; }
        ex.forEach((x, jj) => { if (x) pairs.push({ a: o.c[v] * x, b: jj }); });
        if (ex0) pairs.push({ a: o.c[v] * ex0, b: null });
      });
      const needExpand = Math.abs(o.c[v]) !== 1 || pairs.length !== o.c.filter(a => a).length;
      if (needExpand) lines.push(line(`${texPairs(pairs)} = ${fmtN(o.r)}`, 'expand'));
      const nc = o.c.map((a, j) => (j === v ? 0 : a + o.c[v] * ex[j]) || 0);
      const nr = o.r - o.c[v] * ex0;
      const raw = { ...o, c: nc, r: nr };
      lines.push(line(texEq(raw), 'collect'));
      const { e: ne, d } = normalize(raw);
      const newName = o.name + "'";
      if (d !== 1) lines.push(line(texEq(ne), divNote(d), tag(newName)));
      else lines[lines.length - 1].tag = tag(newName);
      next.push({ ...ne, name: newName, kind: o.kind });
      step.blocks.push({ head: `Into ${tag(o.name)}:`, lines });
    }
    subs.push({ v, ex, ex0, name: je.name });
    steps.push(step);
    sys = next;
  }

  // ---- phase 2: elimination with integer multipliers
  const pivots = [];
  while (sys.length > 1) {
    const vars = [...Array(nB).keys()].filter(j => sys.some(e => e.c[j] !== 0));
    // pick the variable that is cheapest to eliminate (smallest lcm of coefficients)
    let bestV = vars[0], bestCost = Infinity;
    for (const j of vars) {
      const cs = sys.filter(e => e.c[j] !== 0).map(e => Math.abs(e.c[j]));
      if (cs.length < 2) continue;
      const cost = cs.reduce((a, b) => lcm(a, b), 1);
      if (cost < bestCost) { bestCost = cost; bestV = j; }
    }
    const v = bestV;
    const withV = sys.filter(e => e.c[v] !== 0).sort((a, b) => Math.abs(a.c[v]) - Math.abs(b.c[v]) || a.c.filter(x => x).length - b.c.filter(x => x).length);
    const p = withV[0];
    const step = {
      kind: 'elim', v,
      title: `Eliminate ${M(Itex(v))}`,
      note: `${sys.length} equations, ${vars.length} unknowns. Scale the equations so that ${M(Itex(v))} has the same size coefficient in both, then add or subtract them — ${M(Itex(v))} cancels out and we are left with one unknown fewer.`,
      blocks: [],
    };
    const next = [];
    for (const e of sys) {
      if (e === p) continue;
      if (e.c[v] === 0) { next.push(e); continue; }
      const Lm = lcm(Math.abs(p.c[v]), Math.abs(e.c[v]));
      const a = Lm / Math.abs(e.c[v]), bb = Lm / Math.abs(p.c[v]);
      const same = Math.sign(e.c[v]) === Math.sign(p.c[v]);
      const sc = (q, k) => ({ c: q.c.map(x => x * k), r: q.r * k });
      const lines = [];
      const eS = sc(e, a), pS = sc(p, bb);
      lines.push(line(texEq(eS), a === 1 ? `${tag(e.name)}` : `${a} × ${tag(e.name)}`));
      lines.push(line(texEq(pS), bb === 1 ? `${tag(p.name)}` : `${bb} × ${tag(p.name)}`));
      const nc = e.c.map((x, j) => (a * x + (same ? -1 : 1) * bb * p.c[j]) || 0);
      const nr = a * e.r + (same ? -1 : 1) * bb * p.r;
      const raw = { c: nc, r: nr };
      lines.push(line(texEq(raw), same ? 'subtract' : 'add', ''));
      const { e: ne, d } = normalize(raw);
      const newName = e.name + "'";
      if (d !== 1) lines.push(line(texEq(ne), divNote(d), tag(newName)));
      else lines[lines.length - 1].tag = tag(newName);
      next.push({ ...ne, name: newName, kind: 'X' });
      step.blocks.push({ head: `${tag(e.name)} ${same ? '−' : '+'} ${tag(p.name)}, scaled so ${M(Itex(v))} cancels:`, lines });
    }
    pivots.push({ v, p });
    steps.push(step);
    sys = next;
  }

  // ---- final single equation
  const known = {};
  const last = sys[0];
  const u = last.c.findIndex(x => x !== 0);
  const valU = last.r / last.c[u];
  known[u] = valU;
  {
    const lines = [];
    if (last.c[u] !== 1) {
      lines.push(line(texEq(last), '', tag(last.name)));
      lines.push(line(`${Itex(u)} = \\frac{${fmtN(last.r)}}{${fmtN(last.c[u])}} = \\boxed{${fmtN(valU)}\\unit{A}}`, `÷ ${fmtN(last.c[u])}`));
    } else lines.push(line(`${Itex(u)} = \\boxed{${fmtN(valU)}\\unit{A}}`, 'already solved', tag(last.name)));
    steps.push({ kind: 'one', v: u, title: `Only ${M(Itex(u))} is left`, note: `One equation with one unknown — just divide.`, blocks: [{ lines }] });
  }

  // ---- back-substitution
  const backBlocks = [];
  for (let k = pivots.length - 1; k >= 0; k--) {
    const { v, p } = pivots[k];
    const lines = [line(texEq(p), '', tag(p.name))];
    let s = '', first = true, K = 0;
    p.c.forEach((a, j) => {
      if (!a) return;
      if (j === v) s += coefTerm(a, Itex(j), first);
      else { const m = Math.abs(a); K += a * known[j]; s += (first ? (a < 0 ? '-' : '') : a < 0 ? ' - ' : ' + ') + (m === 1 ? '' : fmtN(m) + '\\cdot ') + par(known[j]); }
      first = false;
    });
    lines.push(line(`${s} = ${fmtN(p.r)}`, 'plug in'));
    const rhs = p.r - K;
    const lhsV = coefTerm(p.c[v], Itex(v), true);
    lines.push(line(`${lhsV} = ${fmtN(p.r)} ${K >= 0 ? '-' : '+'} ${fmtN(Math.abs(K))} = ${fmtN(rhs)}`, 'move numbers'));
    const val = rhs / p.c[v];
    if (p.c[v] !== 1) lines.push(line(`${Itex(v)} = \\frac{${fmtN(rhs)}}{${fmtN(p.c[v])}} = \\boxed{${fmtN(val)}\\unit{A}}`, `÷ ${fmtN(p.c[v])}`));
    else lines[lines.length - 1].tex += ` \\;\\Rightarrow\\; \\boxed{${Itex(v)} = ${fmtN(val)}\\unit{A}}`;
    known[v] = val;
    backBlocks.push({ head: `Find ${M(Itex(v))} from ${tag(p.name)}:`, lines });
  }
  for (let k = subs.length - 1; k >= 0; k--) {
    const { v, ex, ex0, name } = subs[k];
    let s = '', first = true, val = ex0;
    ex.forEach((a, j) => {
      if (!a) return;
      const m = Math.abs(a); val += a * known[j];
      s += (first ? (a < 0 ? '-' : '') : a < 0 ? ' - ' : ' + ') + (m === 1 ? '' : fmtN(m) + '\\cdot ') + par(known[j]);
      first = false;
    });
    if (ex0) s += (ex0 < 0 ? ' - ' : ' + ') + fmtN(Math.abs(ex0));
    known[v] = val;
    backBlocks.push({ head: `Find ${M(Itex(v))} from the junction equation ${tag(name)}:`, lines: [line(`${Itex(v)} = ${texExpr(ex, ex0)} = ${s || '0'} = \\boxed{${fmtN(val)}\\unit{A}}`, '')] });
  }
  if (backBlocks.length) steps.push({ kind: 'back', title: 'Work backwards', note: 'Now that one current is known, plug it into the earlier equations, one at a time, to unlock the rest.', blocks: backBlocks });
  const values = [...Array(nB).keys()].map(j => known[j]);
  return { steps, values };
}

/* =====================================================================
   POTENTIALS, LOOP "ROLLERCOASTER", POWER
   ===================================================================== */
function potentials(c, groundId) {
  const V = { [groundId]: 0 };
  const delta = c.branches.map(br => br.els.reduce((s, e) => s + elDeltaFwd(e, br.I), 0));
  for (let changed = true; changed;) {
    changed = false;
    c.branches.forEach((br, b) => {
      if (V[br.from] !== undefined && V[br.to] === undefined) { V[br.to] = V[br.from] + delta[b]; changed = true; }
      else if (V[br.to] !== undefined && V[br.from] === undefined) { V[br.from] = V[br.to] - delta[b]; changed = true; }
    });
  }
  const pieces = c.branches.map(br => { const arr = [V[br.from]]; let v = V[br.from]; for (const e of br.els) { v += elDeltaFwd(e, br.I); arr.push(v); } return arr; });
  const all = [...Object.values(V), ...pieces.flat()];
  return { V, pieces, min: Math.min(...all), max: Math.max(...all), delta };
}

/* potential as a function of arc length along a loop route */
function coasterProfile(c, route, Vstart) {
  const pts = [[0, Vstart]]; let v = Vstart;
  for (const r of route.elems) {
    const br = c.branches[r.b];
    const dv = r.t * elDeltaFwd(r.e, br.I);
    if (r.e.type === 'R') { pts.push([r.s - r.h, v]); v += dv; pts.push([r.s + r.h, v]); }
    else { pts.push([r.s, v]); v += dv; pts.push([r.s, v]); }
  }
  pts.push([route.len, v]);
  return pts;
}

function powerTable(c) {
  const rows = [];
  c.branches.forEach((br, b) => br.els.forEach(e => {
    if (e.type === 'R') rows.push({ e, b, P: br.I * br.I * e.val, role: 'heat' });
    else { const P = e.val * br.I * (e.plus === 'to' ? 1 : -1); rows.push({ e, b, P: Math.abs(P), role: P > 0 ? 'source' : 'charging' }); }
  }));
  return rows;
}

if (typeof module !== 'undefined') module.exports = { RNG, TeX, M, MD, generate, buildModel, potentials, coasterProfile, powerTable, routeGeometry, normalize, texEq, LEVELS };
