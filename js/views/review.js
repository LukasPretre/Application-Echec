import { Chess, store, h, $, $$, esc, fr, gameBoard, boardShow, sound, toast, uciToSan, pvToSan, fmtLine, evalText, whitePct } from '../util.js';
import { Board } from '../board.js';
import { evalPos, judge, explain, CLS, CLS_HEX, clsIcon, accuracyFromLosses, lineVal } from '../coach.js';
import { winPct } from '../engine.js';
import { isBookMove } from './play.js';

const ORDER = ['brilliant', 'best', 'excellent', 'good', 'book', 'inacc', 'mistake', 'miss', 'blunder'];
const pack = (l) => l ? { move: l.move, pv: (l.pv || []).slice(0, 8), cp: l.cp, mate: l.mate } : null;

export async function render(el, [id]) {
  const g = store.s.games.find((x) => x.id === id);
  if (!g) { el.innerHTML = '<div class="card">Partie introuvable. <a href="#/jouer">Jouer une partie</a></div>'; return; }
  let alive = true;
  const fens = [], moves = [];
  const c = new Chess(); fens.push(c.fen());
  for (const san of g.moves) { moves.push(c.move(san)); fens.push(c.fen()); }
  const N = moves.length;

  el.innerHTML = '';
  const v = h(`<div class="layout">
    <div class="boardcol"><div class="evalwrap"><div class="evalbar" id="ebar"><i style="height:50%"></i><span id="etxt" style="bottom:2px;color:#333"></span></div><div style="flex:1"><div id="rb"></div></div></div></div>
    <div class="panelcol">
      <div class="phead">📊 Bilan de la partie</div>
      <div class="pbody" id="rbody"><p class="muted">Le coach analyse ta partie coup par coup…</p><div class="pbar"><i id="prog" style="width:0%"></i></div><p class="small dim" id="progt"></p></div>
      <div class="pfoot" id="rfoot"></div>
    </div></div>`);
  el.appendChild(v);
  const board = new Board($('#rb', v), { orientation: g.color });
  boardShow(board, fens[0]);

  // ---------- analysis ----------
  let an = g.analysis;
  if (!an || an.length !== N + 1) {
    an = [];
    for (let i = 0; i <= N; i++) {
      const r = await evalPos(fens[i], 12);
      if (!alive) return;
      an.push(r.lines.slice(0, 2).map(pack));
      $('#prog', v).style.width = Math.round((i + 1) / (N + 1) * 100) + '%';
      $('#progt', v).textContent = `Position ${i + 1} / ${N + 1}`;
    }
  }
  const js = [];
  for (let i = 0; i < N; i++) {
    const book = i < 20 && isBookMove(g.moves, i);
    js.push(judge(fens[i], moves[i], an[i], an[i + 1], { book, prevOppLoss: i > 0 ? js[i - 1].loss : 0, allowBrilliant: true }));
  }
  const side = (i) => (i % 2 === 0 ? 'w' : 'b');
  const acc = { w: accuracyFromLosses(js.filter((_, i) => side(i) === 'w').map((j) => j.loss)), b: accuracyFromLosses(js.filter((_, i) => side(i) === 'b').map((j) => j.loss)) };
  const isNew = !g.analysis;
  g.analysis = an; g.accuracy = acc[g.color];
  if (isNew) {
    // turn mistakes into personal puzzles
    js.forEach((j, i) => {
      if (side(i) !== g.color || !['mistake', 'blunder', 'miss'].includes(j.cls) || !j.best?.move) return;
      const key = g.id + ':' + i;
      if (store.s.mistakes.some((m) => m.id === key)) return;
      store.s.mistakes.unshift({ id: key, fen: fens[i], best: j.best.move, pv: (j.best.pv || []).slice(0, 6), played: moves[i].san, cls: j.cls, date: g.date, solved: 0 });
    });
    store.s.mistakes = store.s.mistakes.slice(0, 200);
  }
  store.save();
  if (!alive) return;

  // ---------- UI ----------
  let ply = 0; // position index shown (0 = start)
  let showBest = true, retry = null;
  const counts = (col) => { const o = {}; js.forEach((j, i) => { if (side(i) === col) o[j.cls] = (o[j.cls] || 0) + 1; }); return o; };
  const cw = counts('w'), cb = counts('b');
  const you = g.color, them = you === 'w' ? 'b' : 'w';
  const youName = 'Toi', themName = g.botName;
  const graphPts = an.map((l, i) => whitePct(l[0], i % 2 === 0 ? 'w' : 'b'));
  const W = 300, H = 80;
  const path = graphPts.map((p, i) => `${(i / Math.max(1, N)) * W},${H - p / 100 * H}`).join(' ');
  const dots = js.map((j, i) => ['mistake', 'blunder', 'miss', 'brilliant'].includes(j.cls) ? `<circle cx="${((i + 1) / Math.max(1, N)) * W}" cy="${H - graphPts[i + 1] / 100 * H}" r="3" fill="${CLS_HEX[j.cls]}"/>` : '').join('');
  const summary = `<div class="stats" style="grid-template-columns:1fr 1fr;margin-bottom:10px">
      <div class="stat"><div class="k">${youName} (${you === 'w' ? 'Blancs' : 'Noirs'})</div><div class="v" style="color:var(--green)">${acc[you]}%</div><div class="k">Précision</div></div>
      <div class="stat"><div class="k">${esc(themName)} (≈${g.botElo})</div><div class="v">${acc[them]}%</div><div class="k">Précision</div></div></div>
    <svg class="graph" id="graph" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><polygon points="0,${H} ${path} ${W},${H}" fill="#fff"/><line x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}" stroke="#888" stroke-width=".5"/>${dots}<line id="gcur" x1="0" x2="0" y1="0" y2="${H}" stroke="var(--green)" stroke-width="1.5"/></svg>
    <table style="width:100%;margin:10px 0;font-size:14px;border-collapse:collapse">${ORDER.filter((k) => cw[k] || cb[k]).map((k) => `<tr><td style="padding:3px 0">${clsIcon(k)} ${CLS[k].label}</td><td style="text-align:center;font-weight:800;color:${CLS_HEX[k]}">${(you === 'w' ? cw : cb)[k] || 0}</td><td style="text-align:center;color:var(--dim)">${(you === 'w' ? cb : cw)[k] || 0}</td></tr>`).join('')}</table>
    <p class="small muted">${g.opening ? '📖 ' + esc(g.opening) + ' · ' : ''}${esc(g.reason || '')} ${g.result}</p>`;

  $('#rbody', v).innerHTML = `${summary}<div class="coach"><div class="face">🧑‍🏫</div><div class="bubble" id="bubble"></div></div><div class="moves" id="moves"></div>`;
  $('#rfoot', v).innerHTML = `<button class="btn small" id="first">⏮</button><button class="btn small" id="prev">◀</button><button class="btn small green" id="next">▶</button><button class="btn small" id="last">⏭</button><span class="spacer"></span><button class="btn small" id="nextErr">⚠️ Erreur suivante</button><button class="btn small" id="toggleBest">Meilleur coup</button>`;

  function renderMoves() {
    let out = '';
    for (let i = 0; i < N; i += 2) {
      const cell = (k) => k < N ? `<span class="m ${k + 1 === ply ? 'cur' : ''}" data-p="${k + 1}">${clsIcon(js[k].cls)}${fr(moves[k].san)}</span>` : '<span></span>';
      out += `<div class="row"><span class="n">${i / 2 + 1}.</span>${cell(i)}${cell(i + 1)}</div>`;
    }
    $('#moves', v).innerHTML = out;
    $$('#moves .m[data-p]', v).forEach((m) => (m.onclick = () => show(+m.dataset.p)));
    const cur = $('#moves .cur', v); if (cur) cur.scrollIntoView({ block: 'nearest' });
  }
  function setEval(i) {
    const l = an[i][0]; const turn = i % 2 === 0 ? 'w' : 'b';
    const p = whitePct(l, turn);
    const flip = g.color === 'b';
    const bar = $('#ebar', v); bar.style.transform = flip ? 'rotate(180deg)' : '';
    bar.querySelector('i').style.height = p + '%';
    const t = $('#etxt', v); t.textContent = evalText(l, turn).replace('+', ''); t.style.transform = flip ? 'rotate(180deg)' : '';
    const top = p < 50; t.style.bottom = top ? '' : '2px'; t.style.top = top ? '2px' : ''; t.style.color = top ? '#fff' : '#333';
    $('#gcur', v).setAttribute('x1', (i / Math.max(1, N)) * W); $('#gcur', v).setAttribute('x2', (i / Math.max(1, N)) * W);
  }
  function show(i, animate = false) {
    retry = null;
    ply = Math.max(0, Math.min(N, i));
    const m = ply > 0 ? moves[ply - 1] : null;
    boardShow(board, fens[ply], m, animate);
    board.o.movable = () => false;
    setEval(ply);
    renderMoves();
    const bub = $('#bubble', v);
    if (!m) { bub.innerHTML = `Voici le bilan de ta partie contre <b>${esc(g.botName)}</b>. Avance coup par coup avec ▶, ou saute directement à tes erreurs avec ⚠️.`; board.setArrows([]); board.setBadges({}); return; }
    const j = js[ply - 1];
    const mine = side(ply - 1) === g.color;
    board.setBadges({ [m.to]: { color: CLS_HEX[j.cls], text: CLS[j.cls].sym === '📖' ? '≡' : CLS[j.cls].sym } });
    const arrows = [];
    if (showBest && j.best?.move && !['best', 'book', 'brilliant'].includes(j.cls)) arrows.push({ from: j.best.move.slice(0, 2), to: j.best.move.slice(2, 4), color: 'rgba(129,182,76,.85)' });
    board.setArrows(arrows);
    const txt = explain(fens[ply - 1], m, j, an[ply], { you: mine });
    const canRetry = mine && ['inacc', 'mistake', 'blunder', 'miss'].includes(j.cls);
    bub.innerHTML = `<div class="t">${clsIcon(j.cls)} ${fr(m.san)} ${mine ? '' : `<span class="dim small">(${esc(g.botName)})</span>`} : ${CLS[j.cls].label}</div>${txt}
      ${canRetry ? '<div class="flex" style="margin-top:8px"><button class="btn small green" id="retry">🔁 Réessayer ce coup</button><button class="btn small" id="line">Voir la meilleure suite</button></div>' : ''}`;
    if (canRetry) {
      $('#retry', v).onclick = () => startRetry(ply - 1);
      $('#line', v).onclick = () => playLine(ply - 1);
    }
  }
  function startRetry(i) {
    const game = new Chess(fens[i]);
    retry = i;
    boardShow(board, fens[i], i > 0 ? moves[i - 1] : null);
    board.setArrows([]); board.setBadges({});
    $('#bubble', v).innerHTML = `<div class="t">🔁 À toi</div>Trouve un meilleur coup que <b>${fr(moves[i].san)}</b>.`;
    board.o.movable = (sq) => { const p = game.get(sq); return retry === i && p && p.color === game.turn(); };
    board.o.targets = (sq) => game.moves({ square: sq, verbose: true }).map((m) => m.to);
    board.o.onMove = async (from, to, promo) => {
      let m; try { m = game.move({ from, to, promotion: promo || 'q' }); } catch (e) { boardShow(board, game.fen()); return; }
      boardShow(board, game.fen(), m);
      board.o.movable = () => false;
      const a = await evalPos(game.fen(), 12);
      const j = judge(fens[i], m, an[i], a.lines, {});
      if (j.loss < 5 || j.cls === 'best' || j.cls === 'excellent') {
        sound('good');
        $('#bubble', v).innerHTML = `<div class="t">${clsIcon(j.cls)} ${fr(m.san)} : bravo !</div>${explain(fens[i], m, j, a.lines)}<div class="flex" style="margin-top:8px"><button class="btn small green" id="goon">Continuer le bilan</button></div>`;
        $('#goon', v).onclick = () => show(i + 1);
      } else {
        sound('bad');
        $('#bubble', v).innerHTML = `<div class="t">${clsIcon(j.cls)} ${fr(m.san)} : pas encore…</div>${explain(fens[i], m, j, a.lines)}<div class="flex" style="margin-top:8px"><button class="btn small green" id="again">Réessayer</button><button class="btn small" id="sol">Solution</button></div>`;
        $('#again', v).onclick = () => startRetry(i);
        $('#sol', v).onclick = () => playLine(i);
      }
    };
  }
  async function playLine(i) {
    retry = null;
    const best = an[i][0]; if (!best?.pv) return;
    const seq = pvToSan(fens[i], best.pv, 6);
    $('#bubble', v).innerHTML = `<div class="t">✨ Meilleure suite</div>${fmtLine(fens[i], seq)}`;
    const cc = new Chess(fens[i]);
    boardShow(board, fens[i], i > 0 ? moves[i - 1] : null); board.setArrows([]); board.setBadges({});
    for (const m of seq) {
      await new Promise((r) => setTimeout(r, 900));
      if (!alive || retry !== null) return;
      cc.move(m.san); boardShow(board, cc.fen(), m, true);
    }
  }
  $('#first', v).onclick = () => show(0);
  $('#prev', v).onclick = () => show(ply - 1);
  $('#next', v).onclick = () => { show(ply + 1, true); if (ply > 0) sound(moves[ply - 1].captured ? 'capture' : 'move'); };
  $('#last', v).onclick = () => show(N);
  $('#nextErr', v).onclick = () => {
    for (let k = ply; k < N; k++) if (side(k) === g.color && ['mistake', 'blunder', 'miss', 'inacc'].includes(js[k].cls) && k + 1 > ply) return show(k + 1);
    toast('Plus d\'erreurs après ce coup 👍');
  };
  $('#toggleBest', v).onclick = () => { showBest = !showBest; show(ply); };
  $('#graph', v).onclick = (e) => { const r = e.currentTarget.getBoundingClientRect(); show(Math.round((e.clientX - r.left) / r.width * N)); };
  const key = (e) => { if (e.target.tagName === 'INPUT') return; if (e.key === 'ArrowRight') $('#next', v).click(); if (e.key === 'ArrowLeft') show(ply - 1); };
  document.addEventListener('keydown', key);
  show(0);
  return () => { alive = false; document.removeEventListener('keydown', key); };
}
