// Pomodoro com tags de matéria. O timer fica salvo no estado (sobrevive a recarregar a página),
// cada sessão de foco é registrada com a matéria e os minutos somam no hábito de estudo.
import { h, svg, ICONES, uid, pad, somaDias, inicioSemana, LETRAS_SEMANA, clamp } from './util.js';
import { S, mudar, avisar, botaoConfirmar } from './store.js';
import { ativos, fmtMetrica, detalharSessao } from './habitos.js';
import { som } from './efeitos.js';
import { reagir } from './claudinho.js';
import { TEMAS, temaDe, particulas } from './temas.js';

export const FASES = {
  foco: { titulo: 'Foco', sub: 'hora de focar', cor: '#ff6b57', cor2: '#ffb36b' },
  curta: { titulo: 'Pausa', sub: 'respira, levanta, bebe água', cor: '#3fcfae', cor2: '#a3eedc' },
  longa: { titulo: 'Pausa longa', sub: 'você mereceu', cor: '#8b93ff', cor2: '#d0b8ff' },
  livre: { titulo: 'Livre', sub: 'cronômetro livre', cor: '#f6c98b', cor2: '#ffe7b8' },
};
export const CORES_MATERIA = ['#ff8a7a', '#f6c98b', '#a6dd8f', '#86d0c5', '#8ec5f5', '#b3b3ec', '#d6a6e6', '#f4a3b0', '#f0dc82', '#c9b79c'];
export const CONFIG_PADRAO = { foco: 25, curta: 5, longa: 15, ciclos: 4, pausaRapida: 3, autoIniciar: false, notificar: true, alvo: null };

const agora = () => Date.now();
const temNotif = () => typeof Notification !== 'undefined';
const P = () => S.estado.pomodoro;
const cfg = () => ({ ...CONFIG_PADRAO, ...(P().config || {}) });
export const decorrido = (t, n = agora()) => Math.max(0, (t.pausadoEm ?? n) - t.inicio);
export const restante = (t, n = agora()) => (t.duracaoMs == null ? null : t.duracaoMs - decorrido(t, n));
const mmss = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  const hh = Math.floor(s / 3600);
  return hh ? `${hh}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}` : `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
};
const minTxt = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? pad(m % 60) : ''}` : `${m} min`);
export const materia = (id) => S.estado.materias.find((m) => m.id === id) || null;
/** Remove a matéria e solta o timer/seleção que apontavam para ela. */
export function excluirMateria(e, id) {
  e.materias = e.materias.filter((y) => y.id !== id);
  if (e.pomodoro.tag === id) { e.pomodoro.tag = null; e.pomodoro.assunto = null; }
  if (e.pomodoro.timer?.tag === id) { e.pomodoro.timer.tag = null; e.pomodoro.timer.assunto = null; }
}
const nomeAssunto = (tag, id) => (id ? materia(tag)?.assuntos?.find((a) => a.id === id)?.nome || null : null);

/** Abre o modo foco já com a matéria (e o assunto) escolhidos. */
export function estudar(materiaId, assuntoId = null) {
  mudar((e) => {
    e.pomodoro.tag = materiaId;
    e.pomodoro.assunto = assuntoId;
    if (e.pomodoro.timer) { e.pomodoro.timer.tag = materiaId; e.pomodoro.timer.assunto = assuntoId; }
  });
  abrirFoco();
}
/** Tema do momento: o da matéria do timer (ou da matéria selecionada). */
export const temaAtual = () => temaDe(materia(P().timer ? P().timer.tag : P().tag));
const coresFase = (tema, fase) => tema.cores[fase] || TEMAS.padrao.cores[fase];
const tituloFase = (tema, fase) => tema.titulos[fase] || TEMAS.padrao.titulos[fase];

/** Para onde vão os minutos: config explícita ou o melhor palpite (métrica em min de um hábito de estudo). */
export function alvoPomodoro(e = S.estado) {
  const c = e.pomodoro?.config?.alvo;
  if (c) {
    const hab = ativos(e).find((x) => x.id === c.habitoId);
    const m = hab?.metricas?.find((x) => x.id === c.metricaId);
    if (m) return { hab, m };
    if (c.nenhum) return null;
  }
  const cands = [];
  for (const hab of ativos(e)) {
    if (hab.tipo !== 'numero') continue;
    for (const m of hab.metricas) {
      if (m.unidade !== 'min') continue;
      cands.push({ hab, m, pts: (/estud/i.test(hab.nome) ? 3 : 0) + (m.cronometro ? 2 : 0) });
    }
  }
  cands.sort((a, b) => b.pts - a.pts);
  return cands[0]?.pts > 0 ? cands[0] : null;
}

