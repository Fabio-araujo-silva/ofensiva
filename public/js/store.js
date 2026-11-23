// Estado global, gravação no servidor, avisos e modais.
import { h, hojeISO, ICONES, svg } from './util.js';
import { normalizar } from './habitos.js';

export const S = {
  estado: null,
  rev: 0,
  hoje: hojeISO(),
  dia: hojeISO(), // dia aberto no registro
  ano: new Date().getFullYear(),
  claude: { configurada: false, modelo: '' },
};

let renderizar = () => {};
export const definirRender = (f) => (renderizar = f);
export const render = () => renderizar();

// ---------- gravação ----------
// Cada mudança é uma função aplicada ao estado (mudar(fn)). Guardamos as que o servidor ainda não
// confirmou: se outra aba salvar antes (409), reaplicamos as suas por cima da versão mais nova,
// em vez de jogar a sua edição fora.
let timer = null;
let emVoo = false;
let sujo = false;
let filaMut = []; // mutações aplicadas localmente e ainda não confirmadas
let forcarProximo = false; // redução intencional (excluir/importar): o servidor não deve barrar
export const temPendencia = () => sujo || emVoo;

// Cópias de segurança no navegador
const LS_PENDENTE = 'ofensiva.naoSalvo'; // estado atual até o servidor confirmar
const LS_RECUPERAVEL = 'ofensiva.recuperavel'; // versão que não deu para reaplicar sozinha (fica em Ajustes)
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const lsDel = (k) => { try { localStorage.removeItem(k); } catch {} };
const guardarPendente = () => lsSet(LS_PENDENTE, { rev: S.rev, estado: S.estado, quando: Date.now() });
const limparPendente = () => lsDel(LS_PENDENTE);
function guardarRecuperavel(estado, motivo) {
  lsSet(LS_RECUPERAVEL, { estado, quando: Date.now(), motivo });
}
export const copiaRecuperavel = () => lsGet(LS_RECUPERAVEL);
export const descartarRecuperavel = () => lsDel(LS_RECUPERAVEL);
export function restaurarRecuperavel() {
  const c = copiaRecuperavel();
  if (!c?.estado) return;
  mudar((e) => Object.assign(e, normalizar(structuredClone(c.estado))), { forcar: true });
  descartarRecuperavel();
  avisar('Versão recuperada ✔');
}
// versões antigas do app deixavam cópias órfãs em 'ofensiva.naoSalvo.<n>': junta a mais nova e limpa
(() => {
  try {
    const orfas = Object.keys(localStorage).filter((k) => k.startsWith(`${LS_PENDENTE}.`)).sort();
    if (orfas.length && !copiaRecuperavel()) {
      const ultima = lsGet(orfas[orfas.length - 1]);
      if (ultima?.estado) guardarRecuperavel(ultima.estado, 'alterações antigas não salvas');
    }
    for (const k of orfas) lsDel(k);
  } catch {}
})();

const temDados = (e) => !!e && (e.habitos?.length || Object.keys(e.dias || {}).length || e.materias?.length || e.todos?.length || e.semanais?.length);

async function buscarServidor() {
  const r = await fetch('/api/estado', { cache: 'no-store' });
  const j = await r.json();
  S.claude = j.claude || S.claude;
  return j;
}

export async function carregar() {
  const j = await buscarServidor();
  S.estado = normalizar(j.estado);
  S.rev = j.rev;
  filaMut = [];

  const pend = lsGet(LS_PENDENTE);
  if (pend?.estado) {
    if (pend.rev === j.rev) {
      // o servidor não mudou desde então: reaplica o que ficou sem salvar
      S.estado = normalizar(pend.estado);
      salvar();
      setTimeout(() => avisar('Recuperei alterações que não tinham sido salvas 👍', 5000), 800);
    } else {
      // o servidor andou e não sabemos juntar sozinhos: guarda para você decidir em Ajustes
      guardarRecuperavel(pend.estado, 'alterações não salvas de uma sessão anterior');
      limparPendente();
      setTimeout(() => avisar('Achei alterações antigas que não foram salvas. Se quiser, recupere em Ajustes → Recuperar.', 8000), 800);
    }
  }
}

export function salvar() {
  sujo = true;
  guardarPendente();
  clearTimeout(timer);
  timer = setTimeout(enviar, 300);
}

