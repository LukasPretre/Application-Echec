import { Chess, store, h, $, $$, esc, fr, boardShow, sound, sleep, toast } from '../util.js';
import { Board } from '../board.js';
import { REPERTOIRES } from '../data/openings.js';

const allLines = () => REPERTOIRES.flatMap((r) => r.lines.map((l) => ({ r, l })));
function status(id) {
  const o = store.s.openings[id];
  if (!o) return { icon: '☆', label: 'Nouvelle', cls: '' };
  if ((o.perfect || 0) >= 3) return { icon: '★', label: 'Maîtrisée', cls: 'ok' };
  if (o.learned) return { icon: '✓', label: `Apprise · ${o.perfect || 0}/3 sans faute`, cls: 'ok' };
  return { icon: '☆', label: 'Commencée', cls: '' };
}

export async function render(el, [a, b, mode]) {
  if (a === 'revision') return revision(el);
  if (a && b) {
    const r = REPERTOIRES.find((x) => x.id === a); const l = r?.lines.find((x) => x.id === b);
    if (l) return trainer(el, r, l, mode === 'pratique' ? 'practice' : 'learn');
  }
  menu(el);
}

function menu(el) {
  el.appendChild(h(`<div style="max-width:1000px;margin:0 auto"><h1>📖 Mes ouvertures</h1>
  <div class="card lesson-text" style="margin-bottom:16px">
    <p><b>Le Système de Londres, bon choix à 700 elo ?</b> Oui, très bon. Tu joues presque toujours les mêmes coups (d4, Ff4, e3, c3, Cf3, Cd2, Fd3), quoi que fasse l'adversaire. Tu as donc peu de théorie à apprendre, une position solide sans pièges dangereux pour toi, et des plans d'attaque clairs (Ce5, f4, attaque sur le roi). Tu peux passer ton temps sur la tactique au lieu d'apprendre des variantes par cœur.</p>
    <p>Méthode : <b>Apprendre</b> une ligne (les flèches te guident), puis <b>S'entraîner</b> de mémoire jusqu'à 3 réussites sans faute. Ensuite, utilise la <b>révision</b> tous les jours.</p>
    <a class="btn green" href="#/ouvertures/revision">🔁 Révision aléatoire</a>
  </div>
  ${REPERTOIRES.map((r) => `<div class="card" style="margin-bottom:14px"><div class="flex"><span style="font-size:30px">${r.side === 'w' ? '⚪' : '⚫'}</span><div><div style="font-weight:800;font-size:18px">${esc(r.name)} <span class="badge">${r.side === 'w' ? 'avec les Blancs' : 'avec les Noirs'}</span></div><div class="small muted">${esc(r.desc)}</div></div></div>
    <div class="list" style="margin-top:12px">${r.lines.map((l) => { const st = status(l.id); return `<div class="li"><div class="check ${st.cls}">${st.icon}</div><div><div class="ttl">${esc(l.name)}</div><div class="sub">${Math.ceil(l.moves.length / 2)} coups · ${st.label}</div></div><div class="right"><a class="btn small" href="#/ouvertures/${r.id}/${l.id}/apprendre">Apprendre</a><a class="btn small green" href="#/ouvertures/${r.id}/${l.id}/pratique">S'entraîner</a></div></div>`; }).join('')}</div></div>`).join('')}
  </div>`));
}

function revision(el) {
  const items = allLines();
  const w = items.map(({ l }) => { const o = store.s.openings[l.id]; return o?.learned ? 1 / (1 + (o.perfect || 0)) : 0.25; });
  let x = Math.random() * w.reduce((a, b) => a + b, 0);
  let pick = items[0];
  for (let i = 0; i < items.length; i++) { x -= w[i]; if (x <= 0) { pick = items[i]; break; } }
  return trainer(el, pick.r, pick.l, 'practice', true);
}

