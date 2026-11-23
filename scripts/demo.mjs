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
const escolhidas = ['agua', 'passos', 'idioma', 'estudo', 'treino', 'leitura', 'sono', 'projeto'];
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
      for (const m of h.metricas) v[m.id] = Math.round(m.meta * Math.min(1.15, 0.3 + rnd() * animo * 1.2) * (m.decimal ? 2 : 1)) / (m.decimal ? 2 : 1);
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

const estado = {
  versao: 1,
  perfil: { nome: '', limiar: 0.7, som: true, claudinho: true },
  habitos,
  dias,
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
