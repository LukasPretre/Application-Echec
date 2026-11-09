// Dedupe, classify themes, rate and export puzzles to js/data/puzzles.js
import { Chess } from 'chess.js';
import fs from 'node:fs';


const files = process.argv.slice(2);
const raw = files.flatMap((f) => fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)));
const V = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
const mv = (c, u) => c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || 'q' });
const seen = new Set();

const out = [];

function pieces(c, color) { const r = []; for (const row of c.board()) for (const s of row) if (s && s.color === color) r.push(s); return r; }
const DIRS = { b: [[1, 1], [1, -1], [-1, 1], [-1, -1]], r: [[1, 0], [-1, 0], [0, 1], [0, -1]] };
DIRS.q = [...DIRS.b, ...DIRS.r];
const sq = (f, r) => 'abcdefgh'[f] + (r + 1);

function themes(p) {
  const T = new Set();
  const c = new Chess(p.fen); mv(c, p.mistake);
  const solver = c.turn(), opp = solver === 'w' ? 'b' : 'w';
  const solverMoves = p.line.filter((_, i) => i % 2 === 0).length;
  const start = new Chess(c.fen());
  const first = start.move({ from: p.line[0].slice(0, 2), to: p.line[0].slice(2, 4), promotion: p.line[0][4] || 'q' });
  // mates
  const end = new Chess(c.fen()); let lastMove; for (const u of p.line) lastMove = mv(end, u);
  if (end.isCheckmate()) {
    T.add(solverMoves === 1 ? 'mate1' : solverMoves === 2 ? 'mate2' : 'mate3');
    const k = pieces(end, opp).find((x) => x.type === 'k');
    const backRank = opp === 'w' ? '1' : '8';
    if ((lastMove.piece === 'r' || lastMove.piece === 'q') && k.square[1] === backRank && lastMove.to[1] === backRank) T.add('backrank');
    if (lastMove.piece === 'n') {
      const f = 'abcdefgh'.indexOf(k.square[0]), r = +k.square[1] - 1; let blocked = true;
      for (let df = -1; df <= 1; df++) for (let dr = -1; dr <= 1; dr++) { if (!df && !dr) continue; const ff = f + df, rr = r + dr; if (ff < 0 || ff > 7 || rr < 0 || rr > 7) continue; const pc = end.get(sq(ff, rr)); if (!pc || pc.color !== opp) blocked = false; }
      if (blocked) T.add('smothered');
    }
  }
  if (p.line.some((u, i) => i % 2 === 0 && u.length === 5)) T.add('promotion');
  // first move analysis
  const after = start; // position after solver's first move
  const to = first.to, me = first.piece;
  // fork
  let targets = 0;
  for (const e of pieces(after, opp)) {
    if (!after.attackers(e.square, solver).includes(to)) continue;
    const defended = after.attackers(e.square, opp).length > 0;
    if (e.type === 'k' || V[e.type] > V[me] || (!defended && V[e.type] >= 3)) targets++;
  }
  if (targets >= 2 && me !== 'k') T.add('fork');
  // pin / skewer
  if ('brq'.includes(me)) {
    for (const [df, dr] of DIRS[me]) {
      let f = 'abcdefgh'.indexOf(to[0]) + df, r = +to[1] - 1 + dr; const hit = [];
      while (f >= 0 && f < 8 && r >= 0 && r < 8 && hit.length < 2) { const pc = after.get(sq(f, r)); if (pc) { if (pc.color !== opp) break; hit.push(pc); } f += df; r += dr; }
      if (hit.length === 2) {
        const [x, y] = hit;
        if (x.type !== 'k' && V[y.type] > V[x.type] && V[y.type] >= 5) T.add('pin');
        if ((x.type === 'k' || (x.type === 'q' && V[x.type] > V[y.type])) && V[y.type] >= 3) T.add('skewer');
      }
    }
  }
  // discovered attack
  const before = new Chess(c.fen());
  for (const e of pieces(after, opp).filter((x) => x.type === 'k' || x.type === 'q' || x.type === 'r')) {
    const now = after.attackers(e.square, solver).filter((s) => s !== to);
    const was = before.attackers(e.square, solver);
    if (now.some((s) => !was.includes(s))) T.add('discovered');
  }
  // hanging piece
  if (solverMoves === 1 && first.captured && !T.has('mate1')) {
    const defenders = before.attackers(first.to, opp);
    if (!defenders.length) T.add('hanging');
  }
  if (!T.size || (T.size === 1 && T.has('promotion'))) T.add('material');
  if (!first.captured && !first.san.includes('+')) T.add('quiet');
  return [...T];
}

let i = 0;
for (const p of raw) {
  const c = new Chess(p.fen); mv(c, p.mistake);
  const key = c.fen().split(' ').slice(0, 2).join(' ');
  if (seen.has(key)) continue; seen.add(key);
  const T = themes(p);
  const solverMoves = p.line.filter((_, k) => k % 2 === 0).length;
  const st = new Chess(c.fen());
  const nLegal = st.moves().length;
  const first = st.move({ from: p.line[0].slice(0, 2), to: p.line[0].slice(2, 4), promotion: p.line[0][4] || 'q' });
  let rating;
  if (T.includes('mate1')) rating = 600; else if (T.includes('mate2')) rating = 1000; else if (T.includes('mate3')) rating = 1350;
  else if (T.includes('hanging')) rating = 420 + (first.captured === 'q' ? -40 : first.captured === 'p' ? 120 : 40);
  else rating = 650 + 300 * (solverMoves - 1);
  if (T.includes('quiet')) rating += 250;
  if (first.san.includes('+')) rating -= 60;
  if (first.captured && !T.includes('hanging')) rating += 80;
  if (['fork', 'pin', 'skewer', 'discovered'].some((t) => T.includes(t))) rating += 100;
  if (first.piece === 'k') rating += 150;
  rating += Math.max(0, nLegal - 25) * 4;
  rating = Math.max(350, Math.min(2300, Math.round((rating + (Math.random() - 0.5) * 100) / 10) * 10));
  out.push([out.length + 1, p.fen, p.mistake, p.line.join(' '), rating, T.join(' ')]);
  if (++i % 50 === 0) process.stderr.write(i + '\n');
}
out.sort((a, b) => a[4] - b[4]);
out.forEach((p, k) => (p[0] = k + 1));
fs.writeFileSync(new URL('../js/data/puzzles.js', import.meta.url),
  '// Generated by tools/finalize-puzzles.mjs — every solution verified with Stockfish 19\n// [id, fen before opponent move, opponent move, solution (uci), rating, themes]\nexport const PUZZLES = [\n' + out.map((p) => JSON.stringify(p)).join(',\n') + '\n];\n');
const count = {}; out.forEach((p) => p[5].split(' ').forEach((t) => (count[t] = (count[t] || 0) + 1)));
const hist = {}; out.forEach((p) => { const b = Math.floor(p[4] / 200) * 200; hist[b] = (hist[b] || 0) + 1; });
console.log(out.length, count, hist);
process.exit(0);
