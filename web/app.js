// Mio Peça — código compartilhado entre as páginas da loja.
(function () {
  const M = window.MIO || {};

  // ---------- utilitários ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const qs = (k) => new URLSearchParams(location.search).get(k);

  async function api(caminho, opts = {}) {
    const res = await fetch(caminho, {
      method: opts.method || 'GET',
      headers: opts.body ? { 'Content-Type': 'application/json' } : {},
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin',
    });
    let dados = null;
    try { dados = await res.json(); } catch { /* sem corpo */ }
    if (!res.ok) { const e = new Error(dados?.erro || `Erro ${res.status}`); e.status = res.status; throw e; }
    return dados;
  }

  function toast(msg) {
    let t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('on');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2600);
  }

  // ---------- ícones ----------
  const ic = {
    busca: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    carrinho: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.5L21 8H6.2"/><circle cx="10" cy="20.5" r="1.3"/><circle cx="18" cy="20.5" r="1.3"/></svg>',
    whats: '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/></svg>',
    tel: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/></svg>',
    pin: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    relogio: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    mail: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4.5 4.5L19 7"/></svg>',
    escudo: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/></svg>',
    caixa: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5M12 13v8"/></svg>',
    loja: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9 5 4h14l2 5M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0V9ZM5 13v7h14v-7"/></svg>',
    foto: '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/></svg>',
  };
  const pitIcone = {
    anos: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6"><circle cx="12" cy="9" r="6"/><path d="m8.5 14-1.5 7 5-2.5 5 2.5-1.5-7"/></svg>',
    rapido: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/></svg>',
    marcas: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6"><path d="m12 2 2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17l-6.1 3.4 1.5-6.8L2.2 9l6.9-.7L12 2Z"/></svg>',
    entrega: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6"><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5M12 13v8"/></svg>',
    seguro: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6"><path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/></svg>',
  };
  const catIcone = {
    geladeiras: '<svg width="54" height="54" viewBox="0 0 48 48" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><rect x="12" y="4" width="24" height="40" rx="3"/><path d="M12 18h24M17 10v4M17 23v8"/></svg>',
    lavadoras: '<svg width="54" height="54" viewBox="0 0 48 48" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><rect x="8" y="4" width="32" height="40" rx="3"/><circle cx="24" cy="27" r="10"/><path d="M8 12h32M14 8h2M20 8h2"/><path d="M18 28c2-2 4 2 6 0s4 2 6 0"/></svg>',
    secadoras: '<svg width="54" height="54" viewBox="0 0 48 48" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><rect x="8" y="4" width="32" height="40" rx="3"/><circle cx="24" cy="27" r="10"/><path d="M8 12h32M20 24c0 2 2 2 2 4M26 24c0 2 2 2 2 4"/></svg>',
    tanquinhos: '<svg width="54" height="54" viewBox="0 0 48 48" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><path d="M10 12h28l-3 30H13L10 12Z"/><path d="M8 12h32M18 6h12v6M24 20v14M19 24l5 4 5-4"/></svg>',
    microondas: '<svg width="54" height="54" viewBox="0 0 48 48" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><rect x="4" y="10" width="40" height="28" rx="3"/><rect x="9" y="15" width="24" height="18" rx="2"/><path d="M38 16v2M38 22v2M38 28v2"/></svg>',
    'ar-condicionado': '<svg width="54" height="54" viewBox="0 0 48 48" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><rect x="4" y="10" width="40" height="16" rx="3"/><path d="M10 20h28M14 32c0 3-2 3-2 6M24 32c0 3-2 3-2 6M34 32c0 3-2 3-2 6"/></svg>',
    filtros: '<svg width="54" height="54" viewBox="0 0 48 48" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><path d="M24 4s-12 14-12 24a12 12 0 0 0 24 0C36 18 24 4 24 4Z"/><path d="M18 30a6 6 0 0 0 6 6"/></svg>',
    'lava-loucas': '<svg width="54" height="54" viewBox="0 0 48 48" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><rect x="8" y="4" width="32" height="40" rx="3"/><path d="M8 12h32M15 22h18M15 30h18M17 22v12M24 22v12M31 22v12"/></svg>',
    ferramentas: '<svg width="54" height="54" viewBox="0 0 48 48" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M30 6a9 9 0 0 0-8.5 12L8 31.5a3.5 3.5 0 0 0 5 5L26.5 23A9 9 0 0 0 38 14l-5 5-5-1-1-5 5-5a9 9 0 0 0-2-2Z"/></svg>',
    outros: '<svg width="54" height="54" viewBox="0 0 48 48" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><circle cx="24" cy="24" r="7"/><path d="M24 4v6M24 38v6M4 24h6M38 24h6M10 10l4 4M34 34l4 4M10 38l4-4M34 14l4-4"/></svg>',
  };

  // ---------- carrinho (localStorage, com fallback em memória) ----------
  let memoria = [];
  const Carrinho = {
    ler() { try { return JSON.parse(localStorage.getItem('mio_carrinho') || '[]'); } catch { return memoria; } },
    salvar(itens) { memoria = itens; try { localStorage.setItem('mio_carrinho', JSON.stringify(itens)); } catch { /* modo privado */ } atualizarContador(); },
    adicionar(p, qtd = 1) {
      const itens = Carrinho.ler();
      const ex = itens.find((i) => i.id === p.id);
      const max = p.estoque || 99;
      if (ex) ex.qtd = Math.min(ex.qtd + qtd, max);
      else itens.push({ id: p.id, slug: p.slug, nome: p.nome, preco: p.preco, imagem: p.imagem, qtd: Math.min(qtd, max), max });
      Carrinho.salvar(itens);
    },
    alterar(id, qtd) { const itens = Carrinho.ler().map((i) => (i.id === id ? { ...i, qtd: Math.max(1, Math.min(qtd, i.max || 99)) } : i)); Carrinho.salvar(itens); },
    remover(id) { Carrinho.salvar(Carrinho.ler().filter((i) => i.id !== id)); },
    limpar() { Carrinho.salvar([]); },
    total() { return Carrinho.ler().reduce((s, i) => s + i.preco * i.qtd, 0); },
    qtd() { return Carrinho.ler().reduce((s, i) => s + i.qtd, 0); },
  };
  function atualizarContador() { document.querySelectorAll('.btn-carrinho .qtd').forEach((el) => { const n = Carrinho.qtd(); el.textContent = n ? String(n) : ''; }); }

  const linkWhats = (texto) => `https://wa.me/${M.whatsapp}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`;

  // ---------- cabeçalho e rodapé ----------
  function montarCabecalho(categorias) {
    const el = document.getElementById('cabecalho-slot');
    if (!el) return;
    const catAtual = qs('cat');
    el.outerHTML = `
      <div class="topo-contato"><div class="container">
        <span><span class="so-desk">Loja física em São José dos Campos · </span>${esc(M.telefone)}</span>
        <span><a href="${linkWhats()}" target="_blank" rel="noopener">Atendimento via WhatsApp</a></span>
      </div></div>
      <header id="cabecalho">
        <div class="container">
          <a href="/" class="logo" aria-label="Mio Peça — início"><img src="/logo.svg" alt="Mio Peça" width="190" height="50"></a>
          <form class="busca" action="/loja.html" role="search">
            <label for="q" class="sr">Buscar peça</label>
            <input id="q" name="q" type="search" placeholder="Busque por peça, modelo ou código" value="${esc(qs('q') || '')}" autocomplete="off">
            <button type="submit" aria-label="Buscar">${ic.busca}</button>
          </form>
          <nav class="menu-acoes">
            <a href="${linkWhats()}" target="_blank" rel="noopener">${ic.whats.replace('26', '20').replace('26', '20')}<span class="txt">Ajuda</span></a>
            <a href="/carrinho.html" class="btn-carrinho" aria-label="Carrinho">${ic.carrinho}<span class="qtd"></span><span class="txt">Carrinho</span></a>
          </nav>
        </div>
        <nav class="nav-cat" aria-label="Categorias"><div class="container">
          <a href="/loja.html" class="${location.pathname.startsWith('/loja') && !catAtual && !qs('q') ? 'ativo' : ''}">Todas as peças</a>
          ${(categorias || []).filter((c) => c.total > 0).map((c) => `<a href="/loja.html?cat=${c.slug}" class="${catAtual === c.slug ? 'ativo' : ''}">${esc(c.nome)}</a>`).join('')}
        </div></nav>
      </header>`;
    atualizarContador();
  }

  function montarRodape() {
    const el = document.getElementById('rodape-slot');
    if (!el) return;
    el.outerHTML = `
      <footer id="rodape">
        <div class="container">
          <div>
            <img src="/logo.svg" alt="Mio Peça" width="190" height="50" style="background:#fff;border-radius:8px;padding:6px 10px;margin-bottom:14px">
            <p style="color:#dbe9f7;margin:0">Peças para refrigeração, lavadoras, micro-ondas e purificadores. A loja online da Dande, há mais de 20 anos em São José dos Campos.</p>
          </div>
          <div>
            <h4>Atendimento</h4>
            <div class="item">${ic.tel}<span>${esc(M.telefone)}</span></div>
            <div class="item">${ic.whats.replace(/26/g, '16')}<a href="${linkWhats()}" target="_blank" rel="noopener">${esc(M.whatsappTexto)}</a></div>
            <div class="item">${ic.mail}<a href="mailto:${esc(M.email)}">${esc(M.email)}</a></div>
            <div class="item">${ic.relogio}<span>${esc(M.horario)}</span></div>
          </div>
          <div>
            <h4>Loja física</h4>
            <div class="item">${ic.pin}<span>${esc(M.endereco)}<br>${esc(M.cidade)}</span></div>
            <div class="item"><a href="${esc(M.facebook)}" target="_blank" rel="noopener">@danderefrigeracao</a></div>
          </div>
          <div>
            <h4>Institucional</h4>
            <ul>
              <li><a href="/politicas.html#trocas">Trocas e devoluções</a></li>
              <li><a href="/politicas.html#entrega">Entrega e retirada</a></li>
              <li><a href="/politicas.html#privacidade">Privacidade</a></li>
              <li><a href="/politicas.html#garantia">Garantia</a></li>
            </ul>
          </div>
        </div>
      </footer>
      <div class="assinatura"><div class="container">
        <span>${esc(M.razao)} · CNPJ ${esc(M.cnpj)}</span>
        <span>Pagamentos processados pelo Mercado Pago</span>
      </div></div>
      <a id="btn-whats" href="${linkWhats('Olá! Vim pela loja online da Mio Peça.')}" target="_blank" rel="noopener">${ic.whats}<span>Fale no WhatsApp</span></a>`;
  }

  // ---------- card de produto ----------
  function cardProduto(p) {
    const foto = p.imagem ? `<img src="${esc(p.imagem)}" alt="${esc(p.nome)}" loading="lazy" width="200" height="200">` : `<span class="sem-foto">${ic.foto}</span>`;
    return `<a class="card" href="/produto.html?p=${esc(p.slug)}">
      <div class="foto">${foto}</div>
      <div class="info">
        <span class="nome">${esc(p.nome)}</span>
        ${p.disponivel ? '' : '<span><span class="selo selo-esgotado">Esgotado</span></span>'}
        <span class="preco">${brl(p.preco)}</span>
        <span class="pix">Pix, cartão ou boleto</span>
      </div>
    </a>`;
  }

  let categoriasCache = null;
  async function categorias() {
    if (!categoriasCache) { try { categoriasCache = await api('/api/categorias'); } catch { categoriasCache = []; } }
    return categoriasCache;
  }

  async function iniciar() {
    montarCabecalho([]);
    montarRodape();
    const cats = await categorias();
    // remonta o menu de categorias com as que têm produtos
    const nav = document.querySelector('.nav-cat .container');
    if (nav) {
      const catAtual = qs('cat');
      nav.innerHTML = `<a href="/loja.html" class="${location.pathname.startsWith('/loja') && !catAtual && !qs('q') ? 'ativo' : ''}">Todas as peças</a>` +
        cats.filter((c) => c.total > 0).map((c) => `<a href="/loja.html?cat=${c.slug}" class="${catAtual === c.slug ? 'ativo' : ''}">${esc(c.nome)}</a>`).join('');
    }
  }

  window.Mio = { esc, brl, qs, api, toast, ic, pitIcone, catIcone, Carrinho, cardProduto, categorias, linkWhats, cfg: M };
  document.addEventListener('DOMContentLoaded', iniciar);
})();
