// Movimento ligado à rolagem e ao ponteiro (o "líquido" do vidro):
//  - a lente do menu desliza até a seção que está na tela;
//  - a barra do topo condensa depois que a página rola;
//  - no celular, a barra de abas encolhe ao descer e volta ao subir;
//  - no computador, um reflexo acompanha o ponteiro sobre os cartões.
//  - o fundo ambiente desliza devagar com a rolagem;
//  - os cartões sobem e aparecem quando entram na tela (uma vez, com transição).
// Tudo só trabalha quando algo muda: parada, a página não gera quadros por causa disso.

const corpo = document.body;
const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- menu: aba ativa + lente ----------
// Medir posições força o navegador a recalcular o layout. Por isso as medidas são tiradas só depois de
// desenhar ou redimensionar (medir), e durante a rolagem só se compara com scrollY, sem tocar no layout.
let medidas = null; // { abas, secoes: [{ a, topo }], pos: Map(aba → { x, w }), max }
let ultimaLente = '';
function medir() {
  const abas = document.querySelector('.nav-abas');
  if (!abas) { medidas = null; return; }
  const secoes = [];
  for (const a of abas.querySelectorAll('a[data-sec]')) {
    if (!a.getClientRects().length) continue; // aba que não existe neste tamanho de tela
    const el = document.getElementById(a.dataset.sec);
    if (el) secoes.push({ a, topo: el.getBoundingClientRect().top + scrollY });
  }
  const pos = new Map();
  for (const a of abas.querySelectorAll('a')) pos.set(a, { x: a.offsetLeft, w: a.offsetWidth });
  medidas = { abas, secoes, pos, max: document.documentElement.scrollHeight - innerHeight };
  ultimaLente = '';
}

/** Marca a aba da seção que está na tela e leva a lente até ela (sem medir nada). */
export function atualizarNav() {
  if (!medidas || !medidas.abas.isConnected) medir();
  if (!medidas) return;
  const { abas, secoes, pos } = medidas;
  let ativa;
  if (corpo.classList.contains('vista-materias')) ativa = abas.querySelector('a[href="#materias"]');
  else {
    // a seção "da vez" é a última cujo topo já passou de ~1/3 da tela
    const linha = scrollY + innerHeight * 0.36;
    ativa = abas.querySelector('a[data-sec="topo"]');
    for (const s of secoes) if (s.topo <= linha) ativa = s.a;
  }
  for (const a of pos.keys()) {
    const on = a === ativa;
    if (a.classList.contains('ativo') === on) continue;
    a.classList.toggle('ativo', on);
    if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
  }
  const lente = abas.querySelector('.nav-lente');
  const p = pos.get(ativa);
  if (!lente || !p) return;
  const chave = `${p.x}|${p.w}`;
  if (chave === ultimaLente) return;
  ultimaLente = chave;
  lente.style.setProperty('--lx', `${p.x}px`);
  lente.style.setProperty('--lw', `${p.w}px`);
  lente.style.setProperty('--lo', '1');
}

// ---------- rolagem: topo condensado e barra de abas que encolhe ----------
let ultimoY = 0, quadro = false;
function aoRolar() {
  if (quadro) return;
  quadro = true;
  requestAnimationFrame(() => {
    quadro = false;
    const max = medidas ? medidas.max : Infinity; // guardado: ler scrollHeight aqui forçaria layout
    const y = Math.min(Math.max(0, scrollY), Math.max(0, max)); // ignora o "elástico" do iOS
    corpo.classList.toggle('rolou', y > 12);
    derivar(max > 0 && max !== Infinity ? y / max : 0);
    if (Math.abs(y - ultimoY) > 10) {
      corpo.classList.toggle('descendo', y > ultimoY && y > 160 && y < max - 40);
      ultimoY = y;
    }
    atualizarNav();
  });
}

// ---------- reflexo que segue o ponteiro ----------
const VIDROS = '.card, .hcard, .mapa';
let px = -1, py = -1, aceso = null, pendente = false;
function reluzir() {
  pendente = false;
  const el = px < 0 ? null : document.elementFromPoint(px, py)?.closest(VIDROS) || null;
  if (aceso && aceso !== el) { aceso.classList.remove('reluz'); aceso.style.removeProperty('--mx'); aceso.style.removeProperty('--my'); }
  aceso = el;
  if (!el) return;
  const r = el.getBoundingClientRect();
  el.style.setProperty('--mx', `${Math.round(px - r.left)}px`);
  el.style.setProperty('--my', `${Math.round(py - r.top)}px`);
  if (!el.classList.contains('reluz')) el.classList.add('reluz');
}

