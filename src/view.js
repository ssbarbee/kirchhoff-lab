/* =====================================================================
   VIEW — SVG circuit renderer, animation loop, walker, rollercoaster
   ===================================================================== */
const SVGNS = 'http://www.w3.org/2000/svg';
function sv(tag, attrs = {}, parent) {
  const el = document.createElementNS(SVGNS, tag);
  for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) el.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(el);
  return el;
}
const f1 = n => (Math.round(n * 10) / 10).toString();
const ptsStr = pts => pts.map(p => f1(p[0]) + ',' + f1(p[1])).join(' ');
const pathD = pts => 'M' + pts.map(p => f1(p[0]) + ' ' + f1(p[1])).join(' L');
const vadd = (a, b) => [a[0] + b[0], a[1] + b[1]];
const vmul = (a, k) => [a[0] * k, a[1] * k];
const SIDE = { L: [-1, 0], R: [1, 0], U: [0, -1], D: [0, 1] };
const OPP = { L: 'R', R: 'L', U: 'D', D: 'U' };
const curColor = b => `var(--c${b + 1})`;
const loopColor = l => `var(--l${l + 1})`;
const potColor = (v, min, max) => { const f = max - min < 1e-9 ? 0.5 : (v - min) / (max - min); return `color-mix(in oklch, var(--vhi) ${Math.round(f * 100)}%, var(--vlo))`; };