// =====================================================================
// motor
// =====================================================================
/**
 * Registra uma sessão de estudo. Os campos extras (dia da semana, horários, pausas, desfecho)
 * existem para estatísticas futuras — ver detalharSessao() em habitos.js.
 */
function registrar(e, minutos, t, desfecho = 'completo') {
  if (minutos < 1) return 0;
  const alvo = alvoPomodoro(e);
  // guarda para onde os minutos foram, para desfazer exatamente ali se a sessão for apagada
  const destino = alvo ? { habitoId: alvo.hab.id, metricaId: alvo.m.id } : null;
  const fim = agora();
  e.sessoes.push(detalharSessao({
    id: 'p' + uid(), dia: t.dia, tag: t.tag || null, assunto: t.assunto || null, minutos,
    inicio: t.iniciadoEm ?? t.inicio, fim, tipo: t.fase === 'livre' ? 'livre' : 'pomodoro', destino,
    desfecho, // 'completo' | 'interrompido' | 'livre'
    planejadoMin: t.duracaoMs != null ? Math.round(t.duracaoMs / 60000) : null,
    pausadoMin: Math.round(((t.pausasMs || 0) + (t.pausadoEm ? fim - t.pausadoEm : 0)) / 60000),
    pausas: t.pausas || 0,
    pausasRapidas: t.pausasRapidas || 0,
    materiaNome: materia(t.tag)?.nome || null, // nome na época (se a matéria for apagada/renomeada depois)
  }));
  if (destino) {
    const d = (e.dias[t.dia] ??= {});
    const v = (d[destino.habitoId] ??= {});
    v[destino.metricaId] = (Number(v[destino.metricaId]) || 0) + minutos;
  }
  return minutos;
}

export function iniciar(fase = P().proxima || 'foco') {
  if (temNotif() && Notification.permission === 'default' && cfg().notificar) Notification.requestPermission().catch(() => {});
  const c = cfg();
  mudar((e) => {
    const p = e.pomodoro;
    if (p.cicloDia !== S.hoje) { p.ciclo = 0; p.cicloDia = S.hoje; }
    const t0 = agora();
    p.timer = { fase, inicio: t0, iniciadoEm: t0, duracaoMs: fase === 'livre' ? null : c[fase] * 60000, pausadoEm: null, tag: p.tag || null, assunto: p.assunto || null, dia: S.hoje };
  });
}
export function pausarOuRetomar() {
  const t = P().timer;
  if (!t) return iniciar();
  mudar((e) => {
    const x = e.pomodoro.timer;
    if (x.pausadoEm) { const p = agora() - x.pausadoEm; x.inicio += p; x.pausasMs = (x.pausasMs || 0) + p; x.pausadoEm = null; x.pausaRapidaAte = null; } else { x.pausadoEm = agora(); x.pausas = (x.pausas || 0) + 1; }
  });
}

/** Pausa rápida (ex.: ir ao banheiro): pausa por alguns minutos e retoma sozinha. */
export function pausaRapida() {
  const t = P().timer;
  if (!t || t.fase === 'curta' || t.fase === 'longa') return;
  const ms = cfg().pausaRapida * 60000;
  mudar((e) => {
    const x = e.pomodoro.timer;
    const n = agora();
    if (!x.pausadoEm) { x.pausadoEm = n; x.pausas = (x.pausas || 0) + 1; }
    x.pausaRapidaAte = n + ms;
    x.pausasRapidas = (x.pausasRapidas || 0) + 1;
  });
}
let retomando = false;
/** Fim da pausa rápida: retoma como se tivesse voltado na hora marcada (mesmo se o app ficou fechado). */
function fimPausaRapida() {
  if (retomando) return;
  retomando = true;
  mudar((e) => {
    const x = e.pomodoro.timer;
    if (!x?.pausadoEm || !x.pausaRapidaAte) return;
    const volta = Math.min(agora(), x.pausaRapidaAte);
    const p = Math.max(0, volta - x.pausadoEm);
    x.inicio += p;
    x.pausasMs = (x.pausasMs || 0) + p;
    x.pausadoEm = null;
    x.pausaRapidaAte = null;
  });
  retomando = false;
  if (S.estado.perfil.som !== false) som('ok');
  avisar('De volta ao foco 🍅');
}
export function reiniciarFase() {
  mudar((e) => { const x = e.pomodoro.timer; if (x) { x.inicio = agora(); if (x.pausadoEm) x.pausadoEm = x.inicio; } });
}
/** Para tudo; foco/livre registram o tempo já feito (≥ 1 min) se `registrarParcial`. */
export function parar(registrarParcial = true) {
  const t = P().timer;
  if (!t) return;
  let min = 0;
  mudar((e) => {
    const x = e.pomodoro.timer;
    if (registrarParcial && (x.fase === 'foco' || x.fase === 'livre')) min = registrar(e, Math.floor(decorrido(x) / 60000), x, x.fase === 'livre' ? 'livre' : 'interrompido');
    e.pomodoro.timer = null;
  });
  if (min) avisar(`+${minTxt(min)} de ${materia(t.tag)?.nome || 'estudo'} registrados`);
}

