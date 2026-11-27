// Mio Peça — API da loja própria.
// Node 22, sem dependências, banco SQLite embutido (node:sqlite).
// Integra: Bling (catálogo, estoque, pedidos), Mercado Pago (Checkout Pro) e Melhor Envio (frete, opcional).
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------
const env = process.env;
const CFG = {
  port: Number(env.PORT || 3000),
  dataDir: env.DATA_DIR || path.join(__dirname, 'data'),
  publicUrl: (env.PUBLIC_URL || 'http://localhost:3200').replace(/\/$/, ''),
  adminPassword: env.ADMIN_PASSWORD || '',
  sessionSecret: env.SESSION_SECRET || '',
  cookieSecure: env.COOKIE_SECURE === 'true',
  // Bling
  blingClientId: env.BLING_CLIENT_ID || '',
  blingClientSecret: env.BLING_CLIENT_SECRET || '',
  blingApi: 'https://api.bling.com.br/Api/v3',
  blingAuthorize: 'https://www.bling.com.br/Api/v3/oauth/authorize',
  expectedCnpj: (env.EXPECTED_CNPJ || '61102078000101').replace(/\D/g, ''),
  blingLojaId: Number(env.BLING_LOJA_ID || 0) || null,
  blingPedidoAuto: env.BLING_PEDIDO_AUTO === 'true',
  syncMinutos: Math.max(5, Number(env.BLING_SYNC_MIN || 20)),
  // Mercado Pago
  mpToken: env.MP_ACCESS_TOKEN || '',
  // Frete
  origemCep: (env.ORIGEM_CEP || '12233000').replace(/\D/g, ''),
  freteLocalValor: Number(env.FRETE_LOCAL_VALOR || 15),
  freteLocalCeps: (env.FRETE_LOCAL_FAIXA || '12200000-12248999').split('-').map((s) => Number(s.replace(/\D/g, ''))),
  melhorEnvioToken: env.MELHOR_ENVIO_TOKEN || '',
  melhorEnvioEmail: env.MELHOR_ENVIO_EMAIL || 'gerencia@dandecomercial.com.br',
};

if (!CFG.adminPassword || !CFG.sessionSecret) {
  console.warn('[aviso] ADMIN_PASSWORD e SESSION_SECRET não definidos: o painel fica bloqueado.');
}

const IMG_DIR = path.join(CFG.dataDir, 'img');
fs.mkdirSync(IMG_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Identidade visual da Dande: arquivos do site dandecomercial.com.br espelhados
// no volume na primeira execução e servidos em /assets/ (não depende do site antigo).
// ---------------------------------------------------------------------------
const ASSET_DIR = path.join(CFG.dataDir, 'assets');
fs.mkdirSync(ASSET_DIR, { recursive: true });
const DANDE = 'https://dandecomercial.com.br/wp-content';
const ASSETS = {
  'logo-dande.png': `${DANDE}/uploads/2018/08/Logo_Dande_Institucional.png`,
  'logo-dande-negativo.png': `${DANDE}/themes/dande/imagens/Logo_Dande_Negativo.png`,
  'favicon-dande.png': `${DANDE}/uploads/2018/08/cropped-favicon-1-270x270.png`,
  'banner-1.jpg': `${DANDE}/uploads/2018/10/DN_HOME_BannerTopo-2.jpg`,
  'banner-2.jpg': `${DANDE}/uploads/2018/10/DN_HOME_BannerTopo_2-2.jpg`,
  'banner-3.jpg': `${DANDE}/uploads/2018/10/DN_HOME_BannerTopo_3-2.jpg`,
  'banner-4.jpg': `${DANDE}/uploads/2018/10/DN_HOME_BannerTopo_4-2.jpg`,
  'banner-m-1.jpg': `${DANDE}/uploads/2021/02/DN_HOME_BannerTopo_640x640px-1-min.jpg`,
  'banner-m-2.jpg': `${DANDE}/uploads/2021/02/DN_HOME_BannerTopo_2_640x640px-1-min.jpg`,
  'banner-m-3.jpg': `${DANDE}/uploads/2018/10/DN_HOME_BannerTopo_3_640x640px-1.jpg`,
  'banner-m-4.jpg': `${DANDE}/uploads/2018/10/DN_HOME_BannerTopo_4_640x640px-1.jpg`,
  'supergraphic.jpg': `${DANDE}/uploads/2021/02/supergraphic-gray-light-min.jpg`,
  'pit-20anos.png': `${DANDE}/themes/dande/imagens/DN_HOME_BarraTopo_Icones_20anos.png`,
  'pit-rapido.png': `${DANDE}/themes/dande/imagens/DN_HOME_BarraTopo_Icones_AtendRapido.png`,
  'pit-marcas.png': `${DANDE}/themes/dande/imagens/DN_HOME_BarraTopo_Icones_GrandesMarcas.png`,
  'pit-entrega.png': `${DANDE}/themes/dande/imagens/DN_HOME_BarraTopo_Icones_ProntaEntrega.png`,
  'pit-estacionamento.png': `${DANDE}/themes/dande/imagens/DN_HOME_BarraTopo_Icones_Estacionamento.png`,
  'marca-brastemp.png': `${DANDE}/themes/dande/imagens/af_logo_brastemp.png`,
  'marca-consul.png': `${DANDE}/themes/dande/imagens/consul-logo.png`,
  'marca-electrolux.png': `${DANDE}/themes/dande/imagens/Logo-Electrolux.png`,
  'marca-planeta-agua.png': `${DANDE}/themes/dande/imagens/planeta-agua.png`,
  'cat-geladeiras.png': `${DANDE}/themes/dande/imagens/DN_HOME_Produtos_Geladeiras.png`,
  'cat-lavadoras.png': `${DANDE}/themes/dande/imagens/DN_HOME_Produtos_Lavadora.png`,
  'cat-secadoras.png': `${DANDE}/themes/dande/imagens/DN_HOME_Produtos_Secadoras.png`,
  'cat-tanquinhos.png': `${DANDE}/themes/dande/imagens/DN_HOME_Produtos_Refrigeracao.png`,
  'cat-microondas.png': `${DANDE}/themes/dande/imagens/DN_HOME_Produtos_Microondas.png`,
  'cat-ar-condicionado.png': `${DANDE}/themes/dande/imagens/DN_HOME_Produtos_ArCondicionado.png`,
  'cat-filtros.png': `${DANDE}/themes/dande/imagens/DN_HOME_Produtos_FiltrodeAgua.png`,
  'cat-lava-loucas.png': `${DANDE}/themes/dande/imagens/DN_HOME_Produtos_LavaLoucas.png`,
  'ic-facebook.png': `${DANDE}/themes/dande/imagens/if_facebook_circle_color_107175.png`,
  'ic-whatsapp.png': `${DANDE}/themes/dande/imagens/whatsapp.png`,
  'ic-horario.png': `${DANDE}/themes/dande/imagens/horario-rodape.png`,
  'ic-mail.png': `${DANDE}/themes/dande/imagens/if_Mail02_928432.png`,
  'ic-facebook-rodape.png': `${DANDE}/themes/dande/imagens/if_facebook_circle_rodape.png`,
  'ic-whatsapp-rodape.png': `${DANDE}/themes/dande/imagens/whatsapp-rodape.png`,
  'pt-sans.woff': `${DANDE}/themes/dande/fontes/PTS55F-webfont.woff`,
  'pt-sans-bold.woff': `${DANDE}/themes/dande/fontes/PTS75F-webfont.woff`,
  'pt-sans-narrow.woff': `${DANDE}/themes/dande/fontes/PTN57F-webfont.woff`,
  'futura-pt-book.woff2': `${DANDE}/themes/dande/fontes/FuturaPT-Book.woff2`,
  'futura-pt-bold.woff2': `${DANDE}/themes/dande/fontes/FuturaPT-Bold.woff2`,
};
const TIPOS = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', woff: 'font/woff', woff2: 'font/woff2' };
async function espelharAssets() {
  let novos = 0, falhas = 0;
  for (const [nome, url] of Object.entries(ASSETS)) {
    const destino = path.join(ASSET_DIR, nome);
    if (fs.existsSync(destino) && fs.statSync(destino).size > 0) continue;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (mio-loja)' } });
      if (!res.ok) throw new Error(String(res.status));
      fs.writeFileSync(destino, Buffer.from(await res.arrayBuffer()));
      novos++;
    } catch (e) { falhas++; console.warn(`[asset] ${nome}: ${e.message}`); }
  }
  if (novos || falhas) console.log(`[asset] identidade Dande: ${novos} baixados, ${falhas} falhas`);
}

