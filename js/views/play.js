import { Chess, store, h, $, $$, esc, fr, gameBoard, sound, modal, toast, sleep, material, uciToSan, kingSquare } from '../util.js';
import { analyse, newGame, val } from '../engine.js';
import { evalPos, judge, explain, CLS, clsIcon } from '../coach.js';
import { REPERTOIRES, BOOK } from '../data/openings.js';

export const BOTS = [
  { id: 0, name: 'Léo', elo: 400, face: '🐣', depth: 1, temp: 300, blunder: 0.3, mpv: 8, book: 0.3, desc: 'Vient d\'apprendre les règles.' },
  { id: 1, name: 'Chloé', elo: 600, face: '🙂', depth: 2, temp: 170, blunder: 0.15, mpv: 6, book: 0.5, desc: 'Laisse souvent des pièces en prise.' },
  { id: 2, name: 'Hugo', elo: 800, face: '😎', depth: 3, temp: 110, blunder: 0.08, mpv: 5, book: 0.7, desc: 'Ton niveau : idéal pour t\'entraîner.' },
  { id: 3, name: 'Inès', elo: 1000, face: '🦊', depth: 5, temp: 70, blunder: 0.045, mpv: 4, book: 0.8, desc: 'Voit les tactiques simples.' },
  { id: 4, name: 'Malik', elo: 1200, face: '🐺', depth: 6, temp: 45, blunder: 0.02, mpv: 4, book: 0.85, desc: 'Solide, punit les gaffes.' },
  { id: 5, name: 'Sophie', elo: 1500, face: '🦅', depth: 8, temp: 25, blunder: 0.008, mpv: 3, book: 0.9, desc: 'Joueuse de club.' },
  { id: 6, name: 'Viktor', elo: 1800, face: '🧠', depth: 11, temp: 10, blunder: 0, mpv: 3, book: 0.9, desc: 'Très fort tactiquement.' },
  { id: 7, name: 'Stockfish', elo: 2800, face: '🤖', depth: 16, temp: 0, blunder: 0, mpv: 1, book: 0.6, desc: 'Le moteur à pleine puissance.' },
];

// all book sequences (repertoire lines + named openings)
const SEQS = [...REPERTOIRES.flatMap((r) => r.lines.map((l) => l.moves.map((m) => m[0]))), ...BOOK.map((b) => b[0].split(' '))];
export function openingName(sans) {
  let best = null, bestLen = 0;
  for (const [seq, name] of BOOK) { const s = seq.split(' '); if (s.length <= sans.length && s.every((m, i) => sans[i] === m) && s.length > bestLen) { best = name; bestLen = s.length; } }
  for (const r of REPERTOIRES) for (const l of r.lines) {
    let n = 0; while (n < l.moves.length && n < sans.length && l.moves[n][0] === sans[n]) n++;
    if (n >= 4 && n > bestLen) { best = r.name + ' : ' + l.name; bestLen = n; }
  }
  return best;
}
export function isBookMove(sans, ply) { // is sans[ply] part of a known sequence given sans[0..ply-1]
  return SEQS.some((s) => s.length > ply && s.slice(0, ply + 1).every((m, i) => m === sans[i]));
}

async function botMove(game, bot) {
  const fen = game.fen();
  const sans = game.history();
  // opening book
  if (sans.length < 12 && Math.random() < bot.book) {
    const next = SEQS.filter((s) => s.length > sans.length && s.slice(0, sans.length).every((m, i) => m === sans[i])).map((s) => s[sans.length]);
    if (next.length) { const san = next[Math.floor(Math.random() * next.length)]; const m = new Chess(fen).move(san); return m.from + m.to + (m.promotion || ''); }
  }
  const legal = game.moves({ verbose: true });
  if (bot.blunder && Math.random() < bot.blunder && sans.length > 4) {
    const m = legal[Math.floor(Math.random() * legal.length)];
    return m.from + m.to + (m.promotion || '');
  }
  const r = await analyse(fen, { depth: bot.depth, multipv: Math.min(bot.mpv, legal.length) });
  const lines = r.lines.filter((l) => l.move);
  if (!lines.length) return r.bestmove;
  if (!bot.temp) return lines[0].move;
  const vals = lines.map((l) => Math.max(-3000, Math.min(3000, val(l))));
  const top = Math.max(...vals);
  const w = vals.map((v) => Math.exp((v - top) / bot.temp));
  let x = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) { x -= w[i]; if (x <= 0) return lines[i].move; }
  return lines[0].move;
}

