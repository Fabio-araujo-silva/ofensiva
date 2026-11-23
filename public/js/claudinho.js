// Claudinho: um mini Claude que passeia pela tela e te dá incentivo (Claude API via servidor).
import { h, ICONES, svg, clamp } from './util.js';

export const SVG_CLAUDINHO = `
<svg viewBox="0 0 72 78" aria-hidden="true">
  <defs>
    <radialGradient id="cl-corpo" cx="38%" cy="30%" r="75%">
      <stop offset="0" stop-color="#eea07f"/>
      <stop offset=".6" stop-color="#d97757"/>
      <stop offset="1" stop-color="#b85c3f"/>
    </radialGradient>
  </defs>
  <path class="faisca" d="M36 2.5l2.2 6.3 6.3 2.2-6.3 2.2L36 19.5l-2.2-6.3-6.3-2.2 6.3-2.2z" fill="#f3c19f"/>
  <rect class="braco-e" x="4" y="38" width="10" height="7" rx="3.5" fill="#c4664a"/>
  <rect class="braco-d" x="58" y="38" width="10" height="7" rx="3.5" fill="#c4664a"/>
  <ellipse cx="26" cy="70" rx="6" ry="4" fill="#b85c3f"/>
  <ellipse cx="46" cy="70" rx="6" ry="4" fill="#b85c3f"/>
  <rect x="11" y="18" width="50" height="52" rx="22" fill="url(#cl-corpo)"/>
  <ellipse cx="27" cy="27" rx="9" ry="5" fill="#fff" opacity=".16"/>
  <ellipse class="olho" cx="27" cy="42" rx="3.4" ry="5" fill="#1d1a17"/>
  <ellipse class="olho" cx="45" cy="42" rx="3.4" ry="5" fill="#1d1a17"/>
  <circle cx="28.2" cy="40" r="1.2" fill="#fff"/>
  <circle cx="46.2" cy="40" r="1.2" fill="#fff"/>
  <circle cx="20" cy="51" r="3.4" fill="#f2a08a" opacity=".75"/>
  <circle cx="52" cy="51" r="3.4" fill="#f2a08a" opacity=".75"/>
  <path class="boca" d="M32 52.5q4 3 8 0" stroke="#1d1a17" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  <path class="boca-feliz" d="M30.5 51.5q5.5 6.5 11 0z" fill="#1d1a17"/>
</svg>`;

const LS_DORMINDO = 'ofensiva.claudinho.dormindo';
const lerLS = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const gravarLS = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };

let opts;
let el, balao = null;
let pos = { x: 0, y: 0 }, alvo = null, pausaAte = 0;
let dormindo = lerLS(LS_DORMINDO) === '1';
let ocupado = false;
let ultimoAuto = 0;
let historico = [];
let avisouSemChave = false;
let arrasto = null;

export function iniciarClaudinho(o) {
  opts = o;
  const raiz = document.getElementById('claudinho-raiz');
  el = h('div', { class: 'claudinho', role: 'button', tabindex: '0', 'aria-label': 'Claudinho — clique para um incentivo', title: 'Claudinho' },
    h('div', { class: 'claudinho-corpo', html: SVG_CLAUDINHO }),
    h('span', { class: 'zzz' }, 'z z'));
  raiz.append(el);
  pos = { x: innerWidth - 130, y: innerHeight - 170 };
  if (dormindo) estacionar();
  el.classList.toggle('dormindo', dormindo);

  el.addEventListener('pointerdown', (e) => {
    arrasto = { x0: e.clientX, y0: e.clientY, px: pos.x, py: pos.y, moveu: false };
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', (e) => {
    if (!arrasto) return;
    const dx = e.clientX - arrasto.x0, dy = e.clientY - arrasto.y0;
    if (Math.abs(dx) + Math.abs(dy) > 6) arrasto.moveu = true;
    if (arrasto.moveu) {
      pos.x = clamp(arrasto.px + dx, 4, innerWidth - 76);
      pos.y = clamp(arrasto.py + dy, 64, innerHeight - 82);
      alvo = null;
      pausaAte = performance.now() + 6000;
      aplicar();
      posicionarBalao();
    }
  });
  el.addEventListener('pointerup', () => {
    const foiClique = arrasto && !arrasto.moveu;
    arrasto = null;
    if (foiClique) clicou();
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clicou(); }
  });
  addEventListener('resize', () => {
    pos.x = clamp(pos.x, 4, innerWidth - 76);
    pos.y = clamp(pos.y, 64, innerHeight - 82);
    if (dormindo) estacionar();
    aplicar();
  });
  requestAnimationFrame(passo);
}

export function mostrarClaudinho(visivel) {
  if (!el) return;
  el.style.display = visivel ? '' : 'none';
  if (!visivel) fecharBalao();
}

