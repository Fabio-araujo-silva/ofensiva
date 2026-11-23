// Aba "Matérias": matérias da faculdade → assuntos → subtópicos (visto / não visto).
// As matérias são as mesmas tags do Pomodoro.
import { h, svg, ICONES, uid, inicioSemana, somaDias, pad } from './util.js';
import { S, mudar, render, botaoConfirmar } from './store.js';
import { temaDe, TEMAS } from './temas.js';
import { CORES_MATERIA, estudar, excluirMateria } from './pomodoro.js';
import { manterCampos } from './util.js';

const LS_ABERTAS = 'ofensiva.materias.abertas';
const lerAbertas = () => { try { return new Set(JSON.parse(localStorage.getItem(LS_ABERTAS) || '[]')); } catch { return new Set(); } };
const gravarAbertas = (s) => { try { localStorage.setItem(LS_ABERTAS, JSON.stringify([...s])); } catch {} };
const minTxt = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? pad(m % 60) : ''}` : `${m} min`);

export function progressoAssunto(a) {
  const n = a.subtopicos.length;
  return { vistos: a.subtopicos.filter((s) => s.visto).length, total: n };
}
export function progressoMateria(m) {
  let vistos = 0, total = 0;
  for (const a of m.assuntos || []) { const p = progressoAssunto(a); vistos += p.vistos; total += p.total; }
  return { vistos, total, frac: total ? vistos / total : 0 };
}

/** Linhas coladas viram vários itens (remove marcadores como "-", "•", "1.", "a)"). */
function linhas(txt) {
  const ls = txt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const lista = ls.length > 1;
  return ls
    .map((l) => (lista ? l.replace(/^(?:[-–—•*·▪◦]|\d+(?:\.\d+)*[.)]|[a-z]\))\s+/, '') : l).trim().slice(0, 200))
    .filter(Boolean);
}

function anelMini(frac, cor) {
  const R = 15, C = 2 * Math.PI * R;
  return h('div', { class: 'mt-anel', style: { '--m': cor }, html: `<svg viewBox="0 0 38 38"><circle cx="19" cy="19" r="${R}" class="f"/><circle cx="19" cy="19" r="${R}" class="p" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - frac)}"/></svg><span>${Math.round(frac * 100)}%</span>` });
}

export function renderMaterias() {
  const raiz = document.getElementById('materias-vista');
  if (!raiz || !document.body.classList.contains('vista-materias')) return;
  manterCampos(raiz, () => desenharMaterias(raiz));
}

function desenharMaterias(raiz) {
  const e = S.estado;
  const abertas = lerAbertas();
  const seg = inicioSemana(S.hoje);

  const nova = h('input', { class: 'entrada cresce', placeholder: 'Nova matéria (ex.: SMA0180 Matemática Discreta)', maxlength: '60', 'data-campo': 'mt-nova' });
  const criar = () => {
    const nome = nova.value.trim();
    if (!nome) return;
    nova.value = '';
    const id = 'mt' + uid();
    abertas.add(id);
    gravarAbertas(abertas);
    mudar((st) => st.materias.push({ id, nome, cor: CORES_MATERIA[st.materias.length % CORES_MATERIA.length], assuntos: [] }));
  };
  nova.addEventListener('keydown', (ev) => ev.key === 'Enter' && criar());

  let vistos = 0, total = 0;
  for (const m of e.materias) { const p = progressoMateria(m); vistos += p.vistos; total += p.total; }

  raiz.replaceChildren(
    h('div', { class: 'cabecalho-secao' },
      h('h2', { class: 'secao' }, 'Matérias'),
      total ? h('span', { class: 'nota-dia' }, `${vistos}/${total} subtópicos vistos`) : null),
    h('p', { class: 'ajuda mt-intro' }, 'Organize cada matéria em assuntos e subtópicos e marque o que já viu. As matérias também são as tags do Pomodoro: o 🍅 de um assunto já abre o modo foco nele.'),
    h('div', { class: 'linha mt-nova' }, nova, h('button', { class: 'btn-primario', onClick: criar }, svg(ICONES.mais), 'Criar matéria')),
    e.materias.length
      ? h('div', { class: 'mt-lista' }, e.materias.map((m) => cartaoMateria(m, abertas, seg)))
      : h('div', { class: 'card vazio-estado' }, 'Nenhuma matéria ainda. Crie a primeira aí em cima 👆'));
}

