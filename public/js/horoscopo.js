// Horóscopo chinês do dia, pela tradição do calendário 干支 (troncos e ramos):
// - o signo vem do ano de nascimento (o ano astrológico vira no 立春, ~4 de fevereiro, como no BaZi);
// - cada dia tem um pilar (tronco + ramo, ciclo de 60);
// - a leitura sai da relação entre o ramo do dia e o seu (六合, 三合, 冲, 刑, 害)
//   e da interação dos cinco elementos entre o tronco do dia e o do seu ano.
// Puro (sem DOM) — roda no navegador e no Node.

export const TRONCOS = [
  { h: '甲', p: 'jiǎ', el: 'madeira', yy: 'yang' },
  { h: '乙', p: 'yǐ', el: 'madeira', yy: 'yin' },
  { h: '丙', p: 'bǐng', el: 'fogo', yy: 'yang' },
  { h: '丁', p: 'dīng', el: 'fogo', yy: 'yin' },
  { h: '戊', p: 'wù', el: 'terra', yy: 'yang' },
  { h: '己', p: 'jǐ', el: 'terra', yy: 'yin' },
  { h: '庚', p: 'gēng', el: 'metal', yy: 'yang' },
  { h: '辛', p: 'xīn', el: 'metal', yy: 'yin' },
  { h: '壬', p: 'rén', el: 'água', yy: 'yang' },
  { h: '癸', p: 'guǐ', el: 'água', yy: 'yin' },
];

export const RAMOS = [
  { h: '子', p: 'zǐ', animal: 'Rato', zh: '鼠', py: 'shǔ', em: '🐀', tracos: ['esperto', 'adaptável', 'econômico'] },
  { h: '丑', p: 'chǒu', animal: 'Boi', zh: '牛', py: 'niú', em: '🐂', tracos: ['paciente', 'confiável', 'trabalhador'] },
  { h: '寅', p: 'yín', animal: 'Tigre', zh: '虎', py: 'hǔ', em: '🐅', tracos: ['corajoso', 'intenso', 'líder'] },
  { h: '卯', p: 'mǎo', animal: 'Coelho', zh: '兔', py: 'tù', em: '🐇', tracos: ['gentil', 'diplomático', 'cuidadoso'] },
  { h: '辰', p: 'chén', animal: 'Dragão', zh: '龙', py: 'lóng', em: '🐉', tracos: ['confiante', 'ambicioso', 'carismático'] },
  { h: '巳', p: 'sì', animal: 'Serpente', zh: '蛇', py: 'shé', em: '🐍', tracos: ['intuitivo', 'estratégico', 'reservado'] },
  { h: '午', p: 'wǔ', animal: 'Cavalo', zh: '马', py: 'mǎ', em: '🐎', tracos: ['livre', 'enérgico', 'sociável'] },
  { h: '未', p: 'wèi', animal: 'Cabra', zh: '羊', py: 'yáng', em: '🐐', tracos: ['criativo', 'sensível', 'calmo'] },
  { h: '申', p: 'shēn', animal: 'Macaco', zh: '猴', py: 'hóu', em: '🐒', tracos: ['inteligente', 'curioso', 'engenhoso'] },
  { h: '酉', p: 'yǒu', animal: 'Galo', zh: '鸡', py: 'jī', em: '🐓', tracos: ['observador', 'organizado', 'direto'] },
  { h: '戌', p: 'xū', animal: 'Cão', zh: '狗', py: 'gǒu', em: '🐕', tracos: ['leal', 'justo', 'protetor'] },
  { h: '亥', p: 'hài', animal: 'Porco', zh: '猪', py: 'zhū', em: '🐖', tracos: ['generoso', 'sincero', 'tranquilo'] },
];

const ELEMENTO_ZH = { madeira: '木', fogo: '火', terra: '土', metal: '金', água: '水' };
const ELEMENTO_ADJ = { madeira: 'de Madeira', fogo: 'de Fogo', terra: 'de Terra', metal: 'de Metal', água: 'de Água' };

function jdn(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const a = Math.floor((14 - m) / 12);
  const y2 = y + 4800 - a;
  const m2 = m + 12 * a - 3;
  return d + Math.floor((153 * m2 + 2) / 5) + 365 * y2 + Math.floor(y2 / 4) - Math.floor(y2 / 100) + Math.floor(y2 / 400) - 32045;
}
const mod = (n, m) => ((n % m) + m) % m;

