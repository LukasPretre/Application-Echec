// Move classification + plain-French explanations
import { Chess, fr, uciToSan, pvToSan, fmtLine, PIECE, VAL } from './util.js';
import { analyse, winPct, val } from './engine.js';

export const CLS = {
  brilliant: { label: 'Brillant', sym: '!!', color: 'var(--brill)' },
  best: { label: 'Meilleur coup', sym: '★', color: 'var(--best)' },
  excellent: { label: 'Excellent', sym: '!', color: 'var(--excellent)' },
  good: { label: 'Bon coup', sym: '✓', color: 'var(--good)' },
  book: { label: 'Théorie', sym: '📖', color: 'var(--book)' },
  inacc: { label: 'Imprécision', sym: '?!', color: 'var(--inacc)' },
  mistake: { label: 'Erreur', sym: '?', color: 'var(--mistake)' },
  miss: { label: 'Coup manqué', sym: '✗', color: 'var(--miss)' },
  blunder: { label: 'Gaffe', sym: '??', color: 'var(--blunder)' },
};
export const CLS_HEX = { brilliant: '#26c2a3', best: '#81b64c', excellent: '#96bc4b', good: '#97af8b', book: '#a88865', inacc: '#f7c631', mistake: '#ffa459', miss: '#ff7769', blunder: '#fa412d' };
export const clsIcon = (c) => `<span class="cls" style="background:${CLS[c].color}">${CLS[c].sym === '📖' ? '≡' : CLS[c].sym}</span>`;

const cache = new Map();
export function evalPos(fen, depth = 12) {
  const k = depth + '|' + fen;
  if (!cache.has(k)) {
    const c = new Chess(fen);
    if (c.isGameOver()) {
      const r = { lines: [c.isCheckmate() ? { move: null, pv: [], cp: null, mate: 0 } : { move: null, pv: [], cp: 0, mate: null }] };
      cache.set(k, Promise.resolve(r));
    } else cache.set(k, analyse(fen, { depth, multipv: 2 }));
    if (cache.size > 400) cache.delete(cache.keys().next().value);
  }
  return cache.get(k);
}
// score of a line from the side-to-move perspective; mate 0 = side to move is mated
export function lineVal(l) { if (!l) return 0; if (l.mate === 0) return -100000; return val(l); }

/**
 * Evaluate a move. before = analysis lines of fenBefore, after = analysis lines of position after the move.
 * Returns {cls, loss, winBefore, winAfter, best, bestSan}
 */
export function judge(fenBefore, move, before, after, ctx = {}) {
  const best = before[0];
  const vBest = lineVal(best);
  const vAfter = -lineVal(after[0]);
  const wBest = winPct(vBest), wAfter = winPct(vAfter);
  const loss = Math.max(0, wBest - wAfter);
  const uci = move.from + move.to + (move.promotion || '');
  let cls;
  const isBest = best && best.move && (best.move === uci || best.move === move.from + move.to);
  if (isBest) cls = 'best';
  else if (loss < 2) cls = 'excellent';
  else if (loss < 5) cls = 'good';
  else if (loss < 10) cls = 'inacc';
  else if (loss < 20) cls = 'mistake';
  else cls = 'blunder';
  // a mate kept is never a mistake
  if (vBest > 90000 && vAfter > 90000 && cls !== 'best') cls = 'excellent';
  // missed opportunity: opponent had just erred, we had a big advantage available and let it go
  if ((cls === 'mistake' || cls === 'blunder' || cls === 'inacc') && ctx.prevOppLoss >= 10 && wBest >= 65 && wAfter < 60) cls = 'miss';
  // sacrifice that is best and wins: "brilliant"
  if (cls === 'best' && ctx.allowBrilliant && move.piece !== 'p' && isSacrifice(fenBefore, move) && wAfter >= 55) cls = 'brilliant';
  if (ctx.book) cls = 'book';
  return { cls, loss, wBest, wAfter, best, bestSan: best && best.move ? uciToSan(fenBefore, best.move) : null };
}

function isSacrifice(fen, move) {
  // the moved piece can be captured by a lower-value piece, or is left undefended and attacked, and we did not capture something worth as much
  const c = new Chess(fen); c.move(move);
  const gained = move.captured ? VAL[move.captured] : 0;
  const mine = VAL[move.piece];
  if (mine - gained < 2) return false;
  const attackers = c.moves({ verbose: true }).filter((m) => m.to === move.to && m.captured);
  return attackers.length > 0;
}

function capWord(p) { return { p: 'un pion', n: 'un cavalier', b: 'un fou', r: 'une tour', q: 'la dame', k: 'le roi' }[p]; }