let navPendente = false;
/** Depois de redesenhar: atualiza o menu no próximo quadro e repõe o reflexo sob o ponteiro (os cartões são novos). */
export function aposDesenhar() {
  corpo.classList.toggle('com-pilula', !!document.getElementById('pomo-pilula')?.firstElementChild);
  if (!navPendente) { navPendente = true; requestAnimationFrame(() => { navPendente = false; medir(); atualizarNav(); prepararRevelar(); aoRolar(); }); }
  if (px >= 0 && !pendente) { pendente = true; requestAnimationFrame(reluzir); }
}

// ---------- plano B do "surgir ao rolar" (navegador sem animation-timeline) ----------
// ---------- fundo que desliza com a rolagem ----------
const fundo = document.getElementById('fundo');
let ultimaDeriva = '';
/**
 * f: 0 (topo da página) → 1 (fim): o fundo sobe 9% da altura da tela ao longo da página.
 * Só deslocamento, em pixels inteiros: sem aceleração de hardware, girar ou escalar a camada
 * obrigava o processador a reamostrar a tela inteira a cada quadro da rolagem.
 */
function derivar(f) {
  if (!fundo || calmo) return;
  const t = `translate3d(0, ${Math.round(-0.09 * innerHeight * f)}px, 0)`;
  if (t === ultimaDeriva) return;
  ultimaDeriva = t;
  fundo.style.transform = t;
}

// ---------- cartões que surgem ao entrar na tela ----------
const REVELAR = '.hero > .card, .painel-dia > .card, .coluna-tarefas > .card, .hcard, .mapa, .mt-card, .registro > .cabecalho-secao, .ano > .cabecalho-secao';
const preparados = new WeakSet();
let obsRevelar = null;
/** Esconde (com .rv) os cartões novos que estão abaixo da tela; quando chegam, aparecem uma vez. */
function prepararRevelar() {
  if (calmo || !('IntersectionObserver' in window)) return;
  obsRevelar ??= new IntersectionObserver((entradas) => {
    for (const en of entradas) {
      if (!en.isIntersecting) continue;
      const el = en.target;
      obsRevelar.unobserve(el);
      // fica com .rv.rv-in (estado final = cartão normal): tirar as classes no fim custaria mais um
      // recálculo de estilo por cartão bem no meio da rolagem
      el.classList.add('rv-in');
    }
  }, { rootMargin: '0px 0px -6% 0px' });
  for (const el of document.querySelectorAll(REVELAR)) {
    if (preparados.has(el)) continue;
    preparados.add(el);
    const r = el.getBoundingClientRect();
    if (!r.height || r.top < innerHeight) continue; // escondido (outra vista) ou já na tela: não esconde
    el.classList.add('rv');
    obsRevelar.observe(el);
  }
}

/** Liga tudo. Chame uma vez, depois do primeiro desenho. */
export function iniciarMovimento() {
  // entrada: os cartões sobem em sequência só na abertura (a classe sai logo, para não repetir a cada redesenho)
  if (!calmo) {
    corpo.classList.add('entrando');
    setTimeout(() => corpo.classList.remove('entrando'), 1400);
  }
  addEventListener('scroll', aoRolar, { passive: true });
  const campo = (el) => el?.matches?.('input:not([type=checkbox]):not([type=range]):not([type=radio]), textarea, select');
  addEventListener('focusin', (ev) => corpo.classList.toggle('teclado-aberto', !!campo(ev.target)));
  addEventListener('focusout', () => setTimeout(() => corpo.classList.toggle('teclado-aberto', !!campo(document.activeElement)), 0));
  addEventListener('resize', () => { medir(); atualizarNav(); }, { passive: true });
  document.fonts?.ready.then(() => { medir(); atualizarNav(); });
  // imagens/fontes tardias mudam a altura: remede quando o tamanho da página mudar
  if ('ResizeObserver' in window) new ResizeObserver(() => { medir(); atualizarNav(); }).observe(document.getElementById('app'));
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    addEventListener('pointermove', (ev) => {
      px = ev.clientX; py = ev.clientY;
      if (!pendente) { pendente = true; requestAnimationFrame(reluzir); }
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => { px = py = -1; reluzir(); });
  }
  prepararRevelar();
  aoRolar();
}