/* ---------- global animation loop ---------- */
const Anim = {
  subs: new Set(), running: false,
  add(f) { this.subs.add(f); this.kick(); return () => this.subs.delete(f); },
  kick() {
    if (this.running) return; this.running = true;
    const loop = t => { if (!this.subs.size) { this.running = false; return; } for (const f of [...this.subs]) f(t); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  },
};

/* text label helper: symbol with subscript, then a value */
function symText(parent, attrs, sym, num, rest) {
  const t = sv('text', attrs, parent);
  sv('tspan', { class: sym === 'ℰ' ? 'sym emf' : 'sym' }, t).textContent = sym;
  if (num !== '' && num !== undefined) { const s = sv('tspan', { class: 'sub', dy: 6, 'font-size': '0.68em' }, t); s.textContent = num; }
  if (rest) { const r = sv('tspan', { dy: num !== '' && num !== undefined ? -6 : 0, class: 'val' }, t); r.textContent = rest; }
  return t;
}
function placeAt(p, side, d) {
  const v = SIDE[side];
  const a = { x: p[0] + v[0] * d, y: p[1] + v[1] * d, 'text-anchor': side === 'L' ? 'end' : side === 'R' ? 'start' : 'middle' };
  if (side === 'L' || side === 'R') a.y += 7;
  if (side === 'D') a.y += 15;
  return a;
}

class CircuitView {
  constructor(host, c, o = {}) {
    this.c = c;
    this.o = Object.assign({ arrows: 'assumed', labels: true, loops: false, flow: false, potential: null, mini: false, electrons: false, startFlag: null }, o);
    this.svg = sv('svg', { viewBox: `0 0 ${c.view.w} ${c.view.h}`, class: 'circ' + (o.mini ? ' mini' : ''), role: 'img', 'aria-label': 'Circuit diagram' });
    host.appendChild(this.svg);
    this.flows = [];
    if (!c._vb) c._vb = fitBox(c);
    this.svg.setAttribute('viewBox', c._vb);
    this.draw();
    this.unsub = Anim.add(t => this.tick(t));
  }
  destroy() { this.unsub && this.unsub(); this.svg.remove(); }
  get dirs() { return this.o.dirs || S.dirs; }
  get ldirs() { return this.o.loopDirs || S.loopDirs; }
  set(o) { Object.assign(this.o, o); this.draw(); }

  draw() {
    const c = this.c, o = this.o, svg = this.svg;
    svg.innerHTML = '';
    svg.classList.toggle('pot', !!o.potential);
    const g = name => sv('g', { class: 'ly-' + name }, svg);
    const gBand = g('band'), gNW = g('nwire'), gW = g('wire'), gFlow = g('flow'), gEl = g('el'), gLab = g('lab'), gArr = g('arr'), gNode = g('node'), gLoop = g('loop');
    this.gTop = g('top');
    this.flows = [];
    const P = o.potential ? potentials(c, o.potential.ground) : null;
    this.P = P;
    const iec = (typeof S !== 'undefined' ? S.symbol : 'iec') === 'iec';

    // loop bands (for highlighting a loop)
    this.bands = c.loops.map((L, l) => {
      const r = routeGeometry(c, loopItems(L, 1));
      return sv('path', { d: pathD(r.pts) + ' Z', class: 'band', 'data-loop': l, style: `stroke:${loopColor(l)}` }, gBand);
    });

    // node wires
    for (const n of c.nodes) {
      n.wires.forEach(([i, j]) => {
        const ln = sv('line', { x1: n.pts[i][0], y1: n.pts[i][1], x2: n.pts[j][0], y2: n.pts[j][1], class: 'wire', 'data-n': n.id }, gNW);
        if (P) ln.style.stroke = potColor(P.V[n.id], P.min, P.max);
      });
    }
    // branch wires (pieces between elements)
    c.branches.forEach((br, b) => {
      br.pieces.forEach((pc, j) => {
        const pl = sv('polyline', { points: ptsStr(pc), class: 'wire', 'data-b': b }, gW);
        if (P) pl.style.stroke = potColor(P.pieces[b][j], P.min, P.max);
      });
    });

    // flow dots
    if (o.flow) {
      const k = o.electrons ? -1 : 1;
      c.branches.forEach((br, b) => {
        const el = sv('path', { d: pathD(br.path), class: 'flow' + (o.electrons ? ' e' : ''), 'data-b': b, style: o.electrons ? '' : `stroke:${curColor(b)}` }, gFlow);
        this.flows.push({ el, v: k * c.Itrue[b] });
      });
      for (const n of c.nodes) {
        n.wires.forEach(([i, j]) => {
          const cur = nodeEdgeCurrent(c, n, i, j);
          if (Math.abs(cur) < 1e-9) return;
          const el = sv('path', { d: pathD([n.pts[i], n.pts[j]]), class: 'flow nflow' + (o.electrons ? ' e' : ''), 'data-n': n.id }, gFlow);
          this.flows.push({ el, v: k * cur });
        });
      }
    }

    // elements
    c.branches.forEach((br, b) => br.els.forEach(e => {
      const grp = sv('g', { class: 'el el' + e.type, 'data-b': b, 'data-el': e.id }, gEl);
      const u = e.u, n = [-u[1], u[0]];
      const at = (a, bb) => [e.p[0] + u[0] * a + n[0] * bb, e.p[1] + u[1] * a + n[1] * bb];
      if (e.type === 'R') {
        if (iec) sv('polygon', { points: ptsStr([at(-28, -10), at(28, -10), at(28, 10), at(-28, 10)]), class: 'rbox' }, grp);
        else {
          const ts = [0, 1, 3, 5, 7, 9, 11, 12], bs = [0, 9, -9, 9, -9, 9, -9, 0];
          sv('polyline', { points: ptsStr(ts.map((t, i) => at(-28 + (56 * t) / 12, bs[i]))), class: 'zig' }, grp);
        }
        sv('rect', { x: Math.min(at(-30, -16)[0], at(30, 16)[0]), y: Math.min(at(-30, -16)[1], at(30, 16)[1]), width: Math.abs(at(30, 16)[0] - at(-30, -16)[0]), height: Math.abs(at(30, 16)[1] - at(-30, -16)[1]), class: 'hit' }, grp);
      } else {
        const sgn = e.plus === 'to' ? 1 : -1; // + plate toward the branch's "to" end (= +u)
        const pp = at(6 * sgn, 0), pm = at(-6 * sgn, 0);
        sv('line', { x1: pp[0] - n[0] * 21, y1: pp[1] - n[1] * 21, x2: pp[0] + n[0] * 21, y2: pp[1] + n[1] * 21, class: 'plate plus' }, grp);
        sv('line', { x1: pm[0] - n[0] * 11, y1: pm[1] - n[1] * 11, x2: pm[0] + n[0] * 11, y2: pm[1] + n[1] * 11, class: 'plate minus' }, grp);
        // + and − marks on the side opposite to the label, nudged outward along the wire
        const os = SIDE[OPP[e.side]];
        const mark = (q, out, txt) => { const tt = sv('text', { x: q[0] + os[0] * 30 + u[0] * 8 * out, y: q[1] + os[1] * 26 + u[1] * 8 * out + 6, class: 'pm', 'text-anchor': 'middle' }, grp); tt.textContent = txt; };
        mark(pp, sgn, '+'); mark(pm, -sgn, '−');
        sv('rect', { x: e.p[0] - 24, y: e.p[1] - 24, width: 48, height: 48, class: 'hit' }, grp);
      }
      if (o.labels) {
        const t = symText(gLab, { ...placeAt(e.p, e.side, e.type === 'R' ? 20 : 28), class: 'lab', 'data-b': b, 'data-el': e.id }, e.type === 'R' ? 'R' : 'ℰ', String(e.num), o.mini ? '' : ` = ${e.val} ${e.type === 'R' ? 'Ω' : 'V'}`);
        t.dataset.el = e.id;
      }
    }));

    // current arrows
    if (o.arrows) {
      c.branches.forEach((br, b) => {
        const d0 = o.arrows === 'actual' ? Math.sign(c.Itrue[b]) : this.dirs[b];
        const d = vmul(br.arrowU, d0), n = [-d[1], d[0]], p = br.arrowP;
        const grp = sv('g', { class: 'arrow' + (o.onArrow ? ' clickable' : ''), 'data-b': b, style: `color:${curColor(b)}` }, gArr);
        if (o.onArrow) {
          sv('circle', { cx: p[0], cy: p[1], r: 26, class: 'ahalo' }, grp);
          grp.addEventListener('click', () => o.onArrow(b));
        }
        const tip = vadd(p, vmul(d, 12)), bk = vadd(p, vmul(d, -9));
        sv('path', { d: `M${f1(tip[0])} ${f1(tip[1])} L${f1(bk[0] + n[0] * 9)} ${f1(bk[1] + n[1] * 9)} L${f1(bk[0] - n[0] * 9)} ${f1(bk[1] - n[1] * 9)} Z`, class: 'ahead' }, grp);
        const rest = o.arrows === 'actual' && !o.mini ? ` = ${Math.abs(c.Itrue[b])} A` : '';
        symText(grp, { ...placeAt(p, OPP[br.arrowSide], 18), class: 'alab' }, 'I', String(b + 1), rest);
      });
    }

    // junction dots + names
    for (const n of c.nodes) {
      if (!n.junction) continue;
      n.dots.forEach(i => sv('circle', { cx: n.pts[i][0], cy: n.pts[i][1], r: 7, class: 'ndot', 'data-n': n.id }, gNode));
      n.labels.forEach(({ pt, dir }) => {
        const q = n.pts[pt];
        const a = placeAt(q, dir, dir === 'U' ? 18 : 16);
        const t = sv('text', { ...a, class: 'nlab', 'data-n': n.id }, gNode);
        t.textContent = n.id;
        if (P) {
          const vt = sv('text', { x: q[0] + 16, y: dir === 'U' ? q[1] - 40 : q[1] + 60, 'text-anchor': 'middle', class: 'vlab', 'data-n': n.id }, gNode);
          vt.textContent = `${fmtN(P.V[n.id])} V`;
          vt.setAttribute('x', q[0]);
        }
      });
      if (o.onNode) {
        n.dots.forEach(i => { const hc = sv('circle', { cx: n.pts[i][0], cy: n.pts[i][1], r: 24, class: 'nhit', 'data-n': n.id }, gNode); hc.addEventListener('click', () => o.onNode(n.id)); });
      }
    }
    if (P && o.potential.ground) {
      const gn = c.nodeById[o.potential.ground];
      if (!gn.junction) { // single loop: show the reference point
        const q = gn.pts[0];
        sv('circle', { cx: q[0], cy: q[1], r: 6, class: 'ndot' }, gNode);
        const t = sv('text', { x: q[0] - 14, y: q[1] - 14, 'text-anchor': 'end', class: 'vlab' }, gNode); t.textContent = '0 V';
      }
    }

    // loop indicators
    if (o.loops) {
      const which = o.loops === true ? c.loops.map((_, l) => l) : o.loops;
      const boxes = [];
      svg.querySelectorAll('text').forEach(t => { try { const b = t.getBBox(); if (b.width) boxes.push(b); } catch (e) { /* not rendered */ } });
      which.forEach(l => {
        const L = c.loops[l], cw = this.ldirs[l] === 1;
        const grp = sv('g', { class: 'loopind' + (o.onLoop ? ' clickable' : ''), 'data-loop': l, style: `color:${loopColor(l)}` }, gLoop);
        const [cx, cy] = loopSpot(c, L, boxes), r = 30;
        const a0 = -Math.PI / 2 + 0.5, sweep = Math.PI * 1.55;
        const a1 = cw ? a0 + sweep : a0 - sweep;
        const P0 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)], P1 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
        if (o.onLoop) { sv('circle', { cx, cy, r: 44, class: 'lhalo' }, grp); grp.addEventListener('click', () => o.onLoop(l)); }
        sv('path', { d: `M${f1(P0[0])} ${f1(P0[1])} A${r} ${r} 0 1 ${cw ? 1 : 0} ${f1(P1[0])} ${f1(P1[1])}`, class: 'larc' }, grp);
        const tg = cw ? [-Math.sin(a1), Math.cos(a1)] : [Math.sin(a1), -Math.cos(a1)], nn = [-tg[1], tg[0]];
        const tip = vadd(P1, vmul(tg, 10)), bk = vadd(P1, vmul(tg, -4));
        sv('path', { d: `M${f1(tip[0])} ${f1(tip[1])} L${f1(bk[0] + nn[0] * 8)} ${f1(bk[1] + nn[1] * 8)} L${f1(bk[0] - nn[0] * 8)} ${f1(bk[1] - nn[1] * 8)} Z`, class: 'lhead' }, grp);
        const t = sv('text', { x: cx, y: cy + 8, 'text-anchor': 'middle', class: 'lnum' }, grp); t.textContent = String(l + 1);
      });
    }
    if (o.startFlag) {
      const q = o.startFlag;
      sv('circle', { cx: q[0], cy: q[1], r: 11, class: 'startflag' }, this.gTop);
    }
    this.walker = null;
    if (this._focus) this.focus(this._focus);
  }

  tick(t) {
    if (!this.flows.length) return;
    const speed = 26;
    for (const f of this.flows) f.el.style.strokeDashoffset = String((-(t / 1000) * f.v * speed) % 26);
  }

  focus(sel) {
    this._focus = sel;
    this.svg.classList.toggle('focusing', !!sel);
    if (!sel) return;
    this.svg.querySelectorAll('[data-b],[data-n]').forEach(el => {
      const b = el.dataset.b !== undefined ? +el.dataset.b : null, n = el.dataset.n, id = el.dataset.el;
      const on = (b !== null && sel.b && sel.b.includes(b)) || (n && sel.n && sel.n.includes(n)) || (id && sel.el && sel.el.includes(id));
      el.classList.toggle('on', !!on);
    });
  }
  focusRoute(bs, ns, route) {
    this.focus({ b: bs, n: ns });
    const near = (q, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / L2)); return Math.hypot(a[0] + t * dx - q[0], a[1] + t * dy - q[1]); };
    this.svg.querySelectorAll('.ly-nwire line').forEach(ln => {
      const q = [(+ln.getAttribute('x1') + +ln.getAttribute('x2')) / 2, (+ln.getAttribute('y1') + +ln.getAttribute('y2')) / 2];
      let on = false;
      for (let i = 1; i < route.pts.length && !on; i++) on = near(q, route.pts[i - 1], route.pts[i]) < 1.5;
      ln.classList.toggle('on', on);
    });
  }
  showBand(l) { this.bands.forEach((p, i) => p.classList.toggle('show', i === l || (Array.isArray(l) && l.includes(i)))); }
  hot(id) { this.svg.querySelectorAll('.hot').forEach(x => x.classList.remove('hot')); if (id) this.svg.querySelectorAll(`[data-el="${id}"]`).forEach(x => x.classList.add('hot')); }
  setWalker(p, color) {
    if (!this.walker) {
      const g = sv('g', { class: 'walker' }, this.gTop);
      sv('circle', { r: 16, class: 'wring' }, g);
      sv('circle', { r: 9, class: 'wdot' }, g);
      this.walker = g;
    }
    this.walker.style.color = color || 'var(--hot)';
    this.walker.setAttribute('transform', `translate(${f1(p[0])} ${f1(p[1])})`);
  }
  hideWalker() { if (this.walker) { this.walker.remove(); this.walker = null; } }
}

