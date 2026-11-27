// Modelo de hábitos: tipos, progresso do dia, ofensivas e descrições.
// Tudo aqui é puro (sem DOM) — também roda no Node (scripts/demo.mjs).
import { somaDias, fmt, uid, pad } from './util.js';

export const TIPOS = {
  numero: { nome: 'Número com meta', exemplo: 'água em ml, passos, minutos, horas' },
  checklist: { nome: 'Checklist', exemplo: 'várias partes; quanto mais marca, mais colorido' },
  simnao: { nome: 'Sim ou não', exemplo: 'fez ou não fez (com dia de descanso opcional)' },
  niveis: { nome: 'Níveis', exemplo: 'nada / um pouco / tudo' },
};

export const PALETA = [
  '#8ec5f5', '#86d0c5', '#f6c98b', '#f4a3b0', '#b3b3ec', '#d6a6e6',
  '#f7a98b', '#a6dd8f', '#ef8a8a', '#f0dc82', '#9fd8f0', '#c9b79c',
];

/** Cria um hábito novo (com ids) a partir de um modelo/sugestão. */
export function instanciar(modelo, hoje) {
  const h = structuredClone(modelo);
  h.id = 'h' + uid();
  delete h.sugestaoId;
  delete h.descricao;
  h.criadoEm = hoje;
  h.arquivado = false;
  if (h.tipo === 'numero') h.metricas = h.metricas.map((m) => ({ ...m, id: m.id || 'm' + uid() }));
  if (h.tipo === 'checklist') h.itens = h.itens.map((i) => ({ ...i, id: i.id || 'i' + uid() }));
  return h;
}

/** Progresso de um valor salvo: p (0..1), descanso (dia de folga), reg (tem algo registrado). */
export function progresso(h, v) {
  if (!v) return { p: 0, descanso: false, reg: false };
  switch (h.tipo) {
    case 'numero': {
      const reg = h.metricas.some((m) => (Number(v[m.id]) || 0) > 0);
      if (ehSoma(h)) return { p: Math.min(totalSoma(h, v) / h.total.meta, 1), descanso: false, reg };
      const rs = h.metricas.map((m) => razaoMetrica(m, Number(v[m.id]) || 0));
      const p = rs.length === 0 ? 0 : h.combinar === 'media' ? rs.reduce((a, b) => a + b, 0) / rs.length : Math.max(...rs);
      return { p, descanso: false, reg };
    }
    case 'checklist': {
      const n = h.itens.filter((i) => v[i.id]).length;
      return { p: h.itens.length ? n / h.itens.length : 0, descanso: false, reg: n > 0 };
    }
    case 'simnao':
      return { p: v.feito ? 1 : 0, descanso: !v.feito && !!v.descanso, reg: !!(v.feito || v.descanso) };
    case 'niveis': {
      const n = v.nivel || 0;
      return { p: n ? h.niveis[n - 1]?.valor ?? 0 : 0, descanso: false, reg: n > 0 || !!v.nota };
    }
    default:
      return { p: 0, descanso: false, reg: false };
  }
}

/**
 * Quanto uma métrica cumpre a meta (0..1).
 * Meta normal: chegar lá. Meta-teto (`limite`, ex.: até 2.000 kcal): registrou e ficou
 * dentro = 100%; passou, cai na proporção (2.500 de 2.000 → 80%). Sem registro = 0.
 */
export function razaoMetrica(m, val) {
  const meta = m.meta || 1;
  if (m.limite) return val <= 0 ? 0 : val <= meta ? 1 : meta / val;
  return Math.min(val / meta, 1);
}

/**
 * Hábito numérico em que as métricas SOMAM para uma meta única, cada uma convertida pelo seu
 * `vale` (ex.: cardio de 500 kcal = passos × 0,04 + andares de escada × 3).
 */
export const ehSoma = (h) => h.tipo === 'numero' && h.combinar === 'soma' && Number(h.total?.meta) > 0;
/** Quanto um valor de métrica contribui para o total (na unidade do total). */
export const parcela = (m, val) => (Number(val) || 0) * (Number(m.vale) || 0);
export const totalSoma = (h, v) => (v ? h.metricas.reduce((s, m) => s + parcela(m, v[m.id]), 0) : 0);
/** A meta única vista como uma métrica (para formatar com fmtMetrica). */
export const metricaTotal = (h) => ({ nome: h.total.nome || h.nome, meta: Number(h.total.meta), unidade: h.total.unidade || '' });

export const valorDe = (e, h, dia) => e.dias[dia]?.[h.id];
export const prog = (e, h, dia) => progresso(h, valorDe(e, h, dia));
export const okDia = (r) => r.p >= 0.999 || r.descanso;
export const ativos = (e) => e.habitos.filter((h) => !h.arquivado);