function trainer(el, rep, line, mode, isRevision = false) {
  let alive = true, ply = 0, errors = 0, wrongHere = 0, done = false;
  const game = new Chess();
  el.innerHTML = '';
  const v = h(`<div class="layout">
    <div class="boardcol"><div id="ob"></div></div>
    <div class="panelcol">
      <div class="phead"><a href="#/ouvertures" class="btn ghost small">←</a><div><div style="font-size:15px">${esc(rep.name)}</div><div class="small muted" style="font-weight:600">${esc(line.name)}</div></div></div>
      <div class="pbody">
        <div class="opts" style="margin-bottom:12px"><div class="opt ${mode === 'learn' ? 'on' : ''}" id="mLearn">📘 Apprendre</div><div class="opt ${mode === 'practice' ? 'on' : ''}" id="mPrac">🧠 S'entraîner</div></div>
        <div class="pbar" style="margin-bottom:12px"><i id="op"></i></div>
        <div class="coach"><div class="face">🧑‍🏫</div><div class="bubble" id="bubble"></div></div>
        <div class="moves small" id="seq" style="line-height:1.8"></div>
      </div>
      <div class="pfoot" id="foot"><button class="btn small" id="restart">↺ Recommencer</button><button class="btn small" id="show">👁 Montrer le coup</button></div>
    </div></div>`);
  el.appendChild(v);
  const board = new Board($('#ob', v), { orientation: rep.side });
  const bubble = (x) => ($('#bubble', v).innerHTML = x);
  const mySide = rep.side;
  $('#mLearn', v).onclick = () => (location.hash = `#/ouvertures/${rep.id}/${line.id}/apprendre`);
  $('#mPrac', v).onclick = () => (location.hash = `#/ouvertures/${rep.id}/${line.id}/pratique`);
  $('#restart', v).onclick = () => { if (isRevision) trainer(el, rep, line, mode, true); else start(); };
  $('#show', v).onclick = () => { if (done) return; const [san] = line.moves[ply]; arrowFor(san); wrongHere = 2; errors++; };

  function arrowFor(san) { const m = new Chess(game.fen()).move(san); board.setArrows([{ from: m.from, to: m.to, color: 'rgba(129,182,76,.85)' }]); }
  function seq() {
    const parts = [];
    line.moves.slice(0, ply).forEach(([san], i) => { if (i % 2 === 0) parts.push(`<b class="dim">${i / 2 + 1}.</b>`); parts.push(fr(san)); });
    $('#seq', v).innerHTML = parts.join(' ');
    $('#op', v).style.width = (ply / line.moves.length * 100) + '%';
  }
  function start() {
    game.reset(); ply = 0; errors = 0; wrongHere = 0; done = false;
    boardShow(board, game.fen()); board.setArrows([]);
    seq(); step();
  }
  async function step() {
    if (!alive) return;
    if (ply >= line.moves.length) return finish();
    const turn = game.turn();
    const [san, com] = line.moves[ply];
    if (turn !== mySide) {
      board.o.movable = () => false;
      await sleep(ply === 0 ? 300 : 650); if (!alive) return;
      const m = game.move(san); ply++;
      boardShow(board, game.fen(), m, true); sound(m.captured ? 'capture' : 'move');
      seq();
      const lab = (Math.floor((ply - 1) / 2) + 1) + ((ply - 1) % 2 ? '…' : '.');
      if (com) bubble(`<div class="t">${lab} ${fr(san)}</div>${com}`);
      else bubble(`L'adversaire joue <b>${fr(san)}</b>. À toi !`);
      return step();
    }
    wrongHere = 0;
    if (mode === 'learn') {
      arrowFor(san);
      bubble(`<div class="t">Joue ${fr(san)}</div>${com || 'Suis la flèche verte.'}`);
    } else {
      board.setArrows([]);
      const prev = $('#bubble', v).innerHTML;
      if (!prev || ply === 0) bubble('Joue le premier coup de ton répertoire.');
    }
    board.o.movable = (sq) => { const p = game.get(sq); return !done && p && p.color === mySide && game.turn() === mySide; };
    board.o.targets = (sq) => game.moves({ square: sq, verbose: true }).map((m) => m.to);
    board.o.onMove = async (from, to, promo, animate) => {
      let m; try { m = game.move({ from, to, promotion: promo || 'q' }); } catch (e) { boardShow(board, game.fen()); return; }
      const ok = m.san === san;
      if (!ok) {
        boardShow(board, game.fen(), m, animate); board.setMarks({ [m.to]: 'red' }); sound('bad');
        await sleep(450); if (!alive) return;
        game.undo(); const hst = game.history({ verbose: true }); boardShow(board, game.fen(), hst[hst.length - 1] || null); board.setMarks({});
        errors++; wrongHere++;
        if (mode === 'learn' || wrongHere >= 2) { arrowFor(san); bubble(`<div class="t">❌ Pas ${fr(m.san)}</div>Le coup du répertoire est <b>${fr(san)}</b>. ${com}`); }
        else bubble(`<div class="t">❌ ${fr(m.san)} n'est pas dans ton répertoire</div>Réessaie ! Indice : regarde ${new Chess(game.fen()).move(san).piece === 'p' ? 'tes pions' : 'tes pièces'}.`);
        return;
      }
      ply++;
      boardShow(board, game.fen(), m, animate); board.setArrows([]);
      import('../util.js').then((u) => u.moveSound(m, game));
      seq();
      bubble(`<div class="t">✅ ${fr(san)}</div>${com || 'Bien joué.'}`);
      board.o.movable = () => false;
      await sleep(mode === 'learn' && com ? 900 : 450);
      step();
    };
  }
  function finish() {
    done = true; board.o.movable = () => false; sound('end');
    const o = store.s.openings[line.id] = store.s.openings[line.id] || { learned: false, perfect: 0, runs: 0 };
    o.runs++; if (mode === 'learn') o.learned = true;
    if (mode === 'practice') { o.learned = true; if (errors === 0) o.perfect = (o.perfect || 0) + 1; }
    store.save(); store.activity('openings');
    bubble(`<div class="t">🎉 Ligne terminée !</div>${mode === 'practice' ? (errors === 0 ? `Sans aucune faute ! (${o.perfect}/3 pour la maîtriser)` : `${errors} erreur${errors > 1 ? 's' : ''}. Recommence pour la faire sans faute.`) : 'Maintenant, essaie de la rejouer de mémoire avec « S\'entraîner ».'}`);
    const f = $('#foot', v);
    f.innerHTML = '';
    const add = (label, fn, cls = '') => { const b = h(`<button class="btn small ${cls}">${label}</button>`); b.onclick = fn; f.appendChild(b); };
    if (isRevision) add('Ligne suivante ▶', () => revision(el), 'green');
    else if (mode === 'learn') add("🧠 S'entraîner", () => (location.hash = `#/ouvertures/${rep.id}/${line.id}/pratique`), 'green');
    else add('↺ Encore', () => trainer(el, rep, line, mode), 'green');
    add('🔍 Analyser la position', () => (location.hash = '#/analyse?fen=' + encodeURIComponent(game.fen())));
    add('Toutes les lignes', () => (location.hash = '#/ouvertures'), 'ghost');
  }
  start();
  return () => { alive = false; };
}
