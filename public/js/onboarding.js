// Onboarding: nome → escolher hábitos (sugestões ou do zero) → ajustar metas → Claudinho.
import { h, svg, ICONES, numeroLivre, hojeISO, uid } from './util.js';
import { S, mudar, avisar } from './store.js';
import { instanciar, descricaoMeta } from './habitos.js';
import { SUGESTOES, modeloVazio } from './sugestoes.js';
import { abrirEditor } from './ajustes.js';
import { SVG_CLAUDINHO, reagir } from './claudinho.js';

export function abrirOnboarding() {
  const e = S.estado;
  const st = {
    passo: 0,
    nome: e.perfil.nome || '',
    nascimento: e.perfil.nascimento || '',
    // escolhidos: lista de modelos (cópias editáveis). chave = sugestaoId ou id local
    escolhidos: [],
  };
  const raiz = h('div', { class: 'onb', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Boas-vindas' });
  const caixa = h('div', { class: 'onb-caixa' });
  const barra = h('div', { class: 'onb-barra' });
  raiz.append(caixa, barra);
  document.body.append(raiz);
  document.body.style.overflow = 'hidden';

  const passos = () => h('div', { class: 'onb-passos' }, [0, 1, 2, 3].map((i) => h('i', { class: i <= st.passo ? 'on' : '' })));
  const ir = (p) => { st.passo = p; desenhar(); raiz.scrollTo({ top: 0 }); };
  const escolhido = (sid) => st.escolhidos.find((x) => x._chave === sid);

  function desenhar() {
    if (st.passo === 0) passo0();
    else if (st.passo === 1) passo1();
    else if (st.passo === 2) passo2();
    else passo3();
  }

  // ---------- 0: boas-vindas ----------
  function passo0() {
    const nome = h('input', { class: 'onb-nome', placeholder: 'Como posso te chamar?', value: st.nome, maxlength: '30', onInput: (ev) => (st.nome = ev.target.value) });
    nome.addEventListener('keydown', (ev) => ev.key === 'Enter' && ir(1));
    const nasc = h('input', { type: 'date', class: 'entrada', value: st.nascimento || '', max: hojeISO(), min: '1900-01-01', 'aria-label': 'Data de nascimento', onInput: (ev) => (st.nascimento = ev.target.value) });
    caixa.replaceChildren(passos(),
      h('div', { class: 'onb-centro onb-heroi' },
        h('span', { class: 'fogo aceso vivo', html: ICONES.fogo }),
        h('h1', null, 'Bem-vindo à Ofensiva'),
        h('p', { class: 'sub' }, 'Escolha os hábitos que importam pra você, registre um pouquinho todo dia e veja o ano inteiro ficar colorido. Cada dia cumprido mantém a chama acesa.'),
        nome,
        h('label', { class: 'campo', style: { alignItems: 'center' } },
          h('span', { class: 'ajuda' }, 'Data de nascimento (opcional, para o horóscopo chinês do dia)'), nasc)));
    barra.replaceChildren(h('button', { class: 'btn-primario', onClick: () => ir(1) }, 'Começar ', svg(ICONES.dir)));
    setTimeout(() => nome.focus(), 50);
  }

  // ---------- 1: escolher hábitos ----------
  function passo1() {
    const alternar = (s) => {
      const i = st.escolhidos.findIndex((x) => x._chave === s.sugestaoId);
      if (i >= 0) st.escolhidos.splice(i, 1);
      else st.escolhidos.push({ ...structuredClone(s), _chave: s.sugestaoId });
      passo1();
    };
    const doZero = () => abrirEditor(modeloVazio('numero'), {
      novo: true,
      aoSalvar: (w) => { st.escolhidos.push({ ...w, _chave: 'custom-' + uid() }); passo1(); },
    });
    const customizados = st.escolhidos.filter((x) => x._chave.startsWith('custom-'));
    caixa.replaceChildren(passos(),
      h('h1', null, 'Quais hábitos vão ser os seus?'),
      h('p', { class: 'sub' }, 'Toque para escolher. São só pontos de partida — no próximo passo você ajusta as metas, e dá pra criar os seus do zero.'),
      h('div', { class: 'sugestoes' },
        SUGESTOES.map((s) => h('button', { class: `sug ${escolhido(s.sugestaoId) ? 'on' : ''}`, style: { '--c': s.cor }, 'aria-pressed': String(!!escolhido(s.sugestaoId)), onClick: () => alternar(s) },
          h('span', { class: 'marca-sel' }, svg(ICONES.check)),
          h('span', { class: 'em' }, s.emoji), h('b', null, s.nome), h('span', { class: 'ds' }, s.descricao), h('span', { class: 'mt' }, descricaoMeta(s)))),
        customizados.map((c) => h('button', { class: 'sug on', style: { '--c': c.cor }, onClick: () => { st.escolhidos = st.escolhidos.filter((x) => x !== c); passo1(); } },
          h('span', { class: 'marca-sel' }, svg(ICONES.check)),
          h('span', { class: 'em' }, c.emoji), h('b', null, c.nome), h('span', { class: 'ds' }, 'criado por você'), h('span', { class: 'mt' }, descricaoMeta(c)))),
        h('button', { class: 'sug novo', onClick: doZero }, h('span', { class: 'em' }, '✨'), h('b', null, 'Criar do zero'), h('span', { class: 'ds' }, 'Qualquer hábito, do seu jeito'))));
    barra.replaceChildren(
      h('button', { class: 'btn-secundario', onClick: () => ir(0) }, 'Voltar'),
      h('button', { class: 'btn-primario', disabled: !st.escolhidos.length, onClick: () => ir(2) },
        st.escolhidos.length ? `Continuar com ${st.escolhidos.length}` : 'Escolha pelo menos 1', svg(ICONES.dir)));
  }

  // ---------- 2: ajustar metas ----------
  function passo2() {
    const itens = st.escolhidos.map((x, idx) => {
      const campos = [h('input', { class: 'nome', value: x.nome, maxlength: '40', 'aria-label': 'Nome do hábito', onInput: (ev) => (x.nome = ev.target.value) })];
      if (x.tipo === 'numero') {
        campos.push(h('div', { class: 'linha' }, x.metricas.map((m, i) => [
          i > 0 && h('span', { class: 'ajuda' }, x.combinar === 'media' ? '+' : 'ou'),
          h('input', { class: 'entrada', type: 'text', inputmode: 'decimal', value: String(m.meta).replace('.', ','), 'aria-label': `Meta de ${m.nome}`, onInput: (ev) => (m.meta = numeroLivre(ev.target.value)) }),
          h('span', { class: 'ajuda' }, `${m.unidade}${x.metricas.length > 1 && !m.nome.toLowerCase().startsWith(m.unidade.toLowerCase()) ? ' de ' + m.nome.toLowerCase() : ''}`),
        ]), h('span', { class: 'ajuda' }, 'por dia')));
      } else if (x.tipo === 'checklist') {
        campos.push(h('input', {
          class: 'entrada', value: x.itens.map((i) => i.nome).join(', '), 'aria-label': 'Partes (separadas por vírgula)',
          onInput: (ev) => (x.itens = ev.target.value.split(',').map((n) => n.trim()).filter(Boolean).map((nome) => ({ nome }))),
        }), h('span', { class: 'ajuda' }, 'partes separadas por vírgula — quanto mais marcar no dia, mais colorido'));
      } else if (x.tipo === 'simnao') {
        campos.push(h('label', { class: 'alternar' }, h('input', { type: 'checkbox', checked: !!x.permiteDescanso, onChange: (ev) => (x.permiteDescanso = ev.target.checked) }), 'dia de descanso não quebra a ofensiva'));
      } else {
        campos.push(h('span', { class: 'ajuda' }, x.niveis.map((n) => `${n.nome} (${n.valor * 100}%)`).join(' · ')));
      }
      return h('div', { class: 'ajuste-item', style: { '--c': x.cor } },
        h('span', { class: 'em' }, x.emoji),
        h('div', { class: 'ajuste-campos' }, campos),
        h('div', { class: 'ajuste-acoes' },
          h('button', {
            class: 'mini-btn', title: 'Personalizar tudo', 'aria-label': 'Personalizar tudo',
            onClick: () => abrirEditor(x, { novo: true, aoSalvar: (w) => { st.escolhidos[idx] = { ...w, _chave: x._chave }; passo2(); } }),
          }, svg(ICONES.editar)),
          h('button', { class: 'mini-btn', title: 'Tirar', 'aria-label': 'Tirar', onClick: () => { st.escolhidos.splice(idx, 1); st.escolhidos.length ? passo2() : ir(1); } }, svg(ICONES.x))));
    });
    caixa.replaceChildren(passos(),
      h('h1', null, 'Ajuste as metas'),
      h('p', { class: 'sub' }, 'Comece com metas que você bate num dia normal — dá pra aumentar depois em Ajustes. O lápis abre todas as opções (cor, emoji, cronômetro…).'),
      h('div', { class: 'ajuste-lista' }, itens));
    barra.replaceChildren(
      h('button', { class: 'btn-secundario', onClick: () => ir(1) }, 'Voltar'),
      h('button', { class: 'btn-primario', onClick: () => { const erro = validarTodos(); erro ? avisar(erro) : ir(3); } }, 'Continuar', svg(ICONES.dir)));
  }
  function validarTodos() {
    for (const x of st.escolhidos) {
      if (!x.nome?.trim()) return 'Todo hábito precisa de nome.';
      if (x.tipo === 'numero' && x.metricas.some((m) => !(m.meta > 0))) return `Confira a meta de ${x.nome}.`;
      if (x.tipo === 'checklist' && !x.itens.length) return `${x.nome} precisa de pelo menos uma parte.`;
    }
    return null;
  }

  // ---------- 3: Claudinho ----------
  function passo3() {
    const chave = h('input', { class: 'onb-nome', type: 'password', placeholder: 'sk-ant-… (opcional)', autocomplete: 'off', style: { fontSize: '16px' } });
    caixa.replaceChildren(passos(),
      h('div', { class: 'onb-centro' },
        h('div', { class: 'claudinho-demo', html: SVG_CLAUDINHO }),
        h('h1', null, 'Conheça o Claudinho'),
        h('p', { class: 'sub' }, `Ele vai passear pela tela e te dar uns empurrõezinhos${st.nome.trim() ? ', ' + st.nome.trim() : ''}. Com uma chave da API da Anthropic, ele lê seu dia e fala coisas específicas; sem chave, usa frases prontas.`),
        S.claude.configurada
          ? h('p', { class: 'status-chave ok' }, '● já tem uma chave configurada no servidor')
          : [chave, h('p', { class: 'ajuda' }, 'A chave fica só neste computador. Dá pra colar depois em Ajustes.')]));
    barra.replaceChildren(
      h('button', { class: 'btn-secundario', onClick: () => ir(2) }, 'Voltar'),
      h('button', { class: 'btn-primario', onClick: () => concluir(chave.value.trim()) }, 'Acender a chama ', h('span', { class: 'fogo aceso', style: { width: '18px', height: '18px' }, html: ICONES.fogo })));
  }

  async function concluir(chave) {
    if (chave) {
      try {
        const r = await fetch('/api/chave', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chave }) });
        S.claude.configurada = (await r.json()).configurada;
      } catch { avisar('Não consegui salvar a chave — tente em Ajustes.'); }
    }
    const hoje = hojeISO();
    mudar((est) => {
      est.perfil.nome = st.nome.trim();
      if (st.nascimento) est.perfil.nascimento = st.nascimento;
      const existentes = new Set(est.habitos.map((x) => x.nome.toLowerCase()));
      for (const x of st.escolhidos) {
        if (existentes.has(x.nome.trim().toLowerCase())) continue; // refazendo onboarding: não duplica
        const { _chave, ...modelo } = x;
        modelo.nome = modelo.nome.trim();
        if (modelo.tipo === 'checklist') modelo.itens = modelo.itens.map((i) => ({ ...i }));
        est.habitos.push(instanciar(modelo, hoje));
      }
      est.onboardingFeito = true;
    });
    raiz.remove();
    document.body.style.overflow = '';
    avisar('Tudo pronto! Registre o primeiro hábito de hoje 🔥', 5000);
    setTimeout(() => reagir('abriu'), 1200);
  }

  desenhar();
}