/** Primeiro dia que conta para o hábito: criação ou o registro mais antigo (se registrou dias antes). */
const CACHE_INICIO = new Map();
/** Chame antes de cada render (os dados podem ter mudado). */
export const limparCache = () => CACHE_INICIO.clear();
export function inicioHabito(e, h) {
  if (CACHE_INICIO.has(h.id)) return CACHE_INICIO.get(h.id);
  let ini = h.criadoEm;
  for (const d in e.dias) if (d < ini && e.dias[d]?.[h.id] !== undefined) ini = d;
  CACHE_INICIO.set(h.id, ini);
  return ini;
}

function contaSequencia(hoje, ini, ok) {
  let d = hoje;
  let n = 0;
  if (!ok(d)) d = somaDias(d, -1); // hoje ainda pode ser feito: não quebra
  while (d >= ini && ok(d)) {
    n++;
    d = somaDias(d, -1);
  }
  return n;
}
function maiorSequencia(hoje, ini, ok) {
  let melhor = 0, atual = 0;
  for (let d = ini; d <= hoje; d = somaDias(d, 1)) {
    if (ok(d)) melhor = Math.max(melhor, ++atual);
    else if (d !== hoje) atual = 0;
  }
  return melhor;
}

export function ofensivaHabito(e, h, hoje) {
  return contaSequencia(hoje, inicioHabito(e, h), (d) => okDia(prog(e, h, d)));
}
export function recordeHabito(e, h, hoje) {
  return maiorSequencia(hoje, inicioHabito(e, h), (d) => okDia(prog(e, h, d)));
}

/** Média do dia entre os hábitos ativos naquele dia (dias de descanso não contam). */
export function notaDia(e, dia) {
  let soma = 0, n = 0, reg = false, perfeito = true, algum = false;
  for (const h of ativos(e)) {
    if (inicioHabito(e, h) > dia) continue;
    algum = true;
    const r = prog(e, h, dia);
    if (r.reg) reg = true;
    if (!okDia(r)) perfeito = false;
    if (r.descanso) continue;
    soma += r.p;
    n++;
  }
  return { media: n ? soma / n : reg ? 1 : 0, reg, perfeito: algum && perfeito && reg };
}
export const okGeral = (nd, limiar) => nd.reg && nd.media >= limiar - 1e-9;

export function inicioGeral(e) {
  const hs = ativos(e);
  if (!hs.length) return null;
  return hs.map((h) => inicioHabito(e, h)).sort()[0];
}
export function ofensivaGeral(e, hoje, limiar) {
  const ini = inicioGeral(e);
  if (!ini) return 0;
  return contaSequencia(hoje, ini, (d) => okGeral(notaDia(e, d), limiar));
}
export function recordeGeral(e, hoje, limiar) {
  const ini = inicioGeral(e);
  if (!ini) return 0;
  return maiorSequencia(hoje, ini, (d) => okGeral(notaDia(e, d), limiar));
}
export function diasPerfeitos(e, hoje) {
  const ini = inicioGeral(e);
  if (!ini) return 0;
  let n = 0;
  for (let d = ini; d <= hoje; d = somaDias(d, 1)) if (notaDia(e, d).perfeito) n++;
  return n;
}

/** % médio de cumprimento desde o início do hábito (hoje só conta se já tiver registro). */
export function pctHabito(e, h, hoje) {
  let soma = 0, n = 0;
  for (let d = inicioHabito(e, h); d <= hoje; d = somaDias(d, 1)) {
    const r = prog(e, h, d);
    if (d === hoje && !r.reg) continue;
    if (r.descanso) continue;
    soma += r.p;
    n++;
  }
  return n ? soma / n : 0;
}

export function fmtMetrica(valor, m) {
  if (m.unidade === 'min' && m.meta >= 60) {
    const t = Math.round(valor);
    const hs = Math.floor(t / 60), mi = t % 60;
    return hs ? `${hs}h${mi ? pad(mi) : ''}` : `${mi} min`;
  }
  const casas = m.decimal ? 1 : 0;
  return `${fmt(valor, casas)}${m.unidade ? ' ' + m.unidade : ''}`;
}

export function descricaoMeta(h) {
  switch (h.tipo) {
    case 'numero': {
      if (ehSoma(h)) {
        const nomes = h.metricas.map((m) => (m.nome || m.unidade || '').toLowerCase()).filter(Boolean);
        return `${fmtMetrica(h.total.meta, metricaTotal(h))} por dia, somando ${nomes.join(' + ')}`;
      }
      const partes = h.metricas.map((m) => {
        const nome = (m.nome || '').toLowerCase();
        const redundante = !nome || (m.unidade && nome.startsWith(m.unidade.toLowerCase().replace('.', '')));
        return (m.limite ? 'até ' : '') + fmtMetrica(m.meta, m) + (h.metricas.length > 1 && !redundante ? ` de ${nome}` : '');
      });
      return partes.join(h.combinar === 'media' ? ' + ' : ' ou ') + ' por dia';
    }
    case 'checklist':
      return h.itens.map((i) => i.nome).join(' · ');
    case 'simnao':
      return h.permiteDescanso ? 'todo dia (com descanso)' : 'todo dia';
    case 'niveis':
      return h.niveis.map((n) => n.nome).join(' / ');
    default:
      return '';
  }
}

