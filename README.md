# 🔥 Ofensiva

Rastreador de hábitos **local**, em tema escuro, com ofensivas no estilo Duolingo e o ano inteiro num mapa de calor: cada hábito tem o seu gráfico, e cada quadradinho fica mais colorido conforme o quanto você cumpriu naquele dia.

![Ofensiva](docs/tela.png)

## O que tem

- **Onboarding**: cada pessoa monta os próprios hábitos. Dá pra partir de sugestões (água, passos, estudo, treino, leitura, sono, meditação, idioma, projeto pessoal…) e ajustar as metas, ou criar do zero.
- **4 tipos de hábito**:
  - **Número com meta**: água em ml, passos, minutos de estudo, horas de sono. Tem botões de `+`, valor exato com um clique e cronômetro opcional. Aceita métricas alternativas (ex.: *ler 2 páginas **ou** ouvir 10 min de audiobook*).
  - **Checklist**: um hábito com várias partes (ex.: idioma = app + flashcards + leitura). Quanto mais você marca, mais colorido fica o dia.
  - **Sim ou não**: com etiquetas opcionais (ex.: Push/Pull/Legs) e **dia de descanso**, que não quebra a ofensiva.
  - **Níveis**: nada / um pouco / tudo, com campo de anotação.
- **Ofensiva estilo Duolingo**: a chama geral (dias em que você fez pelo menos X% do dia; o X você ajusta), a semana com as chamas, recorde, dias perfeitos e a ofensiva de cada hábito.
- **Ano em revisão**: um mapa de calor por hábito, mais um da ofensiva geral. Passe o mouse para ver o detalhe do dia, clique para abrir e editar aquele dia.
- **Tarefas do dia**: elas somem à meia-noite. Só segue para o dia seguinte a tarefa em que você clicar no 📌 (e o 📌 vale por uma virada; no outro dia você decide de novo).
- **Provérbio chinês do dia**: hanzi, pinyin, tradução e uma lição pra levar pra vida. Tem o modo "tentar ler primeiro", que borra o pinyin e a tradução até você clicar.
- **Claudinho**: um mini Claude que passeia pela tela. Ele reage quando você fecha um hábito ou garante a ofensiva, e você pode conversar com ele. Com uma chave da API da Anthropic ele lê o seu dia e responde de forma específica; sem chave, usa frases prontas.

Tudo fica no seu computador, em `dados/estado.json`, com backup diário automático em `dados/backups/`.

## Como rodar

Precisa do [Node.js](https://nodejs.org) 20.12 ou mais novo.

```bash
git clone https://github.com/Fabio-araujo-silva/ofensiva.git
cd ofensiva
npm install
npm start
```

Abra **http://localhost:4848**. No Windows, também dá pra dar dois cliques em `iniciar.bat`.

### Claudinho com a Claude API (opcional)

Cole sua chave em **Ajustes → Claudinho**, ou crie um `.env` a partir do `.env.example`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

A chave fica só na sua máquina e as chamadas saem do servidor local, nunca do navegador. O modelo padrão é o `claude-opus-5-5` (troque com `CLAUDE_MODELO`). Cada fala é curta, então o custo por mensagem é de frações de centavo.

### Ver com dados de exemplo

```bash
npm run demo
```

Sobe em **http://localhost:4849** com uns 10 meses de dados inventados, numa pasta separada (`dados-demo/`). Seus dados de verdade não são tocados.

## Configuração

| Variável | Padrão | Para quê |
|---|---|---|
| `PORTA` | `4848` | porta do servidor |
| `HOST` | `127.0.0.1` | troque para `0.0.0.0` para abrir no celular pela rede local (sem senha!) |
| `OFENSIVA_DADOS` | `dados` | pasta dos dados |
| `ANTHROPIC_API_KEY` | — | chave do Claudinho |
| `CLAUDE_MODELO` | `claude-opus-5-5` | modelo do Claudinho |

## Estrutura

```
server.js            servidor HTTP (estáticos + /api/estado + /api/claudinho)
public/
  index.html, estilo.css
  js/app.js          telas: ofensiva, provérbio, registro, tarefas, ano
  js/habitos.js      modelo: progresso, ofensivas, descrições (sem DOM)
  js/onboarding.js   boas-vindas e escolha dos hábitos
  js/ajustes.js      ajustes e editor de hábito
  js/claudinho.js    o mascote e as falas
  js/proverbios.js   70+ provérbios com pinyin e tradução
  js/sugestoes.js    sugestões do onboarding
scripts/demo.mjs     dados de exemplo
```

## Licença

MIT
