import {
  h, $, svg, ICONES, manterCampos, hojeISO, somaDias, parseISO, iso, diaSemana, inicioSemana, LETRAS_SEMANA,
  dataLonga, dataCurta, nomeMes, fmt, pct, uid, misturar, numeroLivre, pad,
} from './util.js';
import {
  progresso, prog, okDia, ativos, inicioHabito, ofensivaHabito, recordeHabito, notaDia, okGeral, inicioGeral,
  ofensivaGeral, recordeGeral, diasPerfeitos, pctHabito, descricaoMeta, detalheValor, fmtMetrica, rolarTodos, limparCache, valorDe,
} from './habitos.js';
import { S, carregar, definirRender, render, mudar, avisar, temPendencia } from './store.js';
import { proverbioDoDia } from './proverbios.js';
import { horoscopoDoDia, leituraOffline } from './horoscopo.js';
import { renderSemana, rolarSemanais } from './semana.js';
import { renderFoco, renderPilula, abrirFoco, alvoPomodoro, materia, sessoesDoDia, resumoHojePorMateria, temaAtual } from './pomodoro.js';
import { renderMaterias } from './materias.js';
import { temaDe } from './temas.js';
import { iniciarClaudinho, reagir, mostrarClaudinho } from './claudinho.js';
import { confete, som, celebrarOfensiva } from './efeitos.js';
import { abrirOnboarding } from './onboarding.js';
import { abrirAjustes, abrirNovoHabito } from './ajustes.js';

const VAZIO = '#2a2a30';
const fogo = (aceso, extra = '') => h('span', { class: `fogo ${aceso ? 'aceso' : ''} ${extra}`, html: ICONES.fogo });
const limiar = () => S.estado.perfil.limiar ?? 0.7;
const lerLS = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const gravarLS = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

// =====================================================================
// render geral
// =====================================================================
let foto = null; // o que estava completo no último render (para comemorar só mudanças)

function renderTudo() {
  limparCache();
  renderTopo();
  renderOfensiva();
  renderProverbio();
  renderHoroscopo();
  renderRegistro();
  aplicarVista();
  renderTodos();
  renderSemana();
  renderAno();
  renderMaterias();
  renderFoco();
  renderPilula();
  mostrarClaudinho(S.estado.perfil.claudinho !== false && S.estado.onboardingFeito);
  detectarConquistas();
}
definirRender(renderTudo);

function detectarConquistas() {
  const e = S.estado, d = S.hoje;
  const completos = new Set(ativos(e).filter((x) => prog(e, x, d).p >= 0.999).map((x) => x.id));
  const nd = notaDia(e, d);
  const geral = okGeral(nd, limiar());
  const antes = foto;
  foto = { dia: d, completos, geral, perfeito: nd.perfeito };
  if (!antes || antes.dia !== d) return;

  const novos = [...completos].filter((id) => !antes.completos.has(id));
  const tocar = e.perfil.som !== false;
  for (const id of novos) {
    const hab = e.habitos.find((x) => x.id === id);
    const card = document.querySelector(`.hcard[data-hid="${id}"]`);
    if (card && S.dia === d && card.offsetParent) {
      const r = card.getBoundingClientRect();
      confete(r.left + r.width / 2, r.top + 40, [hab.cor, '#ffffff', '#ffc857'], 50);
      card.classList.add('pulo');
    }
  }
  if (geral && !antes.geral) {
    const n = ofensivaGeral(e, d, limiar());
    if (tocar) som('ofensiva');
    celebrarOfensiva(n, recordeGeral(e, d, limiar()));
    reagir('ofensiva', { dias: n });
  } else if (nd.perfeito && !antes.perfeito) {
    if (tocar) som('ofensiva');
    reagir('tudo');
  } else if (novos.length) {
    if (tocar) som('ok');
    const hab = e.habitos.find((x) => x.id === novos[0]);
    reagir('completou', { nome: hab.nome });
  }
}

// =====================================================================
// topo
// =====================================================================
function renderTopo() {
  const e = S.estado;
  const n = ofensivaGeral(e, S.hoje, limiar());
  const garantida = okGeral(notaDia(e, S.hoje), limiar());
  const el = $('#topo-chama');
  el.className = `topo-chama ${n || garantida ? '' : 'apagada'}`;
  el.title = garantida ? 'Ofensiva de hoje garantida' : 'Ofensiva de hoje ainda não garantida';
  el.replaceChildren(fogo(garantida, garantida ? 'vivo' : ''), h('span', null, String(n)));
}