function pilar(tronco, ramo) {
  const t = TRONCOS[tronco], r = RAMOS[ramo];
  return {
    tronco, ramo,
    hanzi: t.h + r.h,
    pinyin: `${t.p} ${r.p}`,
    elemento: t.el,
    elementoZh: ELEMENTO_ZH[t.el],
    yy: t.yy,
    animal: r.animal, animalZh: r.zh, animalPy: r.py, emoji: r.em, tracos: r.tracos,
    nome: `${r.animal} ${ELEMENTO_ADJ[t.el]}`,
  };
}

/** Pilar do ano astrológico (vira em 4 de fevereiro, aproximação do 立春). */
export function pilarDoAno(ano) {
  return pilar(mod(ano - 4, 10), mod(ano - 4, 12));
}
export function signoDe(nascimentoISO) {
  const [y, m, d] = nascimentoISO.split('-').map(Number);
  const anoAstro = m < 2 || (m === 2 && d < 4) ? y - 1 : y;
  const s = pilarDoAno(anoAstro);
  s.anoAstro = anoAstro;
  s.limiar = m === 2 && d >= 3 && d <= 5; // perto do 立春: pode variar por algumas horas
  s.antesDoAnoNovo = anoAstro !== y; // nascido em jan/começo de fev
  return s;
}
/** Pilar do dia: ciclo de 60 dias. 0 = 甲子 (ex.: 1949-10-01 foi 甲子). */
export function pilarDoDia(iso) {
  const i = mod(jdn(iso) + 49, 60);
  return pilar(i % 10, i % 12);
}

// ---------- relações entre ramos ----------
const par = (a, b, lista) => lista.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
const LIUHE = [[0, 1], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7]];
const SANHE = [[8, 0, 4], [11, 3, 7], [2, 6, 10], [5, 9, 1]];
const HAI = [[0, 7], [1, 6], [2, 5], [3, 4], [8, 11], [9, 10]];
const XING_GRUPOS = [[2, 5, 8], [1, 10, 7]];
const XING_PAR = [[0, 3]];
const AUTO_XING = [4, 6, 9, 11];

export function relacoesRamos(meu, dia) {
  const r = [];
  if (meu === dia) {
    r.push({ zh: '伏吟', nome: 'dia do seu animal', tom: 'misto', peso: 0, texto: 'O dia tem o seu próprio animal: energia familiar, que amplifica o seu jeito — para o bem e para o mal.' });
    if (AUTO_XING.includes(meu)) r.push({ zh: '自刑', nome: 'autopunição', tom: 'ruim', peso: -1, texto: 'Tradicionalmente pede cuidado com a autocobrança e com repetir os mesmos erros.' });
    return r;
  }
  if (mod(meu - dia, 12) === 6) r.push({ zh: '冲', nome: 'choque', tom: 'ruim', peso: -2, texto: 'O animal do dia é o seu oposto: dia de mudanças e atritos. Bom para quebrar rotina ruim, ruim para decisões impulsivas.' });
  if (par(meu, dia, LIUHE)) r.push({ zh: '六合', nome: 'harmonia secreta', tom: 'bom', peso: 1.5, texto: 'O animal do dia é seu par de harmonia: as coisas tendem a se encaixar e ajudas aparecem.' });
  if (SANHE.some((g) => g.includes(meu) && g.includes(dia))) r.push({ zh: '三合', nome: 'trio de harmonia', tom: 'bom', peso: 1, texto: 'O animal do dia é do seu trio de afinidade: boa energia para cooperar e avançar em grupo.' });
  if (XING_GRUPOS.some((g) => g.includes(meu) && g.includes(dia)) || par(meu, dia, XING_PAR)) r.push({ zh: '刑', nome: 'punição', tom: 'ruim', peso: -1, texto: 'Relação de "punição": atenção a regras, prazos e palavras ditas sem pensar.' });
  if (par(meu, dia, HAI)) r.push({ zh: '害', nome: 'dano', tom: 'ruim', peso: -1, texto: 'Relação de "dano": pequenos ruídos e mal-entendidos; vá com calma nas conversas.' });
  return r;
}