function clicou() {
  if (dormindo) {
    dormindo = false;
    gravarLS(LS_DORMINDO, null);
    el.classList.remove('dormindo');
  }
  if (balao && !ocupado) { fecharBalao(); return; }
  falar('clique');
}

let ultimoT = performance.now();
function passo(t) {
  const dt = Math.min(0.05, (t - ultimoT) / 1000);
  ultimoT = t;
  if (!dormindo && !balao && !arrasto && el.style.display !== 'none' && t > pausaAte) {
    if (!alvo) {
      alvo = {
        x: 20 + Math.random() * Math.max(40, innerWidth - 120),
        y: 90 + Math.random() * Math.max(40, innerHeight - 200),
      };
    }
    const dx = alvo.x - pos.x, dy = alvo.y - pos.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 3) {
      alvo = null;
      pausaAte = t + 1500 + Math.random() * 5000;
    } else {
      const vel = 34; // px/s — passeio calmo
      pos.x += (dx / dist) * Math.min(dist, vel * dt);
      pos.y += (dy / dist) * Math.min(dist, vel * dt);
      el.classList.toggle('virado', dx < 0);
    }
    aplicar();
  }
  requestAnimationFrame(passo);
}
function aplicar() {
  el.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
}
function estacionar() {
  pos = { x: innerWidth - 96, y: innerHeight - 100 };
  alvo = null;
  aplicar();
}

// ---------- balão ----------
function abrirBalao() {
  if (balao) return balao;
  const texto = h('div', { class: 'balao-texto' });
  const entrada = h('input', { placeholder: 'Responder ao Claudinho…', 'aria-label': 'Mensagem para o Claudinho', maxlength: '400' });
  const form = h('form', {
    class: 'balao-form',
    onSubmit: (e) => {
      e.preventDefault();
      const m = entrada.value.trim();
      if (!m || ocupado) return;
      entrada.value = '';
      falar('mensagem', m);
    },
  }, entrada, h('button', { type: 'submit', 'aria-label': 'Enviar' }, svg(ICONES.enviar)));
  const acoes = h('div', { class: 'balao-acoes' },
    h('button', { onClick: () => { fecharBalao(); dormir(); } }, '💤 cochilar no canto'),
    h('button', { onClick: fecharBalao }, 'fechar'));
  balao = h('div', { class: 'balao', role: 'status', 'aria-live': 'polite' },
    h('div', { class: 'balao-nome' }, 'Claudinho'), texto, opts.temChave() ? form : null, acoes);
  balao._texto = texto;
  document.body.append(balao);
  posicionarBalao();
  return balao;
}
function posicionarBalao() {
  if (!balao) return;
  const w = balao.offsetWidth, hh = balao.offsetHeight;
  let x = pos.x + 36 - w / 2;
  let y = pos.y - hh - 12;
  if (y < 64) y = pos.y + 86;
  x = clamp(x, 12, innerWidth - w - 12);
  y = clamp(y, 64, innerHeight - hh - 12);
  balao.style.left = `${x}px`;
  balao.style.top = `${y}px`;
}
let timerFechar;
function fecharBalao() {
  clearTimeout(timerFechar);
  balao?.remove();
  balao = null;
  el?.classList.remove('falando');
  pausaAte = performance.now() + 2500;
}
function dormir() {
  dormindo = true;
  gravarLS(LS_DORMINDO, '1');
  el.classList.add('dormindo');
  estacionar();
}

// ---------- falas ----------
const DESCR = {
  abriu: 'Acabei de abrir o app. Me dá um oi curto e um empurrãozinho para o que mais importa agora.',
  clique: 'Cliquei em você. Me dá um incentivo específico para agora.',
  parado: 'Estou com o app aberto há um tempo. Um lembrete gentil do que ainda falta hoje.',
};

/** Reação automática (com intervalo mínimo, para não encher o saco). */
export function reagir(evento, extra = {}) {
  if (!el || dormindo || el.style.display === 'none' || ocupado) return;
  const agora = Date.now();
  const forte = evento === 'ofensiva' || evento === 'tudo' || evento === 'pomodoro';
  if (!forte && agora - ultimoAuto < 75_000) return;
  ultimoAuto = agora;
  if (forte || evento === 'completou') {
    el.classList.add('festa');
    setTimeout(() => el.classList.remove('festa'), 2200);
  }
  falar(evento, extra);
}

