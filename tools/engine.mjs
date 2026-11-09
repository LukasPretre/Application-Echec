// Minimal UCI wrapper around stockfish.js for Node (used by build/validation scripts)
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SF = path.join(here, '..', 'node_modules', 'stockfish', 'bin', 'stockfish-19-lite-single.js');

export class Engine {
  constructor() {
    this.p = spawn('node', [SF], { stdio: ['pipe', 'pipe', 'inherit'] });
    this.buf = '';
    this.listeners = [];
    this.p.stdout.on('data', (d) => {
      this.buf += d.toString();
      let i;
      while ((i = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, i).trim();
        this.buf = this.buf.slice(i + 1);
        for (const l of [...this.listeners]) l(line);
      }
    });
  }
  send(cmd) { this.p.stdin.write(cmd + '\n'); }
  waitFor(pred) {
    return new Promise((res) => {
      const l = (line) => { if (pred(line)) { this.listeners = this.listeners.filter((x) => x !== l); res(line); } };
      this.listeners.push(l);
    });
  }
  async init() {
    this.send('uci');
    await this.waitFor((l) => l === 'uciok');
    this.send('setoption name Hash value 32');
    this.send('isready');
    await this.waitFor((l) => l === 'readyok');
  }
  // returns [{move, cp, mate, pv}] sorted by multipv, scores from side-to-move perspective
  async analyse(fen, { depth = 12, multipv = 1 } = {}) {
    this.send(`setoption name MultiPV value ${multipv}`);
    this.send(`position fen ${fen}`);
    const lines = {};
    const l = (line) => {
      if (!line.startsWith('info') || !line.includes(' pv ')) return;
      const m = line.match(/multipv (\d+)/);
      const k = m ? +m[1] : 1;
      const sc = line.match(/score (cp|mate) (-?\d+)/);
      const pv = line.split(' pv ')[1].split(' ');
      lines[k] = { move: pv[0], pv, cp: sc[1] === 'cp' ? +sc[2] : null, mate: sc[1] === 'mate' ? +sc[2] : null };
    };
    this.listeners.push(l);
    this.send(`go depth ${depth}`);
    await this.waitFor((x) => x.startsWith('bestmove'));
    this.listeners = this.listeners.filter((x) => x !== l);
    return Object.keys(lines).sort((a, b) => a - b).map((k) => lines[k]);
  }
  quit() { this.send('quit'); }
}

// convert score to a single comparable number (cp), mate = +-100000 adjusted by distance
export function val(s) {
  if (!s) return 0;
  if (s.mate !== null) return s.mate > 0 ? 100000 - s.mate * 100 : -100000 - s.mate * 100;
  return s.cp;
}
