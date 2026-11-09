// Stockfish (WASM, single thread) wrapper running in a Web Worker.
let worker = null;
const listeners = new Set();
let ready = null;
let queue = Promise.resolve();
let opts = {};

function boot() {
  if (ready) return ready;
  worker = new Worker('engine/stockfish-19-lite-single.js');
  worker.onmessage = (e) => { const line = typeof e.data === 'string' ? e.data : ''; for (const l of [...listeners]) l(line); };
  ready = new Promise((res) => {
    const l = (line) => { if (line === 'uciok') { listeners.delete(l); send('setoption name Hash value 16'); res(); } };
    listeners.add(l);
    send('uci');
  });
  return ready;
}
function send(c) { worker.postMessage(c); }
function setOpt(name, value) { if (opts[name] !== value) { opts[name] = value; send(`setoption name ${name} value ${value}`); } }

export function val(s) {
  if (!s) return 0;
  if (s.mate !== null && s.mate !== undefined) return s.mate > 0 ? 100000 - s.mate * 100 : -100000 - s.mate * 100;
  return s.cp;
}
// Win probability (0..100) for side to move, lichess formula
export function winPct(s) {
  const v = typeof s === 'number' ? s : val(s);
  const cp = Math.max(-1000, Math.min(1000, v));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

let current = null;
export function stop() { if (current) send('stop'); }

/**
 * analyse(fen, {depth, movetime, multipv, skill, onInfo})
 * returns {lines:[{move,pv,cp,mate,depth}], bestmove}
 * Scores are from the side-to-move perspective.
 */
export function analyse(fen, o = {}) {
  const job = queue.then(() => boot()).then(() => new Promise((res) => {
    if (o.stale && o.stale()) return res({ lines: [], bestmove: null });
    setOpt('MultiPV', o.multipv || 1);
    setOpt('Skill Level', o.skill ?? 20);
    const lines = {};
    const l = (line) => {
      if (line.startsWith('info') && line.includes(' pv ')) {
        const k = +(line.match(/ multipv (\d+)/)?.[1] || 1);
        const sc = line.match(/score (cp|mate) (-?\d+)/);
        if (!sc) return;
        const pv = line.split(' pv ')[1].trim().split(' ');
        lines[k] = { move: pv[0], pv, cp: sc[1] === 'cp' ? +sc[2] : null, mate: sc[1] === 'mate' ? +sc[2] : null, depth: +(line.match(/ depth (\d+)/)?.[1] || 0) };
        o.onInfo && o.onInfo(lines[k], k);
      } else if (line.startsWith('bestmove')) {
        listeners.delete(l); current = null;
        const bm = line.split(' ')[1];
        res({ lines: Object.keys(lines).sort((a, b) => a - b).map((k) => lines[k]), bestmove: bm === '(none)' ? null : bm });
      }
    };
    listeners.add(l);
    current = l;
    send(`position fen ${fen}`);
    if (o.movetime && !o.depth) send(`go movetime ${o.movetime}`);
    else if (o.movetime) send(`go depth ${o.depth} movetime ${o.movetime}`);
    else send(`go depth ${o.depth || 12}`);
  }));
  queue = job.catch(() => {});
  return job;
}
export function newGame() { queue = queue.then(() => boot()).then(() => send('ucinewgame')); }
export function warmup() { boot(); }
