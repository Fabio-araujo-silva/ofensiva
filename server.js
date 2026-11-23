// Servidor local da Ofensiva: arquivos estáticos + estado em JSON + Claudinho (Claude API).
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
try {
  process.loadEnvFile(path.join(RAIZ, '.env'));
} catch {
  /* sem .env: tudo bem */
}

const PORTA = Number(process.env.PORTA || 4848);
const HOST = process.env.HOST || '127.0.0.1';
const DADOS = path.resolve(RAIZ, process.env.OFENSIVA_DADOS || 'dados');
const ARQ_ESTADO = path.join(DADOS, 'estado.json');
const ARQ_SEGREDOS = path.join(DADOS, 'segredos.json');
const PASTA_BACKUP = path.join(DADOS, 'backups');
const MODELO = process.env.CLAUDE_MODELO || 'claude-opus-5-5';
const PUBLICO = path.join(RAIZ, 'public');

const TIPOS_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// ---------- estado ----------

async function lerJSON(arq, padrao) {
  try {
    return JSON.parse(await fs.readFile(arq, 'utf8'));
  } catch {
    return padrao;
  }
}

async function gravarAtomico(arq, conteudo) {
  await fs.mkdir(path.dirname(arq), { recursive: true });
  const tmp = `${arq}.${process.pid}.tmp`;
  await fs.writeFile(tmp, conteudo, 'utf8');
  for (let i = 0; ; i++) {
    try {
      await fs.rename(tmp, arq);
      return;
    } catch (e) {
      if (i >= 4 || (e.code !== 'EPERM' && e.code !== 'EBUSY')) throw e;
      await new Promise((r) => setTimeout(r, 60 * (i + 1)));
    }
  }
}

// ---------- proteção dos dados ----------
// 1) gravação atômica (arquivo temporário + rename)
// 2) backup diário (120 dias) + um backup por mês para sempre
// 3) snapshot "protecao-*" antes de qualquer gravação que DIMINUA os dados
// 4) recusa trocar um estado com dados por um estado vazio
// 5) se estado.json estiver corrompido, separa o arquivo e recupera do backup mais novo
// 6) opcional: OFENSIVA_BACKUP_EXTRA espelha tudo numa segunda pasta (ex.: OneDrive)
const PASTA_EXTRA = process.env.OFENSIVA_BACKUP_EXTRA ? path.resolve(process.env.OFENSIVA_BACKUP_EXTRA) : null;
const DIARIOS_MANTIDOS = 120;
const PROTECOES_MANTIDAS = 300;

const hojeLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const carimbo = () => new Date().toISOString().replace(/[:.]/g, '-');
const existe = (arq) => fs.access(arq).then(() => true, () => false);

function medir(estado) {
  let registros = 0;
  for (const d of Object.values(estado?.dias || {})) registros += Object.keys(d || {}).length;
  return { habitos: (estado?.habitos || []).length, registros };
}

async function podar(pasta, prefixo, manter) {
  const arqs = (await fs.readdir(pasta)).filter((f) => f.startsWith(prefixo)).sort();
  for (const f of arqs.slice(0, Math.max(0, arqs.length - manter))) await fs.unlink(path.join(pasta, f)).catch(() => {});
}

let cache = null; // { rev, estado }
async function carregarEstado() {
  if (cache) return cache;
  if (!(await existe(ARQ_ESTADO))) return (cache = { rev: 0, estado: null });
  try {
    cache = JSON.parse(await fs.readFile(ARQ_ESTADO, 'utf8'));
    return cache;
  } catch (e) {
    // nunca começa "do zero" por cima de um arquivo ilegível
    const separado = path.join(DADOS, `estado.corrompido-${carimbo()}.json`);
    await fs.rename(ARQ_ESTADO, separado).catch(() => {});
    console.error(`[dados] estado.json ilegível (${e.message}); guardado em ${separado}`);
    const backups = (await fs.readdir(PASTA_BACKUP).catch(() => []))
      .filter((f) => /^(estado|protecao|mensal)-/.test(f))
      .map((f) => path.join(PASTA_BACKUP, f));
    const comData = await Promise.all(backups.map(async (f) => ({ f, t: (await fs.stat(f)).mtimeMs })));
    for (const { f } of comData.sort((a, b) => b.t - a.t)) {
      try {
        cache = JSON.parse(await fs.readFile(f, 'utf8'));
        await gravarAtomico(ARQ_ESTADO, JSON.stringify(cache));
        console.error(`[dados] recuperado de ${f}`);
        return cache;
      } catch {}
    }
    throw new Error('estado.json ilegível e nenhum backup válido — nada foi apagado, veja a pasta dados/');
  }
}