// =====================================================================
// ofensiva (estilo Duolingo)
// =====================================================================
function renderOfensiva() {
  const e = S.estado, hoje = S.hoje, lim = limiar();
  const raiz = $('#ofensiva');
  const n = ofensivaGeral(e, hoje, lim);
  const rec = recordeGeral(e, hoje, lim);
  const nd = notaDia(e, hoje);
  const garantida = okGeral(nd, lim);
  raiz.className = `card ofensiva ${garantida || n ? '' : 'fria'}`;

  const ini = inicioGeral(e);
  const seg = inicioSemana(hoje);
  const semana = LETRAS_SEMANA.map((letra, i) => {
    const d = somaDias(seg, i);
    let cls = 'perdeu';
    let conteudo = null;
    if (d > hoje) cls = 'futuro';
    else if (!ini || d < ini) cls = 'futuro';
    else if (okGeral(notaDia(e, d), lim)) { cls = 'ok'; conteudo = fogo(true); }
    else if (d === hoje) { cls = 'pendente'; conteudo = fogo(false); }
    return h('div', { class: `semana-dia ${d === hoje ? 'hoje' : ''}`, title: dataLonga(d) },
      h('span', null, letra), h('div', { class: `semana-bola ${cls}` }, conteudo));
  });

  const falta = Math.max(0, lim - nd.media);
  const status = !ativos(e).length
    ? 'Crie seus hábitos para acender a primeira chama.'
    : garantida
      ? nd.perfeito ? 'Dia perfeito! Todos os hábitos fechados 🔥' : 'Ofensiva de hoje garantida! 🔥'
      : n
        ? `Faltam ${pct(falta)} do dia pra manter a chama de ${n} ${n === 1 ? 'dia' : 'dias'}.`
        : `Chegue a ${pct(lim)} do dia para acender a chama.`;

  raiz.replaceChildren(
    h('div', { class: 'of-topo' },
      h('div', { class: 'of-chama' }, fogo(garantida || n > 0, 'vivo')),
      h('div', null, h('div', { class: 'of-num' }, String(n)), h('div', { class: 'of-rotulo' }, n === 1 ? 'dia de ofensiva' : 'dias de ofensiva'))),
    h('p', { class: 'of-status' }, status),
    h('div', { class: 'of-barra', title: `Hoje: ${pct(nd.media)} · meta da ofensiva: ${pct(lim)}` },
      h('div', { class: 'of-barra-enc', style: { width: pct(Math.min(1, nd.media)) } }),
      h('div', { class: 'of-barra-marca', 'data-rot': `meta ${pct(lim)}`, style: { left: pct(lim) } })),
    h('div', { class: 'semana' }, semana),
    h('div', { class: 'of-stats' },
      h('div', { class: 'stat' }, h('b', null, String(rec)), h('span', null, 'recorde')),
      h('div', { class: 'stat' }, h('b', null, String(diasPerfeitos(e, hoje))), h('span', null, 'dias perfeitos')),
      h('div', { class: 'stat' }, h('b', null, pct(nd.media)), h('span', null, 'do dia feito'))),
    ativos(e).length ? h('div', { class: 'chips-ofensiva' }, ativos(e).map((x) => {
      const k = ofensivaHabito(e, x, hoje);
      return h('span', { class: `chip-of ${k ? '' : 'zero'}`, title: `${x.nome}: ${k} ${k === 1 ? 'dia' : 'dias'} seguidos` }, x.emoji, ' ', fogo(k > 0), String(k));
    })) : null
  );
}

// =====================================================================
// provérbio do dia
// =====================================================================
function renderProverbio() {
  const p = proverbioDoDia(S.hoje);
  const leitura = lerLS('ofensiva.modoLeitura') === '1';
  const raiz = $('#proverbio');
  raiz.className = `card proverbio ${leitura ? 'modo-leitura' : ''}`;
  const revelar = (e) => e.currentTarget.classList.add('revelado');
  raiz.replaceChildren(
    h('div', { class: 'pv-topo' },
      h('div', { class: 'pv-selo' }, h('span', { class: 'carimbo' }, '谚语'), h('span', { class: 'rotulo' }, `provérbio do dia · ${dataCurta(S.hoje)}`)),
      h('button', {
        class: `btn-texto ${leitura ? 'ativo' : ''}`,
        title: 'Esconde pinyin e tradução para você tentar ler primeiro',
        onClick: () => { gravarLS('ofensiva.modoLeitura', leitura ? '0' : '1'); renderProverbio(); },
      }, svg(ICONES.olho), leitura ? 'modo leitura: on' : 'tentar ler primeiro')),
    h('p', { class: 'pv-hanzi', lang: 'zh-CN' }, p.h.split('，').map((parte, i, arr) => h('span', { class: 'pv-frase' }, parte + (i < arr.length - 1 ? '，' : '')))),
    h('div', { class: 'pv-pinyin borravel', onClick: revelar }, p.p),
    h('p', { class: 'pv-lit borravel', onClick: revelar }, `“${p.lit}”`),
    h('p', { class: 'pv-sent borravel', onClick: revelar }, p.sent),
    h('p', { class: 'pv-vida' }, h('b', null, 'pra levar pra vida'), p.vida)
  );
}

// =====================================================================
// horóscopo chinês do dia
// =====================================================================
const COR_ELEMENTO = { madeira: '#8fd18f', fogo: '#ff8a65', terra: '#d9b26f', metal: '#cfd6e0', 'água': '#7fb7ff' };
const COR_TOM = { 'favorável': '#8fdc8f', 'atenção': '#ff8a7a', misto: '#f6c98b', neutro: '#a1a1ad' };
let horoscopoPedido = null; // dia+nascimento já pedido ao Claude (evita repetir)

function fatosHoroscopo(hz) {
  return {
    signo: { pilar: hz.signo.hanzi, nome: hz.signo.nome, anoAstrologico: hz.signo.anoAstro, tracos: hz.signo.tracos },
    dia: { data: S.hoje, pilar: hz.dia.hanzi, pinyin: hz.dia.pinyin, nome: hz.dia.nome },
    relacoesEntreRamos: hz.ramos.map((r) => `${r.zh} (${r.nome}): ${r.texto}`),
    cincoElementos: `${hz.elementos.zh}, ${hz.elementos.nome}: ${hz.elementos.texto}`,
    tomDoDia: hz.tom,
    notaDe1a5: hz.nota,
    anoChines: `${hz.ano.nome} ${hz.ano.hanzi}`,
  };
}

async function pedirHoroscopo(hz, nasc) {
  const dia = S.hoje;
  horoscopoPedido = dia + nasc;
  try {
    const r = await fetch('/api/horoscopo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fatos: fatosHoroscopo(hz), contexto: contextoClaudinho() }),
    });
    const j = await r.json();
    if (j.leitura && S.hoje === dia && S.estado.perfil.nascimento === nasc) mudar((e) => (e.horoscopo = { dia, nasc, leitura: j.leitura }));
  } catch {
    /* fica a leitura offline */
  }
}

