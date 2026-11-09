// Validates lessons and openings: legality + engine soundness.
import { Chess } from 'chess.js';
import { Engine, val } from './engine.mjs';
const root = new URL('../js/data/', import.meta.url).href;
const { MODULES } = await import(root + 'lessons.js');
const { REPERTOIRES } = await import(root + 'openings.js');

const eng = new Engine(); await eng.init();
let problems = 0;
const warn = (...a) => { problems++; console.log('⚠️ ', ...a); };

async function lossOf(fen, san) {
  const ch = new Chess(fen);
  const a = await eng.analyse(fen, { depth: 14 });
  const best = val(a[0]);
  const m = ch.move(san);
  if (ch.isCheckmate()) return { loss: 0, best, after: 100000, bestMove: a[0].move };
  const b = await eng.analyse(ch.fen(), { depth: 14 });
  const after = -val(b[0]);
  return { loss: best - after, best, after, bestMove: a[0].move, uci: m.from + m.to };
}

for (const mod of MODULES) for (const les of mod.lessons) for (const [i, st] of les.steps.entries()) {
  const where = `${les.id}#${i}`;
  let ch;
  try {
    ch = st.fen ? new Chess(st.fen) : new Chess();
    if (st.pgn) for (const m of st.pgn.split(' ')) ch.move(m);
  } catch (e) { warn(where, 'bad position', e.message); continue; }
  if (ch.isCheck() && st.fen) { /* side to move in check is legal */ }
  // side not to move must not be in check
  const parts = ch.fen().split(' '); parts[1] = parts[1] === 'w' ? 'b' : 'w'; parts[3] = '-';
  try { const t = new Chess(parts.join(' ')); if (t.isCheck()) warn(where, 'side not to move is in check (illegal)'); } catch (e) {}
  if (st.task) {
    const start = ch.fen();
    const c2 = new Chess(start);
    for (const [k, m] of st.task.moves.entries()) {
      try {
        if (k % 2 === 0) {
          const r = await lossOf(c2.fen(), m);
          if (r.loss > 60 && r.best < 90000) warn(where, `move ${m} loses ${r.loss}cp (best ${r.bestMove})`);
          if (r.best > 90000 && r.after < 90000) warn(where, `move ${m} misses mate (best ${r.bestMove})`);
        }
        c2.move(m);
      } catch (e) { warn(where, 'illegal task move', m, e.message); break; }
    }
    for (const m of st.task.accept || []) {
      try {
        const r = await lossOf(start, m);
        if (r.loss > 120) warn(where, `accepted ${m} loses ${r.loss}cp (best ${r.bestMove}, best eval ${r.best})`);
      } catch (e) { warn(where, 'illegal accept', m); }
    }
    console.log('ok task', where, st.task.moves.join(' '));
  }
}

for (const rep of REPERTOIRES) for (const line of rep.lines) {
  const ch = new Chess();
  for (const [k, [san]] of line.moves.entries()) {
    const mySide = (k % 2 === 0 ? 'w' : 'b') === rep.side;
    try {
      if (mySide) {
        const r = await lossOf(ch.fen(), san);
        if (r.loss > 70) warn(line.id, `ply ${k + 1} ${san} loses ${r.loss}cp (best ${r.bestMove})`);
      }
      ch.move(san);
    } catch (e) { warn(line.id, 'illegal', san, e.message); break; }
  }
  const a = await eng.analyse(ch.fen(), { depth: 14 });
  const ev = val(a[0]) * (ch.turn() === rep.side ? 1 : -1);
  console.log(`line ${line.id}: final eval for me ${ev}`);
  if (ev < -80) warn(line.id, 'final position bad for me', ev);
}
console.log('problems:', problems);
eng.quit(); process.exit(0);