let concluindo = false;
/** Fim natural da fase (ou "pular"). */
export function concluirFase(natural = true) {
  const t = P().timer;
  if (!t || concluindo) return;
  // se o fim foi percebido bem depois (aba fechada/dormindo), não emenda nem notifica como se fosse agora
  const atrasado = natural && t.duracaoMs != null && -restante(t) > 5000;
  concluindo = true;
  const c = cfg();
  let min = 0, proxima = 'foco';
  mudar((e) => {
    const p = e.pomodoro;
    const x = p.timer;
    if (x.fase === 'foco') {
      min = registrar(e, natural ? Math.round(x.duracaoMs / 60000) : Math.floor(decorrido(x) / 60000), x, natural ? 'completo' : 'interrompido');
      p.ciclo = (p.ciclo || 0) + 1;
      proxima = p.ciclo % c.ciclos === 0 ? 'longa' : 'curta';
    } else if (x.fase === 'livre') {
      min = registrar(e, Math.floor(decorrido(x) / 60000), x, 'livre');
      proxima = 'livre';
    } else {
      if (x.fase === 'longa') p.ciclo = 0;
      proxima = 'foco';
    }
    p.proxima = proxima;
    p.timer = null;
  });
  concluindo = false;

  if (natural && !atrasado) {
    if (S.estado.perfil.som !== false) som(temaDe(materia(t.tag)).som || 'sino');
    const titulo = t.fase === 'foco' ? `🍅 Pomodoro concluído! +${minTxt(min)}` : 'Pausa encerrada — bora focar?';
    const corpo = t.fase === 'foco' ? `${materia(t.tag)?.nome || 'Estudo'} · agora: ${TEMAS.padrao.titulos[proxima].toLowerCase()}` : `Próximo: foco de ${c.foco} min`;
    if (c.notificar && document.visibilityState !== 'visible' && temNotif() && Notification.permission === 'granted') {
      try { new Notification(titulo, { body: corpo, tag: 'ofensiva-pomodoro' }); } catch {}
    }
    avisar(titulo, 5000);
    flash();
  }
  if (t.fase === 'foco' && min) reagir('pomodoro', { minutos: min, materia: materia(t.tag)?.nome || null, proxima: TEMAS.padrao.titulos[proxima].toLowerCase(), hoje: minutosHoje() });
  if (atrasado && t.fase === 'foco' && min) avisar(`O pomodoro de ${materia(t.tag)?.nome || 'estudo'} terminou enquanto o app estava fechado: +${minTxt(min)} registrados.`, 6000);
  if (c.autoIniciar && natural && !atrasado && document.visibilityState === 'visible' && t.fase !== 'livre') setTimeout(() => !P().timer && iniciar(proxima), 1200);
}

// =====================================================================
// estatísticas
// =====================================================================
export function sessoesDoDia(dia = S.hoje) {
  return S.estado.sessoes.filter((s) => s.dia === dia);
}
export function minutosHoje() {
  return sessoesDoDia().reduce((a, s) => a + s.minutos, 0);
}
function porMateria(sessoes) {
  const m = new Map();
  for (const s of sessoes) { const k = materia(s.tag) ? s.tag : '_'; m.set(k, (m.get(k) || 0) + s.minutos); }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([tag, min]) => ({ tag, min, mat: materia(tag) }));
}
export function resumoHojePorMateria() {
  return porMateria(sessoesDoDia()).map((x) => `${x.mat?.nome || 'sem matéria'} ${minTxt(x.min)}`).join(', ');
}

// =====================================================================
// interface: modo foco (tela cheia) + pílula flutuante
// =====================================================================
let aberto = false;
let painelConfig = false;
let novaMateriaTxt = '';
const raizFoco = () => document.getElementById('foco-raiz');

export function abrirFoco() {
  aberto = true;
  document.body.style.overflow = 'hidden';
  renderFoco();
}
export function fecharFoco() {
  aberto = false;
  document.body.style.overflow = '';
  raizFoco().replaceChildren();
  renderPilula();
}

function flash() {
  const el = document.querySelector('.foco');
  if (!el) return;
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
}