function renderHoroscopo() {
  const raiz = $('#horoscopo');
  const nasc = S.estado.perfil.nascimento;
  const selo = (txt) => h('div', { class: 'pv-selo' }, h('span', { class: 'carimbo' }, '生肖'), h('span', { class: 'rotulo' }, txt));
  if (!nasc) {
    const data = h('input', { type: 'date', class: 'entrada', max: S.hoje, min: '1900-01-01', 'aria-label': 'Data de nascimento' });
    raiz.replaceChildren(
      h('div', { class: 'hs-topo' }, selo('horóscopo chinês do dia')),
      h('div', { class: 'hs-vazio' },
        h('div', { class: 'hs-roda' }, ['🐀', '🐂', '🐅', '🐇', '🐉', '🐍', '🐎', '🐐', '🐒', '🐓', '🐕', '🐖'].map((a) => h('span', null, a))),
        h('p', null, 'Qual é a sua data de nascimento? Com ela eu descubro seu animal e elemento no zodíaco chinês e leio como o dia de hoje conversa com você.'),
        h('div', { class: 'linha' }, data, h('button', { class: 'btn-primario', onClick: () => data.value && mudar((e) => (e.perfil.nascimento = data.value)) }, 'Ver meu horóscopo'))));
    return;
  }

  const hz = horoscopoDoDia(nasc, S.hoje);
  const salvo = S.estado.horoscopo;
  const doClaude = salvo && salvo.dia === S.hoje && salvo.nasc === nasc ? salvo.leitura : null;
  const leitura = doClaude || leituraOffline(hz);
  if (!doClaude && S.claude.configurada && horoscopoPedido !== S.hoje + nasc) pedirHoroscopo(hz, nasc);

  const s = hz.signo, d = hz.dia;
  const bolinhas = h('span', { class: 'hs-nota', title: `energia do dia: ${hz.nota} de 5` }, [1, 2, 3, 4, 5].map((i) => h('i', { class: i <= hz.nota ? 'on' : '' })));
  const elem = (nome, zh) => h('span', { class: 'hs-el', style: { '--e': COR_ELEMENTO[nome] } }, `${zh} ${nome}`);
  const fonte = doClaude
    ? '✦ leitura escrita pelo Claudinho a partir do calendário'
    : S.claude.configurada ? 'o Claudinho está escrevendo a leitura de hoje…' : 'leitura offline · com chave da API, o Claudinho escreve uma personalizada';

  raiz.replaceChildren(
    h('div', { class: 'hs-topo' },
      selo(`horóscopo chinês · ${dataCurta(S.hoje)}`),
      h('div', { class: 'hs-tom', style: { '--t': COR_TOM[hz.tom] } }, h('span', null, hz.tom), bolinhas)),
    h('div', { class: 'hs-grade' },
      h('div', { class: 'hs-bloco hs-signo' },
        h('span', { class: 'rotulo' }, 'seu signo'),
        h('div', { class: 'hs-animal' }, h('span', { class: 'hs-emoji' }, s.emoji), h('span', { class: 'hs-zh', lang: 'zh-CN' }, s.animalZh)),
        h('b', { class: 'hs-nome' }, s.nome),
        h('span', { class: 'hs-pilar' }, h('span', { lang: 'zh-CN' }, s.hanzi), ` · ${s.pinyin} · ano ${s.anoAstro}`),
        h('div', { class: 'hs-tracos' }, s.tracos.map((t) => h('span', null, t)))),
      h('div', { class: 'hs-bloco hs-dia' },
        h('span', { class: 'rotulo' }, 'hoje é dia do'),
        h('div', { class: 'hs-animal' }, h('span', { class: 'hs-emoji' }, d.emoji), h('span', { class: 'hs-zh', lang: 'zh-CN' }, `${d.hanzi}日`)),
        h('b', { class: 'hs-nome' }, d.nome),
        h('span', { class: 'hs-pilar' }, d.pinyin),
        h('div', { class: 'hs-rels' },
          hz.ramos.length
            ? hz.ramos.map((r) => h('span', { class: `hs-rel ${r.tom}`, title: r.texto }, h('b', { lang: 'zh-CN' }, r.zh), r.nome))
            : h('span', { class: 'hs-rel neutro', title: 'Sem relação tradicional forte entre os dois animais' }, h('b', null, '—'), 'sem relação forte com o seu animal'),
          h('span', { class: 'hs-rel elementos', title: hz.elementos.texto }, elem(d.elemento, d.elementoZh), '→', elem(s.elemento, s.elementoZh), hz.elementos.nome))),
      h('div', { class: 'hs-bloco hs-leitura' },
        [['Geral', leitura.geral], ['Foco', leitura.foco], ['Corpo', leitura.corpo], ['Conselho', leitura.conselho]]
          .filter(([, t]) => t).map(([k, t]) => h('p', null, h('b', null, k), t)),
        h('span', { class: 'hs-fonte' }, fonte))),
    h('div', { class: 'hs-pe' },
      `Ano chinês: ${hz.ano.emoji} `, h('span', { lang: 'zh-CN' }, hz.ano.hanzi), ` ${hz.ano.nome}`,
      hz.relAno.length ? ` · com o seu ${s.animal}: ${hz.relAno.map((r) => `${r.zh} ${r.nome}`).join(', ')}` : '',
      s.limiar || s.antesDoAnoNovo ? h('span', { class: 'hs-nota-ano' }, ' · o signo vira no 立春 (~4/fev); quem nasceu em jan/fev pode ter outro animal pelo Ano Novo Lunar') : null)
  );
}

// =====================================================================
// registro do dia
// =====================================================================
function renderRegistro() {
  const e = S.estado, dia = S.dia;
  const raiz = $('#registro');
  const lista = ativos(e);
  const nd = notaDia(e, dia);
  const eHoje = dia === S.hoje;

  const nav = h('div', { class: 'nav-dia' },
    !eHoje && h('button', { class: 'voltar-hoje', onClick: () => irPara(S.hoje) }, 'voltar pra hoje'),
    h('button', { class: 'btn-icone', 'aria-label': 'Dia anterior', onClick: () => irPara(somaDias(dia, -1)) }, svg(ICONES.esq)),
    h('div', { class: 'nav-dia-data' }, eHoje ? 'Hoje' : dataLonga(dia).split(',')[0], h('small', null, eHoje ? dataLonga(dia) : dataLonga(dia).split(', ')[1])),
    h('button', { class: 'btn-icone', 'aria-label': 'Próximo dia', disabled: eHoje, onClick: () => irPara(somaDias(dia, 1)) }, svg(ICONES.dir)));

  raiz.replaceChildren(
    h('div', { class: 'cabecalho-secao' },
      h('h2', { class: 'secao' }, eHoje ? 'Registro de hoje' : 'Registro'),
      lista.length ? h('span', { class: 'nota-dia' }, `${pct(nd.media)} do dia`) : null,
      nav),
    lista.length
      ? h('div', { class: 'grade-habitos' }, lista.map(cardHabito))
      : h('div', { class: 'card vazio-estado' },
          h('p', null, 'Nenhum hábito por aqui ainda.'),
          h('button', { class: 'btn-primario', onClick: () => abrirNovoHabito() }, svg(ICONES.mais), 'Criar hábito'))
  );
}