/* place a loop symbol where it covers no label: search near the loop's centre */
function loopSpot(c, L, boxes) {
  if (!boxes.length) return L.c;
  const pts = routeGeometry(c, loopItems(L, 1)).pts, xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), R = 40;
  let best = L.c, bestCost = Infinity;
  for (const dy of [0, -30, 30, -60, 60, -90, 90, -120, 120]) for (const dx of [0, -25, 25, -50, 50]) {
    const x = L.c[0] + dx, y = L.c[1] + dy;
    if (x - R < x0 || x + R > x1 || y - R < y0 || y + R > y1) continue;
    let hit = 0;
    for (const b of boxes) {
      const w = Math.min(x + R, b.x + b.width) - Math.max(x - R, b.x), h = Math.min(y + R, b.y + b.height) - Math.max(y - R, b.y);
      if (w > 0 && h > 0) hit += w * h;
    }
    const cost = hit * 50 + Math.hypot(dx, dy);
    if (cost < bestCost) { bestCost = cost; best = [x, y]; }
  }
  return best;
}

/* crop the drawing to its content, measured once per circuit with every label shown */
function fitBox(c) {
  c._vb = `0 0 ${c.view.w} ${c.view.h}`;
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-99999px;top:0;width:1000px;visibility:hidden';
  document.body.appendChild(host);
  let vb = c._vb;
  try {
    const v = new CircuitView(host, c, { dirs: c.dir0, arrows: 'actual', loops: true, potential: { ground: c.ground } });
    v.unsub();
    const bb = v.svg.getBBox(), p = 18;
    if (bb.width > 0 && bb.height > 0) vb = `${f1(bb.x - p)} ${f1(bb.y - p)} ${f1(bb.width + 2 * p)} ${f1(bb.height + 2 * p)}`;
  } catch (e) { /* keep the default box */ }
  host.remove();
  return vb;
}