let avisouFalha = false;
async function enviar() {
  if (emVoo) return; // quando o envio atual terminar, ele vê "sujo" e manda de novo
  emVoo = true;
  sujo = false;
  const enviando = filaMut;
  filaMut = [];
  const forcar = forcarProximo;
  forcarProximo = false;
  let atraso = 300;
  try {
    const r = await fetch('/api/estado', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rev: S.rev, estado: S.estado, forcar }),
    });
    const j = await r.json();
    if (r.status === 409) {
      const muts = [...enviando, ...filaMut];
      if (!temDados(j.estado) && temDados(S.estado)) {
        // o servidor está sem dados (ex.: arquivo sumiu) e esta aba tem: não adota o vazio, regrava
        S.rev = j.rev;
        forcarProximo = true;
        filaMut = muts;
        sujo = true;
      } else {
        const base = normalizar(j.estado);
        let falhou = false;
        for (const f of muts) {
          try { f(base); } catch { falhou = true; }
        }
        if (falhou) guardarRecuperavel(S.estado, 'conflito com outra aba');
        S.estado = base;
        S.rev = j.rev;
        filaMut = muts;
        sujo = muts.length > 0;
        if (sujo) guardarPendente();
        else limparPendente();
        avisar(muts.length ? 'Outra aba salvou antes — juntei as suas mudanças com a versão mais nova.' : 'Carreguei a versão mais nova (outra aba salvou).');
        render();
      }
    } else if (r.status === 422) {
      guardarRecuperavel(S.estado, j.erro);
      limparPendente();
      const atual = await buscarServidor();
      S.estado = normalizar(atual.estado);
      S.rev = atual.rev;
      filaMut = [];
      sujo = false;
      avisar(`Gravação bloqueada para proteger seus dados (${j.erro}). A versão recusada ficou em Ajustes → Recuperar.`, 9000);
      render();
    } else if (r.ok) {
      S.rev = j.rev;
      if (sujo) guardarPendente(); // ainda há mudanças: regrava a cópia já com a revisão nova
      else limparPendente();
      if (avisouFalha) avisar('Servidor de volta — tudo salvo ✔');
      avisouFalha = false;
    } else throw new Error(j.erro || r.status);
  } catch {
    filaMut = [...enviando, ...filaMut];
    forcarProximo ||= forcar;
    sujo = true;
    atraso = 4000;
    if (!avisouFalha) avisar('Servidor fora do ar. Suas mudanças estão guardadas no navegador e serão salvas quando ele voltar.', 6000);
    avisouFalha = true;
  } finally {
    emVoo = false;
    if (sujo) {
      clearTimeout(timer);
      timer = setTimeout(enviar, atraso);
    }
  }
}

addEventListener('beforeunload', () => {
  if (!sujo) return;
  const blob = new Blob([JSON.stringify({ rev: S.rev, estado: S.estado, forcar: forcarProximo })], { type: 'application/json' });
  navigator.sendBeacon('/api/estado', blob);
});

/**
 * Muda o estado, salva e redesenha.
 * `forcar`: a mudança reduz dados de propósito (excluir, importar) — o servidor não deve barrar.
 */
export function mudar(fn, { forcar = false } = {}) {
  fn(S.estado);
  filaMut.push(fn);
  if (forcar) forcarProximo = true;
  salvar();
  render();
}

// ---------- avisos ----------
export function avisar(msg, ms = 3500) {
  const raiz = document.getElementById('avisos');
  const el = h('div', { class: 'aviso' }, msg);
  raiz.append(el);
  setTimeout(() => el.remove(), ms);
}

// ---------- modais ----------
export function abrirModal(titulo, corpo, { largo = false, pe = null, aoFechar = null } = {}) {
  const raiz = document.getElementById('modais');
  const fechar = () => {
    fundo.remove();
    removeEventListener('keydown', esc);
    aoFechar?.();
  };
  const esc = (e) => {
    if (e.key === 'Escape' && raiz.lastElementChild === fundo) fechar();
  };
  const fundo = h(
    'div',
    { class: 'modal-fundo', onMousedown: (e) => e.target === fundo && fechar() },
    h(
      'div',
      { class: `modal ${largo ? 'largo' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo },
      h('div', { class: 'modal-cab' }, h('h3', null, titulo), h('button', { class: 'btn-icone', 'aria-label': 'Fechar', onClick: fechar }, svg(ICONES.x))),
      h('div', { class: 'modal-corpo' }, corpo),
      pe && h('div', { class: 'modal-pe' }, pe)
    )
  );
  raiz.append(fundo);
  addEventListener('keydown', esc);
  setTimeout(() => fundo.querySelector('input:not([type=checkbox]):not([type=range])')?.focus(), 30);
  return { fechar, el: fundo };
}

/** Botão que pede um segundo clique para confirmar (sem diálogo do navegador). */
export function botaoConfirmar(texto, textoConfirma, acao, classe = 'btn-secundario btn-perigo') {
  let armado = false;
  let t;
  const b = h('button', {
    class: classe,
    onClick: () => {
      if (!armado) {
        armado = true;
        b.textContent = textoConfirma;
        t = setTimeout(() => {
          armado = false;
          b.textContent = texto;
        }, 3000);
        return;
      }
      clearTimeout(t);
      acao();
    },
  }, texto);
  return b;
}