function irPara(d) {
  if (d > S.hoje) return;
  S.dia = d;
  render();
}

// Animação do progresso: cada anel/barra lembra o último valor desenhado e anima dele até o novo
// (o cartão é recriado a cada mudança, então sem isso ele "pularia" direto pro valor final).
const ULTIMO = new Map();
const reduzMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;
const depoisDoPintar = (fn) => requestAnimationFrame(() => requestAnimationFrame(fn));
const suave = (t) => 1 - Math.pow(1 - t, 3);

function contarPct(span, de, para, ms = 750) {
  const ini = performance.now();
  const passo = (agora) => {
    if (!span.isConnected) return;
    const t = Math.min(1, (agora - ini) / ms);
    const v = de + (para - de) * suave(t);
    span.textContent = t >= 1 && para >= 0.999 ? '✓' : pct(v);
    if (t < 1) requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
}

function anel(p, descanso, chave) {
  const R = 18, C = 2 * Math.PI * R;
  const alvo = Math.min(1, p);
  const de = reduzMovimento ? alvo : ULTIMO.has(chave) ? ULTIMO.get(chave) : 0;
  ULTIMO.set(chave, alvo);
  const cheio = alvo >= 0.999;
  const rotulo = h('span', null, descanso ? '💤' : de === alvo ? (cheio ? '✓' : pct(alvo)) : pct(de));
  const el = h('div', {
    class: `anel ${cheio ? 'cheio' : ''}`,
    html: `<svg viewBox="0 0 44 44"><circle class="anel-fundo" cx="22" cy="22" r="${R}"/><circle class="anel-frente" cx="22" cy="22" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - de)}"/></svg>`,
  }, rotulo);
  if (de !== alvo) {
    depoisDoPintar(() => {
      el.querySelector('.anel-frente')?.setAttribute('stroke-dashoffset', String(C * (1 - alvo)));
      if (!descanso) contarPct(rotulo, de, alvo);
      if (cheio && de < 0.999) setTimeout(() => el.classList.add('estourou'), 650);
    });
  }
  return el;
}

/** Barra de progresso que anima do valor anterior até o novo. */
function barraAnimada(frac, chave) {
  const alvo = Math.max(0, Math.min(1, frac));
  const de = reduzMovimento ? alvo : ULTIMO.has(chave) ? ULTIMO.get(chave) : 0;
  ULTIMO.set(chave, alvo);
  const preench = h('div', { style: { width: pct(de) } });
  if (de !== alvo) depoisDoPintar(() => (preench.style.width = `${alvo * 100}%`));
  return h('div', { class: `barra ${alvo >= 0.999 ? 'cheia' : ''}` }, preench);
}

/** Muda o valor de um hábito no dia aberto. */
function definir(hab, fn) {
  mudar((e) => {
    const d = (e.dias[S.dia] ??= {});
    const novo = fn(structuredClone(d[hab.id] ?? {}));
    const vazio = !novo || Object.values(novo).every((v) => v === 0 || v === false || v === '' || v == null);
    if (vazio) delete d[hab.id];
    else d[hab.id] = novo;
    if (!Object.keys(d).length) delete e.dias[S.dia];
  });
}

function cardHabito(hab) {
  const e = S.estado;
  const v = valorDe(e, hab, S.dia);
  const r = progresso(hab, v);
  const k = ofensivaHabito(e, hab, S.hoje);
  const corpo =
    hab.tipo === 'numero' ? corpoNumero(hab, v)
    : hab.tipo === 'checklist' ? corpoChecklist(hab, v)
    : hab.tipo === 'simnao' ? corpoSimNao(hab, v)
    : corpoNiveis(hab, v);
  return h('article', { class: `hcard ${okDia(r) && !r.descanso ? 'completo' : ''}`, 'data-hid': hab.id, style: { '--c': hab.cor } },
    h('div', { class: 'hc-topo' },
      h('div', { class: 'hc-emoji' }, hab.emoji),
      h('div', { class: 'hc-tit' }, h('div', { class: 'hc-nome' }, hab.nome), h('div', { class: 'hc-meta', title: descricaoMeta(hab) }, descricaoMeta(hab))),
      anel(r.p, r.descanso, `${hab.id}|${S.dia}`)),
    corpo,
    h('div', { class: 'hc-rodape' },
      h('span', { class: `chip-of ${k ? '' : 'zero'}` }, fogo(k > 0), `${k} ${k === 1 ? 'dia' : 'dias'}`),
      h('span', null, `recorde ${recordeHabito(e, hab, S.hoje)}`)));
}

// ---------- tipo número ----------
function corpoNumero(hab, v) {
  return hab.metricas.map((m) => {
    const val = Number(v?.[m.id]) || 0;
    const passos = (m.passos?.length ? m.passos : [1]).filter((x) => x > 0);
    const somar = (q) => definir(hab, (o) => ({ ...o, [m.id]: Math.max(0, Math.round(((Number(o[m.id]) || 0) + q) * 100) / 100) }));
    const emHoras = m.unidade === 'min' && m.meta >= 60;
    const valorEl = h('button', { class: 'valor-btn', title: `Clique para digitar o valor exato${emHoras ? ' (em minutos)' : ''}` },
      emHoras ? fmtMetrica(val, m) : fmt(val, m.decimal ? 1 : 0));
    valorEl.addEventListener('click', () => {
      const inp = h('input', { class: 'valor-input', type: 'text', inputmode: 'decimal', value: String(val).replace('.', ',') });
      const confirmar = () => {
        const n = numeroLivre(inp.value);
        if (n != null && n >= 0 && n !== val) definir(hab, (o) => ({ ...o, [m.id]: n }));
        else render();
      };
      inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') inp.blur(); if (ev.key === 'Escape') { inp.value = String(val); inp.blur(); } });
      inp.addEventListener('blur', confirmar, { once: true });
      valorEl.replaceWith(inp);
      inp.focus();
      inp.select();
    });
    const alvo = alvoPomodoro();
    const ehAlvo = alvo && alvo.hab.id === hab.id && alvo.m.id === m.id;
    const cronAqui = S.estado.cronometro?.habitoId === hab.id && S.estado.cronometro?.metricaId === m.id;
    const cron = ehAlvo ? [botaoPomodoro(), cronAqui ? botaoCronometro(hab, m) : null] : m.cronometro ? botaoCronometro(hab, m) : null;
    const porMat = ehAlvo ? resumoPorMateriaDoDia() : null;
    return h('div', { class: 'met' },
      hab.metricas.length > 1 && h('div', { class: 'met-nome' }, m.nome),
      h('div', { class: 'met-val' }, valorEl, h('span', { class: 'met-meta' }, `/ ${fmtMetrica(m.meta, m)}`)),
      barraAnimada(val / m.meta, `${hab.id}|${m.id}|${S.dia}`),
      h('div', { class: 'botoes' },
        (m.menos?.filter((x) => x > 0).length ? m.menos.filter((x) => x > 0) : [passos[0]]).map((q) =>
          h('button', { class: 'b menos', disabled: val <= 0, onClick: () => somar(-q), 'aria-label': `Tirar ${q}` }, `−${fmt(q, 2)}`)),
        passos.map((q) => h('button', { class: 'b mais', onClick: () => somar(q) }, `+${fmt(q, 2)}`)),
        cron),
      porMat,
      m.dica && h('div', { class: 'dica-hab' }, m.dica));
  });
}

function botaoPomodoro() {
  const t = S.estado.pomodoro.timer;
  const tema = temaAtual();
  return h('button', { class: `b cron pomo ${t ? 'rodando' : ''}`, title: 'Abrir o modo foco (pomodoro)', onClick: abrirFoco },
    h('span', null, tema.marca), t ? h('span', { 'data-pomo-tempo': '' }, '…') : 'pomodoro');
}
function resumoPorMateriaDoDia() {
  const ss = S.dia === S.hoje ? sessoesDoDia() : sessoesDoDia(S.dia);
  if (!ss.length) return null;
  const mapa = new Map();
  for (const s of ss) mapa.set(s.tag || '_', (mapa.get(s.tag || '_') || 0) + s.minutos);
  return h('div', { class: 'pomo-resumo' }, [...mapa.entries()].sort((a, b) => b[1] - a[1]).map(([tag, min]) => {
    const mt = materia(tag);
    return h('span', { style: { '--m': mt?.cor || '#6c6c78' } }, h('i'), `${mt?.nome || 'sem matéria'} · ${min} min`);
  }));
}

function botaoCronometro(hab, m) {
  const c = S.estado.cronometro;
  const meu = c && c.habitoId === hab.id && c.metricaId === m.id;
  if (meu) {
    return h('button', { class: 'b cron rodando', 'data-cron': String(c.inicio), onClick: pararCronometro, title: 'Parar e somar o tempo' },
      svg(ICONES.stop), h('span', { class: 'cron-t' }, tempoDecorrido(c.inicio)));
  }
  return h('button', { class: 'b cron', title: 'Cronômetro: soma os minutos quando você parar', onClick: () => iniciarCronometro(hab, m) }, svg(ICONES.play), 'cronômetro');
}
function tempoDecorrido(inicio) {
  const s = Math.max(0, Math.floor((Date.now() - inicio) / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}
function iniciarCronometro(hab, m) {
  if (S.estado.cronometro) pararCronometro();
  mudar((e) => { e.cronometro = { habitoId: hab.id, metricaId: m.id, dia: S.dia, inicio: Date.now() }; });
}
function pararCronometro() {
  const c = S.estado.cronometro;
  if (!c) return;
  const minutos = Math.round((Date.now() - c.inicio) / 60000);
  mudar((e) => {
    e.cronometro = null;
    const hab = e.habitos.find((x) => x.id === c.habitoId);
    if (!hab || minutos <= 0) return;
    const d = (e.dias[c.dia] ??= {});
    const o = (d[hab.id] ??= {});
    o[c.metricaId] = (Number(o[c.metricaId]) || 0) + minutos;
  });
  avisar(minutos > 0 ? `+${minutos} min registrados` : 'Menos de 1 minuto — nada somado');
}
setInterval(() => {
  for (const b of document.querySelectorAll('[data-cron]')) b.querySelector('.cron-t').textContent = tempoDecorrido(Number(b.dataset.cron));
}, 1000);

// ---------- tipo checklist ----------
function corpoChecklist(hab, v) {
  return h('div', { class: 'chk-lista' }, hab.itens.map((it) => {
    const on = !!v?.[it.id];
    return h('button', { class: `chk ${on ? 'on' : ''}`, 'aria-pressed': String(on), onClick: () => definir(hab, (o) => ({ ...o, [it.id]: !on })) },
      h('span', { class: 'caixa' }, svg(ICONES.check)), it.nome);
  }));
}

// ---------- tipo sim/não ----------
function corpoSimNao(hab, v) {
  const feito = !!v?.feito;
  const tags = hab.tags || [];
  return h('div', { class: 'met' },
    h('button', {
      class: `sn-feito ${feito ? 'on' : ''}`,
      onClick: () => definir(hab, (o) => (feito ? { ...o, feito: false, tag: '' } : { ...o, feito: true, descanso: false })),
    }, feito ? `✓ Feito${v?.tag ? ' · ' + v.tag : ''}` : 'Marcar como feito'),
    (tags.length || hab.permiteDescanso) && h('div', { class: 'tags' },
      tags.map((t) => h('button', {
        class: `tag ${v?.tag === t ? 'on' : ''}`,
        onClick: () => definir(hab, (o) => (o.tag === t ? { ...o, tag: '' } : { ...o, feito: true, descanso: false, tag: t })),
      }, t)),
      hab.permiteDescanso && h('button', {
        class: `tag descanso ${v?.descanso ? 'on' : ''}`,
        title: 'Dia de descanso não quebra a ofensiva',
        onClick: () => definir(hab, (o) => (o.descanso ? { ...o, descanso: false } : { feito: false, tag: '', descanso: true })),
      }, '😴 descanso')));
}

// ---------- tipo níveis ----------
function corpoNiveis(hab, v) {
  const nivel = v?.nivel || 0;
  const nota = hab.nota
    ? h('input', {
        class: 'nota-input', placeholder: 'o que você fez hoje?', value: v?.nota || '', maxlength: '200',
        onChange: (ev) => definir(hab, (o) => ({ ...o, nota: ev.target.value.trim() })),
        onKeydown: (ev) => { if (ev.key === 'Enter') ev.target.blur(); },
      })
    : null;
  return h('div', { class: 'met' },
    h('div', { class: 'segmentos' },
      h('button', { class: nivel === 0 ? 'on' : '', onClick: () => definir(hab, (o) => ({ ...o, nivel: 0 })) }, 'Nada'),
      hab.niveis.map((n, i) => h('button', { class: nivel === i + 1 ? 'on' : '', onClick: () => definir(hab, (o) => ({ ...o, nivel: i + 1 })) }, n.nome))),
    nota);
}

// =====================================================================
// tarefas do dia
// =====================================================================
function renderTodos() {
  manterCampos($('#todos'), desenharTodos);
}
function desenharTodos() {
  const e = S.estado, hoje = S.hoje;
  const raiz = $('#todos');
  const lista = e.todos.filter((t) => t.dia === hoje).sort((a, b) => (a.feito - b.feito) || (b.manter - a.manter) || (a.criado - b.criado));
  const feitas = lista.filter((t) => t.feito).length;
  const focoAntes = document.activeElement?.id === 'todo-nova';

  const entrada = h('input', { id: 'todo-nova', placeholder: 'Adicionar tarefa de hoje…', maxlength: '200', autocomplete: 'off', 'data-campo': 'todo-nova' });
  const form = h('form', {
    class: 'todo-form',
    onSubmit: (ev) => {
      ev.preventDefault();
      const texto = entrada.value.trim();
      if (!texto) return;
      entrada.value = '';
      mudar((st) => st.todos.push({ id: 't' + uid(), texto, feito: false, dia: hoje, manter: false, adiado: 0, criado: Date.now() }));
      $('#todo-nova')?.focus();
    },
  }, entrada, h('button', { type: 'submit', 'aria-label': 'Adicionar' }, svg(ICONES.mais)));

  raiz.replaceChildren(
    h('div', { class: 'todos-topo' }, h('h2', null, 'Tarefas de hoje'), h('span', { class: 'todos-conta' }, lista.length ? `${feitas}/${lista.length}` : '')),
    form,
    lista.length
      ? h('ul', { class: 'todo-lista' }, lista.map(itemTodo))
      : h('div', { class: 'todos-vazio' }, 'Nada por aqui. O que precisa sair hoje?'),
    h('p', { class: 'todos-pe' }, 'As tarefas valem só pra hoje: à meia-noite elas somem. Clique no ', h('b', null, '📌'), ' de uma tarefa para ela ficar até amanhã.')
  );
  if (focoAntes) entrada.focus();
}

function itemTodo(t) {
  const alterar = (fn) => mudar((e) => { const x = e.todos.find((y) => y.id === t.id); if (x) fn(x); });
  const texto = h('div', { class: 'todo-texto', title: 'Duplo clique para editar' }, t.texto);
  texto.addEventListener('dblclick', () => {
    const inp = h('input', { class: 'todo-edit', value: t.texto, maxlength: '200' });
    const ok = () => { const v = inp.value.trim(); if (v && v !== t.texto) alterar((x) => (x.texto = v)); else render(); };
    inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') inp.blur(); if (ev.key === 'Escape') { inp.value = t.texto; inp.blur(); } });
    inp.addEventListener('blur', ok, { once: true });
    texto.replaceWith(inp);
    inp.focus();
  });
  const meta = [];
  if (t.adiado) meta.push(h('span', { class: 'adiado' }, `↻ ${t.adiado === 1 ? 'veio de ontem' : `adiada ${t.adiado}x`}`));
  if (t.manter && !t.feito) meta.push(h('span', { class: 'vai' }, '📌 fica pra amanhã'));
  return h('li', { class: `todo ${t.feito ? 'feito' : ''} ${t.manter && !t.feito ? 'fixo' : ''}` },
    h('button', {
      class: 'caixa', 'aria-label': t.feito ? 'Desmarcar' : 'Concluir',
      onClick: () => { alterar((x) => (x.feito = !x.feito)); if (!t.feito && S.estado.perfil.som !== false) som('tique'); },
    }, svg(ICONES.check)),
    h('div', { class: 'todo-corpo' }, texto, meta.length ? h('div', { class: 'todo-meta' }, meta) : null),
    h('div', { class: 'todo-acoes' },
      !t.feito && h('button', {
        class: `pin ${t.manter ? 'on' : ''}`,
        title: t.manter ? 'Não levar pra amanhã' : 'Levar pra amanhã (se não terminar hoje)',
        'aria-pressed': String(!!t.manter),
        onClick: () => alterar((x) => (x.manter = !x.manter)),
      }, svg(ICONES.pin)),
      !t.feito && h('button', {
        class: 'mover', title: 'Mover para as tarefas da semana', 'aria-label': 'Mover para a semana',
        onClick: () => mudar((e) => {
          e.todos = e.todos.filter((y) => y.id !== t.id);
          e.semanais.push({ id: 's' + uid(), texto: t.texto, feito: false, semana: inicioSemana(S.hoje), acumular: false, adiada: 0, criado: Date.now() });
        }),
      }, h('span', { class: 'ic-txt' }, '→S')),
      h('button', { title: 'Apagar', 'aria-label': 'Apagar tarefa', onClick: () => mudar((e) => (e.todos = e.todos.filter((y) => y.id !== t.id))) }, svg(ICONES.x))));
}

// =====================================================================
// ano em revisão (mapa de calor)
// =====================================================================
function renderAno() {
  const e = S.estado, ano = S.ano;
  const raiz = $('#ano');
  const lista = ativos(e);
  if (!lista.length) { raiz.replaceChildren(); return; }

  const primeiro = `${ano}-01-01`, ultimo = `${ano}-12-31`;
  const ini = inicioSemana(primeiro);
  const fim = somaDias(inicioSemana(ultimo), 6);
  const dias = [];
  for (let d = ini; d <= fim; d = somaDias(d, 1)) dias.push(d);
  const cols = dias.length / 7;

  const meses = h('div', { class: 'meses', style: { '--cols': cols } });
  for (let m = 0; m < 12; m++) {
    const d1 = `${ano}-${pad(m + 1)}-01`;
    const col = Math.floor((parseISO(d1) - parseISO(ini)) / 86400000 / 7);
    meses.append(h('span', { style: { gridColumn: `${col + 1} / span 4` } }, nomeMes(m)));
  }

  const lim = limiar();
  const geral = {
    id: '_geral', nome: 'Ofensiva geral', emoji: '🔥', cor: '#ff9a3c',
    descr: `dias com ${pct(lim)} ou mais`,
    celula: (d) => { const nd = notaDia(e, d); return { p: nd.reg ? nd.media : 0, descanso: false, reg: nd.reg }; },
    inicio: inicioGeral(e),
    pct: (() => { let s = 0, n = 0; for (let d = inicioGeral(e); d <= S.hoje; d = somaDias(d, 1)) { const nd = notaDia(e, d); if (d === S.hoje && !nd.reg) continue; s += nd.media; n++; } return n ? s / n : 0; })(),
    ofensiva: ofensivaGeral(e, S.hoje, lim),
  };
  const blocos = [geral, ...lista.map((x) => ({
    id: x.id, nome: x.nome, emoji: x.emoji, cor: x.cor, descr: descricaoMeta(x),
    celula: (d) => prog(e, x, d), inicio: inicioHabito(e, x), pct: pctHabito(e, x, S.hoje), ofensiva: ofensivaHabito(e, x, S.hoje),
  }))];

  const mapas = blocos.map((b) => {
    const grade = h('div', { class: 'grade-ano', style: { '--cols': cols } });
    const frag = document.createDocumentFragment();
    for (const d of dias) {
      let cls = 'cel';
      let bg = null;
      if (d < primeiro || d > ultimo) cls += ' fora';
      else if (d > S.hoje) cls += ' futuro';
      else if (d < b.inicio) cls += ' antes';
      else {
        const r = b.celula(d);
        if (r.descanso) cls += ' descanso';
        else if (r.p > 0) bg = misturar(VAZIO, b.cor, 0.22 + 0.78 * Math.min(1, r.p));
      }
      if (d === S.hoje) cls += ' hoje';
      if (d === S.dia && S.dia !== S.hoje) cls += ' sel';
      const c = document.createElement('div');
      c.className = cls;
      if (bg) c.style.background = bg;
      if (!cls.includes('fora')) { c.dataset.d = d; c.dataset.h = b.id; }
      frag.append(c);
    }
    grade.append(frag);
    return h('div', { class: 'mapa', style: { '--c': b.cor } },
      h('div', { class: 'mapa-barra' },
        h('span', { class: 'mapa-ponto' }),
        h('div', { class: 'mapa-nome', title: `${b.nome} — ${b.descr}` }, `${b.emoji} ${b.nome} `, h('span', null, `— ${b.descr}`)),
        h('div', { class: 'mapa-dir' },
          h('span', { class: `mapa-of ${b.ofensiva ? '' : 'zero'}`, title: 'ofensiva atual' }, fogo(b.ofensiva > 0), String(b.ofensiva)),
          h('span', { class: 'mapa-pct', title: 'média de cumprimento desde o início' }, pct(b.pct)))),
      h('div', { class: 'mapa-rolagem' }, h('div', { class: 'mapa-interno' }, meses.cloneNode(true), grade)));
  });

  const anoAtual = new Date().getFullYear();
  raiz.replaceChildren(
    h('div', { class: 'cabecalho-secao ano-cab' },
      h('button', { class: 'btn-icone', 'aria-label': 'Ano anterior', onClick: () => { S.ano--; renderAno(); } }, svg(ICONES.esq)),
      h('h2', { class: 'secao' }, `${ano} em revisão`),
      h('button', { class: 'btn-icone', 'aria-label': 'Próximo ano', disabled: ano >= anoAtual + 1, onClick: () => { S.ano++; renderAno(); } }, svg(ICONES.dir)),
      h('div', { class: 'legenda' }, 'menos',
        [0, 0.25, 0.5, 0.75, 1].map((p) => h('i', { style: { background: p ? misturar(VAZIO, '#a1a1ad', 0.22 + 0.78 * p) : VAZIO } })),
        'mais', h('span', { class: 'sep' }), h('i', { style: { background: VAZIO, boxShadow: 'inset 0 0 0 2px #6c6c78' } }), 'descanso')),
    h('div', { class: 'mapas' }, mapas));

  // rola cada mapa até o mês atual (útil em telas estreitas)
  requestAnimationFrame(() => {
    for (const r of raiz.querySelectorAll('.mapa-rolagem')) {
      const hoje = r.querySelector('.cel.hoje');
      if (hoje && r.scrollWidth > r.clientWidth) r.scrollLeft = hoje.offsetLeft - r.clientWidth * 0.7;
    }
  });
}

// dica (tooltip) e clique nas células — delegação
const dica = $('#dica');
$('#ano').addEventListener('mouseover', (ev) => {
  const c = ev.target.closest('.cel[data-d]');
  if (!c) { dica.hidden = true; return; }
  const d = c.dataset.d;
  const e = S.estado;
  let titulo = dataLonga(d), linha;
  if (d > S.hoje) linha = 'ainda não chegou';
  else if (c.dataset.h === '_geral') {
    const nd = notaDia(e, d);
    linha = nd.reg ? `${pct(nd.media)} do dia${okGeral(nd, limiar()) ? ' · 🔥 ofensiva' : ''}` : 'nada registrado';
  } else {
    const hab = e.habitos.find((x) => x.id === c.dataset.h);
    if (!hab) return;
    const v = valorDe(e, hab, d);
    const r = progresso(hab, v);
    linha = `${r.descanso ? 'descanso' : pct(r.p)} · ${detalheValor(hab, v)}`;
  }
  dica.replaceChildren(h('b', null, titulo), h('span', null, linha));
  dica.hidden = false;
  const rc = c.getBoundingClientRect();
  const w = dica.offsetWidth;
  dica.style.left = `${Math.min(innerWidth - w - 8, Math.max(8, rc.left + rc.width / 2 - w / 2))}px`;
  dica.style.top = `${rc.top - dica.offsetHeight - 8 < 70 ? rc.bottom + 8 : rc.top - dica.offsetHeight - 8}px`;
});
$('#ano').addEventListener('mouseleave', () => (dica.hidden = true));
$('#ano').addEventListener('click', (ev) => {
  const c = ev.target.closest('.cel[data-d]');
  if (!c || c.dataset.d > S.hoje) return;
  dica.hidden = true;
  S.dia = c.dataset.d;
  render();
  $('#registro').scrollIntoView({ behavior: 'smooth' });
});

// =====================================================================
// vistas: "hoje" (padrão) e "matérias" (#materias)
// =====================================================================
function aplicarVista() {
  const materias = location.hash === '#materias';
  document.body.classList.toggle('vista-materias', materias);
  for (const a of document.querySelectorAll('.topo-nav a')) a.classList.toggle('ativo', materias ? a.getAttribute('href') === '#materias' : a.getAttribute('href') === '#registro');
}

// =====================================================================
// contexto para o Claudinho
// =====================================================================
function contextoClaudinho() {
  const e = S.estado, d = S.hoje, lim = limiar();
  const nd = notaDia(e, d);
  const ontem = somaDias(d, -1);
  const p = proverbioDoDia(d);
  const pend = e.todos.filter((t) => t.dia === d && !t.feito);
  return {
    nome: e.perfil.nome || null,
    agora: new Date().toLocaleString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
    ofensiva: { dias: ofensivaGeral(e, d, lim), recorde: recordeGeral(e, d, lim), garantidaHoje: okGeral(nd, lim), metaDoDia: pct(lim), feitoHoje: pct(nd.media) },
    habitos: ativos(e).map((x) => {
      const r = prog(e, x, d);
      return {
        nome: x.nome,
        meta: descricaoMeta(x),
        hoje: r.descanso ? 'dia de descanso' : detalheValor(x, valorDe(e, x, d)),
        progresso: Math.round(r.p * 100),
        ofensivaDias: ofensivaHabito(e, x, d),
        ontem: pct(prog(e, x, ontem).p),
      };
    }),
    tarefasDeHoje: { feitas: e.todos.filter((t) => t.dia === d && t.feito).length, pendentes: pend.slice(0, 6).map((t) => t.texto) },
    tarefasDaSemana: {
      faltamDias: 6 - ((new Date().getDay() + 6) % 7),
      pendentes: e.semanais.filter((t) => t.semana === inicioSemana(d) && !t.feito).slice(0, 6).map((t) => t.texto),
      feitas: e.semanais.filter((t) => t.semana === inicioSemana(d) && t.feito).length,
    },
    estudoHojePorMateria: resumoHojePorMateria() || 'nada ainda',
    pomodoroRodando: e.pomodoro.timer ? `${e.pomodoro.timer.fase}${e.pomodoro.timer.tag ? ' de ' + (materia(e.pomodoro.timer.tag)?.nome || '') : ''}` : null,
    proverbioDoDia: `${p.h} (${p.p}) — ${p.sent}`,
  };
}

// =====================================================================
// virada do dia, foco e início
// =====================================================================
function verificarDia() {
  const agora = hojeISO();
  if (agora === S.hoje) return;
  const estavaHoje = S.dia === S.hoje;
  S.hoje = agora;
  if (estavaHoje) S.dia = agora;
  if (S.ano < new Date().getFullYear()) S.ano = new Date().getFullYear();
  foto = null;
  mudar((e) => { rolarTodos(e, agora); rolarSemanais(e, agora); });
}

async function iniciar() {
  $('#btn-ajustes').append(svg(ICONES.engrenagem));
  $('#marca-fogo').innerHTML = ICONES.fogo;
  $('#btn-ajustes').addEventListener('click', () => abrirAjustes());
  $('#btn-foco').addEventListener('click', () => abrirFoco());
  addEventListener('hashchange', () => {
    aplicarVista();
    renderMaterias();
    const alvo = location.hash.slice(1);
    if (alvo === 'materias' || !alvo) window.scrollTo({ top: 0 });
    else document.getElementById(alvo)?.scrollIntoView({ behavior: 'smooth' });
  });
  try {
    await carregar();
  } catch {
    document.body.replaceChildren(h('div', { class: 'vazio-estado' }, h('h2', null, 'Não consegui falar com o servidor.'), h('p', null, 'Rode "npm start" na pasta do projeto e recarregue.')));
    return;
  }
  rolarTodos(S.estado, S.hoje);
  rolarSemanais(S.estado, S.hoje);
  iniciarClaudinho({ contexto: contextoClaudinho, temChave: () => S.claude.configurada });
  render();
  if (!S.estado.onboardingFeito) abrirOnboarding();
  else setTimeout(() => reagir('abriu'), 2500);

  setInterval(verificarDia, 30_000);
  setInterval(() => { if (document.visibilityState === 'visible') reagir('parado'); }, 50 * 60_000);
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    verificarDia();
    if (temPendencia()) return;
    const revAntes = S.rev;
    try {
      await carregar();
      if (S.rev !== revAntes) { rolarTodos(S.estado, S.hoje); rolarSemanais(S.estado, S.hoje); render(); }
    } catch {}
  });
}

iniciar();
