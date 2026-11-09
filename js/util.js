import { Chess } from './lib/chess.js';
import { Board } from './board.js';
export { Chess };

// ---------- storage ----------
const KEY = 'echecs-coach-v1';
const DEF = { puzzleRating: 700, puzzleHist: {}, puzzleCount: 0, puzzleSolved: 0, streak: 0, bestStreak: 0,
  lessons: {}, openings: {}, games: [], mistakes: [], settings: { sound: true, coach: true, bot: 2, color: 'w' }, days: {} };
let state;
try { state = Object.assign(structuredClone(DEF), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { state = structuredClone(DEF); }
state.settings = Object.assign({}, DEF.settings, state.settings);
export const store = {
  get s() { return state; },
  save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} },
  activity(kind, n = 1) {
    const d = new Date().toISOString().slice(0, 10);
    state.days[d] = state.days[d] || {}; state.days[d][kind] = (state.days[d][kind] || 0) + n; this.save();
  },
  today() { return state.days[new Date().toISOString().slice(0, 10)] || {}; },
};

// ---------- notation ----------
const FR = { K: 'R', Q: 'D', R: 'T', B: 'F', N: 'C' };
export const fr = (san) => san ? san.replace(/^[KQRBN]/, (c) => FR[c]).replace(/=([QRBN])/, (m, c) => '=' + FR[c]) : '';
export const PIECE = { p: 'pion', n: 'cavalier', b: 'fou', r: 'tour', q: 'dame', k: 'roi' };
export const PIECE_UN = { p: 'un pion', n: 'un cavalier', b: 'un fou', r: 'une tour', q: 'la dame', k: 'le roi' };
export const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export function uciToSan(fen, uci) {
  try { const c = new Chess(fen); return c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q' }).san; } catch (e) { return uci; }
}
export function pvToSan(fen, pv, n = 6) {
  const c = new Chess(fen); const out = [];
  for (const u of pv.slice(0, n)) {
    try { const m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || 'q' }); out.push(m); } catch (e) { break; }
  }
  return out;
}
export function fmtLine(fen, moves) { // moves: verbose moves list starting at fen
  const c = new Chess(fen); let num = +fen.split(' ')[5]; let turn = fen.split(' ')[1]; const parts = [];
  moves.forEach((m, i) => {
    if (turn === 'w') parts.push(num + '.' + fr(m.san)); else parts.push((i === 0 ? num + '…' : '') + fr(m.san));
    if (turn === 'b') num++;
    turn = turn === 'w' ? 'b' : 'w';
  });
  return parts.join(' ');
}
export function material(fen) {
  const m = { w: 0, b: 0 };
  for (const ch of fen.split(' ')[0]) { const l = ch.toLowerCase(); if (VAL[l] !== undefined && l !== ch) m.w += VAL[l]; else if (VAL[l] !== undefined) m.b += VAL[l]; }
  return m;
}
export function kingSquare(chess, color) {
  for (const row of chess.board()) for (const sq of row) if (sq && sq.type === 'k' && sq.color === color) return sq.square;
  return null;
}

