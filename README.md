# Mio Peça — loja própria

E-commerce da Mio Peça (CNPJ 61.102.078/0001-01) com a identidade visual da Dande, integrado ao Bling da Mio.

- `web/`: loja (`index`, `loja`, `produto`, `carrinho`, `pedido`, `politicas`) e painel (`painel.html`). HTML, CSS e JS puros, servidos por nginx.
- `api/server.js`: API em Node 22 sem dependências, banco SQLite embutido (`node:sqlite`) no volume `mio-loja-data`.
- `deploy/docker-compose.yml`: gerado por `scripts/build-compose.mjs`, com o código embutido. O VPS só baixa as imagens oficiais `node` e `nginx`.

## Como funciona

| Parte | O que faz |
|---|---|
| Catálogo | Sincroniza produtos ativos do Bling a cada 20 min (preço, estoque) e relê fotos e descrições dos novos. Fotos são baixadas e servidas pela loja, porque os links do Bling expiram. Completa às 3h. |
| Curadoria | Nada vai ao ar sozinho. No painel, cada produto é ligado manualmente. Bloqueia publicar com preço zerado, sem foto, sem descrição ou abaixo do custo. Produto que deixa de passar sai do ar na próxima sincronização. |
| Carrinho | Preço e estoque sempre conferidos no servidor. |
| Frete | Retirada grátis na loja · Entrega em SJC (valor fixo, `FRETE_LOCAL_VALOR`) · Correios e transportadoras via Melhor Envio se `MELHOR_ENVIO_TOKEN` estiver configurado. |
| Pagamento | Mercado Pago Checkout Pro (Pix, cartão, boleto). O status é sempre confirmado na API do MP, nunca pela URL. Sem token, o pedido fica registrado e o pagamento é combinado no WhatsApp. |
| Bling | Pedido pago vira pedido de venda no Bling (cliente buscado ou criado pelo CPF). Padrão: manual, botão no painel. `BLING_PEDIDO_AUTO=true` liga o automático. Trava de CNPJ: só opera na conta da Mio. |

## Variáveis (Docker Manager da Hostinger)

| Variável | Obrigatória | Para quê |
|---|---|---|
| `ADMIN_PASSWORD` | sim | Senha do painel |
| `SESSION_SECRET` | sim | Assina o cookie do painel (texto aleatório longo) |
| `PUBLIC_URL` | não | Padrão `http://srv1830184.hstgr.cloud:3200`. Mudar quando houver domínio |
| `BLING_CLIENT_ID` / `BLING_CLIENT_SECRET` | para integrar | App próprio no Bling (não reaproveite o do mio-bling-mcp: o refresh token do Bling é rotativo e um derrubaria o outro) |
| `MP_ACCESS_TOKEN` | para cobrar | Credencial de produção do Mercado Pago da Mio |
| `MELHOR_ENVIO_TOKEN` | não | Liga frete Correios/transportadoras para fora de SJC |
| `FRETE_LOCAL_VALOR` | não | Padrão 15 |
| `ORIGEM_CEP` | não | CEP de origem do envio. Padrão 12233000, confirmar o CEP da Av. Andrômeda, 3358 |
| `BLING_LOJA_ID` | não | ID do canal "loja própria" no Bling, para separar as vendas nos relatórios |
| `BLING_PEDIDO_AUTO` | não | `true` para criar o pedido no Bling sozinho ao confirmar o pagamento |
| `COOKIE_SECURE` | não | `true` quando houver HTTPS |

## Conectar o Bling

1. No Bling da Mio: Central de extensões → Área do integrador → criar aplicativo. URL de redirecionamento: `<PUBLIC_URL>/oauth/callback`. Escopos: produtos, estoques, contatos, pedidos de venda, dados da empresa.
2. Pôr `BLING_CLIENT_ID` e `BLING_CLIENT_SECRET` no projeto e reiniciar.
3. Painel → Visão geral → Conectar Bling.

## Deploy

```bash
node scripts/build-compose.mjs   # gera deploy/docker-compose.yml
git commit -am "..." && git push
```

No VPS, o projeto Docker `mio-loja` usa a URL raw de `deploy/docker-compose.yml`. Porta 3200. Não mexe nos projetos `gabi-fisio` (3100), `mio-bling-mcp` (80/443) e `bot-portaria`.

## Rodar localmente

```bash
cd api && ADMIN_PASSWORD=teste SESSION_SECRET=x PORT=3001 node server.js
# sirva web/ encaminhando /api, /img e /oauth para a porta 3001
```

## Pendências antes de vender

- Domínio com HTTPS (o Mercado Pago só manda notificação e faz retorno automático com HTTPS). Dá para servir pelo Caddy do mio-bling-mcp.
- Credenciais: app do Bling, Mercado Pago de produção, Melhor Envio.
- Custo zerado no Bling: sem custo não há como validar margem.
- Revisar as políticas (`web/politicas.html`) e o valor do frete local.
- Logo oficial da Mio, se houver (hoje é um logotipo provisório em `web/logo.svg`).