/** Relação do seu animal com o animal do ANO (nomes próprios do ano, não do dia). */
export function relacoesAno(meu, ano) {
  if (meu === ano) {
    const r = [{ zh: '本命年', nome: 'ano do seu animal', tom: 'misto', peso: 0, texto: 'É o seu 本命年 (ano do próprio animal, "值太岁"): tradicionalmente pede cautela e constância.' }];
    if (AUTO_XING.includes(meu)) r.push({ zh: '自刑', nome: 'autopunição', tom: 'ruim', peso: -1, texto: 'Cuidado com a autocobrança neste ano.' });
    return r;
  }
  return relacoesRamos(meu, ano).map((r) => (r.zh === '冲' ? { ...r, zh: '冲太岁', nome: 'choque com o ano', texto: 'Seu animal é o oposto do animal do ano (冲太岁): ano de mudanças.' } : r));
}

// ---------- cinco elementos ----------
const GERA = { madeira: 'fogo', fogo: 'terra', terra: 'metal', metal: 'água', água: 'madeira' };
const CONTROLA = { madeira: 'terra', terra: 'água', água: 'fogo', fogo: 'metal', metal: 'madeira' };
export function relacaoElementos(meu, dia) {
  if (meu === dia) return { zh: '比和', nome: 'mesmo elemento', peso: 0.5, texto: `Dia de ${dia}, o seu elemento: energia de reforço, bom para persistir no que já está andando.` };
  if (GERA[dia] === meu) return { zh: '生', nome: 'o dia te nutre', peso: 1, texto: `${cap(dia)} gera ${meu}: o dia te alimenta. Bom para aprender e recarregar.` };
  if (GERA[meu] === dia) return { zh: '泄', nome: 'você nutre o dia', peso: -0.25, texto: `${cap(meu)} gera ${dia}: você gasta energia se expressando. Bom para criar e produzir — e descansar depois.` };
  if (CONTROLA[meu] === dia) return { zh: '克', nome: 'você domina o dia', peso: 0.25, texto: `${cap(meu)} controla ${dia}: você tem as rédeas. Bom para organizar e resolver pendências.` };
  return { zh: '受克', nome: 'o dia te pressiona', peso: -1, texto: `${cap(dia)} controla ${meu}: dia de pressão. Faça o essencial e não se cobre demais.` };
}
const cap = (s) => s[0].toUpperCase() + s.slice(1);

/** Leitura completa do dia (fatos tradicionais + nota de 1 a 5). */
export function horoscopoDoDia(nascimentoISO, diaISO) {
  const signo = signoDe(nascimentoISO);
  const dia = pilarDoDia(diaISO);
  const ano = pilarDoAno(Number(diaISO.slice(0, 4)) - (diaISO.slice(5) < '02-04' ? 1 : 0));
  const ramos = relacoesRamos(signo.ramo, dia.ramo);
  const elementos = relacaoElementos(signo.elemento, dia.elemento);
  const nota = Math.max(1, Math.min(5, Math.round(3 + ramos.reduce((s, r) => s + r.peso, 0) + elementos.peso)));
  const tons = new Set(ramos.map((r) => r.tom));
  const tom = tons.has('ruim') && tons.has('bom') ? 'misto' : tons.has('ruim') ? 'atenção' : tons.has('bom') ? 'favorável' : tons.has('misto') ? 'misto' : 'neutro';
  const relAno = relacoesAno(signo.ramo, ano.ramo);
  return { signo, dia, ano, ramos, elementos, nota, tom, relAno };
}

/** Texto pronto quando não há chave da API. */
export function leituraOffline(hz) {
  const geral = hz.ramos.length
    ? hz.ramos.map((r) => r.texto).join(' ')
    : `O ${hz.dia.animal} do dia não tem relação forte com o seu ${hz.signo.animal}: dia neutro, que fica com a cara do que você fizer dele.`;
  const foco = {
    'favorável': 'Aproveite o vento a favor para o hábito que você mais vem adiando.',
    'atenção': 'Proteja o básico: faça primeiro os hábitos mais fáceis e garanta a ofensiva cedo.',
    misto: 'Comece pelo que já está no automático e deixe as decisões grandes para amanhã.',
    neutro: 'Dia bom para rotina: constância vale mais do que intensidade hoje.',
  }[hz.tom];
  return { geral, foco, corpo: hz.elementos.texto, conselho: `Como ${hz.signo.animal} (${hz.signo.tracos[0]} e ${hz.signo.tracos[1]}), use isso a seu favor hoje.` };
}