let ultimaProtecao = 0;
async function fazerBackups(atual, novoEstado) {
  if (!atual.estado) return;
  const conteudo = JSON.stringify(atual);
  const hoje = hojeLocal();
  const pastas = [PASTA_BACKUP, PASTA_EXTRA && path.join(PASTA_EXTRA, 'backups')].filter(Boolean);
  for (const pasta of pastas) {
    try {
      await fs.mkdir(pasta, { recursive: true });
      const diario = path.join(pasta, `estado-${hoje}.json`);
      if (!(await existe(diario))) {
        await gravarAtomico(diario, conteudo);
        await podar(pasta, 'estado-', DIARIOS_MANTIDOS);
      }
      const mensal = path.join(pasta, `mensal-${hoje.slice(0, 7)}.json`);
      if (!(await existe(mensal))) await gravarAtomico(mensal, conteudo);
    } catch (e) {
      console.error('[backup]', pasta, e.message);
    }
  }
  // diminuiu? guarda uma foto de antes (no máx. 1 a cada 10 min, salvo se a perda for grande)
  const a = medir(atual.estado), n = medir(novoEstado);
  const diminuiu = n.habitos < a.habitos || n.registros < a.registros;
  const grande = n.habitos < a.habitos || a.registros - n.registros >= 5;
  if (diminuiu && (grande || Date.now() - ultimaProtecao > 10 * 60_000)) {
    ultimaProtecao = Date.now();
    for (const pasta of pastas) {
      try {
        await gravarAtomico(path.join(pasta, `protecao-${carimbo()}.json`), conteudo);
        await podar(pasta, 'protecao-', PROTECOES_MANTIDAS);
      } catch (e) {
        console.error('[backup]', e.message);
      }
    }
  }
}

let fila = Promise.resolve();
function salvarEstado(revCliente, estado, forcar = false) {
  // serializa gravações para nunca intercalar duas
  const tarefa = fila.then(async () => {
    const atual = await carregarEstado();
    if (!forcar && typeof revCliente === 'number' && revCliente !== atual.rev) {
      return { conflito: true, ...atual };
    }
    const a = medir(atual.estado), n = medir(estado);
    if (!forcar && n.habitos === 0 && n.registros === 0 && (a.habitos > 0 || a.registros > 0)) {
      return { recusado: true, motivo: 'o app tentou gravar um estado vazio por cima dos seus dados; nada foi alterado' };
    }
    await fazerBackups(atual, estado);
    const novo = { rev: atual.rev + 1, estado };
    const texto = JSON.stringify(novo);
    await gravarAtomico(ARQ_ESTADO, texto);
    cache = novo;
    if (PASTA_EXTRA) gravarAtomico(path.join(PASTA_EXTRA, 'estado.json'), texto).catch((e) => console.error('[espelho]', e.message));
    return { conflito: false, rev: novo.rev };
  });
  fila = tarefa.catch(() => {});
  return tarefa;
}

// ---------- chave da API ----------

async function obterChave() {
  const s = await lerJSON(ARQ_SEGREDOS, {});
  return s.anthropicApiKey || process.env.ANTHROPIC_API_KEY || '';
}

let cliente = null;
let chaveDoCliente = '';
async function clienteClaude() {
  const chave = await obterChave();
  if (!chave) return null;
  if (!cliente || chave !== chaveDoCliente) {
    cliente = new Anthropic({ apiKey: chave, maxRetries: 1, timeout: 45_000 });
    chaveDoCliente = chave;
  }
  return cliente;
}