/** Plain French explanation */
export function explain(fenBefore, move, j, after, opts = {}) {
  const me = opts.you === false ? 'Ce coup' : 'Ton coup';
  const afterFen = (() => { const c = new Chess(fenBefore); c.move(move); return c.fen(); })();
  const oppLine = after[0] && after[0].pv ? pvToSan(afterFen, after[0].pv, 5) : [];
  const bestLine = j.best && j.best.pv ? pvToSan(fenBefore, j.best.pv, 5) : [];
  const out = [];
  const c = new Chess(afterFen);
  if (c.isCheckmate()) return 'Échec et mat ! 🎉';
  if (['best', 'excellent', 'good', 'brilliant', 'book'].includes(j.cls)) {
    if (j.cls === 'book') out.push("C'est un coup de théorie : il fait partie des ouvertures connues.");
    else if (j.cls === 'brilliant') out.push('Un sacrifice brillant, et c\'est le meilleur coup !');
    else if (j.cls === 'best') out.push("C'est le meilleur coup.");
    else if (j.cls === 'excellent') out.push('Excellent coup, presque aussi bon que le meilleur.');
    else out.push('Bon coup.');
    if (move.captured) out.push(`Tu prends ${capWord(move.captured)}.`);
    const bv = lineVal(j.best);
    if (bv > 90000 && j.best.mate > 0 && j.cls === 'best') out.push(`Il y a un mat en ${j.best.mate} : continue !`);
    if (j.cls === 'good' && j.bestSan) out.push(`Le meilleur était <b>${fr(j.bestSan)}</b>.`);
    return out.join(' ');
  }
  // what goes wrong
  const opp = after[0];
  if (opp && opp.mate !== null && opp.mate > 0) {
    out.push(`${me} permet à l'adversaire de <b>mater en ${opp.mate}</b> : ${fmtLine(afterFen, oppLine.slice(0, opp.mate * 2 - 1))}.`);
  } else if (oppLine[0]) {
    const r = oppLine[0];
    if (r.captured && r.to === move.to) out.push(`${me} laisse ${move.piece === 'r' || move.piece === 'q' ? 'ta' : 'ton'} ${PIECE[move.piece]} en ${move.to} <b>sans défense</b> : l'adversaire répond <b>${fr(r.san)}</b>.`);
    else if (r.captured) out.push(`Après ${me === 'Ton coup' ? 'ton coup' : 'ce coup'}, l'adversaire peut jouer <b>${fr(r.san)}</b> et prendre ${capWord(r.captured)}.`);
    else if (r.san.includes('+')) out.push(`L'adversaire a <b>${fr(r.san)}</b> avec échec, qui lui donne l'avantage (${fmtLine(afterFen, oppLine.slice(0, 3))}).`);
    else if (j.cls === 'inacc') out.push(`Pas une grosse erreur, mais il y avait plus précis.`);
    else out.push(`L'adversaire peut répondre <b>${fr(r.san)}</b> et prendre l'avantage (suite possible : ${fmtLine(afterFen, oppLine.slice(0, 3))}).`);
  }
  // what was better
  if (j.best && j.best.mate > 0) out.push(`Tu avais <b>un mat en ${j.best.mate}</b> : ${fmtLine(fenBefore, bestLine.slice(0, j.best.mate * 2 - 1))} !`);
  else if (bestLine[0]) {
    const b0 = bestLine[0];
    if (j.cls === 'miss') out.push(`Ton adversaire venait de se tromper ! Il fallait jouer <b>${fr(b0.san)}</b>${b0.captured ? ` qui prend ${capWord(b0.captured)}` : ''} (${fmtLine(fenBefore, bestLine.slice(0, 3))}).`);
    else if (b0.captured) out.push(`Mieux : <b>${fr(b0.san)}</b>, qui prend ${capWord(b0.captured)}.`);
    else out.push(`Mieux : <b>${fr(b0.san)}</b> (${fmtLine(fenBefore, bestLine.slice(0, 3))}).`);
  }
  return out.join(' ');
}

export function accuracyFromLosses(losses) {
  if (!losses.length) return 100;
  const accs = losses.map((l) => Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * l) - 3.1669)));
  // harmonic-ish blend like lichess: mean of arithmetic and harmonic
  const mean = accs.reduce((a, b) => a + b, 0) / accs.length;
  const harm = accs.length / accs.reduce((a, b) => a + 1 / Math.max(b, 5), 0);
  return Math.round((mean + harm) / 2 * 10) / 10;
}