export async function render(el) {
  const s = store.s;
  if (s.current && !s.current.over) return playGame(el, s.current);
  setup(el);
}

function setup(el) {
  const st = store.s.settings;
  el.innerHTML = '';
  const v = h(`<div class="layout">
    <div class="boardcol"><div id="pb"></div></div>
    <div class="panelcol">
      <div class="phead">⚔️ Jouer contre l'ordinateur</div>
      <div class="pbody">
        <h3 style="margin-top:0">Choisis ton adversaire</h3>
        <div class="list" id="bots"></div>
        <h3>Ta couleur</h3>
        <div class="opts" id="colors">
          <div class="opt" data-c="w">⚪ Blancs<div class="tag">Système de Londres</div></div>
          <div class="opt" data-c="r">🎲 Au hasard</div>
          <div class="opt" data-c="b">⚫ Noirs<div class="tag">Défense Française</div></div>
        </div>
        <label class="row"><input type="checkbox" id="coach" ${st.coach ? 'checked' : ''}> <span><b>Coach en direct</b><br><span class="small muted">Te prévient quand tu fais une erreur et te propose de reprendre le coup.</span></span></label>
      </div>
      <div class="pfoot"><button class="btn primary block" id="go">Jouer</button></div>
    </div></div>`);
  el.appendChild(v);
  const g = new Chess();
  gameBoard($('#pb', v), g, { canMove: () => null, orientation: st.color === 'b' ? 'b' : 'w' });
  const bl = $('#bots', v);
  for (const b of BOTS) {
    const it = h(`<div class="li ${b.id === st.bot ? 'sel' : ''}" data-id="${b.id}"><div class="player" style="padding:0"><div class="av">${b.face}</div></div><div><div class="ttl">${b.name} <span class="badge">≈${b.elo}</span></div><div class="sub">${b.desc}</div></div><div class="right"><div class="check ${b.id === st.bot ? 'ok' : ''}">${b.id === st.bot ? '✓' : ''}</div></div></div>`);
    it.onclick = () => { st.bot = b.id; store.save(); setup(el); };
    if (b.id === st.bot) it.style.borderColor = 'var(--green)';
    bl.appendChild(it);
  }
  $$('#colors .opt', v).forEach((o) => { o.classList.toggle('on', o.dataset.c === st.color); o.onclick = () => { st.color = o.dataset.c; store.save(); setup(el); }; });
  $('#coach', v).onchange = (e) => { st.coach = e.target.checked; store.save(); };
  $('#go', v).onclick = () => {
    const color = st.color === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : st.color;
    const bot = BOTS[st.bot];
    store.s.current = { id: Date.now().toString(36), color, bot: bot.id, botName: bot.name, botElo: bot.elo, coach: st.coach, moves: [], hints: 0, takebacks: 0, over: false };
    store.save();
    newGame();
    playGame(el, store.s.current);
  };
}

