// Gera deploy/docker-compose.yml com server.js e Caddyfile embutidos (configs.content),
// para subir pelo gerenciador Docker da Hostinger sem precisar de build nem de acesso ao repositório.
// Requer Docker Compose 2.23+ no VPS.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const indent = (txt, n) =>
  txt
    .replace(/\t/g, '    ')
    .replace(/\$/g, '$$$$') // escapa $ para o Compose não interpolar
    .split('\n')
    .map((l) => (l.length ? ' '.repeat(n) + l : ''))
    .join('\n');

const server = fs.readFileSync(path.join(raiz, 'server.js'), 'utf8');
const caddy = fs.readFileSync(path.join(raiz, 'Caddyfile'), 'utf8');

const yml = `# GERADO por scripts/gerar-compose.js — não edite à mão.
# Projeto isolado: rede e volumes próprios, sem relação com o bot-portaria.
# Variáveis (definidas no "environment" do projeto na Hostinger):
#   PUBLIC_HOST, MCP_SECRET, BLING_CLIENT_ID, BLING_CLIENT_SECRET, EXPECTED_CNPJ
name: mio-bling-mcp

services:
  mcp:
    image: node:22-alpine
    restart: unless-stopped
    working_dir: /app
    command: ["node", "/app/server.js"]
    environment:
      PORT: "3000"
      DATA_DIR: /data
      PUBLIC_URL: https://\${PUBLIC_HOST}
      MCP_SECRET: \${MCP_SECRET}
      BLING_CLIENT_ID: \${BLING_CLIENT_ID}
      BLING_CLIENT_SECRET: \${BLING_CLIENT_SECRET}
      EXPECTED_CNPJ: \${EXPECTED_CNPJ}
    configs:
      - source: server_js
        target: /app/server.js
    volumes:
      - mcp-data:/data
    networks: [mcpnet]
    mem_limit: 256m
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/health"]
      interval: 30s
      timeout: 5s

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    depends_on: [mcp]
    environment:
      PUBLIC_HOST: \${PUBLIC_HOST}
    ports:
      - "80:80"
      - "443:443"
    configs:
      - source: caddyfile
        target: /etc/caddy/Caddyfile
    volumes:
      - caddy-data:/data
      - caddy-config:/config
    networks: [mcpnet]
    mem_limit: 128m

configs:
  server_js:
    content: |
${indent(server, 6)}
  caddyfile:
    content: |
${indent(caddy, 6)}

volumes:
  mcp-data:
  caddy-data:
  caddy-config:

networks:
  mcpnet:
`;

fs.mkdirSync(path.join(raiz, 'deploy'), { recursive: true });
fs.writeFileSync(path.join(raiz, 'deploy', 'docker-compose.yml'), yml);
console.log('deploy/docker-compose.yml gerado (' + yml.length + ' bytes)');
