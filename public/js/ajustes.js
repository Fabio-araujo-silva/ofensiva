// Ajustes, editor de hábito e "novo hábito".
import { h, svg, ICONES, uid, numeroLivre, hojeISO } from './util.js';
import { S, mudar, render, abrirModal, avisar, botaoConfirmar, copiaRecuperavel, restaurarRecuperavel, descartarRecuperavel } from './store.js';
import { TIPOS, PALETA, instanciar, descricaoMeta, normalizar } from './habitos.js';
import { SUGESTOES, modeloVazio } from './sugestoes.js';

const EMOJIS = ['💧', '👟', '📚', '🏋️', '📖', '😴', '🧘', '🗣️', '💻', '🥗', '✍️', '🤸', '🏮', '🎸', '🧠', '🏃', '🚴', '🍎', '☀️', '🧹', '💊', '📵', '🎨', '⭐'];

// =====================================================================
// editor de hábito (criar / editar)
// =====================================================================
/**
 * @param {object} base hábito existente (editar) ou modelo (criar)
 * @param {{novo?: boolean, aoSalvar: (h) => void}} op
 */
export function abrirEditor(base, { novo = false, aoSalvar }) {
  const w = structuredClone(base);
  const area = h('div', { class: 'modal-corpo-interno', style: { display: 'flex', flexDirection: 'column', gap: '18px' } });

  const desenhar = () => {
    const nome = h('input', { type: 'text', value: w.nome, placeholder: 'ex.: Beber água', maxlength: '40', onInput: (e) => (w.nome = e.target.value) });
    const emoji = h('input', { type: 'text', value: w.emoji, maxlength: '4', style: { width: '64px', textAlign: 'center', fontSize: '20px' }, onInput: (e) => (w.emoji = e.target.value) });
    const cores = h('div', { class: 'cores' }, PALETA.map((c) =>
      h('button', { class: `cor ${w.cor === c ? 'on' : ''}`, style: { background: c }, 'aria-label': `cor ${c}`, onClick: () => { w.cor = c; desenhar(); } })));
    const emojis = h('div', { class: 'emojis' }, EMOJIS.map((em) => h('button', { onClick: () => { w.emoji = em; emoji.value = em; } }, em)));

    area.replaceChildren(
      h('div', { class: 'linha' },
        h('div', { class: 'campo cresce' }, h('label', null, 'Nome'), nome),
        h('div', { class: 'campo' }, h('label', null, 'Emoji'), emoji)),
      emojis,
      h('div', { class: 'campo' }, h('span', { class: 'rot' }, 'Cor do gráfico'), cores),
      novo
        ? h('div', { class: 'campo' }, h('span', { class: 'rot' }, 'Tipo'),
            h('div', { class: 'tipos' }, Object.entries(TIPOS).map(([k, t]) =>
              h('button', {
                class: `tipo ${w.tipo === k ? 'on' : ''}`,
                onClick: () => {
                  if (w.tipo === k) return;
                  const vazio = modeloVazio(k);
                  for (const chave of ['metricas', 'itens', 'niveis', 'tags', 'permiteDescanso', 'nota', 'combinar']) delete w[chave];
                  Object.assign(w, { ...vazio, nome: w.nome, emoji: w.emoji, cor: w.cor });
                  desenhar();
                },
              }, h('b', null, t.nome), h('span', null, t.exemplo)))))
        : h('p', { class: 'ajuda' }, `Tipo: ${TIPOS[w.tipo].nome} (não dá pra trocar depois de criado, para não bagunçar o histórico).`),
      configTipo(w, desenhar)
    );
  };
  desenhar();

  const salvar = () => {
    const erro = validar(w);
    if (erro) { avisar(erro); return; }
    limpar(w);
    aoSalvar(w);
    modal.fechar();
  };
  const modal = abrirModal(novo ? 'Novo hábito' : `Editar ${base.nome || 'hábito'}`, area, {
    pe: [h('button', { class: 'btn-secundario', onClick: () => modal.fechar() }, 'Cancelar'), h('button', { class: 'btn-primario', onClick: salvar }, 'Salvar')],
  });
}

