import { Chess, store, h, $, $$, esc, fr, boardShow, sound, toast, sleep } from '../util.js';
import { Board } from '../board.js';
import { MODULES } from '../data/lessons.js';
import { analyse } from '../engine.js';
import { THEMES } from './puzzles.js';

const THEME_LINK = { fork: 'fork', pin: 'pin', skewer: 'skewer', discovered: 'discovered', mate: 'mate1' };
const norm = (s) => s.replace(/[+#!?]/g, '');

export async function render(el, [modId, lesId]) {
  if (!modId) return list(el);
  const mod = MODULES.find((m) => m.id === modId);
  const les = mod?.lessons.find((l) => l.id === lesId);
  if (!les) return list(el);
  return player(el, mod, les);
}

function list(el) {
  const s = store.s;
  el.appendChild(h(`<div style="max-width:900px;margin:0 auto"><h1>🎓 Leçons</h1>
  <p class="muted">Des leçons courtes et interactives : tu lis, puis tu joues le bon coup sur l'échiquier.</p>
  ${MODULES.map((m) => {
    const done = m.lessons.filter((l) => s.lessons[l.id]).length;
    return `<div class="card" style="margin-bottom:14px"><div class="flex"><span style="font-size:28px">${m.icon}</span><div><div style="font-weight:800;font-size:17px">${esc(m.title)}</div><div class="small muted">${esc(m.desc)}</div></div><span class="spacer"></span><span class="badge ${done === m.lessons.length ? 'ok' : ''}">${done}/${m.lessons.length}</span></div>
    <div class="pbar" style="margin:10px 0"><i style="width:${done / m.lessons.length * 100}%"></i></div>
    <div class="list">${m.lessons.map((l) => `<a class="li" href="#/lecons/${m.id}/${l.id}" style="text-decoration:none;color:#fff"><div class="check ${s.lessons[l.id] ? 'ok' : ''}">${s.lessons[l.id] ? '✓' : ''}</div><div><div class="ttl">${esc(l.title)}</div><div class="sub">${l.steps.length} étapes · ${l.mins} min</div></div><div class="right">▶</div></a>`).join('')}</div></div>`;
  }).join('')}</div>`));
}

function player(el, mod, les) {
  let alive = true, idx = 0, game, done, k, moveCount;
  el.innerHTML = '';
  const v = h(`<div class="layout">
    <div class="boardcol"><div id="lb"></div></div>
    <div class="panelcol">
      <div class="phead"><a href="#/lecons" class="btn ghost small">←</a><span style="font-size:16px">${esc(les.title)}</span><span class="spacer"></span><span class="badge" id="stepn"></span></div>
      <div class="pbody"><div class="pbar" style="margin-bottom:12px"><i id="lp"></i></div><div class="lesson-text" id="txt"></div><div id="fb"></div></div>
      <div class="pfoot"><button class="btn small" id="prev">◀ Précédent</button><button class="btn small" id="hint">💡 Indice</button><button class="btn small" id="reset">↺</button><span class="spacer"></span><button class="btn green" id="next">Suivant ▶</button></div>
    </div></div>`);
  el.appendChild(v);
  const board = new Board($('#lb', v));
  const fb = (html, cls) => { $('#fb', v).innerHTML = html ? `<div class="feedback ${cls}">${html}</div>` : ''; };

  function startPos(st) { const c = new Chess(st.fen || undefined); if (st.pgn) for (const m of st.pgn.split(' ')) c.move(m); return c; }
  function show(i) {
    idx = i; const st = les.steps[i];
    game = startPos(st); done = !(st.task || st.play); k = 0; moveCount = 0;
    $('#stepn', v).textContent = `${i + 1} / ${les.steps.length}`;
    $('#lp', v).style.width = ((i + 1) / les.steps.length * 100) + '%';
    $('#txt', v).innerHTML = st.t;
    fb(st.task ? `${game.turn() === 'w' ? '⚪' : '⚫'} À toi de jouer (${game.turn() === 'w' ? 'Blancs' : 'Noirs'})` : st.play ? `🎯 Objectif : ${st.play.goal === 'mate' ? 'mater' : 'promouvoir ton pion'} en ${st.play.max} coups maximum.` : '', 'info');
    board.setOrientation(st.orient || (st.task || st.play ? game.turn() : 'w'));
    const hist = game.history({ verbose: true });
    boardShow(board, game.fen(), hist.length ? hist[hist.length - 1] : null);
    board.setArrows((st.arrows || []).map(([from, to, color]) => ({ from, to, color })));
    board.setMarks(st.marks || {});
    $('#prev', v).disabled = i === 0;
    $('#hint', v).classList.toggle('hidden', !st.task?.hint && !st.task);
    $('#reset', v).classList.toggle('hidden', !st.play && !st.task);
    updateNext();
    board.o.movable = (sq) => { const p = game.get(sq); return !done && (st.task || st.play) && p && p.color === game.turn() && (!st.play || game.turn() === playerColor); };
    board.o.targets = (sq) => game.moves({ square: sq, verbose: true }).map((m) => m.to);
    board.o.onMove = (from, to, promo, animate) => onMove(st, from, to, promo, animate);
    playerColor = game.turn();
  }
  let playerColor = 'w';
  function updateNext() {
    const last = idx === les.steps.length - 1;
    const b = $('#next', v);
    b.textContent = last ? (done ? '✓ Terminer' : 'Terminer') : 'Suivant ▶';
    b.disabled = !done;
  }
  async function onMove(st, from, to, promo, animate) {
    let m; try { m = game.move({ from, to, promotion: promo || 'q' }); } catch (e) { boardShow(board, game.fen()); return; }
    boardShow(board, game.fen(), m, animate); board.setArrows([]); board.setMarks({});
    import('../util.js').then((u) => u.moveSound(m, game));
    if (st.task) {
      const exp = st.task.moves[k];
      if (norm(m.san) === norm(exp)) {
        k++;
        if (k >= st.task.moves.length) return win('Bravo, c\'est exactement ça ! 🎉');
        fb('✅ Bien joué ! Continue…', 'ok');
        await sleep(550); if (!alive) return;
        const r = game.move(st.task.moves[k]); k++;
        boardShow(board, game.fen(), r, true); sound(r.captured ? 'capture' : 'move');
        if (k >= st.task.moves.length) return win('Bravo ! 🎉');
        return;
      }
      if (k === 0 && (st.task.accept || []).some((a) => norm(a) === norm(m.san))) return win(`✅ ${fr(m.san)} marche aussi, bien joué ! (le coup principal était ${fr(exp)})`);
      sound('bad');
      board.setMarks({ [m.to]: 'red' });
      await sleep(450); if (!alive) return;
      game.undo(); const hist = game.history({ verbose: true });
      boardShow(board, game.fen(), hist[hist.length - 1] || null); board.setMarks({});
      fb(`❌ ${fr(m.san)} n'est pas le coup attendu. Réessaie !`, 'bad');
      return;
    }
    if (st.play) {
      moveCount++;
      const goal = st.play.goal;
      if (goal === 'promote' && m.promotion) return win('Ton pion est devenu une dame ! 🎉');
      if (game.isCheckmate()) return win(`Échec et mat en ${moveCount} coups ! 🎉`);
      if (game.isStalemate()) { done = false; sound('bad'); fb('😬 Pat ! Le roi noir n\'a plus de coup mais n\'est pas en échec : c\'est nulle. Appuie sur ↺ pour recommencer.', 'bad'); board.o.movable = () => false; return; }
      if (game.isDraw()) { sound('bad'); fb('Partie nulle. Appuie sur ↺ pour recommencer.', 'bad'); board.o.movable = () => false; return; }
      if (moveCount >= st.play.max) { sound('bad'); fb(`Tu as dépassé ${st.play.max} coups. Appuie sur ↺ pour réessayer.`, 'bad'); board.o.movable = () => false; return; }
      fb(`Coup ${moveCount} / ${st.play.max}`, 'info');
      const r = await analyse(game.fen(), { depth: 10 });
      if (!alive || !r.bestmove) return;
      await sleep(250);
      const rm = game.move({ from: r.bestmove.slice(0, 2), to: r.bestmove.slice(2, 4), promotion: r.bestmove[4] || 'q' });
      boardShow(board, game.fen(), rm, true); sound(rm.captured ? 'capture' : 'move');
      if (goal === 'promote' && rm.captured === 'p') { fb('Ton pion a été pris ! Appuie sur ↺ pour recommencer.', 'bad'); board.o.movable = () => false; }
    }
  }
  function win(msg) {
    done = true; sound('good'); fb(msg, 'ok'); updateNext();
    board.o.movable = () => false;
  }
  $('#prev', v).onclick = () => idx > 0 && show(idx - 1);
  $('#reset', v).onclick = () => show(idx);
  $('#hint', v).onclick = () => {
    const st = les.steps[idx]; if (!st.task || done) return;
    const c = new Chess(game.fen()); const m = c.move(st.task.moves[k]);
    board.setMarks({ [m.from]: 'goodsq' }); board.pulse(m.from);
    fb('💡 ' + (st.task.hint || 'Joue avec la pièce en surbrillance.'), 'info');
  };
  $('#next', v).onclick = () => {
    if (!done) return;
    if (idx < les.steps.length - 1) return show(idx + 1);
    store.s.lessons[les.id] = Date.now(); store.save(); store.activity('lessons');
    sound('end');
    const all = MODULES.flatMap((m) => m.lessons.map((l) => ({ m, l })));
    const pos = all.findIndex((x) => x.l.id === les.id);
    const nx = all[pos + 1];
    const th = THEME_LINK[les.theme];
    $('#txt', v).innerHTML = `<h2 style="margin-top:0">🎓 Leçon terminée !</h2><p>Pour bien retenir, rien de mieux que la pratique.</p>`;
    fb('');
    $('.pfoot', v).innerHTML = `${th && THEMES[th] ? `<a class="btn green" href="#/exercices/theme/${th}">🧩 Exercices : ${THEMES[th].name}</a>` : ''}${nx ? `<a class="btn ${th ? '' : 'green'}" href="#/lecons/${nx.m.id}/${nx.l.id}">Leçon suivante ▶</a>` : ''}<a class="btn ghost" href="#/lecons">Toutes les leçons</a>`;
  };
  show(0);
  return () => { alive = false; };
}
