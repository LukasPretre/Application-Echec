// Interactive chessboard (click or drag), chess.com-like look.
const FILES = 'abcdefgh';
export const sqName = (f, r) => FILES[f] + (r + 1);
const fileOf = (s) => FILES.indexOf(s[0]);
const rankOf = (s) => +s[1] - 1;

export function parseFen(fen) {
  const map = {};
  const rows = fen.split(' ')[0].split('/');
  rows.forEach((row, i) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += +ch;
      else { map[sqName(f, 7 - i)] = (ch === ch.toUpperCase() ? 'w' : 'b') + ch.toLowerCase(); f++; }
    }
  });
  return map;
}

export class Board {
  constructor(el, opts = {}) {
    this.el = el;
    this.o = Object.assign({ orientation: 'w', coords: true, movable: () => false, targets: () => [], onMove: () => {} }, opts);
    this.el.classList.add('board');
    this.el.innerHTML = '<div class="sqs"></div><div class="pcs"></div><svg class="arrows" viewBox="0 0 8 8"></svg>';
    this.sqsEl = el.querySelector('.sqs');
    this.pcsEl = el.querySelector('.pcs');
    this.svg = el.querySelector('.arrows');
    this.pos = {};
    this.lastMove = null; this.checkSq = null; this.marks = {}; this.badges = {}; this.arrows = [];
    this.selected = null;
    this.userArrows = []; this.userCircles = [];
    this.drawSquares();
    this.bind();
  }
  get orientation() { return this.o.orientation; }
  setOrientation(c) { this.o.orientation = c; this.drawSquares(); this.renderPieces(false); this.drawArrows(); }
  flip() { this.setOrientation(this.o.orientation === 'w' ? 'b' : 'w'); }
  xy(sq) { // display col,row (0..7) from top-left
    const f = fileOf(sq), r = rankOf(sq);
    return this.o.orientation === 'w' ? [f, 7 - r] : [7 - f, r];
  }
  sqAt(col, row) { return this.o.orientation === 'w' ? sqName(col, 7 - row) : sqName(7 - col, row); }
  drawSquares() {
    let h = '';
    for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
      const sq = this.sqAt(col, row);
      const light = (fileOf(sq) + rankOf(sq)) % 2 === 1;
      let c = '';
      if (this.o.coords) {
        if (row === 7) c += `<span class="coord f">${sq[0]}</span>`;
        if (col === 0) c += `<span class="coord r">${sq[1]}</span>`;
      }
      h += `<div class="sq ${light ? 'l' : 'd'}" data-sq="${sq}">${c}</div>`;
    }
    this.sqsEl.innerHTML = h;
    this.decorate();
  }
  sqEl(sq) { return this.sqsEl.querySelector(`[data-sq="${sq}"]`); }
  decorate() {
    this.sqsEl.querySelectorAll('.sq').forEach((d) => {
      d.classList.remove('last', 'selected', 'check', 'red', 'goodsq', 'hover');
      d.querySelectorAll('.dot,.ring,.badgeicon').forEach((x) => x.remove());
    });
    if (this.lastMove) for (const s of this.lastMove) this.sqEl(s)?.classList.add('last');
    if (this.checkSq) this.sqEl(this.checkSq)?.classList.add('check');
    for (const [s, c] of Object.entries(this.marks)) this.sqEl(s)?.classList.add(c);
    if (this.selected) {
      this.sqEl(this.selected)?.classList.add('selected');
      for (const t of this.o.targets(this.selected)) {
        const e = this.sqEl(t); if (!e) continue;
        const d = document.createElement('div'); d.className = this.pos[t] ? 'ring' : 'dot'; e.appendChild(d);
      }
    }
    for (const [s, b] of Object.entries(this.badges)) {
      const e = this.sqEl(s); if (!e) continue;
      const d = document.createElement('div'); d.className = 'badgeicon'; d.style.background = b.color; d.textContent = b.text; e.appendChild(d);
    }
  }
  set(fen, { lastMove = null, animate = false, check = null } = {}) {
    const prev = this.pos;
    this.pos = parseFen(fen);
    this.lastMove = lastMove; this.checkSq = check; this.selected = null;
    this.userArrows = []; this.userCircles = [];
    this.renderPieces(animate && lastMove && prev[lastMove[0]] ? lastMove : null);
    this.decorate(); this.drawArrows();
  }
  place(el, sq) { const [c, r] = this.xy(sq); el.style.transform = `translate(${c * 100}%,${r * 100}%)`; }
  renderPieces(anim) {
    this.pcsEl.innerHTML = '';
    this.pieceEls = {};
    for (const [sq, p] of Object.entries(this.pos)) {
      const d = document.createElement('div');
      d.className = 'pc ' + p;
      if (anim && sq === anim[1]) {
        this.place(d, anim[0]);
        requestAnimationFrame(() => requestAnimationFrame(() => { d.classList.add('anim'); this.place(d, sq); }));
      } else this.place(d, sq);
      this.pcsEl.appendChild(d);
      this.pieceEls[sq] = d;
    }
  }
  setMarks(m = {}) { this.marks = m; this.decorate(); }
  setBadges(b = {}) { this.badges = b; this.decorate(); }
  setArrows(a = []) { this.arrows = a; this.drawArrows(); }
  pulse(sq) { const e = this.pieceEls?.[sq]; if (e) { e.classList.remove('hint'); void e.offsetWidth; e.classList.add('hint'); } }
  drawArrows() {
    const all = [...this.arrows, ...this.userArrows.map((a) => ({ ...a, color: 'rgba(255,170,0,.8)' }))];
    let h = '<defs>';
    const colors = [...new Set(all.map((a) => a.color || 'rgba(255,170,0,.8)'))];
    colors.forEach((c, i) => { h += `<marker id="ah${i}" markerWidth="4" markerHeight="4" refX="2.05" refY="2" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L4,2 L0,4 z" fill="${c}"/></marker>`; });
    h += '</defs>';
    for (const a of all) {
      const c = a.color || 'rgba(255,170,0,.8)';
      const [x1, y1] = this.xy(a.from), [x2, y2] = this.xy(a.to);
      const cx1 = x1 + .5, cy1 = y1 + .5, cx2 = x2 + .5, cy2 = y2 + .5;
      const dx = cx2 - cx1, dy = cy2 - cy1, len = Math.hypot(dx, dy);
      const ex = cx2 - dx / len * 0.32, ey = cy2 - dy / len * 0.32;
      h += `<line x1="${cx1}" y1="${cy1}" x2="${ex}" y2="${ey}" stroke="${c}" stroke-width="0.16" stroke-linecap="round" marker-end="url(#ah${colors.indexOf(c)})" opacity="${a.opacity || 1}"/>`;
    }
    for (const s of this.userCircles) { const [x, y] = this.xy(s); h += `<circle cx="${x + .5}" cy="${y + .5}" r=".44" fill="none" stroke="rgba(255,170,0,.8)" stroke-width=".07"/>`; }
    this.svg.innerHTML = h;
  }
  pointToSq(e) {
    const r = this.el.getBoundingClientRect();
    const col = Math.floor((e.clientX - r.left) / r.width * 8), row = Math.floor((e.clientY - r.top) / r.height * 8);
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    return this.sqAt(col, row);
  }
  bind() {
    this.el.addEventListener('contextmenu', (e) => e.preventDefault());
    this.el.addEventListener('pointerdown', (e) => {
      if (e.button === 2) { this.rightStart = this.pointToSq(e); return; }
      if (e.button !== 0) return;
      this.closePromo();
      const sq = this.pointToSq(e); if (!sq) return;
      if (this.userArrows.length || this.userCircles.length) { this.userArrows = []; this.userCircles = []; this.drawArrows(); }
      if (this.selected && this.selected !== sq && this.o.targets(this.selected).includes(sq)) {
        this.tryMove(this.selected, sq, true); return;
      }
      if (this.pos[sq] && this.o.movable(sq)) {
        const wasSelected = this.selected === sq;
        this.selected = sq; this.decorate();
        const pe = this.pieceEls[sq];
        this.drag = { from: sq, el: pe, wasSelected, moved: false, x: e.clientX, y: e.clientY };
        this.el.setPointerCapture(e.pointerId);
        e.preventDefault();
      } else { this.selected = null; this.decorate(); }
    });
    this.el.addEventListener('pointermove', (e) => {
      const d = this.drag; if (!d) return;
      if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 4) return;
      d.moved = true;
      const r = this.el.getBoundingClientRect(), w = r.width / 8;
      d.el.classList.add('drag'); d.el.classList.remove('anim');
      d.el.style.transform = `translate(${e.clientX - r.left - w / 2}px,${e.clientY - r.top - w / 2}px) scale(1.08)`;
      const over = this.pointToSq(e);
      if (over !== d.over) { if (d.over) this.sqEl(d.over)?.classList.remove('hover'); d.over = over; if (over) this.sqEl(over)?.classList.add('hover'); }
    });
    const end = (e) => {
      const d = this.drag; if (!d) return;
      this.drag = null;
      if (d.over) this.sqEl(d.over)?.classList.remove('hover');
      d.el.classList.remove('drag');
      const to = this.pointToSq(e);
      if (d.moved && to && to !== d.from && this.o.targets(d.from).includes(to)) { this.tryMove(d.from, to, false); return; }
      this.place(d.el, d.from);
      if (d.moved || (d.wasSelected && to === d.from)) { if (!d.moved) { this.selected = null; } this.decorate(); }
      if (d.moved && to !== d.from) { this.selected = null; this.decorate(); }
    };
    this.el.addEventListener('pointerup', (e) => {
      if (e.button === 2 && this.rightStart) {
        const to = this.pointToSq(e), from = this.rightStart; this.rightStart = null;
        if (!to) return;
        if (to === from) { const i = this.userCircles.indexOf(to); i >= 0 ? this.userCircles.splice(i, 1) : this.userCircles.push(to); }
        else { const i = this.userArrows.findIndex((a) => a.from === from && a.to === to); i >= 0 ? this.userArrows.splice(i, 1) : this.userArrows.push({ from, to }); }
        this.drawArrows(); return;
      }
      end(e);
    });
    this.el.addEventListener('pointercancel', end);
  }
  tryMove(from, to, animate) {
    const p = this.pos[from];
    if (p && p[1] === 'p' && (to[1] === '8' || to[1] === '1')) {
      if (!animate) this.place(this.pieceEls[from], to);
      this.askPromo(from, to, p[0]);
      return;
    }
    this.selected = null;
    this.o.onMove(from, to, undefined, animate);
  }
  askPromo(from, to, color) {
    this.closePromo();
    const [c, r] = this.xy(to);
    const box = document.createElement('div');
    box.className = 'promo';
    box.style.left = c * 12.5 + '%';
    const down = r === 0;
    box.style[down ? 'top' : 'bottom'] = '0';
    for (const t of ['q', 'n', 'r', 'b']) {
      const d = document.createElement('div'); d.className = 'pc ' + color + t; d.style.position = 'static'; d.style.width = '100%'; d.style.height = 'auto';
      d.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.closePromo(); this.selected = null; this.o.onMove(from, to, t, false); });
      box.appendChild(d);
    }
    this.el.appendChild(box); this.promoEl = box;
  }
  closePromo() { if (this.promoEl) { this.promoEl.remove(); this.promoEl = null; this.renderPieces(null); } }
}