function cartaoMateria(m, abertas, seg) {
  const alterar = (fn) => mudar((e) => { const x = e.materias.find((y) => y.id === m.id); if (x) { x.assuntos ??= []; fn(x); } });
  const aberta = abertas.has(m.id);
  const p = progressoMateria(m);
  const tema = temaDe(m);
  const sessoes = S.estado.sessoes.filter((s) => s.tag === m.id);
  const minTotal = sessoes.reduce((a, s) => a + s.minutos, 0);
  const minSemana = sessoes.filter((s) => s.dia >= seg).reduce((a, s) => a + s.minutos, 0);
  const alternar = () => { aberta ? abertas.delete(m.id) : abertas.add(m.id); gravarAbertas(abertas); renderMaterias(); };

  const nome = h('input', {
    class: 'mt-nome', value: m.nome, maxlength: '60', 'aria-label': 'Nome da matéria', 'data-campo': `mt-nome-${m.id}`,
    onChange: (ev) => ev.target.value.trim() && alterar((x) => (x.nome = ev.target.value.trim())),
    onKeydown: (ev) => ev.key === 'Enter' && ev.target.blur(),
  });

  const cab = h('div', { class: 'mt-cab' },
    h('button', { class: 'mt-seta', 'aria-label': aberta ? 'Recolher' : 'Abrir', 'aria-expanded': String(aberta), onClick: alternar }, svg(aberta ? ICONES.baixo : ICONES.dir)),
    h('button', {
      class: 'mt-cor', style: { background: m.cor }, title: 'Trocar cor', 'aria-label': 'Trocar cor',
      onClick: () => alterar((x) => (x.cor = CORES_MATERIA[(CORES_MATERIA.indexOf(x.cor) + 1) % CORES_MATERIA.length])),
    }),
    h('div', { class: 'mt-tit' }, nome,
      h('div', { class: 'mt-sub' },
        `${(m.assuntos || []).length} ${(m.assuntos || []).length === 1 ? 'assunto' : 'assuntos'} · ${p.vistos}/${p.total} subtópicos`,
        minTotal ? ` · ${minTxt(minTotal)} estudados${minSemana ? ` (${minTxt(minSemana)} na semana)` : ''}` : '',
        h('span', { class: 'mt-tema', title: 'Estética do modo foco' }, ` · ${tema.marca} ${tema.nome}`))),
    anelMini(p.frac, m.cor),
    h('button', { class: 'btn-texto', title: 'Estudar com pomodoro', onClick: () => estudar(m.id, null) }, `${tema.marca} estudar`));

  if (!aberta) return h('article', { class: 'card mt-card', style: { '--m': m.cor } }, cab);

  const novoAssunto = h('textarea', { class: 'entrada cresce mt-area', rows: '1', placeholder: 'Novo assunto (cole várias linhas para criar vários)', 'data-campo': `mt-novo-assunto-${m.id}` });
  const criarAssunto = () => {
    const ls = linhas(novoAssunto.value);
    if (!ls.length) return;
    novoAssunto.value = '';
    alterar((x) => { for (const nome of ls) x.assuntos.push({ id: 'as' + uid(), nome, subtopicos: [] }); });
    setTimeout(() => document.querySelector(`[data-campo="mt-novo-assunto-${m.id}"]`)?.focus(), 0);
  };
  novoAssunto.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); criarAssunto(); } });
  novoAssunto.addEventListener('paste', () => setTimeout(() => { if (novoAssunto.value.includes('\n')) criarAssunto(); }, 0));

  const tema2 = h('select', { class: 'entrada', title: 'Estética do modo foco', onChange: (ev) => alterar((x) => (x.tema = ev.target.value || undefined)) },
    h('option', { value: '', selected: !m.tema }, `tema automático (${temaDe({ nome: m.nome }).nome})`),
    Object.values(TEMAS).map((tm) => h('option', { value: tm.id, selected: m.tema === tm.id }, tm.nome)));

  return h('article', { class: 'card mt-card aberta', style: { '--m': m.cor } },
    cab,
    h('div', { class: 'mt-assuntos' }, (m.assuntos || []).map((a, i) => blocoAssunto(m, a, i, alterar))),
    h('div', { class: 'linha mt-novo-assunto' }, novoAssunto, h('button', { class: 'btn-secundario', onClick: criarAssunto }, '+ assunto')),
    h('div', { class: 'linha mt-rodape' }, tema2,
      h('span', { class: 'cresce' }),
      botaoConfirmar('excluir matéria', 'clique de novo para excluir', () => mudar((e) => excluirMateria(e, m.id), { forcar: true }), 'btn-texto btn-perigo')));
}

