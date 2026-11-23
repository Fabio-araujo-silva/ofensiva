// Temas visuais do modo foco: cada matéria ganha uma estética (escolhida pelo nome ou manualmente).

export const TEMAS = {
  padrao: {
    id: 'padrao', nome: 'Tomate 🍅', marca: '🍅',
    cores: { foco: ['#ff6b57', '#ffb36b'], curta: ['#3fcfae', '#a3eedc'], longa: ['#8b93ff', '#d0b8ff'], livre: ['#f6c98b', '#ffe7b8'] },
    titulos: { foco: 'Foco', curta: 'Pausa', longa: 'Pausa longa', livre: 'Livre' },
    simbolos: ['🍅', '·', '•', '✦'],
    som: 'sino',
  },
  china: {
    id: 'china', nome: 'Chinês 中文', marca: '🏮',
    cores: { foco: ['#e0352b', '#f5c249'], curta: ['#c9a227', '#f3dc8a'], longa: ['#b8322f', '#f0b8a0'], livre: ['#e0352b', '#f5c249'] },
    titulos: { foco: '专注', curta: '休息', longa: '长休息', livre: '自由' },
    legendas: { foco: 'zhuānzhù · foco', curta: 'xiūxi · pausa', longa: 'cháng xiūxi · pausa longa', livre: 'zìyóu · livre' },
    simbolos: ['学', '习', '静', '心', '志', '勤', '恒', '道', '书', '文', '字', '汉', '福', '龙', '明', '思'],
    mostrador: ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'],
    marcaGrande: '學',
    som: 'pentatonica',
  },
  matematica: {
    id: 'matematica', nome: 'Matemática ∑', marca: '∎',
    cores: { foco: ['#5fb3ff', '#b8e1ff'], curta: ['#7be0b0', '#d0f5e2'], longa: ['#c49bff', '#e8d6ff'], livre: ['#5fb3ff', '#b8e1ff'] },
    titulos: { foco: 'Foco', curta: 'Pausa', longa: 'Pausa longa', livre: 'Livre' },
    legendas: { foco: 'lim tempo→0 da distração', curta: 'Δt de descanso', longa: '∑ das pausas', livre: '∫ estudo dt' },
    simbolos: ['∑', '∫', 'π', '∞', '∂', '√', '≈', 'θ', 'λ', '∀', '∃', 'ℝ', 'ℕ', '∈', '⊂', 'f(x)', 'Δ', 'e^{iπ}', 'n!', '∧', '∨', '¬', 'mod', '≡'],
    marcaGrande: '∑',
    som: 'arpejo',
  },
  codigo: {
    id: 'codigo', nome: 'Código / IA ⌘', marca: '▣',
    cores: { foco: ['#3ef08a', '#b5ffd2'], curta: ['#3fd0ff', '#b8f0ff'], longa: ['#b98cff', '#e3d1ff'], livre: ['#3ef08a', '#b5ffd2'] },
    titulos: { foco: 'focar()', curta: 'pausa()', longa: 'pausa_longa()', livre: 'livre()' },
    legendas: { foco: 'while (focado) aprender();', curta: 'sleep(5 * 60)', longa: 'await descanso()', livre: 'tempo++' },
    simbolos: ['{ }', '=>', '01', '10', 'λ', 'if', 'def', '[]', '</>', '∇', 'σ(x)', 'argmax', '&&', '++', '0x1F', 'tensor', 'Q(s,a)', '#', 'fn', '::'],
    marcaGrande: '</>',
    som: 'bip',
  },
  bio: {
    id: 'bio', nome: 'Bio / DNA 🧬', marca: '🧬',
    cores: { foco: ['#2fd3a7', '#c6f7a8'], curta: ['#59c3ff', '#c8ecff'], longa: ['#a78bfa', '#e9d5ff'], livre: ['#2fd3a7', '#c6f7a8'] },
    titulos: { foco: 'Foco', curta: 'Pausa', longa: 'Pausa longa', livre: 'Livre' },
    legendas: { foco: 'replicando conhecimento', curta: 'transcrição em pausa', longa: 'mitose do descanso', livre: 'sequenciando' },
    simbolos: ['A', 'T', 'C', 'G', 'U', '🧬', 'ATG', 'GC', '⌬', 'BLAST', 'k-mer', '>seq'],
    marcaGrande: '🧬',
    som: 'sino',
  },
  visual: {
    id: 'visual', nome: 'Visualização 📊', marca: '◆',
    cores: { foco: ['#ff5fa2', '#ffd36b'], curta: ['#4fd1c5', '#a7f3d0'], longa: ['#7c83ff', '#f0abfc'], livre: ['#ff5fa2', '#ffd36b'] },
    titulos: { foco: 'Foco', curta: 'Pausa', longa: 'Pausa longa', livre: 'Livre' },
    legendas: { foco: 'renderizando ideias', curta: 'reduzindo a opacidade', longa: 'repintando a tela', livre: 'plotando' },
    simbolos: ['▁', '▃', '▅', '▇', '●', '◆', '▲', '■', '◐', '⬢', '📈', 'RGB', 'xy', '∿'],
    marcaGrande: '◐',
    som: 'arpejo',
  },
};

const REGRAS = [
  [/chin|hsk|mandarim|hanzi|pinyin|中|汉|漢/i, 'china'],
  [/matem|c[aá]lculo|discreta|[aá]lgebra|estat|geometr|f[ií]sica|sma\d|prob/i, 'matematica'],
  [/biol|bio|gen[ée]t|dna|qu[ií]m/i, 'bio'],
  [/visual|design|arte|desenho|gr[aá]fic/i, 'visual'],
  [/intelig|\bia\b|\bai\b|comput|program|c[oó]digo|algoritm|dados|scc\d|machine|redes/i, 'codigo'],
];

/** Tema de uma matéria: o escolhido nela, ou o palpite pelo nome, ou o padrão. */
export function temaDe(mat) {
  if (mat?.tema && TEMAS[mat.tema]) return TEMAS[mat.tema];
  const nome = mat?.nome || '';
  for (const [re, id] of REGRAS) if (re.test(nome)) return TEMAS[id];
  return TEMAS.padrao;
}

/** Partículas estáveis entre redesenhos (posição determinística por índice). */
export function particulas(tema, qtd = 22) {
  const out = [];
  for (let i = 0; i < qtd; i++) {
    const r = (n) => ((Math.sin((i + 1) * 9301 + n * 49297) + 1) / 2) % 1;
    out.push({
      txt: tema.simbolos[i % tema.simbolos.length],
      x: Math.round(r(1) * 96 + 2),
      tam: Math.round(14 + r(2) * 30),
      dur: Math.round(18 + r(3) * 26),
      atraso: -Math.round(r(4) * 40),
      giro: Math.round((r(5) - 0.5) * 40),
      alfa: (0.1 + r(6) * 0.22).toFixed(2),
    });
  }
  return out;
}