// ---------------------------------------------------------------------------
// Banco
// ---------------------------------------------------------------------------
const db = new DatabaseSync(path.join(CFG.dataDir, 'loja.db'));
db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE IF NOT EXISTS produtos (
  id INTEGER PRIMARY KEY,          -- id do produto no Bling
  codigo TEXT, nome TEXT NOT NULL, slug TEXT UNIQUE,
  preco REAL DEFAULT 0, custo REAL DEFAULT 0, estoque REAL DEFAULT 0,
  descricao TEXT DEFAULT '', marca TEXT DEFAULT '', gtin TEXT DEFAULT '',
  peso REAL DEFAULT 0, altura REAL DEFAULT 0, largura REAL DEFAULT 0, profundidade REAL DEFAULT 0,
  categoria_bling INTEGER, situacao TEXT DEFAULT 'A', formato TEXT DEFAULT 'S',
  imagens TEXT DEFAULT '[]',       -- nomes dos arquivos em /data/img
  detalhe_em TEXT,                 -- quando o detalhe completo foi lido
  sync_em TEXT,
  -- campos da loja (não vêm do Bling)
  publicado INTEGER DEFAULT 0, destaque INTEGER DEFAULT 0,
  categoria_site TEXT, titulo_site TEXT
);
CREATE INDEX IF NOT EXISTS idx_prod_pub ON produtos(publicado, categoria_site);
CREATE TABLE IF NOT EXISTS pedidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT UNIQUE, token TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aguardando_pagamento',
  cliente TEXT NOT NULL, endereco TEXT, itens TEXT NOT NULL,
  subtotal REAL NOT NULL, frete REAL NOT NULL DEFAULT 0, frete_tipo TEXT, frete_nome TEXT, total REAL NOT NULL,
  mp_preferencia TEXT, mp_pagamento TEXT, mp_status TEXT, mp_link TEXT,
  bling_pedido_id INTEGER, bling_numero TEXT, bling_erro TEXT,
  obs_interna TEXT,
  criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT, em TEXT, tipo TEXT, dados TEXT
);
`);

const agora = () => new Date().toISOString();
const kvGet = (k) => { const r = db.prepare('SELECT v FROM kv WHERE k=?').get(k); return r ? JSON.parse(r.v) : null; };
const kvSet = (k, v) => db.prepare('INSERT INTO kv(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').run(k, JSON.stringify(v));
function evento(tipo, dados = {}) {
  db.prepare('INSERT INTO eventos(em,tipo,dados) VALUES(?,?,?)').run(agora(), tipo, JSON.stringify(dados));
  console.log(`[${tipo}]`, JSON.stringify(dados).slice(0, 300));
}

// ---------------------------------------------------------------------------
// Categorias do site (identidade da Dande) e classificação automática
// ---------------------------------------------------------------------------
const CATEGORIAS = [
  { slug: 'geladeiras', nome: 'Geladeiras e Freezers', chaves: ['geladeira', 'refrigerador', 'freezer', 'frost', 'degelo', 'gaveta', 'prateleira', 'termostato', 'guarnicao', 'gaxeta', 'antiodor', 'damper', 'evaporador', 'compressor', 'refrigeracao', 'bia'] },
  { slug: 'lavadoras', nome: 'Lavadoras', chaves: ['lavadora', 'maquina de lavar', 'tirante', 'agitador', 'atuador', 'pressostato', 'cesto', 'tanque', 'lava e seca', 'mecanismo', 'transmissao', 'correia', 'rolamento', 'retentor', 'suspensao', 'eletrovalvula', 'valvula', 'bomba', 'lavar'] },
  { slug: 'secadoras', nome: 'Secadoras', chaves: ['secadora', 'secar', 'centrifuga'] },
  { slug: 'tanquinhos', nome: 'Tanquinhos', chaves: ['tanquinho', 'tanquinhos'] },
  { slug: 'microondas', nome: 'Micro-ondas', chaves: ['microondas', 'micro-ondas', 'micro ondas', 'membrana', 'tinta epson', 'tinta branca', 'magnetron', 'prato giratorio'] },
  { slug: 'ar-condicionado', nome: 'Ar-condicionado', chaves: ['ar condicionado', 'ar-condicionado', 'split', 'capacitor'] },
  { slug: 'filtros', nome: 'Filtros e Purificadores', chaves: ['filtro', 'refil', 'purificador', 'bebedouro', 'adaptador mangueira', 'agua'] },
  { slug: 'lava-loucas', nome: 'Lava-louças', chaves: ['lava louca', 'lava-louca', 'lava loucas', 'lava-loucas'] },
  { slug: 'ferramentas', nome: 'Ferramentas e Acessórios', chaves: ['chave', 'alicate', 'dobrador', 'graxa', 'anticorrosivo', 'limpeza', 'tablete', 'pastilha', 'ferramenta', 'kit instalacao'] },
  { slug: 'outros', nome: 'Outras peças', chaves: [] },
];
const CAT_SLUGS = new Set(CATEGORIAS.map((c) => c.slug));
const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function sugerirCategoria(nome) {
  const n = semAcento(nome);
  for (const c of CATEGORIAS) if (c.chaves.some((k) => n.includes(k))) return c.slug;
  return 'outros';
}
function slugify(s) {
  return semAcento(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'produto';
}

// Higiene: o que bloqueia publicar e o que é só aviso.
function problemas(p) {
  const bloq = [], avisos = [];
  if (!(p.preco > 0)) bloq.push('preço zerado');
  if (!JSON.parse(p.imagens || '[]').length) bloq.push('sem imagem');
  const desc = String(p.descricao || '').replace(/<[^>]+>/g, '').trim();
  if (!desc || desc === '#N/A') bloq.push('sem descrição');
  if (!(p.peso > 0)) avisos.push('sem peso (frete Correios indisponível)');
  if (!(p.estoque > 0)) avisos.push('sem estoque');
  if (!(p.custo > 0)) avisos.push('custo zerado no Bling');
  if (p.custo > 0 && p.preco > 0 && p.preco < p.custo) bloq.push('preço abaixo do custo');
  if (p.situacao !== 'A') bloq.push('inativo no Bling');
  return { bloq, avisos };
}

// ---------------------------------------------------------------------------
// Bling: OAuth + cliente
// ---------------------------------------------------------------------------
let tokens = kvGet('bling_tokens');
const oauthStates = new Map();

async function blingToken(form) {
  const basic = Buffer.from(`${CFG.blingClientId}:${CFG.blingClientSecret}`).toString('base64');
  const res = await fetch(`${CFG.blingApi}/oauth/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: '1.0', 'enable-jwt': '1' },
    body: new URLSearchParams(form).toString(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) throw new Error(`Falha no token do Bling (${res.status}): ${JSON.stringify(body).slice(0, 300)}`);
  tokens = { ...body, obtido_em: Date.now() };
  kvSet('bling_tokens', tokens);
}
let renovando = null;
async function blingAccess() {
  if (!tokens?.refresh_token) throw new Error('Bling não conectado. Conecte pelo painel.');
  const expira = (tokens.obtido_em || 0) + (Number(tokens.expires_in || 0) - 120) * 1000;
  if (Date.now() > expira) {
    renovando ||= blingToken({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token }).finally(() => { renovando = null; });
    await renovando;
  }
  return tokens.access_token;
}
let ultimaChamada = 0;
async function bling(method, rota, { query, body } = {}, tentou = false) {
  const espera = ultimaChamada + 360 - Date.now(); // limite do Bling: 3 req/s
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  ultimaChamada = Date.now();
  const url = new URL(CFG.blingApi + rota);
  for (const [k, v] of Object.entries(query || {})) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${await blingAccess()}`, 'enable-jwt': '1', Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && !tentou) {
    await blingToken({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token });
    return bling(method, rota, { query, body }, true);
  }
  if (res.status === 429 && !tentou) {
    await new Promise((r) => setTimeout(r, 1500));
    return bling(method, rota, { query, body }, true);
  }
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  if (!res.ok) {
    const e = new Error(`Bling ${method} ${rota} → ${res.status}: ${JSON.stringify(json?.error || json).slice(0, 600)}`);
    e.status = res.status;
    throw e;
  }
  return json;
}
async function garantirEmpresa() {
  const r = await bling('GET', '/empresas/me/dados-basicos');
  const cnpj = String(r?.data?.cnpj || '').replace(/\D/g, '');
  if (CFG.expectedCnpj && cnpj !== CFG.expectedCnpj) throw new Error(`Conta do Bling com CNPJ ${r?.data?.cnpj}, esperado o da Mio.`);
  kvSet('bling_empresa', { nome: r?.data?.nome, cnpj: r?.data?.cnpj });
}

// ---------------------------------------------------------------------------
// Sincronização do catálogo
// ---------------------------------------------------------------------------
const sync = { rodando: false, etapa: '', inicio: null, fim: null, erro: null, lidos: 0, detalhados: 0 };

async function baixarImagem(url, nome) {
  const destino = path.join(IMG_DIR, nome);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`imagem ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 4 * 1024 * 1024) throw new Error('imagem maior que 4 MB');
  fs.writeFileSync(destino, buf);
  return nome;
}