/* current along a plain-wire segment inside an (extended) node, positive i→j */
function nodeEdgeCurrent(c, n, i, j) {
  // component containing i when edge (i,j) is removed
  const comp = new Set([i]), q = [i];
  while (q.length) {
    const x = q.shift();
    for (const [a, b] of n.wires) {
      if ((a === i && b === j) || (a === j && b === i)) continue;
      const y = a === x ? b : b === x ? a : null;
      if (y !== null && !comp.has(y)) { comp.add(y); q.push(y); }
    }
  }
  let inflow = 0;
  c.branches.forEach(br => {
    if (br.to === n.id && comp.has(br.tp)) inflow += br.I;
    if (br.from === n.id && comp.has(br.fp)) inflow -= br.I;
  });
  return inflow;
}

/* ---------- walker that moves along a loop route ---------- */
class Tour {
  constructor(view, route, opts = {}) {
    this.view = view; this.route = route; this.o = opts; this.s = 0; this.token = 0;
  }
  place(s) {
    this.s = s;
    const at = pointAt(this.route.pts, this.route.cum, s);
    this.view.setWalker(at.p, this.o.color);
    if (this.o.coaster) this.o.coaster.setS(s);
    if (this.o.hotOnPass) {
      const r = this.route.elems.find(r2 => Math.abs(r2.s - s) <= r2.h + 4);
      this.view.hot(r ? r.e.id : null);
    }
  }
  animateTo(s1, speed = 230) {
    const tok = ++this.token, s0 = this.s, dur = Math.max(1, (Math.abs(s1 - s0) / speed) * 1000);
    return new Promise(res => {
      let t0 = null;
      const stop = Anim.add(t => {
        if (tok !== this.token) { stop(); res(false); return; }
        if (t0 === null) t0 = t;
        const f = Math.min(1, (t - t0) / dur), e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
        this.place(s0 + (s1 - s0) * e);
        if (f >= 1) { stop(); res(true); }
      });
    });
  }
  async loop(speed = 150, pause = 1200) {
    const tok = ++this.token;
    for (;;) {
      this.place(0);
      const t = this.token;
      const ok = await this.animateLinear(this.route.len, speed);
      if (!ok || t !== this.token) return;
      await wait(pause);
      if (t !== this.token) return;
    }
  }
  animateLinear(s1, speed) {
    const tok = this.token, s0 = this.s, dur = Math.max(1, (Math.abs(s1 - s0) / speed) * 1000);
    return new Promise(res => {
      let t0 = null;
      const stop = Anim.add(t => {
        if (tok !== this.token) { stop(); res(false); return; }
        if (t0 === null) t0 = t;
        const f = Math.min(1, (t - t0) / dur);
        this.place(s0 + (s1 - s0) * f);
        if (f >= 1) { stop(); res(true); }
      });
    });
  }
  stop() { this.token++; }
}
const wait = ms => new Promise(r => setTimeout(r, ms));