function blocoAssunto(m, a, idx, alterarMateria) {
  const alterar = (fn) => alterarMateria((x) => { const y = x.assuntos.find((z) => z.id === a.id); if (y) fn(y, x); });
  const p = progressoAssunto(a);
  const completo = p.total > 0 && p.vistos === p.total;

  const novoSub = h('textarea', { class: 'mt-sub-novo mt-area', rows: '1', placeholder: '+ subtópico (cole uma lista para criar vários)', 'data-campo': `mt-novo-sub-${a.id}` });
  const criarSub = () => {
    const ls = linhas(novoSub.value);
    if (!ls.length) return;
    novoSub.value = '';
    alterar((y) => { for (const nome of ls) y.subtopicos.push({ id: 'st' + uid(), nome, visto: false }); });
    setTimeout(() => document.querySelector(`[data-campo="mt-novo-sub-${a.id}"]`)?.focus(), 0);
  };
  novoSub.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); criarSub(); } });
  novoSub.addEventListener('paste', () => setTimeout(() => { if (novoSub.value.includes('\n')) criarSub(); }, 0));

  const titulo = h('input', {
    class: 'mt-as-nome', value: a.nome, maxlength: '120', 'aria-label': 'Nome do assunto', 'data-campo': `mt-as-nome-${a.id}`,
    onChange: (ev) => ev.target.value.trim() && alterar((y) => (y.nome = ev.target.value.trim())),
    onKeydown: (ev) => ev.key === 'Enter' && ev.target.blur(),
  });
  const minAssunto = S.estado.sessoes.filter((s) => s.assunto === a.id).reduce((t, s) => t + s.minutos, 0);

  return h('section', { class: `mt-assunto ${completo ? 'completo' : ''}` },
    h('div', { class: 'mt-as-cab' },
      h('span', { class: 'mt-as-num' }, String(idx + 1)),
      titulo,
      minAssunto ? h('span', { class: 'mt-as-min', title: 'tempo de foco neste assunto' }, minTxt(minAssunto)) : null,
      h('span', { class: 'mt-as-prog' }, p.total ? `${p.vistos}/${p.total}` : '—'),
      h('button', { class: 'mini-btn', title: 'Estudar este assunto com pomodoro', 'aria-label': 'Estudar este assunto', onClick: () => estudar(m.id, a.id) }, temaDe(m).marca),
      h('button', { class: 'mini-btn', title: 'Subir', 'aria-label': 'Subir assunto', disabled: idx === 0, onClick: () => alterarMateria((x) => { const i = x.assuntos.findIndex((z) => z.id === a.id); if (i > 0) [x.assuntos[i - 1], x.assuntos[i]] = [x.assuntos[i], x.assuntos[i - 1]]; }) }, svg(ICONES.cima)),
      botaoConfirmar('×', 'apagar?', () => mudar((e) => { const x = e.materias.find((y) => y.id === m.id); if (x) x.assuntos = x.assuntos.filter((z) => z.id !== a.id); }, { forcar: true }), 'mini-btn mt-apagar')),
    h('div', { class: 'mt-as-barra' }, h('div', { style: { width: `${p.total ? (p.vistos / p.total) * 100 : 0}%` } })),
    h('ul', { class: 'mt-subs' }, a.subtopicos.map((st) => {
      const nomeSub = h('span', { class: 'mt-st-nome', title: 'Duplo clique para editar' }, st.nome);
      nomeSub.addEventListener('dblclick', () => {
        const inp = h('input', { class: 'todo-edit', value: st.nome, maxlength: '200' });
        const ok = () => { const v = inp.value.trim(); if (v && v !== st.nome) alterar((y) => (y.subtopicos.find((z) => z.id === st.id).nome = v)); else render(); };
        inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') inp.blur(); if (ev.key === 'Escape') { inp.value = st.nome; inp.blur(); } });
        inp.addEventListener('blur', ok, { once: true });
        nomeSub.replaceWith(inp);
        inp.focus();
      });
      return h('li', { class: `mt-st ${st.visto ? 'visto' : ''}` },
        h('button', {
          class: 'caixa', 'aria-label': st.visto ? 'Marcar como não visto' : 'Marcar como visto', 'aria-pressed': String(!!st.visto),
          onClick: () => alterar((y) => { const z = y.subtopicos.find((w) => w.id === st.id); z.visto = !z.visto; z.vistoEm = z.visto ? S.hoje : null; }),
        }, svg(ICONES.check)),
        nomeSub,
        st.visto && st.vistoEm ? h('small', { class: 'mt-st-data' }, `visto ${st.vistoEm.slice(8, 10)}/${st.vistoEm.slice(5, 7)}`) : null,
        h('button', { class: 'mt-st-x', title: 'Apagar subtópico', 'aria-label': 'Apagar subtópico', onClick: () => alterar((y) => (y.subtopicos = y.subtopicos.filter((z) => z.id !== st.id))) }, '×'));
    })),
    novoSub);
}