const SISTEMA = `Você é o Claudinho: um mini Claude que flutua pela tela da Ofensiva, um app pessoal de hábitos com ofensivas no estilo Duolingo.
Seu papel é dar incentivo curto, caloroso e específico para a pessoa cumprir os hábitos dela.

Regras:
- Português do Brasil, tom de amigo animado e leve. Nada de sermão, culpa ou frases de coach genéricas.
- No máximo 2 frases curtas (até ~40 palavras), a não ser que a pessoa peça mais na conversa.
- Use os dados do contexto: cite números reais, o que falta, a ofensiva em jogo. Nunca invente dados.
- Considere o horário: de manhã, ajude a começar; de noite, foque no que ainda dá para fechar; de madrugada, incentive dormir.
- Se tudo já estiver feito, comemore e sugira descansar.
- No máximo 1 emoji. Sem markdown, sem listas.`;

function limparHistorico(historico) {
  const msgs = [];
  for (const m of Array.isArray(historico) ? historico.slice(-8) : []) {
    if ((m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string' && m.content.trim()) {
      msgs.push({ role: m.role, content: m.content.slice(0, 2000) });
    }
  }
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  return msgs;
}

async function falarComClaudinho({ contexto, evento, historico }) {
  const client = await clienteClaude();
  if (!client) return { erro: 'sem-chave' };
  const messages = limparHistorico(historico);
  messages.push({
    role: 'user',
    content: `Contexto do app agora (JSON):\n${JSON.stringify(contexto ?? {}).slice(0, 8000)}\n\n${String(evento || 'Me dá um incentivo.').slice(0, 1500)}`,
  });
  try {
    const resp = await client.beta.messages.create({
      model: MODELO,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: SISTEMA,
      messages,
    });
    if (resp.stop_reason === 'refusal') return { erro: 'recusa' };
    const texto = resp.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    return texto ? { texto } : { erro: 'vazio' };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { erro: 'chave-invalida' };
    if (e instanceof Anthropic.PermissionDeniedError) return { erro: 'sem-permissao' };
    if (e instanceof Anthropic.RateLimitError) return { erro: 'limite' };
    if (e instanceof Anthropic.APIError) {
      console.error('[claudinho] erro da API', e.status, e.message);
      return { erro: 'api' };
    }
    console.error('[claudinho] falha', e?.message);
    return { erro: 'rede' };
  }
}

const SISTEMA_HOROSCOPO = `Você escreve o horóscopo chinês do dia num app pessoal de hábitos, a partir dos fatos tradicionais do calendário 干支 que receber (signo da pessoa, pilar do dia, relações entre os ramos como 六合/三合/冲/刑/害 e a interação dos cinco elementos).

Regras:
- Português do Brasil, tom leve, caloroso e prático. É tradição cultural e diversão, não previsão: nada de promessas, medo ou conselhos médicos/financeiros.
- Baseie-se só nos fatos recebidos; não invente outras regras astrológicas.
- Conecte com os hábitos e tarefas da pessoa quando fizer sentido.
- Responda EXATAMENTE em 4 linhas, sem markdown, cada uma com até 24 palavras:
Geral: ...
Foco: ...
Corpo: ...
Conselho: ...`;

async function escreverHoroscopo({ fatos, contexto }) {
  const client = await clienteClaude();
  if (!client) return { erro: 'sem-chave' };
  try {
    const resp = await client.beta.messages.create({
      model: MODELO,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: SISTEMA_HOROSCOPO,
      messages: [{
        role: 'user',
        content: `Fatos do dia (JSON):\n${JSON.stringify(fatos ?? {}).slice(0, 6000)}\n\nHábitos e tarefas de hoje (JSON):\n${JSON.stringify(contexto ?? {}).slice(0, 4000)}`,
      }],
    });
    if (resp.stop_reason === 'refusal') return { erro: 'recusa' };
    const texto = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    const leitura = {};
    for (const linha of texto.split('\n')) {
      const m = linha.trim().replace(/^\*+|\*+$/g, '').match(/^(Geral|Foco|Corpo|Conselho)\s*:\s*(.+)$/i);
      if (m) leitura[m[1].toLowerCase()] = m[2].replace(/\*+/g, '').trim();
    }
    return leitura.geral ? { leitura } : { erro: 'formato' };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { erro: 'chave-invalida' };
    if (e instanceof Anthropic.RateLimitError) return { erro: 'limite' };
    if (e instanceof Anthropic.APIError) {
      console.error('[horoscopo] erro da API', e.status, e.message);
      return { erro: 'api' };
    }
    return { erro: 'rede' };
  }
}

// ---------- http ----------

function responderJSON(res, status, obj) {
  const corpo = JSON.stringify(obj);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(corpo);
}

function lerCorpo(req, limite = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let tam = 0;
    const partes = [];
    req.on('data', (c) => {
      tam += c.length;
      if (tam > limite) {
        reject(new Error('grande-demais'));
        req.destroy();
      } else partes.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(partes).toString('utf8') || '{}'));
      } catch {
        reject(new Error('json-invalido'));
      }
    });
    req.on('error', reject);
  });
}

