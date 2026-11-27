// Gera deploy/docker-compose.yml com o código embutido (configs.content).
// A VPS não precisa clonar o repositório nem fazer build: só imagens oficiais node e nginx.
// Uso: node scripts/build-compose.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const WEB_FILES = readdirSync(join(root, 'web')).filter((f) => /\.(html|css|js|svg)$/.test(f));
const HOST_PORT = process.env.HOST_PORT || '3200';

let commit = 'local';
try { commit = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim(); } catch {}

// JSON é escalar válido em YAML; "$" vira "$$" para o Compose não interpolar.
const yamlStr = (s) => JSON.stringify(s).replace(/\$/g, '$$$$');
const cfgName = (f) => 'web_' + f.replace(/[^a-z0-9]/gi, '_');

const configs = {
  api_server: readFileSync(join(root, 'api/server.js'), 'utf8'),
  nginx_conf: readFileSync(join(root, 'web/nginx.conf'), 'utf8'),
};
// Carimba JS e CSS com o hash do conteúdo: arquivo novo = URL nova.
const ver = (f) => createHash('sha256').update(readFileSync(join(root, 'web', f))).digest('hex').slice(0, 8);
const stamp = (html) => html.replace(/(src|href)="\/?([a-z-]+\.(?:css|js))"/g, (m, attr, f) => (WEB_FILES.includes(f) ? `${attr}="/${f}?v=${ver(f)}"` : m));
for (const f of WEB_FILES) {
  const body = readFileSync(join(root, 'web', f), 'utf8');
  configs[cfgName(f)] = f.endsWith('.html') ? stamp(body) : body;
}
const webMounts = WEB_FILES.map((f) => `      - source: ${cfgName(f)}\n        target: /usr/share/nginx/html/${f}`).join('\n');

const yml = `# Gerado por scripts/build-compose.mjs. Não edite à mão.
name: mio-loja

services:
  api:
    image: node:22-alpine
    restart: unless-stopped
    command: ["node", "--no-warnings", "/app/server.js"]
    environment:
      PORT: "3000"
      DATA_DIR: /data
      PUBLIC_URL: \${PUBLIC_URL:-http://srv1830184.hstgr.cloud:${HOST_PORT}}
      ADMIN_PASSWORD: \${ADMIN_PASSWORD}
      SESSION_SECRET: \${SESSION_SECRET}
      COOKIE_SECURE: \${COOKIE_SECURE:-false}
      BLING_CLIENT_ID: \${BLING_CLIENT_ID:-}
      BLING_CLIENT_SECRET: \${BLING_CLIENT_SECRET:-}
      BLING_LOJA_ID: \${BLING_LOJA_ID:-}
      BLING_PEDIDO_AUTO: \${BLING_PEDIDO_AUTO:-false}
      BLING_SYNC_MIN: \${BLING_SYNC_MIN:-20}
      EXPECTED_CNPJ: "61102078000101"
      MP_ACCESS_TOKEN: \${MP_ACCESS_TOKEN:-}
      ORIGEM_CEP: \${ORIGEM_CEP:-12233000}
      FRETE_LOCAL_VALOR: \${FRETE_LOCAL_VALOR:-15}
      MELHOR_ENVIO_TOKEN: \${MELHOR_ENVIO_TOKEN:-}
      TZ: America/Sao_Paulo
    labels:
      mio.commit: "${commit}"
    configs:
      - source: api_server
        target: /app/server.js
    volumes:
      - mio-loja-data:/data
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
    networks: [mionet]
    mem_limit: 256m

  web:
    image: nginx:1.27-alpine
    restart: unless-stopped
    depends_on: [api]
    ports:
      - "${HOST_PORT}:80"
    labels:
      mio.commit: "${commit}"
    configs:
      - source: nginx_conf
        target: /etc/nginx/conf.d/default.conf
${webMounts}
    networks: [mionet]
    mem_limit: 64m

volumes:
  mio-loja-data:

networks:
  mionet:

configs:
${Object.entries(configs).map(([k, v]) => `  ${k}:\n    content: ${yamlStr(v)}`).join('\n')}
`;

mkdirSync(join(root, 'deploy'), { recursive: true });
writeFileSync(join(root, 'deploy/docker-compose.yml'), yml);
console.log(`deploy/docker-compose.yml gerado (${(yml.length / 1024).toFixed(1)} KB, commit ${commit}, ${WEB_FILES.length} arquivos web)`);
