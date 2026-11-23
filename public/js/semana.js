// Tarefas da semana: valem de segunda a domingo e vão ficando mais vermelhas conforme a semana passa.
// No fim da semana, só seguem para a próxima as que você marcar com ↻ (o ↻ vale por uma virada).
import { h, svg, ICONES, uid, parseISO, inicioSemana, somaDias, diaSemana, dataCurta, clamp, manterCampos } from './util.js';
import { S, mudar, render } from './store.js';
import { som } from './efeitos.js';

const SEMANA_MS = 7 * 86400000;

/** 0 (começo da semana) → 1 (fim). Tarefas acumuladas já começam mais quentes. */
export function urgencia(t, agora = Date.now()) {
  const frac = clamp((agora - parseISO(t.semana).getTime()) / SEMANA_MS, 0, 1);
  return clamp(frac + 0.15 * (t.adiada || 0), 0, 1);
}
/** verde → amarelo → laranja → vermelho */
export function corUrgencia(u, alfa = 1) {
  const hue = Math.round(135 * (1 - u));
  const sat = 62 + Math.round(18 * u);
  return `hsla(${hue}, ${sat}%, ${62 - Math.round(6 * u)}%, ${alfa})`;
}

/** Virada de semana: só seguem as marcadas com ↻ e ainda não feitas. */
export function rolarSemanais(e, hoje) {
  const seg = inicioSemana(hoje);
  for (const t of e.semanais) {
    if (t.semana < seg && t.acumular && !t.feito) {
      t.semana = seg;
      t.acumular = false;
      t.adiada = (t.adiada || 0) + 1;
    }
  }
  const limite = somaDias(seg, -364);
  e.semanais = e.semanais.filter((t) => t.semana >= limite);
}

export function renderSemana() {
  const raiz = document.getElementById('semana-tarefas');
  manterCampos(raiz, () => desenharSemana(raiz));
}
function desenharSemana(raiz) {
  const e = S.estado;
  const seg = inicioSemana(S.hoje);
  const dom = somaDias(seg, 6);
  const lista = e.semanais
    .filter((t) => t.semana === seg)
    .sort((a, b) => a.feito - b.feito || urgencia(b) - urgencia(a) || a.criado - b.criado);
  const feitas = lista.filter((t) => t.feito).length;
  const passada = clamp((Date.now() - parseISO(seg).getTime()) / SEMANA_MS, 0, 1);
  const restam = 6 - diaSemana(S.hoje);

  // resumo da semana anterior
  const segAnt = somaDias(seg, -7);
  const ant = e.semanais.filter((t) => t.semana === segAnt);
  const resumoAnt = ant.length ? `semana passada: ${ant.filter((t) => t.feito).length}/${ant.length} feitas` : null;

  const focoAntes = document.activeElement?.id === 'semanal-nova';
  const entrada = h('input', { id: 'semanal-nova', placeholder: 'Adicionar tarefa da semana…', maxlength: '200', autocomplete: 'off', 'data-campo': 'semanal-nova' });
  const form = h('form', {
    class: 'todo-form',
    onSubmit: (ev) => {
      ev.preventDefault();
      const texto = entrada.value.trim();
      if (!texto) return;
      entrada.value = '';
      mudar((st) => st.semanais.push({ id: 's' + uid(), texto, feito: false, semana: seg, acumular: false, adiada: 0, criado: Date.now() }));
      document.getElementById('semanal-nova')?.focus();
    },
  }, entrada, h('button', { type: 'submit', 'aria-label': 'Adicionar' }, svg(ICONES.mais)));

  raiz.replaceChildren(
    h('div', { class: 'todos-topo' },
      h('h2', null, 'Tarefas da semana'),
      h('span', { class: 'todos-conta' }, lista.length ? `${feitas}/${lista.length}` : '')),
    h('div', { class: 'sem-tempo', title: `${Math.round(passada * 100)}% da semana já passou` },
      h('div', { class: 'sem-datas' }, h('span', null, `seg ${dataCurta(seg)} → dom ${dataCurta(dom)}`),
        h('b', { style: { color: corUrgencia(passada) } }, restam === 0 ? 'último dia!' : `faltam ${restam} ${restam === 1 ? 'dia' : 'dias'}`)),
      h('div', { class: 'sem-barra' }, h('div', { style: { width: `${passada * 100}%` } }))),
    form,
    lista.length
      ? h('ul', { class: 'todo-lista' }, lista.map(itemSemanal))
      : h('div', { class: 'todos-vazio' }, 'Nada pra semana ainda. O que precisa sair até domingo?'),
    h('p', { class: 'todos-pe' },
      resumoAnt ? h('span', { class: 'sem-resumo' }, resumoAnt, ' · ') : null,
      'Elas esquentam até ficar vermelhas no domingo. Clique em ', h('b', null, '↻'), ' para levar uma para a semana que vem.')
  );
  if (focoAntes) entrada.focus();
}

function itemSemanal(t) {
  const alterar = (fn) => mudar((e) => { const x = e.semanais.find((y) => y.id === t.id); if (x) fn(x); });
  const u = t.feito ? 0 : urgencia(t);
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
  if (t.adiada) meta.push(h('span', { class: 'adiado' }, `↻ ${t.adiada === 1 ? 'veio da semana passada' : `${t.adiada}ª semana seguida`}`));
  if (t.acumular && !t.feito) meta.push(h('span', { class: 'vai' }, '↻ vai pra semana que vem se não terminar'));
  if (!t.feito && u >= 0.85) meta.push(h('span', { style: { color: corUrgencia(u) } }, '🔥 tá quente'));

  return h('li', {
    class: `todo semanal ${t.feito ? 'feito' : ''} ${t.acumular && !t.feito ? 'acumula' : ''}`,
    style: t.feito ? null : { '--u': corUrgencia(u), '--u-fundo': corUrgencia(u, 0.05 + 0.13 * u), '--u-borda': corUrgencia(u, 0.25 + 0.45 * u) },
  },
    h('button', {
      class: 'caixa', 'aria-label': t.feito ? 'Desmarcar' : 'Concluir',
      onClick: () => { alterar((x) => { x.feito = !x.feito; x.feitoEm = x.feito ? Date.now() : null; }); if (!t.feito && S.estado.perfil.som !== false) som('tique'); },
    }, svg(ICONES.check)),
    h('div', { class: 'todo-corpo' }, texto, meta.length ? h('div', { class: 'todo-meta' }, meta) : null),
    h('div', { class: 'todo-acoes' },
      !t.feito && h('button', {
        class: `pin acum ${t.acumular ? 'on' : ''}`,
        title: t.acumular ? 'Não levar para a semana que vem' : 'Levar para a semana que vem (se não terminar)',
        'aria-pressed': String(!!t.acumular),
        onClick: () => alterar((x) => (x.acumular = !x.acumular)),
      }, h('span', { class: 'ic-txt' }, '↻')),
      !t.feito && h('button', {
        class: 'mover', title: 'Fazer hoje (move para as tarefas de hoje)', 'aria-label': 'Mover para hoje',
        onClick: () => mudar((e) => {
          e.semanais = e.semanais.filter((y) => y.id !== t.id);
          e.todos.push({ id: 't' + uid(), texto: t.texto, feito: false, dia: S.hoje, manter: false, adiado: 0, criado: Date.now() });
        }),
      }, h('span', { class: 'ic-txt' }, '→H')),
      h('button', { title: 'Apagar', 'aria-label': 'Apagar tarefa', onClick: () => mudar((e) => (e.semanais = e.semanais.filter((y) => y.id !== t.id))) }, svg(ICONES.x))));
}
