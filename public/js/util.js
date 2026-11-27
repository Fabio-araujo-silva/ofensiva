// Utilidades puras (datas, números, cores) + um mini criador de elementos.

export const pad = (n) => String(n).padStart(2, '0');
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hojeISO = () => iso(new Date());
export function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function somaDias(s, n) {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}
/** b - a, em dias */
export const diffDias = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
/** 0 = segunda ... 6 = domingo */
export const diaSemana = (s) => (parseISO(s).getDay() + 6) % 7;
export const inicioSemana = (s) => somaDias(s, -diaSemana(s));

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const SEMANA = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];
export const LETRAS_SEMANA = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
export const nomeMes = (i) => MESES[i];
export function dataLonga(s) {
  const d = parseISO(s);
  return `${SEMANA[diaSemana(s)]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}
/** "qua, 25 nov" (com o ano quando não é o atual) */
export function dataMedia(s) {
  const d = parseISO(s);
  const ano = d.getFullYear() === new Date().getFullYear() ? '' : ` ${d.getFullYear()}`;
  return `${SEMANA[diaSemana(s)].slice(0, 3)}, ${d.getDate()} ${MESES[d.getMonth()]}${ano}`;
}
export function dataCurta(s) {
  const d = parseISO(s);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

export function fmt(n, casas = 1) {
  return Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: casas });
}
export const pct = (p) => `${Math.round((p || 0) * 100)}%`;
export const uid = () => Math.random().toString(36).slice(2, 9);
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export function numero(txt) {
  const n = parseFloat(String(txt).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
/** aceita "7,5" e "7.5" para valores pequenos, e "20.000" como milhar */
export function numeroLivre(txt) {
  const s = String(txt).trim();
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return numero(s);
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function hexRgb(hex) {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
}
export function comAlfa(hex, a) {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export const $ = (s, r = document) => r.querySelector(s);

/** h('div', {class, onClick, style:{'--c': x}}, ...filhos) */
export function h(tag, props, ...filhos) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') {
        for (const [sk, sv] of Object.entries(v)) {
          if (sv == null) continue;
          if (sk.startsWith('--')) el.style.setProperty(sk, sv);
          else el.style[sk] = sv;
        }
      } else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const f of filhos.flat(Infinity)) {
    if (f == null || f === false) continue;
    el.append(f.nodeType ? f : String(f));
  }
  return el;
}
export const svg = (s) => h('span', { class: 'ic', html: s });

/**
 * Redesenha `raiz` sem perder o que a pessoa está digitando: campos com data-campo guardam
 * o texto ainda não confirmado, o foco e a posição do cursor através do redesenho.
 */
export function manterCampos(raiz, desenhar) {
  const salvos = new Map();
  const ativo = document.activeElement;
  for (const el of raiz.querySelectorAll('[data-campo]')) {
    if (el.value !== el.defaultValue || el === ativo) {
      salvos.set(el.dataset.campo, { valor: el.value, mudou: el.value !== el.defaultValue, foco: el === ativo, ini: el.selectionStart, fim: el.selectionEnd });
    }
  }
  desenhar();
  for (const [campo, s] of salvos) {
    const el = raiz.querySelector(`[data-campo="${CSS.escape(campo)}"]`);
    if (!el) continue;
    if (s.mudou) el.value = s.valor;
    if (s.foco) {
      el.focus();
      try { el.setSelectionRange(s.ini, s.fim); } catch {}
    }
  }
}

export const ICONES = {
  fogo: `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="f-ext" d="M12.6 1.6c.7 3.4-1 5.5-2.7 7.4C8.3 10.8 6.4 12.7 6.4 15.6c0 3.7 2.6 6.8 5.6 6.8s5.6-3 5.6-6.6c0-2.6-1.2-4.6-2.5-6-.3 1.4-1 2.5-2 3 .5-3.9-.6-8.1-.5-11.2z"/><path class="f-int" d="M12 12.4c1 1.7 2.8 2.6 2.8 4.8 0 1.8-1.3 3.2-2.8 3.2s-2.8-1.4-2.8-3.2c0-1.9 1.8-2.9 2.8-4.8z"/></svg>`,
  engrenagem: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`,
  mais: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`,
  x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6z"/><path d="M12 14v7"/></svg>`,
  esq: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>`,
  dir: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>`,
  cima: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>`,
  baixo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`,
  editar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>`,
  play: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>`,
  stop: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6.5" y="6.5" width="11" height="11" rx="2"/></svg>`,
  olho: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`,
  lua: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>`,
  enviar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>`,
};
