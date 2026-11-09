// Generates tactical puzzles from Stockfish self-play with injected mistakes.
// Every puzzle: start FEN (before opponent's mistake), the mistake, then solver line verified as "only move".
import { Chess } from 'chess.js';
import fs from 'node:fs';
import { Engine, val } from './engine.mjs';

const OUT = process.argv[2] || 'puzzles-raw.jsonl';
const GAMES = +(process.argv[3] || 100);
const SEED = +(process.argv[4] || 1);
let s = SEED * 9301 + 49297;
const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
const pick = (a) => a[Math.floor(rnd() * a.length)];

const V = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
function material(ch, color) {
  let m = 0;
  for (const row of ch.board()) for (const sq of row) if (sq) m += (sq.color === color ? 1 : -1) * V[sq.type];
  return m;
}
const uciMove = (ch, u) => ch.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || 'q' });

const eng = new Engine();
await eng.init();
const out = fs.createWriteStream(OUT, { flags: 'a' });
const seen = new Set(); const stat={c1:0,c2:0,c3:0};

async function buildLine(fen, first) {
  const ch = new Chess(fen);
  const solver = ch.turn();
  const mat0 = material(ch, solver);
  const line = [];
  let a = first;
  const isMate = val(a[0]) > 90000;
  for (let i = 0; i < (isMate ? 5 : 3); i++) {
    {
      if (i > 0) a = await eng.analyse(ch.fen(), { depth: 14, multipv: 2 });
      if (!a.length) break;
      if (isMate && !(a[0].mate > 0)) return null;
      if (!isMate && i === 0 && val(a[0]) < 250) return null;
      const b = val(a[0]), s2 = a[1] ? val(a[1]) : -1e9;
      const unique = isMate ? !(a[1] && a[1].mate !== null && a[1].mate > 0 && a[1].mate <= a[0].mate) || a[0].mate === 1
                            : s2 < b - 200 && s2 < 250;
      if (!unique) { if (isMate) return null; break; }
    }
    const mv = a[0].move;
    const san = uciMove(ch, mv).san;
    line.push(mv);
    if (ch.isCheckmate()) return { line, mate: true, solver };
    if (isMate) {
      const r = await eng.analyse(ch.fen(), { depth: 12 });
      if (!r.length) return null;
      line.push(r[0].move); uciMove(ch, r[0].move);
      continue;
    }
    // non-mate: should we continue? Only if position still forcing
    const r = await eng.analyse(ch.fen(), { depth: 12, multipv: 1 });
    if (!r.length) break;
    const reply = r[0].move;
    const replyMove = new Chess(ch.fen()).move({ from: reply.slice(0, 2), to: reply.slice(2, 4), promotion: reply[4] || 'q' });
    const forcing = san.includes('+') || replyMove.san.includes('x') || replyMove.san.includes('+');
    // material after opponent best reply
    const tmp = new Chess(ch.fen()); uciMove(tmp, reply);
    const gain = material(tmp, solver) - mat0;
    if (gain >= 2 && !replyMove.san.includes('x')) return { line, mate: false, solver, gain };
    if (!forcing || i === 2) {
      return gain >= 2 ? { line, mate: false, solver, gain } : null;
    }
    line.push(reply); uciMove(ch, reply);
  }
  if (isMate) return null;
  // ended due to non-unique continuation: line ends with opponent move -> trim
  if (line.length % 2 === 0) line.pop();
  const ch2 = new Chess(fen); for (const m of line) uciMove(ch2, m);
  const r = await eng.analyse(ch2.fen(), { depth: 12 });
  if (r.length) uciMove(ch2, r[0].move);
  const gain = material(ch2, solver) - mat0;
  return gain >= 2 && line.length ? { line, mate: false, solver, gain } : null;
}

for (let g = 0; g < GAMES; g++) {
  const ch = new Chess();
  for (let ply = 0; ply < 140 && !ch.isGameOver(); ply++) {
    const prevFen = ch.fen();
    let mv;
    const a0 = await eng.analyse(prevFen, { depth: 8, multipv: 4 });
    if (!a0.length) break;
    if (ply < 8) {
      const ok = a0.filter((x) => val(x) > val(a0[0]) - 50);
      mv = pick(ok).move;
    } else if (Math.abs(val(a0[0])) < 150 && rnd() < 0.3) {
      if (process.argv[5] === 'plausible') {
        const sh = await eng.analyse(prevFen, { depth: 1 + Math.floor(rnd() * 3), multipv: 5 });
        mv = pick(sh).move;
      } else {
        const m = pick(ch.moves({ verbose: true }));
        mv = m.from + m.to + (m.promotion || '');
      }
    } else if (Math.abs(val(a0[0])) >= 300 && !(process.argv[5] === 'mates')) {
      break; // game already decided, start a new one
    } else if ((process.argv[5] === 'mates') && rnd() < 0.25) {
      const sh = await eng.analyse(prevFen, { depth: 1 + Math.floor(rnd() * 2), multipv: 5 });
      mv = pick(sh).move;
    } else {
      const ok = a0.filter((x) => val(x) > val(a0[0]) - 30);
      mv = pick(ok).move;
    }
    uciMove(ch, mv);
    if (ch.isGameOver()) break;
    if (ply < 6) continue;
    const a = await eng.analyse(ch.fen(), { depth: 11, multipv: 2 });
    if (!a.length) continue;
    const best = val(a[0]), second = a[1] ? val(a[1]) : -1e9;
    if (best < 250) continue; stat.c1++;
    if ((process.argv[5] === 'mates') && !(a[0].mate > 0 && a[0].mate <= 4)) continue;
    const unique = best > 90000 ? !(a[1] && a[1].mate !== null && a[1].mate > 0) || a[0].mate === 1 : (second < best - 250 && second < 300);
    if (!unique) continue; stat.c2++;
    // solver must not already be winning before the mistake
    const before = await eng.analyse(prevFen, { depth: 12 });
    if (!before.length || ((process.argv[5] === 'mates') ? -val(before[0]) > 90000 : -val(before[0]) > 120)) continue; stat.c3++;
    if (seen.has(ch.fen())) continue;
    seen.add(ch.fen());
    const confirm = await eng.analyse(ch.fen(), { depth: 15, multipv: 2 });
    const res = await buildLine(ch.fen(), confirm);
    if (res && res.line.length) {
      const rec = { fen: prevFen, mistake: mv, line: res.line, mate: res.mate, gain: res.gain || 0, eval: confirm[0] };
      out.write(JSON.stringify(rec) + '\n');
    }
    // after a puzzle position, keep playing; the game diverges anyway
  }
  process.stderr.write(JSON.stringify(stat)+` game ${g + 1}/${GAMES}\n`);
}
out.end();
eng.quit();
process.exit(0);
