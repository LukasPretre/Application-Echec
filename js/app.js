import { store, $, $$, h, esc } from './util.js';
import { MODULES } from './data/lessons.js';
import { REPERTOIRES } from './data/openings.js';
import { warmup } from './engine.js';

const views = {
  jouer: () => import('./views/play.js'),
  bilan: () => import('./views/review.js'),
  exercices: () => import('./views/puzzles.js'),
  lecons: () => import('./views/lessons.js'),
  ouvertures: () => import('./views/openings.js'),
  analyse: () => import('./views/analysis.js'),
};
let cleanup = null;

async function route() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [path, query] = hash.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const name = parts[0] || 'home';
  const params = Object.fromEntries(new URLSearchParams(query || ''));
  $$('.nav a').forEach((a) => a.classList.toggle('on', a.dataset.r === (name === 'bilan' ? 'jouer' : name)));
  if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
  const el = $('#view');
  el.innerHTML = '';
  window.scrollTo(0, 0);
  if (name === 'home') { home(el); return; }
  const loader = views[name];
  if (!loader) { home(el); return; }
  const mod = await loader();
  cleanup = (await mod.render(el, parts.slice(1), params)) || null;
}

function nextLesson() {
  for (const m of MODULES) for (const l of m.lessons) if (!store.s.lessons[l.id]) return { m, l };
  return null;
}

function home(el) {
  const s = store.s;
  const totalLessons = MODULES.reduce((a, m) => a + m.lessons.length, 0);
  const doneLessons = Object.keys(s.lessons).length;
  const lines = REPERTOIRES.flatMap((r) => r.lines);
  const learned = lines.filter((l) => s.openings[l.id]?.learned).length;
  const t = store.today();
  const nl = nextLesson();
  const resume = s.current && !s.current.over;
  el.appendChild(h(`<div style="max-width:1050px;margin:0 auto">
  <h1>Salut ! Prêt à progresser ? ♟️</h1>
  <div class="stats" style="margin-bottom:18px">
    <div class="stat"><div class="v" style="color:var(--inacc)">${s.puzzleRating}</div><div class="k">Classement exercices</div></div>
    <div class="stat"><div class="v">${s.games.length}</div><div class="k">Parties jouées</div></div>
    <div class="stat"><div class="v">${doneLessons}/${totalLessons}</div><div class="k">Leçons terminées</div></div>
    <div class="stat"><div class="v">${learned}/${lines.length}</div><div class="k">Lignes d'ouverture</div></div>
  </div>
  <h2>📅 Ton programme du jour</h2>
  <div class="tiles">
    ${resume ? `<a class="tile" href="#/jouer" style="border-color:var(--green)"><div class="ic">▶️</div><div class="t">Reprendre ta partie</div><div class="d">Contre ${esc(s.current.botName || 'le bot')}, ${s.current.moves?.length || 0} demi-coups joués.</div></a>` : ''}
    <a class="tile" href="#/exercices/entrainement"><div class="ic">🧩</div><div class="t">10 exercices tactiques</div><div class="d">${Math.min(t.puzzles || 0, 10)}/10 aujourd'hui</div><div class="pbar" style="margin-top:8px"><i style="width:${Math.min(100, (t.puzzles || 0) * 10)}%"></i></div></a>
    ${nl ? `<a class="tile" href="#/lecons/${nl.m.id}/${nl.l.id}"><div class="ic">${nl.m.icon}</div><div class="t">Leçon : ${esc(nl.l.title)}</div><div class="d">${esc(nl.m.title)} · ${nl.l.mins} min</div></a>` : `<a class="tile" href="#/lecons"><div class="ic">🎓</div><div class="t">Toutes les leçons sont faites !</div><div class="d">Refais-les pour réviser.</div></a>`}
    <a class="tile" href="#/ouvertures/revision"><div class="ic">📖</div><div class="t">Réviser tes ouvertures</div><div class="d">Londres avec les Blancs, Française avec les Noirs.</div></a>
    <a class="tile" href="#/jouer"><div class="ic">⚔️</div><div class="t">Une partie + son bilan</div><div class="d">Joue, puis regarde le bilan pour comprendre tes erreurs.</div></a>
  </div>
  <h2>💡 La méthode pour passer de 700 à 1000</h2>
  <div class="card lesson-text">
    <p><b>1. Arrête de donner des pièces.</b> Avant chaque coup : « Qu'est-ce qu'il menace ? Mes pièces sont-elles défendues ? » (leçon <a href="#/lecons/bases/antigaffe">routine anti-gaffe</a>).</p>
    <p><b>2. Fais des exercices tous les jours.</b> 10 à 20 par jour suffisent : ton cerveau apprend à voir les fourchettes, les clouages et les mats.</p>
    <p><b>3. Joue peu d'ouvertures, mais connais-les bien.</b> Le <b>Système de Londres</b> avec les Blancs et la <b>Défense Française</b> avec les Noirs.</p>
    <p><b>4. Analyse chaque partie.</b> Le bilan te montre le moment où tout a basculé. Tes erreurs deviennent ensuite des exercices dans « Mes erreurs ».</p>
  </div>
  ${s.games.length ? `<h2>🕘 Dernières parties</h2><div class="list">${s.games.slice(0, 5).map((g) => `<a class="li" href="#/bilan/${g.id}" style="text-decoration:none;color:#fff"><div class="check ${g.score === 1 ? 'ok' : ''}">${g.score === 1 ? '✓' : g.score === 0.5 ? '½' : '✗'}</div><div><div class="ttl">${g.color === 'w' ? '⚪' : '⚫'} contre ${esc(g.botName)} (≈${g.botElo})</div><div class="sub">${new Date(g.date).toLocaleDateString('fr-FR')} · ${esc(g.opening || '')} · ${g.result}</div></div><div class="right">${g.accuracy ? `<span class="badge">Précision ${g.accuracy}%</span>` : '<span class="badge">Voir le bilan</span>'}</div></a>`).join('')}</div>` : ''}
  <div class="sep" style="margin-top:28px"></div>
  <p class="dim small">Échecs Coach · moteur Stockfish 19 (GPL) · pièces cburnett (CC BY-SA 3.0). Tes progrès sont enregistrés sur cet appareil.
  <a href="#" id="exportbtn">Exporter</a> · <a href="#" id="importbtn">Importer</a> mes données · <a href="#" id="soundbtn">Son : ${s.settings.sound ? 'activé' : 'coupé'}</a></p>
  </div>`));
  $('#soundbtn').onclick = (e) => { e.preventDefault(); s.settings.sound = !s.settings.sound; store.save(); route(); };
  $('#exportbtn').onclick = (e) => {
    e.preventDefault();
    const blob = new Blob([JSON.stringify(s)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'echecs-coach-sauvegarde.json'; a.click();
  };
  $('#importbtn').onclick = (e) => {
    e.preventDefault();
    const i = document.createElement('input'); i.type = 'file'; i.accept = '.json';
    i.onchange = async () => { try { const d = JSON.parse(await i.files[0].text()); Object.assign(s, d); store.save(); route(); } catch (err) { alert('Fichier invalide'); } };
    i.click();
  };
}

window.addEventListener('hashchange', route);
route();
setTimeout(warmup, 800);
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
