# mio-bling-mcp

Servidor MCP para **devolução de NF-e no Bling da Mio Peças**, para usar como conector personalizado no claude.ai.

- Sem dependências: Node 22, um arquivo (`server.js`).
- MCP via Streamable HTTP (JSON-RPC, respostas JSON).
- OAuth do Bling com JWT e renovação automática; tokens no volume `/data`.
- Trava de CNPJ: só opera na conta da Mio (`EXPECTED_CNPJ`).
- Log de auditoria de toda escrita em `/data/auditoria.log`.

## Ferramentas

| Ferramenta | O que faz | Escreve? |
|---|---|---|
| `buscar_nota` | Acha a NF-e pelo número ou id e mostra itens, cliente e chave | Não |
| `listar_naturezas_operacao` | Lista as naturezas, para achar a "Devolução de venda" | Não |
| `preparar_devolucao` | `modo=previa`: monta e mostra a devolução sem gravar. `modo=criar`: grava como rascunho | Rascunho |
| `transmitir_nota` | Envia o rascunho à SEFAZ. Exige repetir o número da nota em `confirmacao` | **Sim, irreversível** |
| `lancar_estoque_nota` | Lança a entrada da devolução no estoque | Sim |

Validações de `preparar_devolucao`: a nota original precisa ser de saída e autorizada, ter chave de acesso, e cada item devolvido precisa existir na original com quantidade menor ou igual. Sem `itens`, faz devolução total.

A devolução sai como **entrada (tipo 0), finalidade 4**, com o mesmo cliente, os valores unitários da original, a nota referenciada no cabeçalho e por item (NT 2025.002-RTC). Tributação e CFOP vêm da **natureza de operação** escolhida no Bling.

## Endpoints

| Rota | Uso |
|---|---|
| `POST /mcp/<MCP_SECRET>` | Endpoint MCP (também aceita `Authorization: Bearer <MCP_SECRET>` em `/mcp`) |
| `GET /oauth/start?key=<MCP_SECRET>` | Inicia a autorização no Bling |
| `GET /oauth/callback` | Retorno do Bling |
| `GET /health` | Status |

## Deploy na Hostinger (sem SSH)

1. Cria o projeto Docker **`mio-bling-mcp`** com o conteúdo de `deploy/hostinger.yml` (cabe no limite de 8 KB da Hostinger) e as variáveis do `.env.example`. A imagem é construída direto deste repositório, então o VPS precisa conseguir ler o repositório.
2. (Alternativa para Compose 2.23+ sem esse limite: `node scripts/gerar-compose.js` gera `deploy/docker-compose.yml` com o código embutido.)
3. Abre `https://<PUBLIC_HOST>/oauth/start?key=<MCP_SECRET>` e autoriza no Bling da Mio.
4. No claude.ai: Configurações → Conectores → Adicionar conector personalizado → `https://<PUBLIC_HOST>/mcp/<MCP_SECRET>`.

O projeto usa rede e volumes próprios e ocupa as portas 80 e 443. Não altera nenhum outro projeto do VPS.

## Deploy com o repositório clonado

```bash
cp .env.example .env   # preencher
docker compose up -d --build
```

## Pendências antes de usar em produção

- Validar com a contabilidade a natureza de operação de devolução (CFOP 1.202/2.202, CSOSN do Simples).
- Primeira devolução real: criar o rascunho, conferir no Bling e só então transmitir.
- Devoluções do ML Full que a integração já gera sozinha **não** devem passar por aqui (risco de nota duplicada).