// ---------- dom ----------
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
export function toast(msg, ms = 2200) { const t = h(`<div class="toast">${msg}</div>`); document.body.appendChild(t); setTimeout(() => t.remove(), ms); }
export function modal(html, buttons = []) {
  return new Promise((res) => {
    const bg = h(`<div class="modal-bg"><div class="modal">${html}<div class="flex" style="justify-content:center;margin-top:16px"></div></div></div>`);
    const bar = bg.querySelector('.flex');
    for (const [label, val, cls] of buttons) { const b = h(`<button class="btn ${cls || ''}">${label}</button>`); b.onclick = () => { bg.remove(); res(val); }; bar.appendChild(b); }
    bg.addEventListener('click', (e) => { if (e.target === bg) { bg.remove(); res(null); } });
    document.body.appendChild(bg);
  });
}
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- sound ----------
let ac;
export function sound(kind = 'move') {
  if (!store.s.settings.sound) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const t = ac.currentTime;
    const tone = (f, d, g, type = 'sine', at = 0) => {
      const o = ac.createOscillator(), v = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t + at); v.gain.setValueAtTime(g, t + at); v.gain.exponentialRampToValueAtTime(0.0001, t + at + d);
      o.connect(v).connect(ac.destination); o.start(t + at); o.stop(t + at + d);
    };
    if (kind === 'move') { tone(520, .07, .25, 'triangle'); tone(180, .05, .2, 'sine'); }
    else if (kind === 'capture') { tone(300, .1, .35, 'square'); tone(140, .08, .3); }
    else if (kind === 'check') { tone(700, .09, .2, 'triangle'); tone(900, .12, .15, 'triangle', .08); }
    else if (kind === 'good') { tone(660, .12, .2, 'triangle'); tone(880, .18, .2, 'triangle', .1); tone(1320, .25, .15, 'triangle', .2); }
    else if (kind === 'bad') { tone(240, .2, .25, 'sawtooth'); tone(180, .3, .2, 'sawtooth', .12); }
    else if (kind === 'end') { tone(440, .2, .2); tone(554, .2, .2, 'sine', .15); tone(659, .35, .2, 'sine', .3); }
  } catch (e) {}
}
export function moveSound(m, chess) {
  if (chess && chess.isCheck()) sound('check'); else if (m.captured) sound('capture'); else sound('move');
}

// ---------- board bound to a chess.js game ----------
// opts: {orientation, canMove: () => color|'both'|null, onMove(moveObj, animate)}
export function gameBoard(el, game, opts = {}) {
  const b = new Board(el, {
    orientation: opts.orientation || 'w',
    movable: (sq) => {
      const who = opts.canMove ? opts.canMove() : game.turn();
      if (!who) return false;
      const p = game.get(sq); if (!p) return false;
      return p.color === game.turn() && (who === 'both' || who === p.color);
    },
    targets: (sq) => game.moves({ square: sq, verbose: true }).map((m) => m.to),
    onMove: (from, to, promo, animate) => {
      let m;
      try { m = game.move({ from, to, promotion: promo || 'q' }); } catch (e) { m = null; }
      if (!m) { sync(false); return; }
      if (opts.intercept && opts.intercept(m) === false) { game.undo(); sync(false); return; }
      sync(animate, m);
      moveSound(m, game);
      opts.onMove && opts.onMove(m, animate);
    },
  });
  function sync(animate = false, m = null) {
    const last = m || game.history({ verbose: true }).slice(-1)[0];
    b.set(game.fen(), { lastMove: last ? [last.from, last.to] : null, animate, check: game.isCheck() ? kingSquare(game, game.turn()) : null });
  }
  b.sync = sync;
  sync();
  return b;
}
export function boardShow(b, fen, last, animate = false) {
  const c = new Chess(fen);
  b.set(fen, { lastMove: last ? [last.from, last.to] : null, animate, check: c.isCheck() ? kingSquare(c, c.turn()) : null });
}

// eval bar helper
export function evalText(line, turn) {
  if (!line) return '';
  const sgn = turn === 'w' ? 1 : -1;
  if (line.mate === 0) return '#';
  if (line.mate !== null && line.mate !== undefined) return (line.mate * sgn > 0 ? '' : '-') + 'M' + Math.abs(line.mate);
  const v = line.cp * sgn / 100; return (v > 0 ? '+' : '') + v.toFixed(1);
}
export function whitePct(line, turn) {
  if (!line) return 50;
  const sgn = turn === 'w' ? 1 : -1;
  if (line.mate === 0) return turn === 'w' ? 0 : 100;
  if (line.mate !== null && line.mate !== undefined) return line.mate * sgn > 0 ? 100 : 0;
  const cp = Math.max(-1000, Math.min(1000, line.cp * sgn));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}
