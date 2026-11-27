// Painel da Mio Peça: conexão com o Bling, curadoria do catálogo e pedidos.
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const data = (s) => (s ? new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
  const STATUS = { aguardando_pagamento: 'Aguardando pagamento', pago: 'Pago', enviado: 'Enviado', entregue: 'Entregue', cancelado: 'Cancelado' };

  async function api(caminho, opts = {}) {
    const res = await fetch(caminho, { method: opts.method || 'GET', headers: opts.body ? { 'Content-Type': 'application/json' } : {}, body: opts.body ? JSON.stringify(opts.body) : undefined, credentials: 'same-origin' });
    let d = null; try { d = await res.json(); } catch {}
    if (res.status === 401 && !caminho.endsWith('/login')) { mostrarLogin(); throw new Error('Sessão expirada.'); }
    if (!res.ok) throw new Error(d?.erro || `Erro ${res.status}`);
    return d;
  }
  function toast(msg, erro) {
    let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.style.background = erro ? 'var(--erro)' : ''; t.classList.add('on');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 3200);
  }
  function mostrarLogin() { $('#tela-login').hidden = false; $('#app').hidden = true; }

  $('#form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api('/api/admin/login', { method: 'POST', body: { senha: $('#senha').value } }); $('#tela-login').hidden = true; iniciar(); }
    catch (err) { $('#login-erro').textContent = err.message; $('#login-erro').hidden = false; }
  });
  $('#sair').addEventListener('click', async () => { await api('/api/admin/logout', { method: 'POST' }).catch(() => {}); location.reload(); });

  let status = null, abaAtual = 'geral';
  $('#abas').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) abrir(b.dataset.aba); });
  function abrir(aba) {
    abaAtual = aba;
    document.querySelectorAll('#abas button').forEach((b) => b.classList.toggle('ativo', b.dataset.aba === aba));
    document.querySelectorAll('[data-painel]').forEach((s) => { s.hidden = s.dataset.painel !== aba; });
    ({ geral: renderGeral, produtos: renderProdutos, pedidos: renderPedidos })[aba]();
  }

  // ---------------- Visão geral ----------------
  let pollSync = null;
  async function renderGeral() {
    const el = $('[data-painel=geral]');
    status = await api('/api/admin/status');
    const s = status, ped = Object.fromEntries(s.pedidos.map((p) => [p.status, p]));
    const pagos = ['pago', 'enviado', 'entregue'].reduce((a, k) => a + (ped[k]?.v || 0), 0);
    const ok = (b) => (b ? '<span class="chip chip-ok">ok</span>' : '<span class="chip chip-b">pendente</span>');
    el.innerHTML = `
      ${new URLSearchParams(location.search).get('bling') === 'ok' ? '<div class="aviso aviso-ok" style="margin-top:16px">Bling conectado. A primeira sincronização começou e leva alguns minutos (o Bling limita a 3 consultas por segundo).</div>' : ''}
      <div class="kpis">
        <div class="kpi"><div class="v">${s.produtos.publicados || 0}</div><div class="l">produtos no ar</div></div>
        <div class="kpi"><div class="v">${s.produtos.ativos || 0}</div><div class="l">produtos ativos no Bling</div></div>
        <div class="kpi"><div class="v">${ped.aguardando_pagamento?.n || 0}</div><div class="l">pedidos aguardando pagamento</div></div>
        <div class="kpi"><div class="v">${ped.pago?.n || 0}</div><div class="l">pedidos pagos para separar</div></div>
        <div class="kpi"><div class="v">${brl(pagos)}</div><div class="l">vendido (pagos)</div></div>
      </div>
      <div class="painel-box">
        <h2>Integrações</h2>
        <div class="config-lista">
          <div class="l"><div><b>Bling</b> ${ok(s.bling.conectado)}<br><small style="color:var(--texto-2)">${s.bling.conectado ? `${esc(s.bling.empresa?.nome || '')} · ${esc(s.bling.empresa?.cnpj || '')}` : s.bling.configurado ? 'Credenciais configuradas. Falta autorizar.' : 'Faltam BLING_CLIENT_ID e BLING_CLIENT_SECRET no servidor.'}</small><br><small>URL de retorno do app no Bling: <code>${esc(s.bling.callback)}</code></small></div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">${s.bling.configurado ? `<a class="btn btn-pequeno ${s.bling.conectado ? '' : 'btn-primario'}" href="/api/admin/bling/conectar">${s.bling.conectado ? 'Reconectar' : 'Conectar Bling'}</a>` : ''}</div></div>
          <div class="l"><div><b>Sincronização do catálogo</b><br><small style="color:var(--texto-2)" id="sync-txt"></small></div>
            <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-pequeno" id="sync-rapido" ${s.bling.conectado ? '' : 'disabled'}>Atualizar preço e estoque</button><button class="btn btn-pequeno" id="sync-completo" ${s.bling.conectado ? '' : 'disabled'}>Reler tudo (fotos e descrições)</button></div></div>
          <div class="l"><div><b>Mercado Pago</b> ${ok(s.mp.configurado)}<br><small style="color:var(--texto-2)">${s.mp.configurado ? (s.mp.webhook ? `Notificações: <code>${esc(s.mp.webhook)}</code>` : 'Sem HTTPS: o status do pagamento é conferido quando o cliente volta ao site ou pelo botão “Conferir pagamento” no pedido.') : 'Sem MP_ACCESS_TOKEN: pedidos ficam registrados e o pagamento é combinado pelo WhatsApp.'}</small></div></div>
          <div class="l"><div><b>Pedido no Bling</b><br><small style="color:var(--texto-2)">${s.bling.pedidoAuto ? 'Automático: pedido pago vira pedido de venda no Bling.' : 'Manual: em cada pedido pago, clique em “Enviar ao Bling”.'}</small></div></div>
          <div class="l"><div><b>Frete</b><br><small style="color:var(--texto-2)">Retirada grátis · Entrega em São José dos Campos ${brl(s.frete.local)} · Correios/transportadoras ${s.frete.melhorEnvio ? 'via Melhor Envio' : '<b>desligado</b> (falta MELHOR_ENVIO_TOKEN)'}</small></div></div>
        </div>
      </div>
      <div class="painel-box"><h2>Últimos eventos</h2><div id="eventos" style="font-size:13px"></div></div>`;
    $('#sync-rapido')?.addEventListener('click', () => dispararSync(false));
    $('#sync-completo')?.addEventListener('click', () => dispararSync(true));
    atualizarSyncTxt(s.sync);
    if (s.sync.rodando) acompanharSync();
    const ev = await api('/api/admin/eventos');
    $('#eventos').innerHTML = ev.length ? ev.slice(0, 25).map((e) => `<div style="padding:5px 0;border-bottom:1px solid var(--linha)"><span style="color:var(--texto-2)">${data(e.em)}</span> · <b>${esc(e.tipo)}</b> <span style="color:var(--texto-2)">${esc(e.dados).slice(0, 160)}</span></div>`).join('') : '<p style="color:var(--texto-2)">Nada ainda.</p>';
  }
  function atualizarSyncTxt(sy) {
    const t = $('#sync-txt'); if (!t) return;
    t.textContent = sy.rodando ? `Rodando: ${sy.etapa} (${sy.lidos} lidos, ${sy.detalhados} detalhados)…`
      : `${sy.ultimo ? `Última: ${data(sy.ultimo.em)} (${sy.ultimo.lidos} produtos)` : 'Ainda não sincronizou.'} · Automática a cada ${sy.intervaloMin} min${sy.erro ? ` · Último erro: ${sy.erro}` : ''}`;
  }
  async function dispararSync(completo) {
    try { await api('/api/admin/sync', { method: 'POST', body: { completo } }); toast('Sincronização iniciada'); acompanharSync(); } catch (e) { toast(e.message, true); }
  }
  function acompanharSync() {
    clearInterval(pollSync);
    pollSync = setInterval(async () => {
      const s = await api('/api/admin/status').catch(() => null); if (!s) return;
      atualizarSyncTxt(s.sync);
      if (!s.sync.rodando) { clearInterval(pollSync); if (abaAtual === 'geral') renderGeral(); toast(s.sync.erro ? 'Sincronização terminou com erro' : 'Catálogo sincronizado', !!s.sync.erro); }
    }, 3000);
  }

  // ---------------- Produtos ----------------
  const filtroProd = { q: '', filtro: 'prontos', cat: '', pagina: 1 };
  async function renderProdutos() {
    const el = $('[data-painel=produtos]');
    if (!status) status = await api('/api/admin/status');
    const cats = status.categorias;
    if (!el.dataset.montado) {
      el.dataset.montado = '1';
      el.innerHTML = `
        <div class="aviso aviso-info" style="margin-top:16px">O catálogo do Bling da Mio é uma lista de candidatos: nada vai ao ar sozinho. Ligue “No ar” só nos produtos que fazem sentido vender online. Itens com <span class="chip chip-b">bloqueio</span> precisam ser corrigidos no Bling primeiro (preço, foto ou descrição).</div>
        <div class="filtros">
          <input id="f-q" type="search" placeholder="Buscar por nome ou código" style="min-width:240px">
          <select id="f-filtro">
            <option value="prontos">Prontos para publicar</option>
            <option value="publicados">No ar</option>
            <option value="bloqueados">Com bloqueio</option>
            <option value="todos">Todos</option>
          </select>
          <select id="f-cat"><option value="">Todas as categorias</option>${cats.map((c) => `<option value="${c.slug}">${esc(c.nome)}</option>`).join('')}</select>
          <span id="f-total" style="color:var(--texto-2);font-size:14px"></span>
        </div>
        <div class="tab-wrap"><table class="tabela"><thead><tr>
          <th></th><th>Produto</th><th class="num">Preço</th><th class="num">Estoque</th><th>Categoria no site</th><th>Higiene</th><th>Destaque</th><th>No ar</th>
        </tr></thead><tbody id="prod-corpo"></tbody></table></div>
        <div class="paginacao" id="prod-pag"></div>`;
      let t;
      $('#f-q').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { filtroProd.q = e.target.value; filtroProd.pagina = 1; carregarProdutos(); }, 300); });
      $('#f-filtro').addEventListener('change', (e) => { filtroProd.filtro = e.target.value; filtroProd.pagina = 1; carregarProdutos(); });
      $('#f-cat').addEventListener('change', (e) => { filtroProd.cat = e.target.value; filtroProd.pagina = 1; carregarProdutos(); });
      $('#prod-corpo').addEventListener('change', async (e) => {
        const tr = e.target.closest('tr'); if (!tr) return;
        const id = tr.dataset.id, campo = e.target.dataset.campo;
        const valor = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        try {
          await api(`/api/admin/produtos/${id}`, { method: 'PATCH', body: { [campo]: valor } });
          toast(campo === 'publicado' ? (valor ? 'Produto no ar' : 'Produto fora do ar') : 'Salvo');
        } catch (err) { toast(err.message, true); if (e.target.type === 'checkbox') e.target.checked = !valor; }
      });
      $('#prod-corpo').addEventListener('click', async (e) => {
        const b = e.target.closest('[data-acao=reler]'); if (!b) return;
        b.disabled = true; b.textContent = 'Lendo…';
        try { await api(`/api/admin/produtos/${b.closest('tr').dataset.id}/atualizar`, { method: 'POST' }); toast('Produto relido do Bling'); carregarProdutos(); } catch (err) { toast(err.message, true); b.disabled = false; b.textContent = 'Reler'; }
      });
      $('#prod-pag').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; filtroProd.pagina = Number(b.dataset.p); carregarProdutos(); });
    }
    $('#f-filtro').value = filtroProd.filtro;
    carregarProdutos();
  }
  async function carregarProdutos() {
    const corpo = $('#prod-corpo');
    corpo.innerHTML = '<tr><td colspan="8" class="carregando">Carregando…</td></tr>';
    const p = new URLSearchParams({ q: filtroProd.q, filtro: filtroProd.filtro, cat: filtroProd.cat, pagina: filtroProd.pagina });
    const r = await api('/api/admin/produtos?' + p);
    $('#f-total').textContent = `${r.total} produto(s)`;
    const cats = status.categorias;
    corpo.innerHTML = r.itens.length ? r.itens.map((x) => `
      <tr data-id="${x.id}">
        <td>${x.imagem ? `<img src="${esc(x.imagem)}" alt="">` : '<div style="width:48px;height:48px;border:1px dashed var(--linha);border-radius:6px"></div>'}</td>
        <td style="min-width:260px"><div>${esc(x.nome)}</div><small style="color:var(--texto-2)">${esc(x.codigo || 'sem código')} · Bling ${x.id}</small><br>
          <input type="text" data-campo="titulo_site" placeholder="Título no site (opcional)" value="${esc(x.titulo_site || '')}" style="margin-top:4px;max-width:320px;width:100%"></td>
        <td class="num">${brl(x.preco)}${x.custo ? `<br><small style="color:var(--texto-2)">custo ${brl(x.custo)}</small>` : ''}</td>
        <td class="num">${Math.floor(x.estoque)}</td>
        <td><select data-campo="categoria_site">${cats.map((c) => `<option value="${c.slug}" ${c.slug === x.categoria_site ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></td>
        <td style="min-width:180px">${x.bloqueios.map((b) => `<span class="chip chip-b">${esc(b)}</span>`).join('')}${x.avisos.map((a) => `<span class="chip chip-a">${esc(a)}</span>`).join('')}${!x.bloqueios.length && !x.avisos.length ? '<span class="chip chip-ok">ok</span>' : ''}
          ${!x.detalhado || x.bloqueios.includes('sem imagem') ? '<br><button class="btn btn-pequeno" data-acao="reler" style="margin-top:4px;padding:3px 10px">Reler</button>' : ''}</td>
        <td><label class="interruptor"><input type="checkbox" data-campo="destaque" ${x.destaque ? 'checked' : ''} aria-label="Destaque"><span></span></label></td>
        <td><label class="interruptor"><input type="checkbox" data-campo="publicado" ${x.publicado ? 'checked' : ''} ${x.bloqueios.length && !x.publicado ? 'disabled' : ''} aria-label="No ar"><span></span></label></td>
      </tr>`).join('') : `<tr><td colspan="8" class="carregando">${status.bling.conectado ? 'Nenhum produto neste filtro.' : 'Conecte o Bling na Visão geral para trazer o catálogo.'}</td></tr>`;
    const paginas = Math.ceil(r.total / 50);
    $('#prod-pag').innerHTML = paginas > 1 ? Array.from({ length: paginas }, (_, i) => `<button class="${i + 1 === filtroProd.pagina ? 'ativo' : ''}" data-p="${i + 1}">${i + 1}</button>`).join('') : '';
  }

  // ---------------- Pedidos ----------------
  let pedidos = [];
  async function renderPedidos() {
    const el = $('[data-painel=pedidos]');
    el.innerHTML = `<div class="filtros"><select id="f-st"><option value="">Todos os status</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
      <div class="tab-wrap"><table class="tabela"><thead><tr><th>Pedido</th><th>Data</th><th>Cliente</th><th>Entrega</th><th class="num">Total</th><th>Status</th><th>Bling</th><th></th></tr></thead><tbody id="ped-corpo"></tbody></table></div>`;
    $('#f-st').addEventListener('change', carregarPedidos);
    $('#ped-corpo').addEventListener('click', (e) => { const b = e.target.closest('[data-ver]'); if (b) verPedido(Number(b.dataset.ver)); });
    carregarPedidos();
  }
  async function carregarPedidos() {
    const st = $('#f-st').value;
    pedidos = await api('/api/admin/pedidos' + (st ? `?status=${st}` : ''));
    $('#ped-corpo').innerHTML = pedidos.length ? pedidos.map((p) => `
      <tr><td><b>${esc(p.codigo)}</b></td><td>${data(p.criado_em)}</td><td>${esc(p.cliente.nome)}<br><small style="color:var(--texto-2)">${esc(p.cliente.telefone)}</small></td>
        <td>${esc(p.frete_nome || '')}</td><td class="num">${brl(p.total)}</td><td><span class="st st-${p.status}">${STATUS[p.status] || p.status}</span></td>
        <td>${p.bling_pedido_id ? `<span class="chip chip-ok">nº ${esc(p.bling_numero || p.bling_pedido_id)}</span>` : p.bling_erro ? '<span class="chip chip-b">erro</span>' : '—'}</td>
        <td><button class="btn btn-pequeno" data-ver="${p.id}">Abrir</button></td></tr>`).join('') : '<tr><td colspan="8" class="carregando">Nenhum pedido ainda.</td></tr>';
  }
  function verPedido(id) {
    const p = pedidos.find((x) => x.id === id); if (!p) return;
    const end = p.endereco ? `${esc(p.endereco.rua)}, ${esc(p.endereco.numero)} ${esc(p.endereco.complemento || '')}<br>${esc(p.endereco.bairro)} · ${esc(p.endereco.cidade)}/${esc(p.endereco.uf)} · CEP ${esc(p.endereco.cep)}` : 'Retirada na loja';
    const whats = `https://wa.me/55${String(p.cliente.telefone).replace(/^55/, '')}?text=${encodeURIComponent(`Olá, ${p.cliente.nome.split(' ')[0]}! Aqui é da Mio Peça, sobre o seu pedido ${p.codigo}.`)}`;
    $('#dlg-titulo').textContent = `Pedido ${p.codigo}`;
    $('#dlg-corpo').innerHTML = `
      <p><b>${esc(p.cliente.nome)}</b> · CPF ${esc(p.cliente.cpf)}<br>${esc(p.cliente.email)} · <a href="${whats}" target="_blank" rel="noopener">${esc(p.cliente.telefone)}</a></p>
      <p><b>Entrega:</b> ${esc(p.frete_nome || '')}<br>${end}</p>
      <table class="tabela" style="margin:10px 0">${p.itens.map((i) => `<tr><td>${i.qtd}×</td><td>${esc(i.nome)}<br><small style="color:var(--texto-2)">${esc(i.codigo)}</small></td><td class="num">${brl(i.preco * i.qtd)}</td></tr>`).join('')}
        <tr><td></td><td>Frete</td><td class="num">${brl(p.frete)}</td></tr><tr><td></td><td><b>Total</b></td><td class="num"><b>${brl(p.total)}</b></td></tr></table>
      <p><b>Mercado Pago:</b> ${p.mp_pagamento ? `pagamento ${esc(p.mp_pagamento)} (${esc(p.mp_status)})` : p.mp_preferencia ? 'link gerado, sem pagamento ainda' : 'sem link (pagamento a combinar)'}</p>
      ${p.bling_erro ? `<div class="aviso aviso-erro">Erro ao enviar ao Bling: ${esc(p.bling_erro)}</div>` : ''}
      <div class="campos" style="margin-top:10px">
        <div class="campo m3"><label for="d-st">Status</label><select id="d-st">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${k === p.status ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div class="campo"><label for="d-obs">Observação interna</label><textarea id="d-obs" rows="2">${esc(p.obs_interna || '')}</textarea></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
        <button class="btn btn-primario btn-pequeno" id="d-salvar">Salvar</button>
        ${p.mp_preferencia ? '<button class="btn btn-pequeno" id="d-conferir">Conferir pagamento</button>' : ''}
        ${p.status === 'pago' && !p.bling_pedido_id ? '<button class="btn btn-comprar btn-pequeno" id="d-bling">Enviar ao Bling</button>' : ''}
      </div>
      ${p.status === 'pago' && !p.bling_pedido_id ? '<p style="font-size:12.5px;color:var(--texto-2)">“Enviar ao Bling” cria o pedido de venda na conta da Mio (com o cliente cadastrado pelo CPF). A nota fiscal continua sendo emitida por você no Bling.</p>' : ''}`;
    $('#d-salvar').onclick = async () => {
      if ($('#d-st').value === 'pago' && p.status !== 'pago' && !confirm('Marcar como pago manualmente? Use só se o pagamento foi confirmado fora do Mercado Pago.')) return;
      try { await api(`/api/admin/pedidos/${p.id}`, { method: 'PATCH', body: { status: $('#d-st').value, obs_interna: $('#d-obs').value } }); toast('Pedido salvo'); $('#dlg').close(); carregarPedidos(); } catch (e) { toast(e.message, true); }
    };
    if ($('#d-conferir')) $('#d-conferir').onclick = async () => {
      try { const r = await api(`/api/admin/pedidos/${p.id}/conferir-pagamento`, { method: 'POST' }); toast(r.encontrado ? `Pagamento: ${r.status}` : 'Nenhum pagamento encontrado'); $('#dlg').close(); carregarPedidos(); } catch (e) { toast(e.message, true); }
    };
    if ($('#d-bling')) $('#d-bling').onclick = async (ev) => {
      if (!confirm(`Criar o pedido de venda ${p.codigo} (${brl(p.total)}) no Bling da Mio?`)) return;
      ev.target.disabled = true; ev.target.textContent = 'Enviando…';
      try { await api(`/api/admin/pedidos/${p.id}/bling`, { method: 'POST' }); toast('Pedido criado no Bling'); $('#dlg').close(); carregarPedidos(); } catch (e) { toast(e.message, true); ev.target.disabled = false; ev.target.textContent = 'Enviar ao Bling'; }
    };
    $('#dlg').showModal();
  }

  async function iniciar() {
    try { status = await api('/api/admin/status'); } catch { return; }
    $('#app').hidden = false;
    abrir('geral');
  }
  iniciar();
})();