const R = 140, CIRC = 2 * Math.PI * R;
function anel(fase, tema) {
  const [c1, c2] = coresFase(tema, fase);
  const f = { cor: c1, cor2: c2 };
  const mostrador = tema.mostrador
    ? tema.mostrador.map((ch, i) => { const a = (i / tema.mostrador.length) * Math.PI * 2; return `<text x="${160 + 108 * Math.sin(a)}" y="${160 - 108 * Math.cos(a)}" class="fa-hanzi">${ch}</text>`; }).join('')
    : '';
  return h('div', {
    class: 'foco-anel',
    html: `<svg viewBox="0 0 320 320" aria-hidden="true">
      <defs>
        <linearGradient id="foco-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${f.cor2}"/><stop offset="1" stop-color="${f.cor}"/></linearGradient>
        <filter id="foco-brilho" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6"/></filter>
      </defs>
      <circle cx="160" cy="160" r="${R}" class="fa-trilho"/>
      ${Array.from({ length: 60 }, (_, i) => { const a = (i / 60) * Math.PI * 2; const r1 = i % 5 ? 123 : 119, r2 = 127; return `<line x1="${160 + r1 * Math.sin(a)}" y1="${160 - r1 * Math.cos(a)}" x2="${160 + r2 * Math.sin(a)}" y2="${160 - r2 * Math.cos(a)}" class="fa-marca${i % 5 ? '' : ' forte'}"/>`; }).join('')}
      ${mostrador}
      <circle cx="160" cy="160" r="${R}" class="fa-brilho" stroke="url(#foco-grad)" filter="url(#foco-brilho)" stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC}"/>
      <circle cx="160" cy="160" r="${R}" class="fa-prog" stroke="url(#foco-grad)" stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC}"/>
      <circle cx="160" cy="20" r="9" class="fa-ponta" fill="${f.cor2}"/>
    </svg>`,
  });
}