function extensaoImagem(url) {
  const m = /\.(jpe?g|png|webp|gif)(\?|$)/i.exec(url);
  return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg';
}

async function detalharProduto(id) {
  const r = await bling('GET', `/produtos/${id}`);
  const d = r?.data;
  if (!d) return;
  const links = [
    ...(d.midia?.imagens?.internas || []).map((i) => i.link),
    ...(d.midia?.imagens?.externas || []).map((i) => i.link),
    ...(d.midia?.imagens?.imagensURL || []).map((i) => i.link || i),
  ].filter(Boolean).slice(0, 6);
  const imagens = [];
  for (let i = 0; i < links.length; i++) {
    const nome = `${id}-${i}.${extensaoImagem(links[i])}`;
    try { imagens.push(await baixarImagem(links[i], nome)); } catch (e) { evento('imagem_erro', { id, erro: e.message }); }
  }
  const desc = d.descricaoComplementar && d.descricaoComplementar.replace(/<[^>]+>/g, '').trim() ? d.descricaoComplementar : (d.descricaoCurta || '');
  db.prepare(`UPDATE produtos SET descricao=?, marca=?, gtin=?, peso=?, altura=?, largura=?, profundidade=?,
    categoria_bling=?, imagens=?, custo=?, detalhe_em=? WHERE id=?`).run(
    limparHtml(desc), d.marca || '', d.gtin || '', Number(d.pesoBruto || d.pesoLiquido || 0),
    Number(d.dimensoes?.altura || 0), Number(d.dimensoes?.largura || 0), Number(d.dimensoes?.profundidade || 0),
    d.categoria?.id || null, JSON.stringify(imagens), Number(d.fornecedor?.precoCusto || 0), agora(), id,
  );
}

// Mantém só tags simples de texto na descrição vinda do Bling.
function limparHtml(html) {
  return String(html || '')
    .replace(/<\s*(script|style|iframe|object|embed)[\s\S]*?<\/\s*\1\s*>/gi, '')
    .replace(/<(\/?)(\w+)[^>]*>/g, (m, barra, tag) => (['p', 'br', 'b', 'strong', 'i', 'em', 'ul', 'ol', 'li', 'h3', 'h4'].includes(tag.toLowerCase()) ? `<${barra}${tag.toLowerCase()}>` : ''))
    .replace(/<p>\s*(&nbsp;| )?\s*<\/p>/g, '')
    .trim();
}

function slugUnico(nome, id) {
  let base = slugify(nome), s = base, n = 2;
  while (db.prepare('SELECT 1 FROM produtos WHERE slug=? AND id<>?').get(s, id)) s = `${base}-${n++}`;
  return s;
}

