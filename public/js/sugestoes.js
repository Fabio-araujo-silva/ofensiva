// Sugestões do onboarding: pontos de partida básicos, que cada pessoa ajusta.
// Cada uma vira um hábito novo (com ids próprios) via instanciar().

export const SUGESTOES = [
  {
    sugestaoId: 'agua', nome: 'Beber água', emoji: '💧', cor: '#8ec5f5', tipo: 'numero',
    descricao: 'Registre copos ao longo do dia.',
    combinar: 'max',
    metricas: [{ id: 'ml', nome: 'Água', meta: 2000, unidade: 'ml', passos: [250, 500] }],
  },
  {
    sugestaoId: 'passos', nome: 'Caminhar', emoji: '👟', cor: '#86d0c5', tipo: 'numero',
    descricao: 'Passos do dia (copie do celular/relógio).',
    combinar: 'max',
    metricas: [{ id: 'passos', nome: 'Passos', meta: 8000, unidade: 'passos', passos: [1000, 5000] }],
  },
  {
    sugestaoId: 'estudo', nome: 'Estudar', emoji: '📚', cor: '#b3b3ec', tipo: 'numero',
    descricao: 'Minutos de estudo, com cronômetro.',
    combinar: 'max',
    metricas: [{ id: 'min', nome: 'Estudo', meta: 120, unidade: 'min', passos: [15, 30, 60], cronometro: true }],
  },
  {
    sugestaoId: 'treino', nome: 'Treinar', emoji: '🏋️', cor: '#f6c98b', tipo: 'simnao',
    descricao: 'Academia, corrida, esporte. Dia de descanso não quebra a ofensiva.',
    permiteDescanso: true, tags: [],
  },
  {
    sugestaoId: 'leitura', nome: 'Ler', emoji: '📖', cor: '#f4a3b0', tipo: 'numero',
    descricao: 'Páginas lidas ou minutos de audiobook — qualquer um conta.',
    combinar: 'max',
    metricas: [
      { id: 'pag', nome: 'Páginas', meta: 10, unidade: 'pág', passos: [1, 5] },
      { id: 'audio', nome: 'Audiobook', meta: 15, unidade: 'min', passos: [5, 10] },
    ],
  },
  {
    sugestaoId: 'sono', nome: 'Dormir bem', emoji: '😴', cor: '#9fd8f0', tipo: 'numero',
    descricao: 'Horas dormidas na noite anterior.',
    combinar: 'max',
    metricas: [{ id: 'h', nome: 'Sono', meta: 8, unidade: 'h', passos: [0.5, 1], decimal: true, dica: 'registre a noite que terminou hoje de manhã' }],
  },
  {
    sugestaoId: 'meditar', nome: 'Meditar', emoji: '🧘', cor: '#d6a6e6', tipo: 'numero',
    descricao: 'Alguns minutos de respiração ou meditação.',
    combinar: 'max',
    metricas: [{ id: 'min', nome: 'Meditação', meta: 10, unidade: 'min', passos: [5, 10], cronometro: true }],
  },
  {
    sugestaoId: 'idioma', nome: 'Idioma', emoji: '🗣️', cor: '#ef8a8a', tipo: 'checklist',
    descricao: 'Várias frentes no mesmo gráfico — quanto mais fizer, mais colorido.',
    itens: [{ nome: 'App de idioma' }, { nome: 'Flashcards' }, { nome: 'Ler ou ouvir no idioma' }],
  },
  {
    sugestaoId: 'projeto', nome: 'Projeto pessoal', emoji: '💻', cor: '#a6dd8f', tipo: 'niveis',
    descricao: 'Aquele projeto paralelo: mexeu um pouco ou entregou algo?',
    niveis: [{ nome: 'Mexi um pouco', valor: 0.5 }, { nome: 'Entreguei algo', valor: 1 }],
    nota: true,
  },
  {
    sugestaoId: 'alimentacao', nome: 'Comer bem', emoji: '🥗', cor: '#c9b79c', tipo: 'checklist',
    descricao: 'Pequenas vitórias na alimentação.',
    itens: [{ nome: 'Fruta' }, { nome: 'Verdura' }, { nome: 'Sem doce' }],
  },
  {
    sugestaoId: 'diario', nome: 'Escrever no diário', emoji: '✍️', cor: '#f7a98b', tipo: 'simnao',
    descricao: 'Algumas linhas sobre o dia.',
    permiteDescanso: false, tags: [],
  },
  {
    sugestaoId: 'alongar', nome: 'Alongar', emoji: '🤸', cor: '#f0dc82', tipo: 'simnao',
    descricao: 'Cinco minutinhos já contam.',
    permiteDescanso: false, tags: [],
  },
];

/** Modelo em branco de cada tipo, para "criar do zero". */
export function modeloVazio(tipo) {
  const base = { nome: '', emoji: '⭐', cor: '#8ec5f5', tipo };
  if (tipo === 'numero') return { ...base, combinar: 'max', metricas: [{ nome: '', meta: 1, unidade: '', passos: [1] }] };
  if (tipo === 'checklist') return { ...base, itens: [{ nome: '' }, { nome: '' }] };
  if (tipo === 'simnao') return { ...base, permiteDescanso: false, tags: [] };
  return { ...base, niveis: [{ nome: 'Um pouco', valor: 0.5 }, { nome: 'Tudo', valor: 1 }], nota: false };
}