export function renderFoco() {
  if (!aberto) return;
  const raiz = raizFoco();
  const p = P(), t = p.timer, c = cfg();
  const fase = t?.fase || p.proxima || 'foco';
  const tema = temaAtual();
  const [cor1, cor2] = coresFase(tema, fase);
  const f = { titulo: tituloFase(tema, fase), sub: tema.legendas?.[fase] || FASES[fase].sub };
  const modoLivre = fase === 'livre';
  const alvo = alvoPomodoro();
  const tagAtual = t ? t.tag : p.tag;
  const focoInput = document.activeElement?.id === 'foco-nova-materia';

  // ----- tags -----
  const escolherTag = (id) => mudar((e) => { e.pomodoro.tag = id; e.pomodoro.assunto = null; if (e.pomodoro.timer) { e.pomodoro.timer.tag = id; e.pomodoro.timer.assunto = null; } });
  const novaInput = h('input', {
    id: 'foco-nova-materia', class: 'foco-nova', placeholder: '+ nova matéria', maxlength: '30', value: novaMateriaTxt,
    onInput: (ev) => (novaMateriaTxt = ev.target.value),
    onKeydown: (ev) => {
      if (ev.key !== 'Enter') return;
      const nome = novaMateriaTxt.trim();
      if (!nome) return;
      novaMateriaTxt = '';
      const id = 'mt' + uid();
      mudar((e) => { e.materias.push({ id, nome, cor: CORES_MATERIA[e.materias.length % CORES_MATERIA.length], assuntos: [] }); e.pomodoro.tag = id; e.pomodoro.assunto = null; if (e.pomodoro.timer) { e.pomodoro.timer.tag = id; e.pomodoro.timer.assunto = null; } });
      setTimeout(() => document.getElementById('foco-nova-materia')?.focus(), 0);
    },
  });
  const tags = h('div', { class: 'foco-tags' },
    h('span', { class: 'foco-rot' }, 'estudando'),
    S.estado.materias.map((m) => h('button', {
      class: `foco-tag ${tagAtual === m.id ? 'on' : ''}`, style: { '--m': m.cor },
      onClick: () => escolherTag(tagAtual === m.id ? null : m.id),
    }, h('i'), m.nome, h('small', { class: 'foco-tag-tema', title: `tema: ${temaDe(m).nome}` }, temaDe(m).marca))),
    novaInput);
  novaInput.dataset.campo = 'foco-nova-materia';

  // ----- controles -----
  const rodando = t && !t.pausadoEm;
  const emPausaRapida = !!(t?.pausadoEm && t.pausaRapidaAte);
  const podeRapida = t && (fase === 'foco' || fase === 'livre') && !emPausaRapida;
  const avisoRapida = emPausaRapida
    ? h('div', { class: 'foco-rapida' }, h('span', null, '🚻 pausa rápida'), h('b', { id: 'foco-rapida-tempo' }, mmss(t.pausaRapidaAte - agora())),
        h('span', { class: 'foco-rapida-sub' }, 'volta sozinho'), h('button', { onClick: pausarOuRetomar }, 'voltar agora'))
    : null;
  const controles = h('div', { class: 'foco-controles' },
    h('button', { class: 'foco-btn', title: 'Reiniciar esta fase', 'aria-label': 'Reiniciar fase', disabled: !t, onClick: reiniciarFase }, '↺'),
    h('button', { class: 'foco-btn rapida', title: `Pausa rápida de ${c.pausaRapida} min (banheiro, água…) — retoma sozinha`, 'aria-label': 'Pausa rápida', disabled: !podeRapida, onClick: pausaRapida }, '🚻'),
    h('button', { class: `foco-play ${rodando ? 'rodando' : ''}`, 'aria-label': rodando ? 'Pausar' : 'Começar', title: 'Espaço', onClick: () => (t ? pausarOuRetomar() : iniciar(fase)) },
      svg(rodando ? '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4.2" height="14" rx="1.4"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.4"/></svg>' : ICONES.play)),
    modoLivre
      ? h('button', { class: 'foco-btn', title: 'Parar e registrar', 'aria-label': 'Parar e registrar', disabled: !t, onClick: () => concluirFase(false) }, '■')
      : h('button', { class: 'foco-btn', title: t ? (fase === 'foco' ? 'Concluir agora (registra o tempo feito)' : 'Pular pausa') : 'Pular para a próxima fase', 'aria-label': 'Pular', onClick: () => (t ? concluirFase(false) : mudar((e) => (e.pomodoro.proxima = fase === 'foco' ? 'curta' : 'foco'))) }, '⏭'));

  // ----- ciclos -----
  const feitos = p.cicloDia === S.hoje ? p.ciclo || 0 : 0;
  const cheios = feitos > 0 && feitos % c.ciclos === 0 && fase === 'longa' ? c.ciclos : feitos % c.ciclos;
  const ciclos = modoLivre ? null : h('div', { class: 'foco-ciclos', title: `${cheios} de ${c.ciclos} até a pausa longa` },
    Array.from({ length: c.ciclos }, (_, i) => h('span', { class: i < cheios ? 'on' : '' }, tema.marca)));

  // ----- abas de modo -----
  const trocarModo = (m) => { if (t) return avisar('Pare o timer atual antes de trocar de modo.'); mudar((e) => (e.pomodoro.proxima = m === 'livre' ? 'livre' : 'foco')); };
  const abas = h('div', { class: 'foco-abas' },
    h('button', { class: !modoLivre ? 'on' : '', onClick: () => trocarModo('pomodoro') }, '🍅 Pomodoro'),
    h('button', { class: modoLivre ? 'on' : '', onClick: () => trocarModo('livre') }, '⏱ Livre'));

  const presets = modoLivre ? null : h('div', { class: 'foco-presets' },
    [[25, 5, 15], [50, 10, 20], [90, 15, 30]].map(([a, b, l]) => h('button', {
      class: c.foco === a && c.curta === b ? 'on' : '',
      title: t ? 'Vale a partir da próxima fase' : `foco ${a} min · pausa ${b} min · pausa longa ${l} min`,
      onClick: () => mudar((e) => (e.pomodoro.config = { ...cfg(), foco: a, curta: b, longa: l })),
    }, `${a}/${b}`)));

  const centro = h('div', { class: 'foco-centro' },
    abas,
    h('div', { class: 'foco-relogio' },
      anel(fase, tema),
      h('div', { class: 'foco-dentro' },
        h('span', { class: 'foco-fase', lang: tema.id === 'china' ? 'zh-CN' : null }, f.titulo),
        h('span', { class: 'foco-tempo', id: 'foco-tempo' }, t ? mmss(modoLivre ? decorrido(t) : restante(t)) : modoLivre ? '00:00' : mmss(c[fase] * 60000)),
        h('span', { class: 'foco-sub' }, t?.pausadoEm ? 'pausado' : t ? ([materia(tagAtual)?.nome, nomeAssunto(tagAtual, t.assunto)].filter(Boolean).join(' · ') || f.sub) : (nomeAssunto(tagAtual, p.assunto) || 'pronto?')),
        h('span', { class: 'foco-legenda' }, f.sub))),
    ciclos,
    avisoRapida,
    controles,
    presets,
    tags);

  const fundo = h('div', { class: 'foco-fundo' }, h('i'), h('i'), h('i'),
    tema.marcaGrande ? h('span', { class: 'foco-marca-grande', lang: tema.id === 'china' ? 'zh-CN' : null }, tema.marcaGrande) : null,
    h('div', { class: 'foco-particulas' }, particulas(tema).map((q) => h('span', {
      style: { left: `${q.x}%`, fontSize: `${q.tam}px`, animationDuration: `${q.dur}s`, animationDelay: `${q.atraso}s`, '--giro': `${q.giro}deg`, '--alfa': q.alfa },
    }, q.txt))));
  raiz.replaceChildren(h('div', {
    class: `foco fase-${fase} tema-${tema.id} ${rodando ? 'ativo' : ''}`, style: { '--f1': cor1, '--f2': cor2 }, role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Modo foco',
  },
    fundo,
    h('div', { class: 'foco-topo' },
      h('div', { class: 'foco-marca' }, `${tema.marca} `, h('b', null, 'modo foco'), alvo ? h('span', null, ` · somando em ${alvo.hab.emoji} ${alvo.hab.nome}`) : h('span', null, ' · sem hábito ligado (veja ⚙)')),
      h('div', { class: 'foco-topo-dir' },
        h('button', { class: `foco-mini ${painelConfig ? 'on' : ''}`, title: 'Configurar', 'aria-label': 'Configurar', onClick: () => { painelConfig = !painelConfig; renderFoco(); } }, svg(ICONES.engrenagem)),
        h('button', { class: 'foco-mini', title: 'Minimizar (Esc) — o timer continua', 'aria-label': 'Minimizar', onClick: fecharFoco }, '—'))),
    h('div', { class: 'foco-corpo' }, centro, painelConfig ? painelDeConfig() : painelStats(alvo))
  ));
  tique();
  if (focoInput) document.getElementById('foco-nova-materia')?.focus();
}