function playGame(el, cur) {
  const bot = BOTS[cur.bot];
  const game = new Chess();
  for (const m of cur.moves) game.move(m);
  let busy = false, alive = true, pendingDecision = false;
  el.innerHTML = '';
  const v = h(`<div class="layout">
    <div class="boardcol">
      <div class="player" id="ptop"><div class="av">${bot.face}</div><div>${bot.name} <span class="dim">(${bot.elo})</span><div class="cap" id="captop"></div></div></div>
      <div id="pb"></div>
      <div class="player" id="pbot"><div class="av">🙂</div><div>Toi<div class="cap" id="capbot"></div></div></div>
    </div>
    <div class="panelcol">
      <div class="phead"><span id="opening" style="font-size:14px;font-weight:700" class="muted">Partie en cours</span></div>
      <div class="pbody">
        <div class="coach"><div class="face">🧑‍🏫</div><div class="bubble" id="bubble">${cur.color === 'w' ? 'Tu as les Blancs. Pense au Système de Londres : <b>d4</b>, puis <b>Ff4</b> !' : 'Tu as les Noirs. Si les Blancs jouent <b>1.e4</b>, réponds par la Française : <b>…e6</b>.'}</div></div>
        <div class="moves" id="moves"></div>
      </div>
      <div class="pfoot">
        <button class="btn small" id="hint">💡 Indice</button>
        <button class="btn small" id="undo">↶ Reprendre</button>
        <button class="btn small" id="flip">⇅</button>
        <span class="spacer"></span>
        <button class="btn small" id="resign">🏳️ Abandonner</button>
      </div>
    </div></div>`);
  el.appendChild(v);
  const board = gameBoard($('#pb', v), game, {
    orientation: cur.color,
    canMove: () => (!busy && !pendingDecision && !cur.over && game.turn() === cur.color ? cur.color : null),
    onMove: (m) => afterUser(m),
  });
  function save() { cur.moves = game.history(); store.save(); }
  function bubble(html) { $('#bubble', v).innerHTML = html; }
  function renderMoves(lastCls) {
    const hist = game.history({ verbose: true });
    let out = '';
    for (let i = 0; i < hist.length; i += 2) {
      const a = hist[i], b = hist[i + 1];
      const ca = cur.cls?.[i] ? clsIcon(cur.cls[i]) : '', cb = cur.cls?.[i + 1] ? clsIcon(cur.cls[i + 1]) : '';
      out += `<div class="row"><span class="n">${i / 2 + 1}.</span><span class="m ${i === hist.length - 1 ? 'cur' : ''}">${ca}${fr(a.san)}</span><span class="m ${i + 1 === hist.length - 1 ? 'cur' : ''}">${b ? cb + fr(b.san) : ''}</span></div>`;
    }
    const mv = $('#moves', v); mv.innerHTML = out; mv.parentElement.scrollTop = 1e6;
    const name = openingName(game.history());
    if (name) $('#opening', v).textContent = name;
    // captured material
    const mat = material(game.fen());
    const diff = mat.w - mat.b;
    const mine = cur.color === 'w' ? diff : -diff;
    $('#capbot', v).textContent = mine > 0 ? '+' + mine : '';
    $('#captop', v).textContent = mine < 0 ? '+' + -mine : '';
  }
  cur.cls = cur.cls || {};
  renderMoves();
  if (cur.color === 'b') board.setOrientation('b');

  async function afterUser(m) {
    save(); renderMoves(); board.setArrows([]);
    if (checkEnd()) return;
    if (cur.coach) {
      busy = true;
      const fenBefore = (() => { const c = new Chess(); const hst = game.history(); for (const x of hst.slice(0, -1)) c.move(x); return c.fen(); })();
      bubble('<span class="muted">Le coach regarde ton coup…</span>');
      const [b, a] = await Promise.all([evalPos(fenBefore, 12), evalPos(game.fen(), 12)]);
      if (!alive) return;
      const ply = game.history().length - 1;
      const book = isBookMove(game.history(), ply);
      const j = judge(fenBefore, m, b.lines, a.lines, { book, prevOppLoss: cur.lastOppLoss || 0 });
      cur.cls[ply] = j.cls; renderMoves();
      const info = CLS[j.cls];
      const txt = explain(fenBefore, m, j, a.lines);
      if (['mistake', 'blunder', 'miss'].includes(j.cls)) {
        sound('bad');
        pendingDecision = true; busy = false;
        bubble(`<div class="t">${clsIcon(j.cls)} ${fr(m.san)} : ${info.label}</div>${txt}<div class="flex" style="margin-top:8px"><button class="btn small green" id="retry">↶ Reprendre ce coup</button><button class="btn small" id="cont">Continuer quand même</button></div>`);
        board.setArrows([{ from: m.from, to: m.to, color: 'rgba(250,65,45,.75)' }]);
        $('#retry', v).onclick = () => { game.undo(); delete cur.cls[ply]; cur.takebacks++; pendingDecision = false; save(); board.sync(); board.setArrows([]); renderMoves(); bubble('Cherche un meilleur coup. Pense : <b>qu\'est-ce que mon adversaire menace ?</b>'); };
        $('#cont', v).onclick = () => { pendingDecision = false; bubble(`<div class="t">${clsIcon(j.cls)} ${fr(m.san)}</div>${txt}`); board.setArrows([]); botTurn(); };
        return;
      }
      bubble(`<div class="t">${clsIcon(j.cls)} ${fr(m.san)} : ${info.label}</div>${txt}`);
      busy = false;
    }
    botTurn();
  }

  async function botTurn() {
    if (cur.over || game.turn() === cur.color) return;
    busy = true;
    const t0 = Date.now();
    const fenBefore = game.fen();
    const uci = await botMove(game, bot);
    if (!alive) return;
    const wait = 450 + Math.random() * 500 - (Date.now() - t0);
    if (wait > 0) await sleep(wait);
    if (!alive) return;
    const m = game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q' });
    board.sync(true, m);
    import('../util.js').then((u) => u.moveSound(m, game));
    save(); renderMoves();
    busy = false;
    // record how bad the bot move was (for "missed opportunity" detection), in background
    cur.lastOppLoss = 0;
    if (cur.coach) {
      Promise.all([evalPos(fenBefore, 12), evalPos(game.fen(), 12)]).then(([b, a]) => {
        const j = judge(fenBefore, m, b.lines, a.lines, {}); cur.lastOppLoss = j.loss;
      });
    }
    checkEnd();
  }

  function checkEnd() {
    if (!game.isGameOver()) return false;
    let result, reason;
    if (game.isCheckmate()) { result = game.turn() === 'w' ? '0-1' : '1-0'; reason = 'Échec et mat'; }
    else if (game.isStalemate()) { result = '1/2-1/2'; reason = 'Pat'; }
    else if (game.isThreefoldRepetition()) { result = '1/2-1/2'; reason = 'Répétition'; }
    else if (game.isInsufficientMaterial()) { result = '1/2-1/2'; reason = 'Matériel insuffisant'; }
    else { result = '1/2-1/2'; reason = 'Règle des 50 coups'; }
    finish(result, reason);
    return true;
  }
  async function finish(result, reason) {
    cur.over = true;
    const score = result === '1/2-1/2' ? 0.5 : (result === '1-0') === (cur.color === 'w') ? 1 : 0;
    const rec = { id: cur.id, date: Date.now(), moves: game.history(), result, reason, score, color: cur.color, bot: bot.id, botName: bot.name, botElo: bot.elo, opening: openingName(game.history()), hints: cur.hints, takebacks: cur.takebacks };
    store.s.games = [rec, ...store.s.games.filter((g) => g.id !== rec.id)].slice(0, 60);
    store.s.current = null; store.save(); store.activity('games');
    sound('end');
    const title = score === 1 ? '🏆 Tu as gagné !' : score === 0.5 ? '🤝 Partie nulle' : `${bot.face} ${bot.name} a gagné`;
    const r = await modal(`<h2>${title}</h2><p class="muted">${reason} · ${result}</p><p>Regarde le bilan pour comprendre les moments clés de la partie.</p>`, [['📊 Voir le bilan', 'review', 'green'], ['Rejouer', 'again'], ['Fermer', 'close', 'ghost']]);
    if (!alive) return;
    if (r === 'review') location.hash = '#/bilan/' + rec.id;
    else if (r === 'again') { store.s.current = { ...cur, id: Date.now().toString(36), moves: [], cls: {}, over: false, hints: 0, takebacks: 0 }; store.save(); newGame(); playGame(el, store.s.current); }
    else { $('.pfoot', v).innerHTML = `<button class="btn green" onclick="location.hash='#/bilan/${rec.id}'">📊 Bilan</button><button class="btn" id="newg">Nouvelle partie</button>`; $('#newg', v).onclick = () => setup(el); }
  }

  $('#hint', v).onclick = async () => {
    if (busy || pendingDecision || cur.over || game.turn() !== cur.color) return;
    busy = true; cur.hints++; save();
    bubble('<span class="muted">Je réfléchis…</span>');
    const r = await evalPos(game.fen(), 14);
    busy = false;
    const best = r.lines[0]; if (!best?.move) return;
    board.setArrows([{ from: best.move.slice(0, 2), to: best.move.slice(2, 4), color: 'rgba(129,182,76,.85)' }]);
    const san = uciToSan(game.fen(), best.move);
    bubble(`💡 Je te conseille <b>${fr(san)}</b>. Essaie de comprendre pourquoi avant de le jouer !`);
  };
  $('#undo', v).onclick = () => {
    if (busy || cur.over || !game.history().length) return;
    pendingDecision = false;
    game.undo(); if (game.turn() !== cur.color && game.history().length) game.undo();
    if (game.turn() !== cur.color) { /* user is black and undid to start */ }
    cur.takebacks++;
    const n = game.history().length; for (const k of Object.keys(cur.cls)) if (+k >= n) delete cur.cls[k];
    save(); board.sync(); board.setArrows([]); renderMoves(); bubble('Coup repris. À toi de jouer.');
    if (game.turn() !== cur.color) botTurn();
  };
  $('#flip', v).onclick = () => board.flip();
  $('#resign', v).onclick = async () => {
    if (cur.over) return;
    const r = await modal('<h2>Abandonner ?</h2><p class="muted">La partie sera comptée comme perdue.</p>', [['Oui, abandonner', true, 'green'], ['Non', false]]);
    if (r) finish(cur.color === 'w' ? '0-1' : '1-0', 'Abandon');
  };
  if (game.turn() !== cur.color && !game.isGameOver()) botTurn();
  return () => { alive = false; };
}
