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

let cache = null; // { rev, estado }
async function carregarEstado() {
  if (!cache) cache = await lerJSON(ARQ_ESTADO, { rev: 0, estado: null });
  return cache;
}

const hojeLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

async function backupDiario() {
  const alvo = path.join(PASTA_BACKUP, `estado-${hojeLocal()}.json`);
  try {
    await fs.access(alvo);
    return; // já tem o de hoje
  } catch {}
  try {
    await fs.mkdir(PASTA_BACKUP, { recursive: true });
    await fs.copyFile(ARQ_ESTADO, alvo);
    const antigos = (await fs.readdir(PASTA_BACKUP)).filter((f) => f.startsWith('estado-')).sort();
    for (const f of antigos.slice(0, -21)) await fs.unlink(path.join(PASTA_BACKUP, f));
  } catch {
    /* primeiro uso: ainda não existe estado.json */
  }
}

let fila = Promise.resolve();
function salvarEstado(revCliente, estado) {
  // serializa gravações para nunca intercalar duas
  const tarefa = fila.then(async () => {
    const atual = await carregarEstado();
    if (typeof revCliente === 'number' && revCliente !== atual.rev) {
      return { conflito: true, ...atual };
    }
    await backupDiario();
    const novo = { rev: atual.rev + 1, estado };
    await gravarAtomico(ARQ_ESTADO, JSON.stringify(novo));
    cache = novo;
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
      const r = await salvarEstado(corpo.forcar ? undefined : corpo.rev, corpo.estado);
      if (r.conflito) return responderJSON(res, 409, { rev: r.rev, estado: r.estado });
      return responderJSON(res, 200, { rev: r.rev });
    }
    if (rota === '/api/claudinho' && req.method === 'POST') {
      const corpo = await lerCorpo(req, 256 * 1024);
      return responderJSON(res, 200, await falarComClaudinho(corpo));
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

servidor.listen(PORTA, HOST, () => {
  console.log(`\n  🔥 Ofensiva rodando em http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORTA}`);
  console.log(`     dados em ${DADOS}`);
  console.log(`     Claudinho: ${process.env.ANTHROPIC_API_KEY ? 'chave no .env' : 'configure a chave em Ajustes (opcional)'} · modelo ${MODELO}\n`);
});