function painelStats(alvo) {
  const hoje = sessoesDoDia();
  const total = hoje.reduce((a, s) => a + s.minutos, 0);
  const pm = porMateria(hoje);
  const meta = alvo?.m.meta || 0;
  const feitoAlvo = Math.max(total, alvo ? Number(S.estado.dias[S.hoje]?.[alvo.hab.id]?.[alvo.m.id]) || 0 : 0);

  // semana: barras empilhadas por matéria
  const seg = inicioSemana(S.hoje);
  const diasSem = Array.from({ length: 7 }, (_, i) => somaDias(seg, i));
  const porDia = diasSem.map((d) => porMateria(S.estado.sessoes.filter((s) => s.dia === d)));
  const maxDia = Math.max(60, ...porDia.map((l) => l.reduce((a, x) => a + x.min, 0)));
  const semTotal = porDia.flat().reduce((a, x) => a + x.min, 0);
  const pmSemana = porMateria(S.estado.sessoes.filter((s) => s.dia >= seg && s.dia <= somaDias(seg, 6)));
  const cor = (x) => x.mat?.cor || '#6c6c78';

  return h('aside', { class: 'foco-painel' },
    h('div', { class: 'fp-bloco' },
      h('span', { class: 'foco-rot' }, 'hoje'),
      h('div', { class: 'fp-total' }, h('b', null, minTxt(feitoAlvo)), meta ? h('span', null, ` de ${fmtMetrica(meta, alvo.m)}`) : null),
      meta ? h('div', { class: 'fp-meta' }, h('div', { style: { width: `${clamp(feitoAlvo / meta, 0, 1) * 100}%` } })) : null,
      pm.length
        ? h('div', { class: 'fp-materias' }, pm.map((x) => h('div', { class: 'fp-mat' },
            h('span', { class: 'fp-mat-nome' }, h('i', { style: { background: cor(x) } }), x.mat?.nome || 'sem matéria'),
            h('span', { class: 'fp-mat-barra' }, h('span', { style: { width: `${(x.min / pm[0].min) * 100}%`, background: cor(x) } })),
            h('b', null, minTxt(x.min)))))
        : h('p', { class: 'fp-vazio' }, 'Nenhuma sessão ainda hoje. O primeiro pomodoro é o mais difícil 🍅')),
    h('div', { class: 'fp-bloco' },
      h('span', { class: 'foco-rot' }, `semana · ${minTxt(semTotal)}`),
      h('div', { class: 'fp-semana' }, diasSem.map((d, i) => h('div', { class: `fp-dia ${d === S.hoje ? 'hoje' : ''}`, title: porDia[i].map((x) => `${x.mat?.nome || 'sem matéria'}: ${minTxt(x.min)}`).join('\n') || 'nada' },
        h('div', { class: 'fp-col' }, porDia[i].map((x) => h('span', { style: { height: `${(x.min / maxDia) * 100}%`, background: cor(x) } }))),
        h('small', null, LETRAS_SEMANA[i])))),
      pmSemana.length ? h('div', { class: 'fp-legenda' }, pmSemana.map((x) => h('span', null, h('i', { style: { background: cor(x) } }), `${x.mat?.nome || 'sem matéria'} ${minTxt(x.min)}`))) : null),
    hoje.length ? h('div', { class: 'fp-bloco' },
      h('span', { class: 'foco-rot' }, 'sessões de hoje'),
      h('ul', { class: 'fp-sessoes' }, [...hoje].reverse().slice(0, 8).map((s) => {
        const d = new Date(s.inicio);
        const mat = materia(s.tag);
        return h('li', null, h('span', null, `${pad(d.getHours())}:${pad(d.getMinutes())}`), h('i', { style: { background: mat?.cor || '#6c6c78' } }), h('span', { class: 'cresce' }, mat?.nome || 'sem matéria'), h('b', null, `${s.minutos} min`),
          h('button', { title: 'Apagar sessão (tira os minutos do hábito)', 'aria-label': 'Apagar sessão', onClick: () => apagarSessao(s.id) }, '×'));
      }))) : null);
}