// completo=true relê o detalhe (imagens, descrição, peso) de todos; senão só dos novos ou sem detalhe recente.
async function sincronizar({ completo = false } = {}) {
  if (sync.rodando) return;
  Object.assign(sync, { rodando: true, etapa: 'listando produtos', inicio: agora(), fim: null, erro: null, lidos: 0, detalhados: 0 });
  try {
    await garantirEmpresa();
    const vistos = new Set();
    for (let pagina = 1; pagina < 200; pagina++) {
      const r = await bling('GET', '/produtos', { query: { pagina, limite: 100, criterio: 2, tipo: 'P' } });
      const lista = r?.data || [];
      for (const p of lista) {
        if (p.idProdutoPai) continue; // variação: fica para uma versão futura
        vistos.add(p.id);
        const existe = db.prepare('SELECT id, nome, slug FROM produtos WHERE id=?').get(p.id);
        const preco = Number(p.preco || 0), estoque = Number(p.estoque?.saldoVirtualTotal || 0);
        if (existe) {
          db.prepare('UPDATE produtos SET codigo=?, nome=?, preco=?, estoque=?, situacao=?, formato=?, sync_em=? WHERE id=?')
            .run(p.codigo || '', p.nome, preco, estoque, p.situacao || 'A', p.formato || 'S', agora(), p.id);
        } else {
          db.prepare(`INSERT INTO produtos(id,codigo,nome,slug,preco,estoque,situacao,formato,categoria_site,sync_em)
            VALUES(?,?,?,?,?,?,?,?,?,?)`).run(p.id, p.codigo || '', p.nome, slugUnico(p.nome, p.id), preco, estoque,
            p.situacao || 'A', p.formato || 'S', sugerirCategoria(p.nome), agora());
        }
        sync.lidos++;
      }
      if (lista.length < 100) break;
    }
    // Produtos que sumiram dos ativos no Bling saem do ar.
    const todos = db.prepare("SELECT id FROM produtos WHERE situacao='A'").all();
    for (const { id } of todos) if (!vistos.has(id)) db.prepare("UPDATE produtos SET situacao='I', publicado=0 WHERE id=?").run(id);

    sync.etapa = 'lendo detalhes e imagens';
    const umDia = new Date(Date.now() - 24 * 3600e3).toISOString();
    const pend = completo
      ? db.prepare("SELECT id FROM produtos WHERE situacao='A' ORDER BY publicado DESC").all()
      : db.prepare("SELECT id FROM produtos WHERE situacao='A' AND (detalhe_em IS NULL OR (publicado=1 AND detalhe_em < ?))").all(umDia);
    for (const { id } of pend) {
      try { await detalharProduto(id); sync.detalhados++; } catch (e) { evento('detalhe_erro', { id, erro: e.message }); }
    }
    // Publicado que deixou de passar na higiene sai do ar.
    for (const p of db.prepare('SELECT * FROM produtos WHERE publicado=1').all()) {
      if (problemas(p).bloq.length) { db.prepare('UPDATE produtos SET publicado=0 WHERE id=?').run(p.id); evento('despublicado', { id: p.id, motivo: problemas(p).bloq }); }
    }
    kvSet('ultimo_sync', { em: agora(), lidos: sync.lidos, detalhados: sync.detalhados });
  } catch (e) {
    sync.erro = e.message;
    evento('sync_erro', { erro: e.message });
  } finally {
    sync.rodando = false; sync.fim = agora(); sync.etapa = '';
  }
}

