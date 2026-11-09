import { Chess, store, h, $, $$, esc, fr, gameBoard, toast, pvToSan, fmtLine, evalText, whitePct } from '../util.js';
import { analyse, stop } from '../engine.js';

export async function render(el, _, params) {
  let alive = true;
  let startFen = params.fen || new Chess().fen();
  let game;
  try { game = new Chess(startFen); } catch (e) { game = new Chess(); startFen = game.fen(); }
  const line = []; // verbose moves from startFen
  let cursor = 0; // number of moves applied
  el.innerHTML = '';
  const v = h(`<div class="layout">
    <div class="boardcol"><div class="evalwrap"><div class="evalbar" id="ebar"><i style="height:50%"></i><span id="etxt" style="bottom:2px;color:#333"></span></div><div style="flex:1"><div id="ab"></div></div></div></div>
    <div class="panelcol">
      <div class="phead">🔍 Analyse <span class="spacer"></span><label class="small flex" style="font-weight:600"><input type="checkbox" id="engOn" checked> Moteur</label></div>
      <div class="pbody">
        <div id="lines" class="small" style="margin-bottom:10px"></div>
        <div class="moves" id="moves"></div>
        <div class="sep"></div>
        <div class="small muted">Colle une position (FEN) ou une partie (PGN) :</div>
        <textarea id="inp" rows="3" style="width:100%;background:#1f1e1c;color:#fff;border:1px solid var(--line);border-radius:6px;padding:8px;font-family:monospace;font-size:12px;margin-top:6px"></textarea>
        <div class="flex" style="margin-top:6px"><button class="btn small" id="load">Charger</button><button class="btn small" id="copy">Copier la FEN</button><button class="btn small" id="reset">Position de départ</button></div>
      </div>
      <div class="pfoot"><button class="btn small" id="first">⏮</button><button class="btn small" id="prev">◀</button><button class="btn small" id="next">▶</button><button class="btn small" id="last">⏭</button><span class="spacer"></span><button class="btn small" id="flip">⇅ Retourner</button></div>
    </div></div>`);
  el.appendChild(v);
  const board = gameBoard($('#ab', v), game, { canMove: () => 'both', onMove: (m) => { line.length = cursor; line.push(m); cursor++; refresh(); } });

  function rebuild() { game.load(startFen); for (let i = 0; i < cursor; i++) game.move(line[i].san); board.sync(); }
  let token = 0;
  async function runEngine() {
    const my = ++token;
    const lines = $('#lines', v);
    if (!$('#engOn', v).checked) { lines.innerHTML = ''; return; }
    if (game.isGameOver()) { lines.innerHTML = `<b>${game.isCheckmate() ? 'Échec et mat' : 'Partie nulle'}</b>`; setBar(game.isCheckmate() ? { mate: 0 } : { cp: 0, mate: null }); return; }
    stop();
    const fen = game.fen(), turn = game.turn();
    const show = (ls) => {
      if (my !== token || !alive) return;
      lines.innerHTML = ls.filter(Boolean).map((l) => `<div style="padding:4px 0;border-bottom:1px solid var(--line)"><span class="badge" style="background:${whitePct(l, turn) >= 50 ? '#fff;color:#222' : '#111'};min-width:46px;text-align:center">${evalText(l, turn)}</span> ${fmtLine(fen, pvToSan(fen, l.pv, 8))}</div>`).join('') + `<div class="dim" style="margin-top:4px">profondeur ${ls[0]?.depth || ''}</div>`;
      setBar(ls[0], turn);
    };
    const cur = [];
    await analyse(fen, { depth: 18, multipv: 3, stale: () => my !== token || !alive, onInfo: (l, k) => { cur[k - 1] = l; if (k === 1 || cur.length >= 3) show(cur); } });
  }
  function setBar(l, turn = game.turn()) {
    const p = whitePct(l, turn);
    const flip = board.orientation === 'b';
    const bar = $('#ebar', v); bar.style.transform = flip ? 'rotate(180deg)' : '';
    bar.querySelector('i').style.height = p + '%';
    const t = $('#etxt', v); t.textContent = evalText(l, turn).replace('+', ''); t.style.transform = flip ? 'rotate(180deg)' : '';
    const top = p < 50; t.style.bottom = top ? '' : '2px'; t.style.top = top ? '2px' : ''; t.style.color = top ? '#fff' : '#333';
  }
  function renderMoves() {
    const startTurn = startFen.split(' ')[1]; let num = +startFen.split(' ')[5];
    let out = '', i = 0;
    const cells = line.map((m, k) => `<span class="m ${k + 1 === cursor ? 'cur' : ''}" data-k="${k + 1}">${fr(m.san)}</span>`);
    if (startTurn === 'b' && cells.length) { out += `<div class="row"><span class="n">${num}.</span><span class="m">…</span>${cells[0]}</div>`; i = 1; num++; }
    for (; i < cells.length; i += 2) { out += `<div class="row"><span class="n">${num}.</span>${cells[i]}${cells[i + 1] || '<span></span>'}</div>`; num++; }
    $('#moves', v).innerHTML = out;
    $$('#moves .m[data-k]', v).forEach((e) => (e.onclick = () => { cursor = +e.dataset.k; rebuild(); refresh(); }));
  }
  function refresh() { renderMoves(); runEngine(); }
  const go = (n) => { cursor = Math.max(0, Math.min(line.length, n)); rebuild(); refresh(); };
  $('#first', v).onclick = () => go(0);
  $('#prev', v).onclick = () => go(cursor - 1);
  $('#next', v).onclick = () => go(cursor + 1);
  $('#last', v).onclick = () => go(line.length);
  $('#flip', v).onclick = () => { board.flip(); runEngine(); };
  $('#engOn', v).onchange = runEngine;
  $('#copy', v).onclick = () => { navigator.clipboard?.writeText(game.fen()); toast('FEN copiée'); };
  $('#reset', v).onclick = () => { startFen = new Chess().fen(); line.length = 0; cursor = 0; rebuild(); refresh(); };
  $('#load', v).onclick = () => {
    const t = $('#inp', v).value.trim(); if (!t) return;
    try {
      const c = new Chess(t); startFen = c.fen(); line.length = 0; cursor = 0;
    } catch (e) {
      try {
        const c = new Chess(); c.loadPgn(t);
        const hist = c.history({ verbose: true });
        startFen = hist.length ? hist[0].before : c.fen();
        line.length = 0; line.push(...hist); cursor = line.length;
      } catch (e2) { toast('FEN ou PGN invalide'); return; }
    }
    rebuild(); refresh();
  };
  const key = (e) => { if (e.target.tagName === 'TEXTAREA') return; if (e.key === 'ArrowRight') go(cursor + 1); if (e.key === 'ArrowLeft') go(cursor - 1); };
  document.addEventListener('keydown', key);
  refresh();
  return () => { alive = false; stop(); document.removeEventListener('keydown', key); };
}
