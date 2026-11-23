// Confete, sons curtinhos e a tela de comemoração da ofensiva.
import { h, ICONES } from './util.js';

const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- confete ----------
let particulas = [];
let rodando = false;
export function confete(x, y, cores = ['#ff9a3c', '#ffc857', '#8ec5f5', '#f4a3b0', '#a6dd8f'], qtd = 70) {
  if (reduzido) return;
  for (let i = 0; i < qtd; i++) {
    const ang = Math.random() * Math.PI * 2;
    const vel = 3 + Math.random() * 7;
    particulas.push({
      x, y,
      vx: Math.cos(ang) * vel,
      vy: Math.sin(ang) * vel - 5,
      r: 3 + Math.random() * 4,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      cor: cores[i % cores.length],
      vida: 70 + Math.random() * 40,
      forma: Math.random() < 0.5 ? 'q' : 'c',
    });
  }
  if (!rodando) {
    rodando = true;
    requestAnimationFrame(quadro);
  }
}
function quadro() {
  const cv = document.getElementById('confete');
  const dpr = devicePixelRatio || 1;
  if (cv.width !== innerWidth * dpr || cv.height !== innerHeight * dpr) {
    cv.width = innerWidth * dpr;
    cv.height = innerHeight * dpr;
  }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  particulas = particulas.filter((p) => p.vida > 0);
  for (const p of particulas) {
    p.vy += 0.22;
    p.vx *= 0.985;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    p.vida--;
    ctx.save();
    ctx.globalAlpha = Math.min(1, p.vida / 30);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.cor;
    if (p.forma === 'q') ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
    else {
      ctx.beginPath();
      ctx.arc(0, 0, p.r / 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  if (particulas.length) requestAnimationFrame(quadro);
  else {
    rodando = false;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
  }
}

// ---------- som ----------
let audio = null;
export function som(tipo = 'ok') {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') audio.resume();
    const notas = tipo === 'ofensiva' ? [523.25, 659.25, 783.99, 1046.5] : tipo === 'tique' ? [880] : [659.25, 987.77];
    const passo = tipo === 'ofensiva' ? 0.11 : 0.09;
    notas.forEach((f, i) => {
      const t = audio.currentTime + i * passo;
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(tipo === 'tique' ? 0.05 : 0.12, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (tipo === 'ofensiva' ? 0.5 : 0.3));
      o.connect(g).connect(audio.destination);
      o.start(t);
      o.stop(t + 0.6);
    });
  } catch {
    /* sem áudio, sem problema */
  }
}

// ---------- comemoração da ofensiva ----------
export function celebrarOfensiva(n, recorde) {
  const fogo = h('span', { class: 'fogo aceso vivo', html: ICONES.fogo });
  const num = h('div', { class: 'celebra-num' }, String(Math.max(0, n - 1)));
  const el = h(
    'div',
    { class: 'celebra', onClick: () => el.remove() },
    h('div', { class: 'celebra-caixa' },
      fogo,
      num,
      h('div', { class: 'celebra-txt' }, n === 1 ? 'dia de ofensiva!' : 'dias de ofensiva!'),
      h('div', { class: 'celebra-sub' }, n > 1 && n >= recorde ? 'Novo recorde! Continua assim 🔥' : 'Ofensiva de hoje garantida. Volta amanhã!')
    )
  );
  document.body.append(el);
  setTimeout(() => {
    num.textContent = String(n);
    num.animate([{ transform: 'scale(1.5)' }, { transform: 'scale(1)' }], { duration: 400, easing: 'cubic-bezier(.2,1.6,.4,1)' });
    confete(innerWidth / 2, innerHeight / 2 - 60, ['#ff5a1f', '#ff9a3c', '#ffc857', '#fff1b8'], 120);
  }, 550);
  setTimeout(() => el.remove(), 4200);
}