async function falar(evento, extra) {
  ocupado = true;
  const b = abrirBalao();
  el.classList.add('falando');
  b._texto.replaceChildren(h('span', { class: 'digitando' }, h('i'), h('i'), h('i')));
  posicionarBalao();

  const contexto = opts.contexto();
  let pedido = DESCR[evento];
  if (evento === 'mensagem') pedido = `Mensagem minha: ${extra}`;
  if (evento === 'completou') pedido = `Acabei de completar 100% do hábito "${extra.nome}" hoje! Comemora comigo em uma frase.`;
  if (evento === 'ofensiva') pedido = `Acabei de garantir a ofensiva geral de hoje: ${extra.dias} dia(s) seguido(s)! Comemora.`;
  if (evento === 'tudo') pedido = 'Acabei de completar TODOS os hábitos de hoje! Comemora muito.';
  if (evento === 'pomodoro') pedido = `Acabei de concluir um pomodoro de ${extra.minutos} min${extra.materia ? ` de ${extra.materia}` : ''} (hoje já são ${extra.hoje} min de foco). Agora vem: ${extra.proxima}. Comemora em uma frase e sugere algo curto pra fazer na pausa.`;

  let texto = null;
  let motivo = null;
  if (opts.temChave()) {
    try {
      const r = await fetch('/api/claudinho', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contexto, evento: pedido, historico }),
      });
      const j = await r.json();
      texto = j.texto || null;
      motivo = j.erro || null;
    } catch {
      motivo = 'rede';
    }
  }
  if (texto) {
    historico.push({ role: 'user', content: pedido }, { role: 'assistant', content: texto });
    historico = historico.slice(-8);
  } else {
    texto = fraseLocal(evento, extra, contexto);
  }
  if (!balao) { ocupado = false; return; }
  b._texto.replaceChildren(texto);
  if (!opts.temChave() && !avisouSemChave) {
    avisouSemChave = true;
    b._texto.append(h('span', { class: 'aviso-chave' }, 'Tô no modo offline. Cola uma chave da API da Anthropic em Ajustes e eu passo a falar de verdade.'));
  } else if (motivo === 'chave-invalida') {
    b._texto.append(h('span', { class: 'aviso-chave' }, 'A chave da API foi recusada — confere em Ajustes.'));
  }
  posicionarBalao();
  ocupado = false;
  clearTimeout(timerFechar);
  const temForm = balao.querySelector('input');
  timerFechar = setTimeout(() => {
    if (balao && !(temForm && document.activeElement === temForm)) fecharBalao();
  }, evento === 'mensagem' ? 30000 : 14000);
}

// ---------- frases offline (sem chave) ----------
const sortear = (a) => a[Math.floor(Math.random() * a.length)];
function fraseLocal(evento, extra, c) {
  const nome = c.nome ? `, ${c.nome}` : '';
  if (evento === 'completou') return sortear([`${extra.nome} fechado! Mais um quadradinho colorido 🔥`, `Isso${nome}! ${extra.nome} no 100%.`, `${extra.nome} ✔️ — é assim que se constrói uma ofensiva.`]);
  if (evento === 'ofensiva') return `${extra.dias} ${extra.dias === 1 ? 'dia' : 'dias'} de ofensiva! A chama de hoje está garantida 🔥`;
  if (evento === 'tudo') return `TUDO feito hoje${nome}! Dia perfeito. Agora é descansar com orgulho.`;
  if (evento === 'pomodoro') return sortear([`+${extra.minutos} min${extra.materia ? ` de ${extra.materia}` : ''}! Levanta, bebe uma água e alonga 🍅`, `Pomodoro fechado! Hoje já são ${extra.hoje} min de foco.`, `Isso${nome}! Pausa merecida — olha pra longe da tela um pouquinho.`]);
  const faltando = (c.habitos || []).filter((x) => x.progresso < 100).sort((a, b) => b.progresso - a.progresso);
  if (!c.habitos?.length) return 'Cria uns hábitos em Ajustes que eu fico de olho em você 👀';
  if (!faltando.length) return sortear([`Tudo fechado hoje${nome}. Dia perfeito!`, 'Nada pendente. Aproveita o resto do dia 😌']);
  const hora = new Date().getHours();
  if (hora >= 0 && hora < 5) return 'Já é madrugada… o melhor hábito agora é dormir. Amanhã a gente continua 🌙';
  const quase = faltando[0];
  const longe = faltando[faltando.length - 1];
  return sortear([
    `Falta pouco em ${quase.nome}: ${quase.hoje}. Bora fechar?`,
    `${faltando.length} ${faltando.length === 1 ? 'hábito falta' : 'hábitos faltam'} hoje. Começa pelo mais fácil: ${quase.nome}.`,
    c.ofensiva?.dias ? `Sua ofensiva está em ${c.ofensiva.dias} ${c.ofensiva.dias === 1 ? 'dia' : 'dias'}. Não deixa a chama apagar!` : 'Hoje pode ser o dia 1 de uma ofensiva enorme 🔥',
    `${longe.nome} ainda está em ${longe.progresso}%. Que tal só 5 minutinhos?`,
    `Provérbio de hoje: ${c.proverbioDoDia}`,
  ]);
}