function apagarSessao(id) {
  mudar((e) => {
    const s = e.sessoes.find((x) => x.id === id);
    if (!s) return;
    e.sessoes = e.sessoes.filter((x) => x.id !== id);
    // sessões antigas (sem destino gravado) usam o alvo atual; as novas, exatamente onde os minutos entraram
    const destino = s.destino !== undefined ? s.destino : (() => { const a = alvoPomodoro(e); return a ? { habitoId: a.hab.id, metricaId: a.m.id } : null; })();
    const v = destino && e.dias[s.dia]?.[destino.habitoId];
    if (v) v[destino.metricaId] = Math.max(0, (Number(v[destino.metricaId]) || 0) - s.minutos);
  });
}

function painelDeConfig() {
  const c = cfg();
  const num = (chave, rot, min, max) => h('label', { class: 'fc-num' }, h('span', null, rot),
    h('input', { type: 'number', min: String(min), max: String(max), value: String(c[chave]), onChange: (ev) => {
      const v = clamp(Math.round(Number(ev.target.value) || c[chave]), min, max);
      mudar((e) => (e.pomodoro.config = { ...cfg(), [chave]: v }));
    } }));
  const opcoes = [];
  for (const hab of ativos(S.estado)) if (hab.tipo === 'numero') for (const m of hab.metricas) if (m.unidade === 'min') opcoes.push({ v: `${hab.id}|${m.id}`, t: `${hab.emoji} ${hab.nome}${hab.metricas.length > 1 ? ' · ' + m.nome : ''}` });
  const alvo = alvoPomodoro();
  const atual = alvo ? `${alvo.hab.id}|${alvo.m.id}` : 'nenhum';

  return h('aside', { class: 'foco-painel' },
    h('div', { class: 'fp-bloco' },
      h('span', { class: 'foco-rot' }, 'tempos (minutos)'),
      h('div', { class: 'fc-grade' }, num('foco', 'foco', 1, 180), num('curta', 'pausa curta', 1, 60), num('longa', 'pausa longa', 1, 90), num('ciclos', 'focos até a longa', 2, 8), num('pausaRapida', 'pausa rápida 🚻', 1, 15)),
      h('label', { class: 'alternar' }, h('input', { type: 'checkbox', checked: c.autoIniciar, onChange: (ev) => mudar((e) => (e.pomodoro.config = { ...cfg(), autoIniciar: ev.target.checked })) }), 'emendar as fases automaticamente'),
      h('label', { class: 'alternar' }, h('input', { type: 'checkbox', checked: c.notificar, onChange: (ev) => mudar((e) => (e.pomodoro.config = { ...cfg(), notificar: ev.target.checked })) }), 'notificação do sistema no fim de cada fase')),
    h('div', { class: 'fp-bloco' },
      h('span', { class: 'foco-rot' }, 'somar os minutos em'),
      h('select', { class: 'entrada', onChange: (ev) => {
        const v = ev.target.value;
        mudar((e) => (e.pomodoro.config = { ...cfg(), alvo: v === 'nenhum' ? { nenhum: true } : { habitoId: v.split('|')[0], metricaId: v.split('|')[1] } }));
      } },
        opcoes.map((o) => h('option', { value: o.v, selected: o.v === atual }, o.t)),
        h('option', { value: 'nenhum', selected: atual === 'nenhum' }, 'não somar em nenhum hábito'))),
    h('div', { class: 'fp-bloco' },
      h('span', { class: 'foco-rot' }, 'matérias'),
      S.estado.materias.length ? h('div', { class: 'fc-materias' }, S.estado.materias.map((m) => h('div', { class: 'fc-mat' },
        h('button', { class: 'fc-cor', style: { background: m.cor }, title: 'Trocar cor', 'aria-label': 'Trocar cor',
          onClick: () => mudar((e) => { const x = e.materias.find((y) => y.id === m.id); x.cor = CORES_MATERIA[(CORES_MATERIA.indexOf(x.cor) + 1) % CORES_MATERIA.length]; }) }),
        h('input', { class: 'entrada', value: m.nome, maxlength: '40', onChange: (ev) => ev.target.value.trim() && mudar((e) => (e.materias.find((y) => y.id === m.id).nome = ev.target.value.trim())) }),
        h('select', { class: 'entrada fc-tema', title: 'Estética do modo foco', onChange: (ev) => mudar((e) => (e.materias.find((y) => y.id === m.id).tema = ev.target.value || undefined)) },
          h('option', { value: '', selected: !m.tema }, `auto (${temaDe({ nome: m.nome }).nome})`),
          Object.values(TEMAS).map((tm) => h('option', { value: tm.id, selected: m.tema === tm.id }, tm.nome))),
        (m.assuntos || []).length
          ? h('a', { class: 'mini-btn', href: '#materias', title: `Tem ${m.assuntos.length} assunto(s): exclua pela aba Matérias`, 'aria-label': 'Gerenciar na aba Matérias', onClick: () => fecharFoco() }, '↗')
          : botaoConfirmar('×', 'apagar?', () => mudar((e) => excluirMateria(e, m.id), { forcar: true }), 'mini-btn')))) : h('p', { class: 'fp-vazio' }, 'Crie matérias no campo "+ nova matéria".')));
}

