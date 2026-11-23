// npm run demo — sobe o app com ~10 meses de dados inventados numa pasta separada (dados-demo/),
// sem tocar nos seus dados de verdade. Bom para ver como fica o mapa de calor.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUGESTOES } from '../public/js/sugestoes.js';
import { instanciar } from '../public/js/habitos.js';
import { hojeISO, somaDias } from '../public/js/util.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pasta = path.join(raiz, 'dados-demo');
fs.mkdirSync(pasta, { recursive: true });

const hoje = hojeISO();
const inicio = somaDias(hoje, -320);
const escolhidas = ['agua', 'passos', 'idioma', 'estudo', 'treino', 'leitura', 'sono', 'projeto', 'dieta'];
const habitos = escolhidas.map((id) => instanciar(SUGESTOES.find((s) => s.sugestaoId === id), inicio));

let semente = 42;
const rnd = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
const dias = {};
for (let d = inicio, i = 0; d < hoje; d = somaDias(d, 1), i++) {
  const animo = 0.55 + 0.4 * Math.sin(i / 23) * 0.5 + rnd() * 0.35; // fases boas e ruins
  const dia = {};
  for (const h of habitos) {
    if (rnd() > animo + 0.15) continue;
    if (h.tipo === 'numero') {
      const v = {};
      for (const m of h.metricas) v[m.id] = m.limite ? Math.round(m.meta * (0.8 + rnd() * (1.5 - animo * 0.5)) / 10) * 10 : Math.round(m.meta * Math.min(1.15, 0.3 + rnd() * animo * 1.2) * (m.decimal ? 2 : 1)) / (m.decimal ? 2 : 1);
      if (h.metricas.length > 1 && rnd() < 0.5) v[h.metricas[1].id] = 0;
      dia[h.id] = v;
    } else if (h.tipo === 'checklist') {
      const v = {};
      for (const it of h.itens) if (rnd() < animo) v[it.id] = true;
      dia[h.id] = v;
    } else if (h.tipo === 'simnao') {
      dia[h.id] = i % 7 === 6 ? { descanso: true } : rnd() < animo + 0.1 ? { feito: true } : {};
    } else {
      dia[h.id] = { nivel: rnd() < animo ? (rnd() < 0.5 ? 2 : 1) : 0 };
    }
  }
  dias[d] = dia;
}

// matérias com assuntos e subtópicos + sessões de pomodoro
const mid = (n) => 'mt' + n;
const sub = (nomes, vistos) => nomes.map((nome, i) => ({ id: `st${nome.length}${i}${vistos}`, nome, visto: i < vistos }));
const materias = [
  { id: mid(1), nome: 'Cálculo I', cor: '#8ec5f5', assuntos: [
    { id: 'as1', nome: 'Limites', subtopicos: sub(['Definição intuitiva', 'Limites laterais', 'Limites no infinito', 'Teorema do confronto'], 4) },
    { id: 'as2', nome: 'Derivadas', subtopicos: sub(['Definição', 'Regra da cadeia', 'Derivada implícita', 'Taxas relacionadas', 'L\'Hôpital'], 2) },
    { id: 'as3', nome: 'Integrais', subtopicos: sub(['Integral definida', 'TFC', 'Substituição', 'Por partes'], 0) },
  ] },
  { id: mid(2), nome: 'Mandarim (HSK 3)', cor: '#ff8a7a', assuntos: [
    { id: 'as4', nome: 'Gramática', subtopicos: sub(['把 字句', '被 字句', 'Complemento de resultado', 'Complemento direcional'], 2) },
    { id: 'as5', nome: 'Vocabulário', subtopicos: sub(['Lições 1–5', 'Lições 6–10', 'Lições 11–15'], 1) },
  ] },
  { id: mid(3), nome: 'Programação', cor: '#a6dd8f', assuntos: [{ id: 'as6', nome: 'Estruturas de dados', subtopicos: sub(['Listas', 'Pilhas e filas', 'Árvores', 'Grafos'], 3) }] },
  { id: mid(4), nome: 'Biologia Celular', cor: '#86d0c5', assuntos: [] },
];
const sessoes = [];
for (let i = 0, d = somaDias(hoje, -13); d <= hoje; d = somaDias(d, 1), i++) {
  const n = Math.floor(rnd() * 5);
  for (let k = 0; k < n; k++) {
    const m = materias[Math.floor(rnd() * materias.length)];
    const inicio = new Date(`${d}T${String(8 + k * 2).padStart(2, '0')}:15:00`).getTime();
    sessoes.push({ id: `p${i}${k}`, dia: d, tag: m.id, assunto: null, minutos: 25, inicio, fim: inicio + 25 * 60000, tipo: 'pomodoro' });
  }
}
const seg = somaDias(hoje, -((new Date().getDay() + 6) % 7));
const semanais = [
  { id: 's1', texto: 'Entregar lista 3 de Cálculo', feito: false, semana: seg, acumular: false, adiada: 1, criado: 1 },
  { id: 's2', texto: 'Revisar slides de Programação', feito: false, semana: seg, acumular: true, adiada: 0, criado: 2 },
  { id: 's3', texto: 'Simulado HSK 3', feito: true, semana: seg, acumular: false, adiada: 0, criado: 3 },
  { id: 's4', texto: 'Marcar médico', feito: false, semana: seg, acumular: false, adiada: 0, criado: 4 },
];

const estado = {
  versao: 1,
  perfil: { nome: '', limiar: 0.7, som: true, claudinho: true, nascimento: '1998-08-15' },
  habitos,
  dias,
  materias,
  sessoes,
  semanais,
  pomodoro: { config: {}, timer: null, ciclo: 2, cicloDia: hoje, proxima: 'foco', tag: mid(2), assunto: 'as4' },
  todos: [
    { id: 'ta', texto: 'Mandar o relatório', feito: false, dia: hoje, manter: true, adiado: 1, criado: Date.now() - 1000 },
    { id: 'tb', texto: 'Comprar café', feito: true, dia: hoje, manter: false, adiado: 0, criado: Date.now() - 500 },
    { id: 'tc', texto: 'Ligar pro dentista', feito: false, dia: hoje, manter: false, adiado: 0, criado: Date.now() },
  ],
  onboardingFeito: true,
  cronometro: null,
};
fs.writeFileSync(path.join(pasta, 'estado.json'), JSON.stringify({ rev: 1, estado }));
console.log(`dados de demonstração em ${pasta}`);

process.env.OFENSIVA_DADOS = 'dados-demo';
process.env.PORTA ||= '4849';
await import('../server.js');