// ---------------------------------------------------------------------------
// Frete
// ---------------------------------------------------------------------------
async function cotarFrete(cep, itens) {
  cep = String(cep || '').replace(/\D/g, '');
  if (cep.length !== 8) throw httpErro(400, 'CEP inválido.');
  const opcoes = [{ tipo: 'retirada', nome: 'Retirar na loja (Av. Andrômeda, 3358 – São José dos Campos)', valor: 0, prazo: 'No mesmo dia útil, após a confirmação do pagamento' }];
  const n = Number(cep);
  if (n >= CFG.freteLocalCeps[0] && n <= CFG.freteLocalCeps[1]) {
    opcoes.push({ tipo: 'local', nome: 'Entrega em São José dos Campos', valor: CFG.freteLocalValor, prazo: 'Até 1 dia útil' });
  }
  if (CFG.melhorEnvioToken) {
    const produtos = itens.map(({ p, qtd }) => ({
      id: String(p.id), width: Math.max(p.largura || 11, 11), height: Math.max(p.altura || 2, 2), length: Math.max(p.profundidade || 16, 16),
      weight: Math.max(p.peso || 0.1, 0.05), insurance_value: p.preco, quantity: qtd,
    }));
    if (itens.every(({ p }) => p.peso > 0)) {
      try {
        const res = await fetch('https://melhorenvio.com.br/api/v2/me/shipment/calculate', {
          method: 'POST',
          headers: { Authorization: `Bearer ${CFG.melhorEnvioToken}`, 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': `Mio Peca (${CFG.melhorEnvioEmail})` },
          body: JSON.stringify({ from: { postal_code: CFG.origemCep }, to: { postal_code: cep }, products: produtos }),
        });
        const lista = await res.json();
        for (const s of Array.isArray(lista) ? lista : []) {
          if (s.error || !s.price) continue;
          opcoes.push({ tipo: `me_${s.id}`, nome: `${s.company?.name || ''} ${s.name}`.trim(), valor: Number(s.custom_price || s.price), prazo: `${s.custom_delivery_time || s.delivery_time} dias úteis` });
        }
      } catch (e) { evento('frete_erro', { erro: e.message }); }
    }
  }
  return opcoes;
}

// ---------------------------------------------------------------------------
// Mercado Pago
// ---------------------------------------------------------------------------
async function mp(method, rota, body) {
  const res = await fetch(`https://api.mercadopago.com${rota}`, {
    method,
    headers: { Authorization: `Bearer ${CFG.mpToken}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': crypto.randomUUID() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Mercado Pago ${rota} → ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);
  return json;
}

async function criarPreferencia(pedido) {
  const cliente = JSON.parse(pedido.cliente);
  const itens = JSON.parse(pedido.itens);
  const volta = `${CFG.publicUrl}/pedido.html?c=${pedido.codigo}&t=${pedido.token}`;
  const https = CFG.publicUrl.startsWith('https://');
  const pref = await mp('POST', '/checkout/preferences', {
    items: itens.map((i) => ({ id: String(i.id), title: i.nome.slice(0, 250), quantity: i.qtd, unit_price: i.preco, currency_id: 'BRL' })),
    shipments: pedido.frete > 0 ? { cost: pedido.frete, mode: 'not_specified' } : undefined,
    payer: { name: cliente.nome, email: cliente.email },
    external_reference: pedido.codigo,
    statement_descriptor: 'MIOPECA',
    back_urls: { success: volta, failure: volta, pending: volta },
    ...(https ? { auto_return: 'approved', notification_url: `${CFG.publicUrl}/api/webhooks/mercadopago` } : {}),
    expires: true,
    expiration_date_to: new Date(Date.now() + 48 * 3600e3).toISOString(),
  });
  db.prepare('UPDATE pedidos SET mp_preferencia=?, mp_link=?, atualizado_em=? WHERE id=?').run(pref.id, pref.init_point, agora(), pedido.id);
  return pref.init_point;
}

const STATUS_MP = { approved: 'pago', authorized: 'pago', pending: 'aguardando_pagamento', in_process: 'aguardando_pagamento', rejected: 'aguardando_pagamento', cancelled: 'cancelado', refunded: 'cancelado', charged_back: 'cancelado' };

async function atualizarPagamento(paymentId) {
  const pg = await mp('GET', `/v1/payments/${encodeURIComponent(paymentId)}`);
  const pedido = db.prepare('SELECT * FROM pedidos WHERE codigo=?').get(pg.external_reference || '');
  if (!pedido) return evento('mp_sem_pedido', { paymentId, ref: pg.external_reference });
  const novo = STATUS_MP[pg.status] || pedido.status;
  // Não regride status operacional (enviado/entregue) por notificação atrasada.
  const status = ['enviado', 'entregue'].includes(pedido.status) && novo !== 'cancelado' ? pedido.status : novo;
  if (status === 'pago' && Math.abs(Number(pg.transaction_amount) - pedido.total) > 0.01) {
    evento('mp_valor_divergente', { codigo: pedido.codigo, pago: pg.transaction_amount, total: pedido.total });
  }
  db.prepare('UPDATE pedidos SET mp_pagamento=?, mp_status=?, status=?, atualizado_em=? WHERE id=?').run(String(pg.id), pg.status, status, agora(), pedido.id);
  evento('mp_pagamento', { codigo: pedido.codigo, status: pg.status });
  if (status === 'pago' && pedido.status !== 'pago' && CFG.blingPedidoAuto && !pedido.bling_pedido_id) {
    enviarPedidoBling(pedido.id).catch((e) => evento('bling_pedido_erro', { codigo: pedido.codigo, erro: e.message }));
  }
}

// ---------------------------------------------------------------------------
// Pedido de venda no Bling
// ---------------------------------------------------------------------------
async function contatoBling(cliente, end) {
  const doc = cliente.cpf.replace(/\D/g, '');
  const busca = await bling('GET', '/contatos', { query: { numeroDocumento: doc, limite: 1 } });
  if (busca?.data?.[0]?.id) return busca.data[0].id;
  const novo = await bling('POST', '/contatos', {
    body: {
      nome: cliente.nome, tipo: 'F', numeroDocumento: doc, situacao: 'A', email: cliente.email, celular: cliente.telefone,
      endereco: end ? { geral: { endereco: end.rua, numero: end.numero, complemento: end.complemento || '', bairro: end.bairro, cep: end.cep, municipio: end.cidade, uf: end.uf } } : undefined,
    },
  });
  return novo?.data?.id;
}

async function enviarPedidoBling(id) {
  const pedido = db.prepare('SELECT * FROM pedidos WHERE id=?').get(id);
  if (!pedido) throw httpErro(404, 'Pedido não encontrado.');
  if (pedido.bling_pedido_id) throw httpErro(409, `Já enviado ao Bling (id ${pedido.bling_pedido_id}).`);
  if (pedido.status !== 'pago') throw httpErro(409, 'Só pedidos pagos vão ao Bling.');
  try {
    await garantirEmpresa();
    const cliente = JSON.parse(pedido.cliente), end = pedido.endereco ? JSON.parse(pedido.endereco) : null;
    const contato = await contatoBling(cliente, end);
    const hoje = new Date().toISOString().slice(0, 10);
    const r = await bling('POST', '/pedidos/vendas', {
      body: {
        contato: { id: contato },
        data: hoje,
        numeroLoja: pedido.codigo,
        ...(CFG.blingLojaId ? { loja: { id: CFG.blingLojaId } } : {}),
        itens: JSON.parse(pedido.itens).map((i) => ({ produto: { id: i.id }, codigo: i.codigo, descricao: i.nome, unidade: 'UN', quantidade: i.qtd, valor: i.preco })),
        transporte: {
          fretePorConta: 0, frete: pedido.frete,
          ...(end ? { etiqueta: { nome: cliente.nome, endereco: end.rua, numero: end.numero, complemento: end.complemento || '', municipio: end.cidade, uf: end.uf, cep: end.cep, bairro: end.bairro } } : {}),
        },
        parcelas: [{ dataVencimento: hoje, valor: pedido.total, observacoes: `Mercado Pago ${pedido.mp_pagamento || ''}`.trim() }],
        observacoes: `Loja própria — ${pedido.codigo} — ${pedido.frete_nome || ''}`,
        observacoesInternas: `Pagamento MP ${pedido.mp_pagamento || '-'}`,
      },
    });
    const bid = r?.data?.id;
    db.prepare('UPDATE pedidos SET bling_pedido_id=?, bling_erro=NULL, atualizado_em=? WHERE id=?').run(bid, agora(), id);
    try {
      const det = await bling('GET', `/pedidos/vendas/${bid}`);
      db.prepare('UPDATE pedidos SET bling_numero=? WHERE id=?').run(String(det?.data?.numero || ''), id);
    } catch {}
    evento('bling_pedido_criado', { codigo: pedido.codigo, bling: bid });
    return bid;
  } catch (e) {
    db.prepare('UPDATE pedidos SET bling_erro=?, atualizado_em=? WHERE id=?').run(e.message.slice(0, 800), agora(), id);
    throw e;
  }
}

// ---------------------------------------------------------------------------
// HTTP: utilitários
// ---------------------------------------------------------------------------
function httpErro(status, msg) { const e = new Error(msg); e.status = status; return e; }
function send(res, status, body, headers = {}) {
  const isStr = typeof body === 'string';
  res.writeHead(status, { 'Content-Type': isStr ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(isStr ? body : JSON.stringify(body));
}
function readBody(req, limite = 64 * 1024) {
  return new Promise((ok, falha) => {
    let tam = 0; const partes = [];
    req.on('data', (c) => { tam += c.length; if (tam > limite) { falha(httpErro(413, 'Corpo grande demais.')); req.destroy(); } else partes.push(c); });
    req.on('end', () => ok(Buffer.concat(partes).toString('utf8')));
    req.on('error', falha);
  });
}
async function readJson(req) {
  const t = await readBody(req);
  try { return t ? JSON.parse(t) : {}; } catch { throw httpErro(400, 'JSON inválido.'); }
}
const safeEqual = (a, b) => {
  const ha = crypto.createHash('sha256').update(String(a)).digest(), hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
};

// Sessão do painel: cookie assinado com HMAC (sem estado no servidor).
function assinar(v) { return crypto.createHmac('sha256', CFG.sessionSecret).update(v).digest('base64url'); }
function criarSessao(res) {
  const exp = String(Date.now() + 12 * 3600e3);
  const cookie = `mio_s=${exp}.${assinar(exp)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200${CFG.cookieSecure ? '; Secure' : ''}`;
  res.setHeader('Set-Cookie', cookie);
}
function sessaoValida(req) {
  if (!CFG.sessionSecret || !CFG.adminPassword) return false;
  const m = /(?:^|;\s*)mio_s=([^;]+)/.exec(req.headers.cookie || '');
  if (!m) return false;
  const [exp, sig] = m[1].split('.');
  return sig && safeEqual(sig, assinar(exp)) && Number(exp) > Date.now();
}
// Limite simples por IP.
const janelas = new Map();
function limitar(req, chave, max, janelaMs) {
  const ip = req.headers['x-real-ip'] || req.socket.remoteAddress;
  const k = `${chave}:${ip}`, t = Date.now();
  const lista = (janelas.get(k) || []).filter((x) => t - x < janelaMs);
  if (lista.length >= max) throw httpErro(429, 'Muitas tentativas. Aguarde alguns minutos.');
  lista.push(t); janelas.set(k, lista);
}

function cpfValido(cpf) {
  const c = String(cpf).replace(/\D/g, '');
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  for (const t of [9, 10]) {
    let s = 0;
    for (let i = 0; i < t; i++) s += Number(c[i]) * (t + 1 - i);
    if (((s * 10) % 11) % 10 !== Number(c[t])) return false;
  }
  return true;
}

// Visão pública do produto.
function produtoPublico(p, completo = false) {
  const imgs = JSON.parse(p.imagens || '[]').map((f) => `/img/${f}`);
  const base = {
    id: p.id, slug: p.slug, nome: p.titulo_site || p.nome, preco: p.preco, disponivel: p.estoque > 0,
    estoque: p.estoque > 0 ? Math.min(Math.floor(p.estoque), 99) : 0, imagem: imgs[0] || null, categoria: p.categoria_site, marca: p.marca,
  };
  return completo ? { ...base, imagens: imgs, descricao: p.descricao, codigo: p.codigo, gtin: p.gtin, peso: p.peso } : base;
}
function produtoAdmin(p) {
  const { bloq, avisos } = problemas(p);
  return {
    id: p.id, codigo: p.codigo, nome: p.nome, titulo_site: p.titulo_site, slug: p.slug, preco: p.preco, custo: p.custo, estoque: p.estoque,
    peso: p.peso, marca: p.marca, situacao: p.situacao, publicado: !!p.publicado, destaque: !!p.destaque, categoria_site: p.categoria_site,
    imagem: JSON.parse(p.imagens || '[]')[0] ? `/img/${JSON.parse(p.imagens)[0]}` : null, detalhado: !!p.detalhe_em, bloqueios: bloq, avisos,
  };
}

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------
async function rotear(req, res, url) {
  const p = url.pathname, m = req.method;

  if (p === '/api/health') return send(res, 200, { ok: true, bling: !!tokens?.refresh_token, mp: !!CFG.mpToken });

  // Imagens (cacheadas do Bling)
  if (p.startsWith('/img/') && m === 'GET') {
    const nome = path.basename(p);
    if (!/^\d+-\d+\.(jpg|png|webp|gif)$/.test(nome)) return send(res, 404, { erro: 'não encontrado' });
    const arq = path.join(IMG_DIR, nome);
    if (!fs.existsSync(arq)) return send(res, 404, { erro: 'não encontrado' });
    const tipo = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' }[nome.split('.').pop()];
    res.writeHead(200, { 'Content-Type': tipo, 'Cache-Control': 'public, max-age=86400' });
    return fs.createReadStream(arq).pipe(res);
  }

  if (p.startsWith('/assets/') && m === 'GET') {
    const nome = path.basename(p);
    if (!ASSETS[nome]) return send(res, 404, { erro: 'não encontrado' });
    const arq = path.join(ASSET_DIR, nome);
    if (!fs.existsSync(arq)) { espelharAssets().catch(() => {}); return send(res, 404, { erro: 'não encontrado' }); }
    res.writeHead(200, { 'Content-Type': TIPOS[nome.split('.').pop()], 'Cache-Control': 'public, max-age=604800', 'Access-Control-Allow-Origin': '*' });
    return fs.createReadStream(arq).pipe(res);
  }

  // ---------- Loja pública ----------
  if (p === '/api/categorias' && m === 'GET') {
    const cont = Object.fromEntries(db.prepare("SELECT categoria_site c, COUNT(*) n FROM produtos WHERE publicado=1 GROUP BY categoria_site").all().map((r) => [r.c, r.n]));
    return send(res, 200, CATEGORIAS.map((c) => ({ slug: c.slug, nome: c.nome, total: cont[c.slug] || 0 })));
  }

  if (p === '/api/produtos' && m === 'GET') {
    const cat = url.searchParams.get('cat') || '', q = semAcento(url.searchParams.get('q') || '').trim();
    const pagina = Math.max(1, Number(url.searchParams.get('pagina') || 1)), porPag = Math.min(48, Math.max(1, Number(url.searchParams.get('limite') || 24)));
    const ordem = { menor: 'preco ASC', maior: 'preco DESC', nome: 'nome ASC' }[url.searchParams.get('ordem')] || 'destaque DESC, (estoque>0) DESC, nome ASC';
    let lista = db.prepare(`SELECT * FROM produtos WHERE publicado=1 ${cat ? 'AND categoria_site=?' : ''} ORDER BY ${ordem}`).all(...(cat ? [cat] : []));
    if (url.searchParams.get('destaque') === '1') lista = lista.filter((x) => x.destaque);
    if (q) {
      const termos = q.split(/\s+/);
      lista = lista.filter((x) => { const t = semAcento(`${x.titulo_site || ''} ${x.nome} ${x.codigo} ${x.marca} ${x.gtin}`); return termos.every((k) => t.includes(k)); });
    }
    return send(res, 200, { total: lista.length, pagina, itens: lista.slice((pagina - 1) * porPag, pagina * porPag).map((x) => produtoPublico(x)) });
  }

  let mm;
  if ((mm = /^\/api\/produtos\/([a-z0-9-]+)$/.exec(p)) && m === 'GET') {
    const prod = db.prepare('SELECT * FROM produtos WHERE slug=? AND publicado=1').get(mm[1]);
    if (!prod) return send(res, 404, { erro: 'Produto não encontrado.' });
    const rel = db.prepare('SELECT * FROM produtos WHERE publicado=1 AND categoria_site=? AND id<>? ORDER BY (estoque>0) DESC, destaque DESC LIMIT 4').all(prod.categoria_site, prod.id);
    return send(res, 200, { ...produtoPublico(prod, true), relacionados: rel.map((x) => produtoPublico(x)) });
  }

  // Monta itens a partir do carrinho com preço e estoque do banco (nunca do cliente).
  const montarItens = (itensReq) => {
    if (!Array.isArray(itensReq) || !itensReq.length || itensReq.length > 30) throw httpErro(400, 'Carrinho vazio ou inválido.');
    return itensReq.map((i) => {
      const prod = db.prepare('SELECT * FROM produtos WHERE id=? AND publicado=1').get(Number(i.id));
      if (!prod) throw httpErro(409, 'Um produto do carrinho não está mais disponível.');
      const qtd = Math.floor(Number(i.qtd));
      if (!(qtd >= 1 && qtd <= 99)) throw httpErro(400, 'Quantidade inválida.');
      if (qtd > prod.estoque) throw httpErro(409, `Estoque insuficiente para "${prod.titulo_site || prod.nome}" (disponível: ${Math.max(0, Math.floor(prod.estoque))}).`);
      return { p: prod, qtd };
    });
  };

  if (p === '/api/frete' && m === 'POST') {
    limitar(req, 'frete', 60, 60e3);
    const b = await readJson(req);
    return send(res, 200, await cotarFrete(b.cep, montarItens(b.itens)));
  }

  if (p === '/api/pedidos' && m === 'POST') {
    limitar(req, 'pedido', 8, 10 * 60e3);
    const b = await readJson(req);
    const c = b.cliente || {}, e = b.endereco || {};
    const cliente = { nome: String(c.nome || '').trim().slice(0, 120), cpf: String(c.cpf || '').replace(/\D/g, ''), email: String(c.email || '').trim().toLowerCase().slice(0, 160), telefone: String(c.telefone || '').replace(/\D/g, '').slice(0, 13) };
    if (cliente.nome.split(/\s+/).length < 2) throw httpErro(400, 'Informe nome e sobrenome.');
    if (!cpfValido(cliente.cpf)) throw httpErro(400, 'CPF inválido.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cliente.email)) throw httpErro(400, 'E-mail inválido.');
    if (cliente.telefone.length < 10) throw httpErro(400, 'Telefone inválido.');
    const itens = montarItens(b.itens);
    const cep = String(e.cep || '').replace(/\D/g, '');
    const opcoes = await cotarFrete(cep, itens);
    const frete = opcoes.find((o) => o.tipo === b.frete_tipo);
    if (!frete) throw httpErro(400, 'Escolha uma forma de entrega válida.');
    let endereco = null;
    if (frete.tipo !== 'retirada') {
      endereco = { cep, rua: String(e.rua || '').slice(0, 120), numero: String(e.numero || '').slice(0, 20), complemento: String(e.complemento || '').slice(0, 60), bairro: String(e.bairro || '').slice(0, 60), cidade: String(e.cidade || '').slice(0, 60), uf: String(e.uf || '').toUpperCase().slice(0, 2) };
      if (!endereco.rua || !endereco.numero || !endereco.bairro || !endereco.cidade || endereco.uf.length !== 2) throw httpErro(400, 'Endereço de entrega incompleto.');
    }
    const linhas = itens.map(({ p: pr, qtd }) => ({ id: pr.id, codigo: pr.codigo, nome: pr.titulo_site || pr.nome, preco: pr.preco, qtd }));
    const subtotal = Math.round(linhas.reduce((s, i) => s + i.preco * i.qtd, 0) * 100) / 100;
    const total = Math.round((subtotal + frete.valor) * 100) / 100;
    const token = crypto.randomBytes(12).toString('base64url');
    const t = agora();
    const info = db.prepare(`INSERT INTO pedidos(codigo,token,cliente,endereco,itens,subtotal,frete,frete_tipo,frete_nome,total,criado_em,atualizado_em)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run('tmp-' + token, token, JSON.stringify(cliente), endereco && JSON.stringify(endereco), JSON.stringify(linhas), subtotal, frete.valor, frete.tipo, frete.nome, total, t, t);
    const codigo = `MIO${1000 + Number(info.lastInsertRowid)}`;
    db.prepare('UPDATE pedidos SET codigo=? WHERE id=?').run(codigo, info.lastInsertRowid);
    evento('pedido_criado', { codigo, total });
    const pedido = db.prepare('SELECT * FROM pedidos WHERE id=?').get(info.lastInsertRowid);
    let pagamento = null;
    if (CFG.mpToken) {
      try { pagamento = await criarPreferencia(pedido); } catch (err) { evento('mp_erro', { codigo, erro: err.message }); }
    }
    return send(res, 201, { codigo, token, total, pagamento });
  }

  if ((mm = /^\/api\/pedidos\/(MIO\d+)$/.exec(p)) && m === 'GET') {
    const ped = db.prepare('SELECT * FROM pedidos WHERE codigo=?').get(mm[1]);
    if (!ped || !safeEqual(url.searchParams.get('t') || '', ped.token)) return send(res, 404, { erro: 'Pedido não encontrado.' });
    // Na volta do Mercado Pago, confere o pagamento direto na API (não confia na URL).
    const pid = url.searchParams.get('payment_id');
    if (pid && CFG.mpToken && ped.status === 'aguardando_pagamento') { try { await atualizarPagamento(pid); } catch (e) { evento('mp_erro', { erro: e.message }); } }
    const atual = db.prepare('SELECT * FROM pedidos WHERE id=?').get(ped.id);
    return send(res, 200, {
      codigo: atual.codigo, status: atual.status, criado_em: atual.criado_em, itens: JSON.parse(atual.itens), subtotal: atual.subtotal,
      frete: atual.frete, frete_nome: atual.frete_nome, total: atual.total, pagamento: atual.status === 'aguardando_pagamento' ? atual.mp_link : null,
      cliente: { nome: JSON.parse(atual.cliente).nome },
    });
  }

  if (p === '/api/webhooks/mercadopago' && m === 'POST') {
    const b = await readJson(req).catch(() => ({}));
    const tipo = b.type || b.topic || url.searchParams.get('type') || url.searchParams.get('topic');
    const id = b.data?.id || url.searchParams.get('data.id') || url.searchParams.get('id');
    if (tipo === 'payment' && id && CFG.mpToken) atualizarPagamento(id).catch((e) => evento('mp_webhook_erro', { erro: e.message }));
    return send(res, 200, { ok: true });
  }

  // ---------- OAuth Bling (retorno) ----------
  if (p === '/oauth/callback' && m === 'GET') {
    const state = url.searchParams.get('state') || '';
    const criado = oauthStates.get(state); oauthStates.delete(state);
    if (!criado || Date.now() - criado > 10 * 60e3) return send(res, 400, 'Autorização expirada. Recomece pelo painel.');
    const code = url.searchParams.get('code');
    if (!code) return send(res, 400, 'Código ausente.');
    await blingToken({ grant_type: 'authorization_code', code });
    try { await garantirEmpresa(); } catch (e) {
      tokens = null; kvSet('bling_tokens', null);
      return send(res, 403, `<h2>Autorização recusada</h2><p>${e.message.replace(/[<>&]/g, '')}</p>`);
    }
    evento('bling_conectado', {});
    sincronizar({ completo: true });
    return send(res, 302, '', { Location: '/painel.html?bling=ok' });
  }

  // ---------- Painel ----------
  if (p === '/api/admin/login' && m === 'POST') {
    limitar(req, 'login', 10, 15 * 60e3);
    const b = await readJson(req);
    if (!CFG.adminPassword || !CFG.sessionSecret || !safeEqual(b.senha || '', CFG.adminPassword)) throw httpErro(401, 'Senha incorreta.');
    criarSessao(res);
    return send(res, 200, { ok: true });
  }
  if (p === '/api/admin/logout' && m === 'POST') {
    res.setHeader('Set-Cookie', 'mio_s=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
    return send(res, 200, { ok: true });
  }
  if (!p.startsWith('/api/admin/')) return send(res, 404, { erro: 'não encontrado' });
  if (!sessaoValida(req)) return send(res, 401, { erro: 'Faça login.' });

  if (p === '/api/admin/status' && m === 'GET') {
    const cont = db.prepare(`SELECT COUNT(*) total, SUM(publicado) publicados, SUM(situacao='A') ativos FROM produtos`).get();
    const ped = db.prepare(`SELECT status, COUNT(*) n, SUM(total) v FROM pedidos GROUP BY status`).all();
    return send(res, 200, {
      bling: { conectado: !!tokens?.refresh_token, configurado: !!(CFG.blingClientId && CFG.blingClientSecret), empresa: kvGet('bling_empresa'), pedidoAuto: CFG.blingPedidoAuto, callback: `${CFG.publicUrl}/oauth/callback` },
      sync: { ...sync, ultimo: kvGet('ultimo_sync'), intervaloMin: CFG.syncMinutos },
      mp: { configurado: !!CFG.mpToken, webhook: CFG.publicUrl.startsWith('https://') ? `${CFG.publicUrl}/api/webhooks/mercadopago` : null },
      frete: { local: CFG.freteLocalValor, melhorEnvio: !!CFG.melhorEnvioToken },
      produtos: cont, pedidos: ped, publicUrl: CFG.publicUrl, categorias: CATEGORIAS.map(({ slug, nome }) => ({ slug, nome })),
    });
  }

  if (p === '/api/admin/bling/conectar' && m === 'GET') {
    if (!CFG.blingClientId) return send(res, 400, 'BLING_CLIENT_ID não configurado.');
    const state = crypto.randomBytes(16).toString('hex');
    oauthStates.set(state, Date.now());
    const a = new URL(CFG.blingAuthorize);
    a.searchParams.set('response_type', 'code'); a.searchParams.set('client_id', CFG.blingClientId); a.searchParams.set('state', state);
    return send(res, 302, '', { Location: a.toString() });
  }

  if (p === '/api/admin/sync' && m === 'POST') {
    const b = await readJson(req);
    if (!tokens?.refresh_token) throw httpErro(409, 'Conecte o Bling primeiro.');
    if (sync.rodando) return send(res, 202, { ok: true, jaRodando: true });
    sincronizar({ completo: !!b.completo });
    return send(res, 202, { ok: true });
  }

  if (p === '/api/admin/produtos' && m === 'GET') {
    const q = semAcento(url.searchParams.get('q') || ''), filtro = url.searchParams.get('filtro') || 'todos', cat = url.searchParams.get('cat') || '';
    let lista = db.prepare("SELECT * FROM produtos WHERE situacao='A' ORDER BY publicado DESC, nome ASC").all().map(produtoAdmin);
    if (q) lista = lista.filter((x) => semAcento(`${x.nome} ${x.codigo} ${x.titulo_site || ''}`).includes(q));
    if (cat) lista = lista.filter((x) => x.categoria_site === cat);
    if (filtro === 'publicados') lista = lista.filter((x) => x.publicado);
    if (filtro === 'prontos') lista = lista.filter((x) => !x.publicado && !x.bloqueios.length);
    if (filtro === 'bloqueados') lista = lista.filter((x) => x.bloqueios.length);
    const pagina = Math.max(1, Number(url.searchParams.get('pagina') || 1));
    return send(res, 200, { total: lista.length, itens: lista.slice((pagina - 1) * 50, pagina * 50) });
  }

  if ((mm = /^\/api\/admin\/produtos\/(\d+)$/.exec(p)) && m === 'PATCH') {
    const id = Number(mm[1]);
    const prod = db.prepare('SELECT * FROM produtos WHERE id=?').get(id);
    if (!prod) throw httpErro(404, 'Produto não encontrado.');
    const b = await readJson(req);
    if (b.publicado === true && problemas(prod).bloq.length) throw httpErro(409, `Não dá para publicar: ${problemas(prod).bloq.join(', ')}.`);
    if (b.categoria_site !== undefined && !CAT_SLUGS.has(b.categoria_site)) throw httpErro(400, 'Categoria inválida.');
    const titulo = b.titulo_site === undefined ? prod.titulo_site : (String(b.titulo_site || '').trim().slice(0, 120) || null);
    db.prepare('UPDATE produtos SET publicado=?, destaque=?, categoria_site=?, titulo_site=? WHERE id=?').run(
      b.publicado === undefined ? prod.publicado : (b.publicado ? 1 : 0), b.destaque === undefined ? prod.destaque : (b.destaque ? 1 : 0),
      b.categoria_site ?? prod.categoria_site, titulo, id);
    evento('produto_editado', { id, ...b });
    return send(res, 200, produtoAdmin(db.prepare('SELECT * FROM produtos WHERE id=?').get(id)));
  }

  if ((mm = /^\/api\/admin\/produtos\/(\d+)\/atualizar$/.exec(p)) && m === 'POST') {
    await detalharProduto(Number(mm[1]));
    return send(res, 200, produtoAdmin(db.prepare('SELECT * FROM produtos WHERE id=?').get(Number(mm[1]))));
  }

  if (p === '/api/admin/pedidos' && m === 'GET') {
    const st = url.searchParams.get('status');
    const lista = db.prepare(`SELECT * FROM pedidos ${st ? 'WHERE status=?' : ''} ORDER BY id DESC LIMIT 200`).all(...(st ? [st] : []));
    return send(res, 200, lista.map((x) => ({ ...x, token: undefined, cliente: JSON.parse(x.cliente), endereco: x.endereco && JSON.parse(x.endereco), itens: JSON.parse(x.itens) })));
  }

  if ((mm = /^\/api\/admin\/pedidos\/(\d+)$/.exec(p)) && m === 'PATCH') {
    const b = await readJson(req);
    const permitidos = ['aguardando_pagamento', 'pago', 'enviado', 'entregue', 'cancelado'];
    if (b.status && !permitidos.includes(b.status)) throw httpErro(400, 'Status inválido.');
    const ped = db.prepare('SELECT * FROM pedidos WHERE id=?').get(Number(mm[1]));
    if (!ped) throw httpErro(404, 'Pedido não encontrado.');
    db.prepare('UPDATE pedidos SET status=?, obs_interna=?, atualizado_em=? WHERE id=?').run(b.status || ped.status, b.obs_interna ?? ped.obs_interna, agora(), ped.id);
    evento('pedido_editado', { codigo: ped.codigo, ...b });
    return send(res, 200, { ok: true });
  }

  if ((mm = /^\/api\/admin\/pedidos\/(\d+)\/bling$/.exec(p)) && m === 'POST') {
    const bid = await enviarPedidoBling(Number(mm[1]));
    return send(res, 200, { ok: true, bling: bid });
  }

  if ((mm = /^\/api\/admin\/pedidos\/(\d+)\/conferir-pagamento$/.exec(p)) && m === 'POST') {
    const ped = db.prepare('SELECT * FROM pedidos WHERE id=?').get(Number(mm[1]));
    if (!ped || !CFG.mpToken) throw httpErro(409, 'Sem Mercado Pago configurado.');
    const busca = await mp('GET', `/v1/payments/search?external_reference=${encodeURIComponent(ped.codigo)}&sort=date_created&criteria=desc`);
    const pg = busca.results?.[0];
    if (!pg) return send(res, 200, { ok: true, encontrado: false });
    await atualizarPagamento(pg.id);
    return send(res, 200, { ok: true, encontrado: true, status: pg.status });
  }

  if (p === '/api/admin/eventos' && m === 'GET') {
    return send(res, 200, db.prepare('SELECT * FROM eventos ORDER BY id DESC LIMIT 100').all());
  }

  return send(res, 404, { erro: 'não encontrado' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    await rotear(req, res, url);
  } catch (e) {
    if (!e.status || e.status >= 500) console.error(e);
    // No painel (já autenticado) a mensagem real ajuda a resolver; para o público, mensagem genérica.
    const admin = url.pathname.startsWith('/api/admin/') && sessaoValida(req);
    if (!res.headersSent) send(res, e.status || 500, { erro: e.status || admin ? e.message : 'Erro interno. Tente de novo.' });
  }
});

// Sincronização periódica: rápida a cada N minutos, completa uma vez por dia (madrugada).
setInterval(() => { if (tokens?.refresh_token) sincronizar(); }, CFG.syncMinutos * 60e3).unref();
setInterval(() => {
  const h = new Date().getUTCHours(); // 6h UTC = 3h em São Paulo
  const ultimo = kvGet('ultimo_completo');
  if (tokens?.refresh_token && h === 6 && ultimo !== new Date().toISOString().slice(0, 10)) {
    kvSet('ultimo_completo', new Date().toISOString().slice(0, 10));
    sincronizar({ completo: true });
  }
}, 10 * 60e3).unref();

if (require.main === module) {
  server.listen(CFG.port, () => console.log(`mio-loja API na porta ${CFG.port}`));
  espelharAssets().catch((e) => console.warn('[asset]', e.message));
  if (tokens?.refresh_token) setTimeout(() => sincronizar(), 5000);
}
module.exports = { server, db, CFG, sugerirCategoria, problemas, cpfValido, limparHtml };
