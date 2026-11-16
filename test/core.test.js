const C = require('../src/core.js');
let fails = 0, total = 0;
const t0 = Date.now();
const hist = {};
for (const level of [1,2,3,4]) {
  let negCount = 0, maxSteps = 0, gens = 0;
  for (let seed = 1; seed <= 1500; seed++) {
    const c = C.generate(level, seed); gens++;
    // try default dirs and some random flips
    for (let trial = 0; trial < 4; trial++) {
      total++;
      const dirs = trial === 0 ? c.dir0.slice() : c.dir0.map((d,i)=> ((seed*31+i*7+trial*13)%3===0 ? -d : d));
      const loopDirs = c.loops.map((_,l)=> trial===3 && l===0 ? -1 : 1);
      const m = C.buildModel(c, dirs, loopDirs);
      const ok = m.solve.values.every((v,i)=> Math.abs(v - m.sol[i]) < 1e-9);
      // verify equations hold for sol
      const eqOk = m.eqs.every(e => Math.abs(e.c.reduce((s,a,i)=>s+a*m.sol[i],0) - e.r) < 1e-9);
      // potentials: loop sum zero
      const P = C.potentials(c, c.ground);
      const potOk = c.branches.every((br,b) => Math.abs(P.V[br.from] + P.delta[b] - P.V[br.to]) < 1e-9);
      // counts
      const countOk = m.eqs.length === c.nB;
      // tex
      let texOk = true;
      for (const st of m.solve.steps) for (const bl of st.blocks) for (const ln of bl.lines) { const x = C.MD(ln.tex); if (x.includes('tx-err')) { texOk = false; console.log('TEXERR', ln.tex); } }
      if (!m.solve.values.every(v => Number.isInteger(v))) { texOk = false; console.log('nonint', level, seed, m.solve.values); }
      if (trial===0) { if (m.sol.some(v=>v<0)) negCount++; maxSteps = Math.max(maxSteps, m.solve.steps.length); }
      if (!(ok && eqOk && potOk && countOk && texOk)) { fails++; if (fails < 5) console.log('FAIL', {level, seed, trial, ok, eqOk, potOk, countOk, texOk, vals: m.solve.values, sol: m.sol}); }
    }
    const key = 'L'+level; hist[key] = hist[key] || {E:[], R:[]};
    c.E.forEach(e=>hist[key].E.push(e.val)); c.R.forEach(e=>hist[key].R.push(e.val));
  }
  console.log(`level ${level}: ${gens} circuits, with a negative answer: ${(100*negCount/gens).toFixed(0)}%, max solve steps: ${maxSteps}`);
}
for (const k in hist) { const E = hist[k].E; console.log(k, 'emf range', Math.min(...E), '-', Math.max(...E), ' avg', (E.reduce((a,b)=>a+b,0)/E.length).toFixed(1)); }
console.log(`total ${total} checks, fails ${fails}, ${Date.now()-t0} ms`);
// sample
const c = C.generate(2, 42); const m = C.buildModel(c, c.dir0, [1,1]);
console.log('L2 seed42 sol', m.sol, 'E', c.E.map(e=>e.val+e.plus), 'R', c.R.map(e=>e.val));
for (const st of m.solve.steps) { console.log('##', st.title.replace(/<[^>]+>/g,'')); for (const bl of st.blocks) for (const ln of bl.lines) console.log('   ', ln.note.replace(/<[^>]+>/g,''), '|', ln.tex, ln.tag); }
console.log(C.M('\\I{1} + \\I{2} = -3\\unit{A}'));
console.log(C.MD('\\begin{bmatrix} 1 & -1 \\\\ 2 & 3 \\end{bmatrix}'));