function configTipo(w, desenhar) {
  if (w.tipo === 'numero') {
    const metricas = w.metricas.map((m, i) =>
      h('div', { class: 'metrica' },
        w.metricas.length > 1 && h('button', { class: 'mini-btn remover', 'aria-label': 'Remover métrica', onClick: () => { w.metricas.splice(i, 1); desenhar(); } }, svg(ICONES.x)),
        h('div', { class: 'campo' }, h('label', null, 'O que medir'), h('input', { type: 'text', value: m.nome, placeholder: 'ex.: Água', onInput: (e) => (m.nome = e.target.value) })),
        h('div', { class: 'campo' }, h('label', null, 'Meta por dia'), h('input', { type: 'text', inputmode: 'decimal', value: String(m.meta ?? '').replace('.', ','), onInput: (e) => (m.meta = numeroLivre(e.target.value)) })),
        h('div', { class: 'campo' }, h('label', null, 'Unidade'), h('input', { type: 'text', value: m.unidade, placeholder: 'ml, passos, min, h, pág', onInput: (e) => (m.unidade = e.target.value.trim()) })),
        h('div', { class: 'campo' }, h('label', null, 'Botões de +'), h('input', {
          type: 'text', value: (m.passos || []).join('; ').replace(/\./g, ','), placeholder: 'ex.: 250; 500',
          onInput: (e) => (m.passos = e.target.value.split(';').map((x) => numeroLivre(x)).filter((x) => x > 0)),
        })),
        h('label', { class: 'alternar' }, h('input', { type: 'checkbox', checked: !!m.decimal, onChange: (e) => (m.decimal = e.target.checked) }), 'aceita decimais'),
        h('label', { class: 'alternar' }, h('input', { type: 'checkbox', checked: !!m.cronometro, onChange: (e) => (m.cronometro = e.target.checked) }), 'cronômetro (unidade min)')));
    return h('div', { class: 'bloco' },
      h('h4', null, 'Métricas'),
      h('p', { class: 'ajuda' }, 'Uma métrica basta. Use duas quando valer uma OU outra (ex.: ler 2 páginas ou ouvir 10 min de audiobook). Separe os botões de + com ponto e vírgula.'),
      metricas,
      w.metricas.length > 1 && h('div', { class: 'campo' }, h('label', null, 'Como combinar'),
        h('select', { onChange: (e) => (w.combinar = e.target.value) },
          h('option', { value: 'max', selected: w.combinar !== 'media' }, 'Basta uma bater a meta'),
          h('option', { value: 'media', selected: w.combinar === 'media' }, 'Média das métricas'))),
      h('div', null, h('button', { class: 'btn-texto', onClick: () => { w.metricas.push({ nome: '', meta: 1, unidade: '', passos: [1] }); desenhar(); } }, svg(ICONES.mais), 'métrica alternativa')));
  }
  if (w.tipo === 'checklist') {
    return h('div', { class: 'bloco' },
      h('h4', null, 'Partes do hábito'),
      h('p', { class: 'ajuda' }, 'Cada parte marcada deixa o quadradinho do dia mais colorido. Todas marcadas = 100%.'),
      w.itens.map((it, i) => h('div', { class: 'item-linha' },
        h('input', { class: 'entrada', type: 'text', value: it.nome, placeholder: `Parte ${i + 1}`, onInput: (e) => (it.nome = e.target.value) }),
        h('button', { class: 'mini-btn', 'aria-label': 'Remover', disabled: w.itens.length <= 1, onClick: () => { w.itens.splice(i, 1); desenhar(); } }, svg(ICONES.x)))),
      h('div', null, h('button', { class: 'btn-texto', onClick: () => { w.itens.push({ nome: '' }); desenhar(); } }, svg(ICONES.mais), 'parte')));
  }
  if (w.tipo === 'simnao') {
    return h('div', { class: 'bloco' },
      h('label', { class: 'alternar' }, h('input', { type: 'checkbox', checked: !!w.permiteDescanso, onChange: (e) => (w.permiteDescanso = e.target.checked) }), 'Permitir dia de descanso (não quebra a ofensiva)'),
      h('div', { class: 'campo' }, h('label', null, 'Etiquetas opcionais (separe por vírgula)'),
        h('input', { type: 'text', value: (w.tags || []).join(', '), placeholder: 'ex.: Push, Pull, Legs', onInput: (e) => (w.tags = e.target.value.split(',').map((x) => x.trim()).filter(Boolean)) })),
      h('p', { class: 'ajuda' }, 'Etiquetas servem para anotar o que foi feito (ex.: o treino do dia).'));
  }
  return h('div', { class: 'bloco' },
    h('h4', null, 'Níveis'),
    h('p', { class: 'ajuda' }, 'Do menor para o maior. O último normalmente vale 100%.'),
    w.niveis.map((n, i) => h('div', { class: 'linha' },
      h('input', { class: 'entrada cresce', type: 'text', value: n.nome, placeholder: `Nível ${i + 1}`, onInput: (e) => (n.nome = e.target.value) }),
      h('select', { class: 'entrada', onChange: (e) => (n.valor = Number(e.target.value)) },
        [0.25, 0.5, 0.75, 1].map((v) => h('option', { value: String(v), selected: n.valor === v }, `${v * 100}%`))),
      h('button', { class: 'mini-btn', 'aria-label': 'Remover', disabled: w.niveis.length <= 1, onClick: () => { w.niveis.splice(i, 1); desenhar(); } }, svg(ICONES.x)))),
    h('div', null, h('button', { class: 'btn-texto', onClick: () => { w.niveis.push({ nome: '', valor: 1 }); desenhar(); } }, svg(ICONES.mais), 'nível')),
    h('label', { class: 'alternar' }, h('input', { type: 'checkbox', checked: !!w.nota, onChange: (e) => (w.nota = e.target.checked) }), 'Campo de anotação ("o que você fez?")'));
}

