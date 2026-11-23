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
let timer = null;
let emVoo = false;
let sujo = false;
export const temPendencia = () => sujo || emVoo;

// Cópia de segurança no navegador: toda mudança fica aqui até o servidor confirmar.
// Se o servidor cair (ou a aba fechar antes de salvar), nada se perde: reenviamos ao voltar.
const LS_PENDENTE = 'ofensiva.naoSalvo';
function guardarPendente() {
  try {
    localStorage.setItem(LS_PENDENTE, JSON.stringify({ rev: S.rev, estado: S.estado, quando: Date.now() }));
  } catch {
    /* sem localStorage: segue só com o servidor */
  }
}
function limparPendente() {
  try { localStorage.removeItem(LS_PENDENTE); } catch {}
}

export async function carregar() {
  const r = await fetch('/api/estado', { cache: 'no-store' });
  const j = await r.json();
  S.estado = normalizar(j.estado);
  S.rev = j.rev;
  S.claude = j.claude || S.claude;

  let pend = null;
  try { pend = JSON.parse(localStorage.getItem(LS_PENDENTE) || 'null'); } catch {}
  if (pend?.estado) {
    if (pend.rev === j.rev) {
      // o servidor não mudou desde então: reaplica o que ficou sem salvar
      S.estado = normalizar(pend.estado);
      salvar();
      setTimeout(() => avisar('Recuperei alterações que não tinham sido salvas 👍', 5000), 800);
    } else {
      // o servidor andou (outra aba salvou): guarda a cópia antiga em vez de sobrescrever
      try { localStorage.setItem(`${LS_PENDENTE}.${pend.quando}`, JSON.stringify(pend)); } catch {}
      limparPendente();
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
  let atraso = 300;
  try {
    const r = await fetch('/api/estado', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rev: S.rev, estado: S.estado }),
    });
    const j = await r.json();
    if (r.status === 409) {
      S.estado = normalizar(j.estado);
      S.rev = j.rev;
      limparPendente();
      avisar('Os dados mudaram em outra aba — carreguei a versão mais nova.');
      render();
    } else if (r.status === 422) {
      avisar(`Gravação bloqueada para proteger seus dados: ${j.erro}`, 8000);
      await carregar().catch(() => {});
      render();
    } else if (r.ok) {
      S.rev = j.rev;
      if (!sujo) limparPendente();
      if (avisouFalha) avisar('Servidor de volta — tudo salvo ✔');
      avisouFalha = false;
    } else throw new Error(j.erro || r.status);
  } catch {
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
  const blob = new Blob([JSON.stringify({ rev: S.rev, estado: S.estado })], { type: 'application/json' });
  navigator.sendBeacon('/api/estado', blob);
});

/** Muda o estado, salva e redesenha. */
export function mudar(fn) {
  fn(S.estado);
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