/** Texto curto do que foi registrado (tooltip, Claudinho). */
export function detalheValor(h, v) {
  if (!v) return 'nada registrado';
  switch (h.tipo) {
    case 'numero':
      if (ehSoma(h)) {
        const mt = metricaTotal(h);
        const partes = h.metricas.filter((m) => Number(v[m.id]) > 0).map((m) => fmtMetrica(Number(v[m.id]), m));
        return `${fmtMetrica(Math.round(totalSoma(h, v)), mt)} de ${fmtMetrica(mt.meta, mt)}${partes.length ? ` (${partes.join(' + ')})` : ''}`;
      }
      return h.metricas.map((m) => {
        const val = Number(v[m.id]) || 0;
        const fim = m.limite ? ` (limite ${fmtMetrica(m.meta, m)}${val > m.meta ? `, passou ${fmtMetrica(val - m.meta, m)}` : ''})` : ` de ${fmtMetrica(m.meta, m)}`;
        return `${h.metricas.length > 1 ? m.nome + ': ' : ''}${fmtMetrica(val, m)}${fim}`;
      }).join(' · ');
    case 'checklist': {
      const feitos = h.itens.filter((i) => v[i.id]).map((i) => i.nome);
      return feitos.length ? `feito: ${feitos.join(', ')}` : 'nada marcado';
    }
    case 'simnao':
      return v.feito ? `feito${v.tag ? ' · ' + v.tag : ''}` : v.descanso ? 'dia de descanso' : 'não feito';
    case 'niveis': {
      const n = v.nivel ? h.niveis[v.nivel - 1]?.nome : 'nada';
      return `${n}${v.nota ? ' — ' + v.nota : ''}`;
    }
    default:
      return '';
  }
}

const DIAS_SEMANA = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];
const hhmm = (ms) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
/**
 * Campos derivados de uma sessão de estudo, para estatísticas (horário x dia da semana etc.).
 * Preenche o que faltar sem mexer no que já existe — serve para sessões antigas também.
 */
export function detalharSessao(s) {
  if (!s || typeof s !== 'object' || !s.inicio) return s;
  const ini = new Date(s.inicio);
  if (s.diaSemana == null) s.diaSemana = (ini.getDay() + 6) % 7; // 0 = segunda … 6 = domingo
  if (!s.diaSemanaNome) s.diaSemanaNome = DIAS_SEMANA[s.diaSemana];
  if (!s.horaInicio) s.horaInicio = hhmm(s.inicio);
  if (!s.horaFim && s.fim) s.horaFim = hhmm(s.fim);
  if (s.hora == null) s.hora = ini.getHours(); // hora cheia, p/ agrupar por faixa do dia
  if (!s.desfecho) s.desfecho = s.tipo === 'livre' ? 'livre' : 'completo';
  return s;
}

/** Deixa um estado antigo/incompleto no formato atual. */
export function normalizar(e) {
  e = e && typeof e === 'object' ? e : {};
  e.versao = 1;
  e.perfil = { nome: '', limiar: 0.7, som: true, claudinho: true, ...(e.perfil || {}) };
  e.habitos = Array.isArray(e.habitos) ? e.habitos : [];
  e.dias = e.dias && typeof e.dias === 'object' ? e.dias : {};
  e.todos = Array.isArray(e.todos) ? e.todos : [];
  e.onboardingFeito = !!e.onboardingFeito;
  e.cronometro = e.cronometro || null;
  e.semanais = Array.isArray(e.semanais) ? e.semanais : [];
  e.materias = Array.isArray(e.materias) ? e.materias : [];
  for (const m of e.materias) m.assuntos = Array.isArray(m.assuntos) ? m.assuntos : [];
  e.sessoes = Array.isArray(e.sessoes) ? e.sessoes.map(detalharSessao) : [];
  e.pomodoro = { config: {}, timer: null, ciclo: 0, cicloDia: null, proxima: 'foco', tag: null, assunto: null, ...(e.pomodoro || {}) };
  return e;
}

/**
 * Tarefas: no virar do dia, só seguem as que foram marcadas com 📌 (e não feitas).
 * O 📌 vale por uma virada: no dia novo a pessoa decide de novo.
 */
export function rolarTodos(e, hoje) {
  for (const t of e.todos) {
    if (t.dia < hoje && t.manter && !t.feito) {
      t.dia = hoje;
      t.manter = false;
      t.adiado = (t.adiado || 0) + 1;
    }
  }
  const limite = somaDias(hoje, -90);
  e.todos = e.todos.filter((t) => t.dia >= limite);
}