function validar(w) {
  if (!w.nome?.trim()) return 'Dê um nome ao hábito.';
  if (w.tipo === 'numero') {
    if (!w.metricas.length) return 'Adicione ao menos uma métrica.';
    for (const m of w.metricas) if (!(m.meta > 0)) return 'Toda métrica precisa de uma meta maior que zero.';
  }
  if (w.tipo === 'checklist' && !w.itens.some((i) => i.nome.trim())) return 'Dê nome a pelo menos uma parte.';
  if (w.tipo === 'niveis' && !w.niveis.some((n) => n.nome.trim())) return 'Dê nome a pelo menos um nível.';
  return null;
}
function limpar(w) {
  w.nome = w.nome.trim();
  w.emoji = (w.emoji || '⭐').trim() || '⭐';
  if (w.tipo === 'numero') {
    w.metricas.forEach((m, i) => {
      m.id ||= 'm' + uid();
      m.nome = (m.nome || '').trim() || (w.metricas.length > 1 ? `Métrica ${i + 1}` : w.nome);
      if (!m.passos?.length) m.passos = [m.decimal ? 0.5 : 1];
    });
    w.combinar ||= 'max';
  }
  if (w.tipo === 'checklist') w.itens = w.itens.filter((i) => i.nome.trim()).map((i) => ({ ...i, nome: i.nome.trim(), id: i.id || 'i' + uid() }));
  if (w.tipo === 'niveis') w.niveis = w.niveis.filter((n) => n.nome.trim()).map((n) => ({ ...n, nome: n.nome.trim() }));
}

// =====================================================================
// novo hábito: sugestões ou do zero
// =====================================================================
export function abrirNovoHabito() {
  const usados = new Set(S.estado.habitos.filter((x) => !x.arquivado).map((x) => x.nome.toLowerCase()));
  const adicionar = (modelo, novo) => abrirEditor(modelo, {
    novo,
    aoSalvar: (w) => {
      mudar((e) => e.habitos.push(instanciar(w, hojeISO())));
      avisar(`${w.emoji} ${w.nome} criado!`);
    },
  });
  const grade = h('div', { class: 'sugestoes' },
    SUGESTOES.map((s) => h('button', {
      class: 'sug', style: { '--c': s.cor, opacity: usados.has(s.nome.toLowerCase()) ? '.45' : null },
      onClick: () => { modal.fechar(); adicionar(s, false); },
    }, h('span', { class: 'em' }, s.emoji), h('b', null, s.nome), h('span', { class: 'ds' }, s.descricao), h('span', { class: 'mt' }, descricaoMeta(s)))),
    h('button', { class: 'sug novo', onClick: () => { modal.fechar(); adicionar(modeloVazio('numero'), true); } },
      h('span', { class: 'em' }, '✨'), h('b', null, 'Criar do zero'), h('span', { class: 'ds' }, 'Escolha o tipo e as metas')));
  const modal = abrirModal('Novo hábito', [h('p', { class: 'ajuda' }, 'Comece de uma sugestão (dá pra ajustar tudo) ou crie do zero.'), grade], { largo: true });
}