/* ---------- potential "rollercoaster" chart ---------- */
class Coaster {
  constructor(host, profile, opts = {}) {
    this.profile = profile; this.o = opts;
    const W = 640, H = 260, padL = 54, padR = 16, padT = 26, padB = 34;
    this.W = W; this.H = H;
    const len = profile[profile.length - 1][0];
    const vs = profile.map(p => p[1]);
    let vmin = Math.min(0, ...vs), vmax = Math.max(0, ...vs);
    if (vmax - vmin < 1) vmax = vmin + 1;
    const span = vmax - vmin; vmin -= span * 0.12; vmax += span * 0.18;
    const X = s => padL + ((W - padL - padR) * s) / len, Y = v => padT + ((H - padT - padB) * (vmax - v)) / (vmax - vmin);
    this.X = X; this.Y = Y;
    const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'coaster' }, host);
    this.svg = svg;
    // grid & axis
    const step = niceStep(vmax - vmin);
    for (let v = Math.ceil(vmin / step) * step; v <= vmax; v += step) {
      sv('line', { x1: padL, x2: W - padR, y1: Y(v), y2: Y(v), class: v === 0 ? 'cz' : 'cg' }, svg);
      const t = sv('text', { x: padL - 8, y: Y(v) + 4, 'text-anchor': 'end', class: 'cax' }, svg); t.textContent = `${fmtN(Math.round(v * 100) / 100)} V`;
    }
    const tl = sv('text', { x: padL, y: H - 8, class: 'cax' }, svg); tl.textContent = 'start';
    const tr = sv('text', { x: W - padR, y: H - 8, 'text-anchor': 'end', class: 'cax' }, svg); tr.textContent = 'back at start';
    // element bands + labels
    (opts.marks || []).forEach(m => {
      sv('rect', { x: X(m.s - m.h) - 2, y: padT - 6, width: X(m.s + m.h) - X(m.s - m.h) + 4, height: H - padT - padB + 6, class: 'cband' }, svg);
      const t = sv('text', { x: X(m.s), y: padT - 10, 'text-anchor': 'middle', class: 'cmark' }, svg);
      t.textContent = m.label;
      const dv = sv('text', { x: X(m.s), y: H - padB + 16, 'text-anchor': 'middle', class: 'cdv ' + (m.dv >= 0 ? 'up' : 'down') }, svg);
      dv.textContent = (m.dv >= 0 ? '+' : '−') + fmtN(Math.abs(m.dv)) + ' V';
    });
    sv('polyline', { points: ptsStr(profile.map(p => [X(p[0]), Y(p[1])])), class: 'cline-bg' }, svg);
    this.trace = sv('polyline', { points: '', class: 'cline', style: opts.color ? `stroke:${opts.color}` : '' }, svg);
    this.dot = sv('circle', { r: 7, class: 'cdot', style: opts.color ? `fill:${opts.color}` : '' }, svg);
    this.vtext = sv('text', { class: 'cval', 'text-anchor': 'start' }, svg);
    this.setS(0);
  }
  valueAt(s) {
    const p = this.profile;
    for (let i = 1; i < p.length; i++) {
      if (s <= p[i][0]) { const a = p[i - 1], b = p[i]; if (b[0] - a[0] < 1e-9) return b[1]; return a[1] + ((b[1] - a[1]) * (s - a[0])) / (b[0] - a[0]); }
    }
    return p[p.length - 1][1];
  }
  setS(s) {
    const pts = [];
    for (const q of this.profile) { if (q[0] <= s) pts.push(q); else break; }
    const v = this.valueAt(s);
    pts.push([s, v]);
    this.trace.setAttribute('points', ptsStr(pts.map(q => [this.X(q[0]), this.Y(q[1])])));
    this.dot.setAttribute('cx', this.X(s)); this.dot.setAttribute('cy', this.Y(v));
    const x = this.X(s);
    this.vtext.setAttribute('x', Math.min(x + 12, this.W - 70)); this.vtext.setAttribute('y', this.Y(v) - 12);
    this.vtext.textContent = `${fmtN(Math.round(v * 10) / 10)} V`;
  }
}
function niceStep(span) { const raw = span / 5, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }
