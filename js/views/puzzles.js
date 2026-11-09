import { Chess, store, h, $, $$, esc, fr, gameBoard, boardShow, sound, toast, sleep, uciToSan, pvToSan, fmtLine, kingSquare } from '../util.js';
import { Board } from '../board.js';
import { PUZZLES } from '../data/puzzles.js';
import { evalPos, judge } from '../coach.js';

export const THEMES = {
  hanging: { name: 'Pièce en prise', icon: '🎁', desc: 'Une pièce adverse n\'est pas défendue : prends-la !' },
  mate1: { name: 'Mat en 1', icon: '♚', desc: 'Trouve l\'échec et mat immédiat.' },
  mate2: { name: 'Mat en 2', icon: '♚♚', desc: 'Un coup préparatoire, puis le mat.' },
  mate3: { name: 'Mat en 3 et plus', icon: '👑', desc: 'Une combinaison de mat plus longue.' },
  fork: { name: 'Fourchette', icon: '🍴', desc: 'Attaque deux pièces à la fois.' },
  pin: { name: 'Clouage', icon: '📌', desc: 'Une pièce adverse ne peut plus bouger.' },
  skewer: { name: 'Enfilade', icon: '🍢', desc: 'Attaque une grosse pièce, gagne celle de derrière.' },
  discovered: { name: 'Attaque à la découverte', icon: '🔦', desc: 'Bouge une pièce pour en démasquer une autre.' },
  backrank: { name: 'Mat du couloir', icon: '🚪', desc: 'Le roi est enfermé sur sa dernière rangée.' },
  smothered: { name: 'Mat à l\'étouffée', icon: '🐴', desc: 'Le cavalier mate un roi coincé par ses pièces.' },
  promotion: { name: 'Promotion', icon: '⬆️', desc: 'Emmène un pion à dame.' },
  material: { name: 'Gain de matériel', icon: '💰', desc: 'Trouve la suite qui gagne du matériel.' },
  quiet: { name: 'Coup calme', icon: '🤫', desc: 'Le meilleur coup n\'est ni un échec ni une prise.' },
};
const P = PUZZLES.map(([id, fen, mistake, sol, rating, themes]) => ({ id, fen, mistake, sol: sol.split(' '), rating, themes: themes.split(' ') }));

function pick(list, target) {
  const s = store.s;
  const fresh = list.filter((p) => !s.puzzleHist[p.id]);
  const pool = fresh.length ? fresh : list;
  let best = pool.filter((p) => Math.abs(p.rating - target) < 120);
  if (best.length < 5) best = [...pool].sort((a, b) => Math.abs(a.rating - target) - Math.abs(b.rating - target)).slice(0, 20);
  return best[Math.floor(Math.random() * best.length)];
}

export async function render(el, [mode, arg]) {
  if (!mode) return menu(el);
  if (mode === 'entrainement') return session(el, { kind: 'train', title: 'Entraînement', next: () => pick(P, store.s.puzzleRating) });
  if (mode === 'theme') {
    const f = P.filter((p) => p.themes.includes(arg)); const list = f.length ? f : P;
    return session(el, { kind: 'train', title: THEMES[arg]?.name || arg, next: () => pick(list, store.s.puzzleRating) });
  }
  if (mode === 'survie') {
    let level = 400;
    return session(el, { kind: 'survival', title: 'Survie (3 vies)', next: () => { const p = pick(P, level); level += 60; return p; } });
  }
  if (mode === 'erreurs') {
    const list = store.s.mistakes;
    if (!list.length) { el.innerHTML = '<div class="card" style="max-width:600px;margin:auto"><h2>Mes erreurs</h2><p>Aucune erreur enregistrée pour l\'instant. Joue une partie et regarde son <b>bilan</b> : chaque erreur que tu fais devient un exercice ici.</p><a class="btn green" href="#/jouer">Jouer une partie</a></div>'; return; }
    let k = 0;
    const sorted = [...list].sort((a, b) => (a.solved || 0) - (b.solved || 0));
    return session(el, { kind: 'mistakes', title: 'Mes erreurs', next: () => { const m = sorted[k++ % sorted.length]; return { id: 'm:' + m.id, fen: m.fen, mistake: null, sol: [m.best], rating: null, themes: [], own: m, loose: true }; } });
  }
  return menu(el);
}

function menu(el) {
  const s = store.s;
  const counts = {}; P.forEach((p) => p.themes.forEach((t) => (counts[t] = (counts[t] || 0) + 1)));
  const solvedPct = s.puzzleCount ? Math.round(s.puzzleSolved / s.puzzleCount * 100) : 0;
  el.appendChild(h(`<div style="max-width:1050px;margin:0 auto">
    <h1>🧩 Exercices</h1>
    <div class="stats" style="margin-bottom:16px">
      <div class="stat"><div class="v" style="color:var(--inacc)">${s.puzzleRating}</div><div class="k">Ton classement</div></div>
      <div class="stat"><div class="v">${s.puzzleCount}</div><div class="k">Exercices faits</div></div>
      <div class="stat"><div class="v">${solvedPct}%</div><div class="k">Réussite</div></div>
      <div class="stat"><div class="v">${s.bestStreak}</div><div class="k">Meilleure série (survie)</div></div>
    </div>
    <div class="tiles">
      <a class="tile" href="#/exercices/entrainement" style="border-color:var(--green)"><div class="ic">🎯</div><div class="t">Entraînement</div><div class="d">Des exercices adaptés à ton niveau. Ton classement monte quand tu réussis du premier coup.</div></a>
      <a class="tile" href="#/exercices/survie"><div class="ic">❤️❤️❤️</div><div class="t">Survie</div><div class="d">De plus en plus difficile. Trois erreurs et c'est fini. Bats ton record !</div></a>
      <a class="tile" href="#/exercices/erreurs"><div class="ic">🔁</div><div class="t">Mes erreurs <span class="badge">${s.mistakes.length}</span></div><div class="d">Les positions où tu t'es trompé dans tes parties. Le meilleur moyen de ne plus refaire la même erreur.</div></a>
    </div>
    <h2>Par thème</h2>
    <div class="tiles">${Object.entries(THEMES).filter(([k]) => counts[k] >= 3).map(([k, t]) => `<a class="tile" href="#/exercices/theme/${k}"><div class="ic">${t.icon}</div><div class="t">${t.name} <span class="badge">${counts[k]}</span></div><div class="d">${t.desc}</div></a>`).join('')}</div>
    <p class="dim small" style="margin-top:18px">${P.length} exercices générés à partir de vraies positions et vérifiés un par un par Stockfish.</p>
  </div>`));
}

function session(el, cfg) {
  const s = store.s;
  let alive = true, lives = 3, streak = 0;
  el.innerHTML = '';
  const v = h(`<div class="layout">
    <div class="boardcol"><div id="zb"></div></div>
    <div class="panelcol">
      <div class="phead"><a href="#/exercices" class="btn ghost small">←</a> ${esc(cfg.title)} <span class="spacer"></span><span id="score" class="badge"></span></div>
      <div class="pbody">
        <div id="turn" class="feedback info"></div>
        <div id="fb"></div>
        <div id="info" class="small muted"></div>
      </div>
      <div class="pfoot" id="foot"></div>
    </div></div>`);
  el.appendChild(v);
  const board = new Board($('#zb', v));
  let game, p, step, failed, done, hinted;

  function score() {
    if (cfg.kind === 'survival') $('#score', v).innerHTML = `${'❤️'.repeat(lives)}${'🖤'.repeat(3 - lives)} · ${streak}`;
    else if (cfg.kind === 'train') $('#score', v).textContent = 'Classement ' + s.puzzleRating;
    else $('#score', v).textContent = '';
  }
  function foot(btns) {
    const f = $('#foot', v); f.innerHTML = '';
    for (const [label, fn, cls] of btns) { const b = h(`<button class="btn small ${cls || ''}">${label}</button>`); b.onclick = fn; f.appendChild(b); }
  }
  function fb(html, cls) { $('#fb', v).innerHTML = html ? `<div class="feedback ${cls}">${html}</div>` : ''; }

  async function load() {
    p = cfg.next(); if (!p) return;
    game = new Chess(p.fen);
    step = 0; failed = false; done = false; hinted = false;
    board.setArrows([]); board.setMarks({});
    const solverColor = p.mistake ? (game.turn() === 'w' ? 'b' : 'w') : game.turn();
    board.setOrientation(solverColor);
    boardShow(board, game.fen());
    fb(''); score();
    $('#turn', v).innerHTML = `${solverColor === 'w' ? '⚪' : '⚫'} <span>À toi : trouve le meilleur coup pour les <b>${solverColor === 'w' ? 'Blancs' : 'Noirs'}</b></span>`;
    $('#info', v).innerHTML = p.rating ? `Exercice n°${p.id} · difficulté ${p.rating}` : `Tiré de ta partie du ${new Date(p.own.date).toLocaleDateString('fr-FR')} (tu avais joué ${fr(p.own.played)})`;
    foot([['💡 Indice', hint], ['Solution', solution]]);
    if (p.mistake) {
      await sleep(700); if (!alive) return;
      const m = game.move({ from: p.mistake.slice(0, 2), to: p.mistake.slice(2, 4), promotion: p.mistake[4] || 'q' });
      boardShow(board, game.fen(), m, true); sound(m.captured ? 'capture' : 'move');
    }
    enable();
  }
  function enable() {
    board.o.movable = (sq) => { const pc = game.get(sq); return !done && pc && pc.color === game.turn(); };
    board.o.targets = (sq) => game.moves({ square: sq, verbose: true }).map((m) => m.to);
    board.o.onMove = onMove;
  }
  async function onMove(from, to, promo, animate) {
    const expected = p.sol[step];
    let m; try { m = game.move({ from, to, promotion: promo || 'q' }); } catch (e) { boardShow(board, game.fen()); return; }
    const uci = m.from + m.to + (m.promotion || '');
    let ok = uci === expected || (uci.slice(0, 4) === expected.slice(0, 4) && !expected[4]) || game.isCheckmate();
    if (!ok && p.loose) {
      boardShow(board, game.fen(), m, animate); board.o.movable = () => false;
      fb('<span class="muted">Je vérifie ton coup…</span>', 'info');
      game.undo(); const fen0 = game.fen(); game.move(m);
      const [b, a] = await Promise.all([evalPos(fen0, 12), evalPos(game.fen(), 12)]);
      if (!alive) return;
      const j = judge(fen0, m, b.lines, a.lines, {});
      ok = j.loss < 4; enable();
    }
    if (!ok) {
      boardShow(board, game.fen(), m, animate);
      sound('bad');
      board.setMarks({ [m.to]: 'red' });
      await sleep(500);
      game.undo(); boardShow(board, game.fen(), game.history({ verbose: true }).slice(-1)[0] || null); board.setMarks({});
      if (!failed) { failed = true; result(false); }
      fb(`❌ ${fr(m.san)} n'est pas le bon coup. ${cfg.kind === 'survival' ? '' : 'Réessaie, ou regarde la solution.'}`, 'bad');
      if (cfg.kind === 'survival') { if (lives <= 0) return gameOver(); setTimeout(() => alive && solution(), 600); }
      return;
    }
    boardShow(board, game.fen(), m, animate);
    import('../util.js').then((u) => u.moveSound(m, game));
    step++;
    if (step >= p.sol.length || game.isCheckmate()) return success();
    fb('✅ Bien vu ! Continue…', 'ok');
    board.o.movable = () => false;
    await sleep(500); if (!alive) return;
    const r = p.sol[step];
    const rm = game.move({ from: r.slice(0, 2), to: r.slice(2, 4), promotion: r[4] || 'q' });
    boardShow(board, game.fen(), rm, true); sound(rm.captured ? 'capture' : 'move');
    step++;
    enable();
  }
  function result(win) {
    if (cfg.kind === 'train' && p.rating) {
      const exp = 1 / (1 + Math.pow(10, (p.rating - s.puzzleRating) / 400));
      const k = s.puzzleCount < 20 ? 40 : 20;
      const delta = Math.round(k * ((win ? 1 : 0) - exp));
      s.puzzleRating = Math.max(100, s.puzzleRating + delta);
      s.puzzleCount++; if (win) s.puzzleSolved++;
      s.puzzleHist[p.id] = win ? 1 : -1;
      store.activity('puzzles');
      toast(`${win ? '+' : ''}${delta} → ${s.puzzleRating}`);
    }
    if (cfg.kind === 'survival') { if (win) streak++; else lives--; if (streak > s.bestStreak) s.bestStreak = streak; store.activity('puzzles'); }
    if (cfg.kind === 'mistakes' && win) { p.own.solved = (p.own.solved || 0) + 1; }
    store.save(); score();
  }
  function success() {
    done = true; board.o.movable = () => false;
    sound('good');
    if (!failed) result(true);
    fb(failed ? '✔️ Résolu (après une erreur). Retiens bien ce motif !' : hinted ? '✅ Résolu avec un indice.' : '🎉 Bravo, exercice réussi !', 'ok');
    const themeNames = p.themes.filter((t) => THEMES[t] && t !== 'quiet').map((t) => THEMES[t].icon + ' ' + THEMES[t].name).join(' · ');
    if (themeNames) $('#info', v).innerHTML += `<br>Thème : ${themeNames}`;
    if (cfg.kind === 'survival' && lives <= 0) return gameOver();
    foot([['Suivant ▶', load, 'green'], ['🔍 Analyser', () => (location.hash = '#/analyse?fen=' + encodeURIComponent(startFen()))]]);
    if (cfg.kind === 'survival') setTimeout(() => alive && done && load(), 1200);
  }
  function startFen() { const c = new Chess(p.fen); if (p.mistake) c.move({ from: p.mistake.slice(0, 2), to: p.mistake.slice(2, 4), promotion: p.mistake[4] || 'q' }); return c.fen(); }
  function hint() {
    if (done) return;
    hinted = true;
    if (!failed && cfg.kind === 'train') { failed = true; result(false); }
    const e = p.sol[step];
    board.setMarks({ [e.slice(0, 2)]: 'goodsq' }); board.pulse(e.slice(0, 2));
    fb('💡 Joue avec cette pièce.', 'info');
  }
  async function solution() {
    if (done) return;
    if (!failed) { failed = true; result(false); }
    done = true; board.o.movable = () => false; board.setMarks({});
    fb('Voici la solution :', 'info');
    while (step < p.sol.length && alive) {
      const u = p.sol[step];
      board.setArrows([{ from: u.slice(0, 2), to: u.slice(2, 4), color: 'rgba(129,182,76,.85)' }]);
      await sleep(800); if (!alive) return;
      const m = game.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || 'q' });
      boardShow(board, game.fen(), m, true); board.setArrows([]); sound(m.captured ? 'capture' : 'move');
      step++;
      await sleep(400);
    }
    fb('👆 Voilà la solution. Rejoue-la dans ta tête pour retenir le motif.', 'info');
    if (cfg.kind === 'survival') { if (lives <= 0) return gameOver(); setTimeout(() => alive && load(), 900); return; }
    foot([['Suivant ▶', load, 'green'], ['Réessayer', () => { const keep = p; cfg._again = keep; const nx = cfg.next; cfg.next = () => { cfg.next = nx; return keep; }; load(); }], ['🔍 Analyser', () => (location.hash = '#/analyse?fen=' + encodeURIComponent(startFen()))]]);
  }
  function gameOver() {
    done = true;
    fb(`💀 Fin de la série : <b>${streak}</b> exercices réussis. Record : ${s.bestStreak}.`, 'info');
    foot([['Recommencer', () => { lives = 3; streak = 0; location.hash = '#/exercices'; setTimeout(() => (location.hash = '#/exercices/survie'), 0); }, 'green']]);
  }
  load();
  return () => { alive = false; };
}