// =====================================================================
// ajustes
// =====================================================================
export function abrirAjustes() {
  const corpo = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '18px' } });
  let modal;

  const desenhar = () => {
    const e = S.estado;
    const ativosL = e.habitos.filter((x) => !x.arquivado);
    const arquivados = e.habitos.filter((x) => x.arquivado);

    const mover = (id, delta) => mudar((st) => {
      const vis = st.habitos.filter((x) => !x.arquivado);
      const i = vis.findIndex((x) => x.id === id), j = i + delta;
      if (j < 0 || j >= vis.length) return;
      [vis[i], vis[j]] = [vis[j], vis[i]];
      st.habitos = [...vis, ...st.habitos.filter((x) => x.arquivado)];
    });

    const itemHab = (x, arquivado) => h('div', { class: 'lista-hab-item' },
      h('span', { class: 'em' }, x.emoji),
      h('div', { class: 'nm' }, x.nome, h('small', null, descricaoMeta(x))),
      !arquivado && h('button', { class: 'mini-btn', 'aria-label': 'Subir', onClick: () => { mover(x.id, -1); desenhar(); } }, svg(ICONES.cima)),
      !arquivado && h('button', { class: 'mini-btn', 'aria-label': 'Descer', onClick: () => { mover(x.id, 1); desenhar(); } }, svg(ICONES.baixo)),
      !arquivado && h('button', {
        class: 'mini-btn', 'aria-label': 'Editar',
        onClick: () => abrirEditor(x, { aoSalvar: (w) => { mudar((st) => { const i = st.habitos.findIndex((y) => y.id === x.id); st.habitos[i] = w; }); desenhar(); } }),
      }, svg(ICONES.editar)),
      h('button', {
        class: 'btn-texto', onClick: () => { mudar((st) => { st.habitos.find((y) => y.id === x.id).arquivado = !arquivado; }); desenhar(); },
        title: arquivado ? 'Voltar a mostrar' : 'Esconde o hábito, mas guarda o histórico',
      }, arquivado ? 'restaurar' : 'arquivar'),
      arquivado && botaoConfirmar('excluir', 'certeza?', () => {
        mudar((st) => {
          st.habitos = st.habitos.filter((y) => y.id !== x.id);
          for (const d of Object.keys(st.dias)) { delete st.dias[d][x.id]; if (!Object.keys(st.dias[d]).length) delete st.dias[d]; }
        }, { forcar: true });
        desenhar();
      }, 'btn-texto btn-perigo'));

    const chave = h('input', { type: 'password', placeholder: 'sk-ant-…', autocomplete: 'off', class: 'entrada cresce' });
    const salvarChave = async (valor) => {
      try {
        const r = await fetch('/api/chave', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chave: valor }) });
        const j = await r.json();
        S.claude.configurada = j.configurada;
        avisar(valor ? 'Chave salva. O Claudinho agora fala de verdade!' : 'Chave removida do app.');
        desenhar();
      } catch { avisar('Não consegui salvar a chave.'); }
    };

    const limiarAtual = Math.round((e.perfil.limiar ?? 0.7) * 100);
    const rotLimiar = h('b', null, `${limiarAtual}%`);

    corpo.replaceChildren(
      h('div', { class: 'bloco' },
        h('h4', null, 'Você'),
        h('div', { class: 'campo' }, h('label', null, 'Como o Claudinho te chama'),
          h('input', { type: 'text', value: e.perfil.nome, maxlength: '30', placeholder: 'seu nome ou apelido', onChange: (ev) => mudar((st) => (st.perfil.nome = ev.target.value.trim())) })),
        h('div', { class: 'campo' }, h('label', null, 'Data de nascimento (para o horóscopo chinês)'),
          h('input', { type: 'date', class: 'entrada', value: e.perfil.nascimento || '', max: hojeISO(), min: '1900-01-01', onChange: (ev) => mudar((st) => (st.perfil.nascimento = ev.target.value || '')) })),
        h('p', { class: 'ajuda' }, 'O signo chinês vira no 立春 (~4 de fevereiro), como na astrologia BaZi. Deixe em branco para esconder a leitura.')),

      h('div', { class: 'bloco' },
        h('h4', null, 'Ofensiva geral'),
        h('div', { class: 'campo' }, h('label', null, 'Quanto do dia precisa estar feito para manter a chama: ', rotLimiar),
          h('input', {
            type: 'range', min: '30', max: '100', step: '5', value: String(limiarAtual), style: { accentColor: 'var(--fogo)' },
            onInput: (ev) => (rotLimiar.textContent = `${ev.target.value}%`),
            onChange: (ev) => mudar((st) => (st.perfil.limiar = Number(ev.target.value) / 100)),
          })),
        h('p', { class: 'ajuda' }, 'A média é de todos os hábitos do dia. Cada hábito também tem a própria ofensiva, que conta só os dias em que bateu 100% (ou descanso).'),
        h('label', { class: 'alternar' }, h('input', { type: 'checkbox', checked: e.perfil.som !== false, onChange: (ev) => mudar((st) => (st.perfil.som = ev.target.checked)) }), 'Sons de comemoração')),

      h('div', { class: 'bloco' },
        h('div', { class: 'linha' }, h('h4', { class: 'cresce' }, 'Hábitos'), h('button', { class: 'btn-primario', onClick: () => { modal.fechar(); abrirNovoHabito(); } }, svg(ICONES.mais), 'Novo hábito')),
        ativosL.length ? h('div', { class: 'lista-hab' }, ativosL.map((x) => itemHab(x, false))) : h('p', { class: 'ajuda' }, 'Nenhum hábito ativo.'),
        arquivados.length ? [h('span', { class: 'rotulo' }, 'Arquivados'), h('div', { class: 'lista-hab' }, arquivados.map((x) => itemHab(x, true)))] : null),

      h('div', { class: 'bloco' },
        h('div', { class: 'linha' }, h('h4', { class: 'cresce' }, 'Claudinho (Claude API)'),
          h('span', { class: `status-chave ${S.claude.configurada ? 'ok' : 'nao'}` }, S.claude.configurada ? '● chave configurada' : '○ modo offline')),
        h('label', { class: 'alternar' }, h('input', { type: 'checkbox', checked: e.perfil.claudinho !== false, onChange: (ev) => mudar((st) => (st.perfil.claudinho = ev.target.checked)) }), 'Mostrar o Claudinho flutuando'),
        h('div', { class: 'linha' }, chave, h('button', { class: 'btn-secundario', onClick: () => chave.value.trim() && salvarChave(chave.value.trim()) }, 'Salvar chave')),
        S.claude.configurada && h('div', null, botaoConfirmar('remover chave salva no app', 'clique de novo para remover', () => salvarChave(''), 'btn-texto btn-perigo')),
        h('p', { class: 'ajuda' }, `A chave fica só neste computador (dados/segredos.json ou .env) e as chamadas saem do servidor local. Modelo: ${S.claude.modelo || 'claude-opus-5-5'}. Sem chave, o Claudinho usa frases prontas.`)),

      (() => {
        const c = copiaRecuperavel();
        if (!c?.estado) return null;
        const q = new Date(c.quando);
        return h('div', { class: 'bloco', style: { borderColor: 'rgba(255, 154, 60, .5)' } },
          h('h4', null, 'Recuperar alterações'),
          h('p', { class: 'ajuda' }, `Tem uma versão guardada no navegador de ${q.toLocaleString('pt-BR')} (${c.motivo || 'não salva'}): ${c.estado.habitos?.length || 0} hábitos, ${Object.keys(c.estado.dias || {}).length} dias registrados, ${c.estado.materias?.length || 0} matérias. Restaurar troca os dados atuais por ela (os atuais ficam no backup de proteção do servidor).`),
          h('div', { class: 'linha' },
            botaoConfirmar('restaurar esta versão', 'clique de novo para restaurar', () => { restaurarRecuperavel(); desenhar(); }, 'btn-secundario'),
            botaoConfirmar('descartar', 'descartar mesmo?', () => { descartarRecuperavel(); desenhar(); }, 'btn-texto btn-perigo')));
      })(),

      h('div', { class: 'bloco' },
        h('h4', null, 'Backup'),
        h('div', { class: 'linha' },
          h('button', { class: 'btn-secundario', onClick: exportar }, 'Exportar JSON'),
          h('label', { class: 'btn-secundario', style: { cursor: 'pointer' } }, 'Importar JSON',
            h('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' }, onChange: importar }))),
        h('p', { class: 'ajuda' }, 'O servidor também guarda uma cópia por dia em dados/backups (últimos 21 dias).'),
        h('div', null, botaoConfirmar('refazer o onboarding', 'clique de novo (seus dados ficam)', () => {
          modal.fechar();
          mudar((st) => (st.onboardingFeito = false));
          import('./onboarding.js').then((m) => m.abrirOnboarding());
        }, 'btn-texto'))));
  };
  desenhar();
  modal = abrirModal('Ajustes', corpo, { largo: true });
}

function exportar() {
  const blob = new Blob([JSON.stringify(S.estado, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ofensiva-backup-${hojeISO()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
async function importar(ev) {
  const arq = ev.target.files?.[0];
  if (!arq) return;
  try {
    const dados = JSON.parse(await arq.text());
    if (!Array.isArray(dados.habitos) || typeof dados.dias !== 'object') throw new Error();
    mudar((st) => Object.assign(st, normalizar(dados)), { forcar: true });
    avisar('Backup importado!');
    render();
  } catch {
    avisar('Esse arquivo não parece um backup da Ofensiva.');
  }
}