async function servirEstatico(req, res, caminho) {
  let rel = decodeURIComponent(caminho);
  if (rel === '/' || rel === '') rel = '/index.html';
  const arq = path.resolve(PUBLICO, '.' + rel);
  if (!arq.startsWith(PUBLICO + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const dados = await fs.readFile(arq);
    res.writeHead(200, {
      'content-type': TIPOS_MIME[path.extname(arq)] || 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    res.end(dados);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('não encontrado');
  }
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const rota = url.pathname;
  try {
    if (rota === '/api/estado' && req.method === 'GET') {
      const { rev, estado } = await carregarEstado();
      return responderJSON(res, 200, { rev, estado, claude: { configurada: !!(await obterChave()), modelo: MODELO } });
    }
    if (rota === '/api/estado' && (req.method === 'PUT' || req.method === 'POST')) {
      const corpo = await lerCorpo(req);
      if (!corpo.estado || typeof corpo.estado !== 'object') return responderJSON(res, 400, { erro: 'estado ausente' });
      const r = await salvarEstado(corpo.rev, corpo.estado, !!corpo.forcar);
      if (r.recusado) return responderJSON(res, 422, { erro: r.motivo });
      if (r.conflito) return responderJSON(res, 409, { rev: r.rev, estado: r.estado });
      return responderJSON(res, 200, { rev: r.rev });
    }
    if (rota === '/api/claudinho' && req.method === 'POST') {
      const corpo = await lerCorpo(req, 256 * 1024);
      return responderJSON(res, 200, await falarComClaudinho(corpo));
    }
    if (rota === '/api/horoscopo' && req.method === 'POST') {
      const corpo = await lerCorpo(req, 256 * 1024);
      return responderJSON(res, 200, await escreverHoroscopo(corpo));
    }
    if (rota === '/api/chave' && req.method === 'POST') {
      const { chave } = await lerCorpo(req, 16 * 1024);
      const s = await lerJSON(ARQ_SEGREDOS, {});
      if (chave && String(chave).trim()) s.anthropicApiKey = String(chave).trim();
      else delete s.anthropicApiKey;
      await gravarAtomico(ARQ_SEGREDOS, JSON.stringify(s, null, 2));
      return responderJSON(res, 200, { configurada: !!(await obterChave()) });
    }
    if (rota.startsWith('/api/')) return responderJSON(res, 404, { erro: 'rota desconhecida' });
    if (req.method !== 'GET' && req.method !== 'HEAD') return res.writeHead(405).end();
    return servirEstatico(req, res, rota);
  } catch (e) {
    console.error('[servidor]', e?.message);
    return responderJSON(res, 500, { erro: e?.message || 'erro' });
  }
});

servidor.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n  A porta ${PORTA} já está em uso — a Ofensiva provavelmente já está aberta: http://localhost:${PORTA}\n`);
    process.exit(1);
  }
  throw e;
});

servidor.listen(PORTA, HOST, () => {
  console.log(`\n  🔥 Ofensiva rodando em http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORTA}`);
  console.log(`     dados em ${DADOS}`);
  if (PASTA_EXTRA) console.log(`     espelho/backup extra em ${PASTA_EXTRA}`);
  console.log(`     Claudinho: ${process.env.ANTHROPIC_API_KEY ? 'chave no .env' : 'configure a chave em Ajustes (opcional)'} · modelo ${MODELO}\n`);
});