// ----- pílula flutuante (timer rodando com o modo foco fechado) -----
export function renderPilula() {
  const raiz = document.getElementById('pomo-pilula');
  const t = S.estado && P()?.timer;
  if (!t || aberto) { raiz.replaceChildren(); return; }
  const tema = temaDe(materia(t.tag));
  const [c1, c2] = coresFase(tema, t.fase);
  raiz.replaceChildren(h('button', { class: `pilula tema-${tema.id} ${t.pausadoEm ? 'pausada' : ''}`, style: { '--f1': c1, '--f2': c2 }, onClick: abrirFoco, title: 'Abrir o modo foco' },
    h('span', { class: 'pilula-prog' }),
    h('span', null, t.fase === 'foco' ? tema.marca : t.fase === 'livre' ? '⏱' : '☕'),
    h('b', { id: 'pilula-tempo' }, ''),
    h('span', { class: 'pilula-tag' }, materia(t.tag)?.nome || tituloFase(tema, t.fase)),
    t.pausadoEm ? h('span', { class: 'pilula-pausa', id: t.pausaRapidaAte ? 'pilula-rapida' : null }, t.pausaRapidaAte ? '🚻' : 'pausado') : null));
  tique();
}

// ----- relógio: atualiza números, anel, título da aba; dispara o fim da fase -----
const TITULO = document.title;
export function tique() {
  if (!S.estado) return;
  const t = P()?.timer;
  if (!t) {
    document.title = TITULO;
    return;
  }
  if (t.pausadoEm && t.pausaRapidaAte) {
    const falta = t.pausaRapidaAte - agora();
    if (falta <= 0) { fimPausaRapida(); return; }
    const el = document.getElementById('foco-rapida-tempo');
    if (el) el.textContent = mmss(falta);
    const pt = document.getElementById('pilula-rapida');
    if (pt) pt.textContent = `🚻 ${mmss(falta)}`;
  }
  const livre = t.fase === 'livre';
  const resta = restante(t);
  if (!livre && resta <= 0 && !t.pausadoEm) { concluirFase(true); return; }
  const txt = mmss(livre ? decorrido(t) : resta);
  const frac = livre ? (decorrido(t) % 3600000) / 3600000 : clamp(1 - resta / t.duracaoMs, 0, 1);
  document.title = `${t.pausadoEm ? '❚❚ ' : ''}${txt} · ${TEMAS.padrao.titulos[t.fase].toLowerCase()} — Ofensiva`;
  const tempo = document.getElementById('foco-tempo');
  if (tempo) tempo.textContent = txt;
  const off = String(CIRC * (1 - frac));
  for (const sel of ['.fa-prog', '.fa-brilho']) document.querySelector(sel)?.setAttribute('stroke-dashoffset', off);
  const ponta = document.querySelector('.fa-ponta');
  if (ponta) {
    const a = frac * Math.PI * 2;
    ponta.setAttribute('cx', String(160 + R * Math.sin(a)));
    ponta.setAttribute('cy', String(160 - R * Math.cos(a)));
  }
  const pt = document.getElementById('pilula-tempo');
  if (pt) pt.textContent = txt;
  document.querySelector('.pilula-prog')?.style.setProperty('width', `${frac * 100}%`);
  for (const el of document.querySelectorAll('[data-pomo-tempo]')) el.textContent = txt;
}
setInterval(tique, 250);

addEventListener('keydown', (ev) => {
  if (!aberto) return;
  if (ev.target.closest?.('input, select, textarea')) return;
  if (ev.key === 'Escape') { ev.preventDefault(); fecharFoco(); }
  if (ev.code === 'Space') { ev.preventDefault(); P().timer ? pausarOuRetomar() : iniciar(P().proxima || 'foco'); }
});
