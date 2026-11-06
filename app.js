'use strict';
/* =====================================================================
   Senhas — venda e impressão de senhas (Fase 1)
   Dados guardados só neste aparelho (IndexedDB «senhas-bd»).
   A estrutura dos dados está pensada para passar mais tarde ao Firebase.
   ===================================================================== */

const VERSAO = '1.1';
const PROD_N = 14;
const PAC_N = 2;
const SENHA_INICIAL = '1234';

// Certificado público da app (o QZ Tray confia nele através do ficheiro override.crt)
const CERT_QZ = `-----BEGIN CERTIFICATE-----
MIIEFTCCAv2gAwIBAgIUP/83/OlvrDgMuXQWklp7JnFpOoYwDQYJKoZIhvcNAQEL
BQAwgZkxCzAJBgNVBAYTAlBUMQ8wDQYDVQQHDAZBbGZlbmExHDAaBgNVBAoME01v
dG9jbHViZSBkZSBBbGZlbmExDzANBgNVBAsMBlNlbmhhczEjMCEGA1UEAwwaU2Vu
aGFzIE1vdG9jbHViZSBkZSBBbGZlbmExJTAjBgkqhkiG9w0BCQEWFnNlbmhhc0Bt
b3RvY2x1YmUubG9jYWwwHhcNMjYxMTA2MjA1MjEyWhcNNDYxMTAxMjA1MjEyWjCB
mTELMAkGA1UEBhMCUFQxDzANBgNVBAcMBkFsZmVuYTEcMBoGA1UECgwTTW90b2Ns
dWJlIGRlIEFsZmVuYTEPMA0GA1UECwwGU2VuaGFzMSMwIQYDVQQDDBpTZW5oYXMg
TW90b2NsdWJlIGRlIEFsZmVuYTElMCMGCSqGSIb3DQEJARYWc2VuaGFzQG1vdG9j
bHViZS5sb2NhbDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAJhcyF0O
gFHxAk3C9sl2qvw4Mt2MZ3ONvRbd1oLNMLp1P9/ss4v/i+IdymjQgZBPqAhviKZT
h61S0ljId9I9eiG4zJp2mJn/Nhoi5M4BkSf/NCWUdlnGWIcPKNRzMQY/Zj7Ygu0Y
YasBDWBe0f/3fvhzMNvQ0eHqca+E4f02DEdhFE4aatwFSNn6hFwOQLZCaUwo8ojd
swhW2QLlElLgfvGiyL1hy0q2cSpdCN3XG/dq2KEFsPLLOxxff/dv76zhJwrB3/qj
jsjBoBlIhSGe0NIktKYxcFaNf1KvkGpMoT1bzLFcThm/w74ly7G8/dWGDpGZnEWB
DeHVgErIrScvkAsCAwEAAaNTMFEwHQYDVR0OBBYEFGSn9dI0EZSERzVZ+u3Q8jZf
pDtuMB8GA1UdIwQYMBaAFGSn9dI0EZSERzVZ+u3Q8jZfpDtuMA8GA1UdEwEB/wQF
MAMBAf8wDQYJKoZIhvcNAQELBQADggEBAIeUtHBZTdoAzStjtlydtgo5OSltFKEc
Pwl9OPpxo8BVndE3ihLxPe9XJu5JPUoG5zxUQm4kqBBOn61vKJ4Z3WJ1jV+MGmQg
wQUw18pllcAA2O3qtSyZ49A7UvapGUVcF5zwmke9e9rBgVjDH+6C/nUpt9gnEeFa
ItSg5jXZxtf5pgE1+j6K0K+08ZwTYF1MuLqlkiVC7W5M0NJXkTeCPDtf7idNF4i6
32ggd747elGSf13OFPW9XCH6O2JtURC6sVZvL5ACjciE+1hDxzspUHH+oX10XCsR
ea3ubs+lUfOXZrJO15vRzpMV0Fg1mqdg4t/YMyevI9g2u6ReKgtWcWs=
-----END CERTIFICATE-----`;

const CONFIG_PADRAO = {
  evento: 'Magusto 2026/1', data: '2026-11-04', posto: 'Posto 1',
  largura: 80, alturaSenha: 45, logo: '', senhaHash: '',
  modoImpressao: 'qz', impressora: 'BP-T3', avanco: 3, imgModo: 'gs_v_0', chaveQZ: ''
};

const CORES = {
  'Laranja': '#e67e22', 'Azul': '#2980b9', 'Verde': '#27ae60', 'Vermelho': '#c0392b',
  'Roxo': '#8e44ad', 'Turquesa': '#16a085', 'Rosa': '#d63384', 'Castanho': '#795548',
  'Azul claro': '#3498db', 'Dourado': '#d4a017'
};

let E = null;          // estado completo (o que é gravado)
let modo = null;       // 'VENDEDOR' | 'ADMIN'
let ecra = 'entrada';  // ecrã visível

/* =====================================================================
   Armazenamento (IndexedDB)
   ===================================================================== */
const BD_NOME = 'senhas-bd', BD_LOJA = 'dados', BD_CHAVE = 'estado';
let bd = null;

function abrirBD() {
  if (bd) return Promise.resolve(bd);
  return new Promise((ok, erro) => {
    const r = indexedDB.open(BD_NOME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(BD_LOJA);
    r.onsuccess = () => { bd = r.result; ok(bd); };
    r.onerror = () => erro(r.error);
  });
}

async function lerEstado() {
  const b = await abrirBD();
  return new Promise((ok, erro) => {
    const q = b.transaction(BD_LOJA, 'readonly').objectStore(BD_LOJA).get(BD_CHAVE);
    q.onsuccess = () => ok(q.result || null);
    q.onerror = () => erro(q.error);
  });
}

async function escreverEstado() {
  const b = await abrirBD();
  return new Promise((ok, erro) => {
    const tx = b.transaction(BD_LOJA, 'readwrite');
    tx.objectStore(BD_LOJA).put(E, BD_CHAVE);
    tx.oncomplete = () => ok();
    tx.onerror = () => erro(tx.error);
  });
}

let filaGravar = Promise.resolve();
function guardar() {
  filaGravar = filaGravar.then(escreverEstado).catch(e => aviso('Erro ao gravar os dados: ' + e));
  return filaGravar;
}

/* =====================================================================
   Estado inicial (produtos e pacotes do Senhas.xlsm)
   ===================================================================== */
function estadoInicial() {
  const base = [
    ['Bifana', 0, 'C', 'Laranja', true, false],
    ['Finos', 1.5, 'B', 'Azul', true, true],
    ['Caldo Verde', 3.5, 'P01', 'Verde', true, false],
    ['Febra Grelhada', 1, 'P02', 'Roxo', true, false],
    ['Chouriço Assado', 5, 'P03', 'Turquesa', false, false],
    ['Salgados', 4, 'P04', 'Rosa', true, false]
  ];
  const coresResto = ['Castanho', 'Azul claro', 'Dourado', 'Vermelho', 'Verde', 'Roxo', 'Turquesa', 'Rosa'];
  const produtos = [];
  for (let i = 0; i < PROD_N; i++) {
    const b = base[i];
    produtos.push(b
      ? { nome: b[0], preco: b[1], prefixo: b[2], cor: b[3], ativo: b[4], usaPacotes: b[5], prox: 1 }
      : { nome: '', preco: 0, prefixo: 'P' + String(i - 1).padStart(2, '0'), cor: coresResto[i - 6], ativo: false, usaPacotes: false, prox: 1 });
  }
  return {
    versaoDados: 1,
    config: { ...CONFIG_PADRAO },
    pacotes: [{ senhas: 8, valor: 10 }, { senhas: 18, valor: 20 }],
    produtos,
    registo: [],        // uma linha por linha de pedido impressa
    fechos: [],         // Fase 2
    fechosDetalhe: [],  // Fase 2
    pedido: [],         // pedido em curso
    ultimoPedido: ''
  };
}

/* =====================================================================
   Utilitários
   ===================================================================== */
const $ = id => document.getElementById(id);
const r2 = x => Math.round((x + Number.EPSILON) * 100) / 100;
const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : 0; };
const int = v => { const n = parseInt(v, 10); return isFinite(n) ? n : 0; };
const euro = v => r2(v).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const euroCurto = v => (Number.isInteger(r2(v)) ? String(r2(v)) : r2(v).toLocaleString('pt-PT', { minimumFractionDigits: 2 })) + ' €';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dataPT = iso => { if (!iso) return ''; const [a, m, d] = iso.split('-'); return `${d}/${m}/${a}`; };
const horaPT = d => d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

async function hash(texto) {
  const dados = new TextEncoder().encode('senhas:' + texto);
  const h = await crypto.subtle.digest('SHA-256', dados);
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* =====================================================================
   Produtos e pacotes
   ===================================================================== */
const prod = i => E.produtos[i];
const prodExiste = i => !!(prod(i) && prod(i).nome.trim());
const corProd = i => CORES[prod(i).cor] || '#7f8c8d';

function pacValido(k) { const p = E.pacotes[k - 1]; return !!p && p.senhas > 0 && p.valor > 0; }
function pacUnit(k) { const p = E.pacotes[k - 1]; return p.senhas > 0 ? p.valor / p.senhas : 0; }

// Produto dos botões PACOTE 1 / PACOTE 2: o 1.º com «Usa pacotes» (-1 = nenhum)
function prodPacotes() {
  for (let i = 0; i < PROD_N; i++) if (prodExiste(i) && prod(i).usaPacotes) return i;
  return -1;
}

function descontoPacote(i, k) {
  const p = E.pacotes[k - 1];
  return Math.max(0, r2(r2(p.senhas * prod(i).preco) - p.valor));
}

// Divide uma quantidade em partes (cada parte = uma linha do pedido)
// Ex.: Finos 37 = Pacote 2 + Pacote 2 + Avulso 1
function dividirQtd(i, qtd) {
  const partes = [];
  let resto = qtd;
  const p = prod(i);
  if (p.usaPacotes) {
    const ordem = [1, 2].filter(pacValido).sort((a, b) => E.pacotes[b - 1].senhas - E.pacotes[a - 1].senhas);
    for (const k of ordem) {
      const s = E.pacotes[k - 1].senhas;
      while (resto >= s) {
        partes.push({ fmt: 'Pacote ' + k, qtd: s, valor: E.pacotes[k - 1].valor, desc: descontoPacote(i, k) });
        resto -= s;
      }
    }
  }
  if (resto > 0) partes.push({ fmt: p.usaPacotes ? 'Avulso' : 'Normal', qtd: resto, valor: r2(resto * p.preco), desc: 0 });
  return partes;
}

function precoParte(i, fmt) {
  if (fmt.startsWith('Pacote ')) return pacUnit(int(fmt.slice(7)));
  if (fmt === 'Oferta') return 0;
  return prod(i).preco;
}

function fmtCurto(fmt) {
  if (fmt.startsWith('Pacote ')) return 'P' + fmt.slice(7);
  if (fmt === 'Avulso') return 'AV';
  if (fmt === 'Oferta') return 'OF';
  return '-';
}

function verificarProdutos(lista) {
  const erros = [];
  for (let i = 0; i < PROD_N; i++) {
    const a = lista[i];
    if (!a.nome.trim()) continue;
    if (a.nome.length > 20) erros.push(`Nº ${i + 1}: o nome tem mais de 20 letras.`);
    if (!a.prefixo.trim()) erros.push(`Nº ${i + 1}: falta o prefixo.`);
    for (let j = i + 1; j < PROD_N; j++) {
      const b = lista[j];
      if (!b.nome.trim()) continue;
      if (a.nome.trim().toLowerCase() === b.nome.trim().toLowerCase()) erros.push(`Nome repetido: ${a.nome} (nº ${i + 1} e ${j + 1}).`);
      if (a.prefixo.trim().toLowerCase() === b.prefixo.trim().toLowerCase()) erros.push(`Prefixo repetido: ${a.prefixo} (nº ${i + 1} e ${j + 1}).`);
    }
  }
  return erros;
}

/* =====================================================================
   Janela de diálogo (substitui alert/confirm/prompt)
   ===================================================================== */
function janela({ titulo = 'Senhas', html = '', botoes = [{ texto: 'OK', classe: 'azul', valor: true }], input = null }) {
  return new Promise(ok => {
    $('modalTitulo').textContent = titulo;
    $('modalCorpo').innerHTML = html;
    const inp = $('modalInput');
    if (input) {
      inp.hidden = false;
      inp.type = input.tipo || 'text';
      inp.value = input.valor || '';
      inp.placeholder = input.placeholder || '';
      inp.maxLength = input.max || 80;
    } else inp.hidden = true;
    const caixa = $('modalBotoes');
    caixa.innerHTML = '';
    const fechar = v => {
      $('fundoModal').hidden = true;
      document.removeEventListener('keydown', teclas);
      ok(input ? (v ? inp.value.trim() : null) : v);
    };
    botoes.forEach(b => {
      const el = document.createElement('button');
      el.className = 'btn ' + (b.classe || 'azul');
      el.textContent = b.texto;
      el.onclick = () => fechar(b.valor);
      caixa.appendChild(el);
    });
    const teclas = e => {
      if (e.key === 'Escape') fechar(botoes[0].valor);
      if (e.key === 'Enter' && input) { e.preventDefault(); fechar(true); }
    };
    document.addEventListener('keydown', teclas);
    $('fundoModal').hidden = false;
    if (input) setTimeout(() => inp.focus(), 50);
    else setTimeout(() => caixa.lastChild && caixa.lastChild.focus(), 50);
  });
}
const aviso = (texto, titulo = 'Senhas') => janela({ titulo, html: esc(texto).replace(/\n/g, '<br>') });
const confirmar = (html, titulo = 'Senhas', sim = 'SIM', nao = 'NÃO') =>
  janela({ titulo, html, botoes: [{ texto: nao, classe: 'cinza', valor: false }, { texto: sim, classe: 'verde', valor: true }] });
const perguntar = (html, titulo, input) =>
  janela({ titulo, html, input, botoes: [{ texto: 'CANCELAR', classe: 'cinza', valor: false }, { texto: 'OK', classe: 'verde', valor: true }] });

/* =====================================================================
   Navegação e modos
   ===================================================================== */
function mostrar(qual) {
  ecra = qual;
  $('ecraEntrada').hidden = qual !== 'entrada';
  $('topo').hidden = qual === 'entrada';
  $('ecraVenda').hidden = qual !== 'venda';
  $('ecraDefinicoes').hidden = qual !== 'definicoes';
  $('navVenda').classList.toggle('ativo', qual === 'venda');
  $('navDefinicoes').classList.toggle('ativo', qual === 'definicoes');
  $('navVenda').hidden = modo !== 'ADMIN';
  $('navDefinicoes').hidden = modo !== 'ADMIN';
  $('navModo').textContent = modo === 'ADMIN' ? 'MODO: ADMIN' : 'MODO: VENDEDOR';
  if (qual === 'venda') renderVenda();
  if (qual === 'definicoes') renderDefinicoes();
  if (qual === 'entrada') renderEntrada();
  renderTopo();
  window.scrollTo(0, 0);
}

async function pedirPalavraPasse(motivo) {
  const pw = await perguntar(esc(motivo), 'Palavra-passe de administrador', { tipo: 'password', max: 40 });
  if (pw === null) return false;
  if (await hash(pw) === E.config.senhaHash) return true;
  await aviso('Palavra-passe errada.');
  return false;
}

const acoes = {
  entrarVendedor() { modo = 'VENDEDOR'; mostrar('venda'); },
  async entrarAdmin() {
    if (!await pedirPalavraPasse('Escreva a palavra-passe de administrador.')) return;
    modo = 'ADMIN';
    mostrar('venda');
    if (E.config.senhaHash === await hash(SENHA_INICIAL))
      aviso('Ainda está a usar a palavra-passe inicial (1234).\nMude-a em DEFINIÇÕES → Palavra-passe de administrador.');
  },
  irVenda() { mostrar('venda'); },
  irDefinicoes() { if (modo === 'ADMIN') mostrar('definicoes'); },
  async trocarModo() {
    if (modo === 'ADMIN') {
      if (await confirmar('Passar para o modo <b>VENDEDOR</b>?<br>Só fica disponível o ecrã de venda.', 'Modo')) {
        modo = 'VENDEDOR'; mostrar('venda');
      }
    } else {
      if (!await pedirPalavraPasse('Para passar a administrador, escreva a palavra-passe.')) return;
      modo = 'ADMIN'; mostrar(ecra === 'entrada' ? 'venda' : ecra);
    }
  },

  // ----- quantidade -----
  qtdMenos() { mudarQtd(-1); },
  qtdMais() { mudarQtd(1); },

  // ----- pedido -----
  produto(el) { adicionarProduto(int(el.dataset.i)); },
  pacote(el) { adicionarPacote(int(el.dataset.k)); },
  oferta() { ofertaUltimo(); },
  removerUltimo() { removerUltimo(); },
  limparPedido() { limparPedido(); },
  imprimirPedido() { imprimirPedido(); },

  // ----- definições -----
  gravarEvento() { gravarEvento(); },
  gravarImpressao() { gravarImpressao(); },
  procurarImpressoras() { procurarImpressoras(); },
  gravarChave() { gravarChave(); },
  apagarChave() { apagarChave(); },
  removerLogo() { removerLogo(); },
  preVisualizar() { preVisualizar(); },
  testeImpressao() { testeImpressao(); },
  gravarPacotes() { gravarPacotes(); },
  gravarProdutos() { gravarProdutos(); },
  mudarPalavraPasse() { mudarPalavraPasse(); }
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-acao]');
  if (!el || el.disabled) return;
  const f = acoes[el.dataset.acao];
  if (f) f(el);
});

/* =====================================================================
   Entrada e topo
   ===================================================================== */
function renderEntrada() {
  $('entradaEvento').textContent = E.config.evento || 'Senhas';
  $('entradaData').textContent = dataPT(E.config.data);
  const img = $('entradaLogo');
  img.hidden = !E.config.logo;
  if (E.config.logo) img.src = E.config.logo;
  $('versaoEntrada').textContent = 'Senhas v' + VERSAO + ' · dados guardados neste computador';
}

function turnoAtual() {
  let senhas = 0, valor = 0;
  for (const l of E.registo) if (l.estado === 'Válida' && !l.fecho) { senhas += l.qtd; valor += l.valor; }
  return { senhas, valor: r2(valor) };
}

function renderTopo() {
  $('topoEvento').textContent = E.config.evento;
  $('topoData').textContent = dataPT(E.config.data) + (E.config.posto ? ' · ' + E.config.posto : '');
  const t = turnoAtual();
  $('topoTurno').textContent = `TURNO: ${t.senhas} senhas · ${euro(t.valor)}`;
}

/* =====================================================================
   VENDA
   ===================================================================== */
function renderVenda() {
  const grandes = $('grelhaGrandes'), fila = $('grelhaFila');
  grandes.innerHTML = ''; fila.innerHTML = '';
  for (let i = 0; i < PROD_N; i++) {
    const b = document.createElement('button');
    b.className = 'btn prod';
    b.dataset.acao = 'produto';
    b.dataset.i = i;
    if (!prodExiste(i)) b.hidden = true;
    else {
      const p = prod(i);
      b.style.background = corProd(i);
      b.innerHTML = esc(p.nome.toUpperCase()) + (p.ativo ? '' : '<span class="sub">INDISPONÍVEL</span>');
      if (!p.ativo) b.classList.add('inativo');
    }
    (i < 2 ? grandes : fila).appendChild(b);
  }
  ajustarLetraBotoes();

  const ip = prodPacotes();
  for (let k = 1; k <= PAC_N; k++) {
    const b = $('btnPac' + k);
    const p = E.pacotes[k - 1];
    b.innerHTML = `PACOTE ${k}<br><small>${pacValido(k) ? p.senhas + ' = ' + euroCurto(p.valor) : 'não definido'}</small>`;
    const ok = ip >= 0 && pacValido(k);
    b.style.background = ok ? corProd(ip) : '';
    b.classList.toggle('desligado', !ok);
  }
  $('ultimoPedido').textContent = E.ultimoPedido || '';
  renderPedido();
}

// Letra dos botões: a palavra mais comprida tem de caber numa linha
function ajustarLetraBotoes() {
  document.querySelectorAll('.btn.prod').forEach(b => {
    if (b.hidden) return;
    const grande = b.parentElement.id === 'grelhaGrandes';
    const max = grande ? (window.innerWidth <= 700 ? 24 : 32) : 15;
    const palavras = b.firstChild && b.firstChild.nodeType === 3 ? b.firstChild.nodeValue.split(' ') : [''];
    const maior = palavras.reduce((m, w) => Math.max(m, w.length), 0);
    const larg = b.clientWidth - 12;
    let t = max;
    if (maior > 0 && larg > 0) t = Math.min(max, Math.floor(larg / (maior * 0.72)));
    b.style.fontSize = Math.max(9, t) + 'px';
  });
}
window.addEventListener('resize', () => { if (ecra === 'venda') ajustarLetraBotoes(); });

function lerQtd() { const q = int($('qtd').value); return Math.min(999, Math.max(0, q)); }
function mudarQtd(d) { $('qtd').value = Math.min(999, Math.max(0, lerQtd() + d)); }

function novoGrupo() { return E.pedido.length ? E.pedido[E.pedido.length - 1].grupo + 1 : 1; }

async function adicionarProduto(i) {
  if (!prodExiste(i)) return;
  const p = prod(i);
  if (!p.ativo) return aviso(p.nome.toUpperCase() + ' está indisponível.');
  const qtd = lerQtd();
  if (qtd < 1) return aviso('Indique primeiro a quantidade de senhas e depois clique no produto.');
  const g = novoGrupo();
  for (const parte of dividirQtd(i, qtd))
    E.pedido.push({ prod: i, qtd: parte.qtd, fmt: parte.fmt, valor: parte.valor, desc: parte.desc, motivo: '', grupo: g });
  $('qtd').value = 0;
  renderPedido();
  guardar();
}

async function adicionarPacote(k) {
  const i = prodPacotes();
  if (i < 0) return aviso('Nenhum produto tem «Usa pacotes» ligado nas Definições.');
  if (!prod(i).ativo) return aviso(prod(i).nome.toUpperCase() + ' está indisponível.');
  if (!pacValido(k)) return aviso('O Pacote ' + k + ' não está definido nas Definições.');
  const p = E.pacotes[k - 1];
  E.pedido.push({ prod: i, qtd: p.senhas, fmt: 'Pacote ' + k, valor: p.valor, desc: descontoPacote(i, k), motivo: '', grupo: novoGrupo() });
  renderPedido();
  guardar();
}

function linhasUltimoGrupo() {
  if (!E.pedido.length) return [];
  const g = E.pedido[E.pedido.length - 1].grupo;
  return E.pedido.filter(l => l.grupo === g);
}

async function ofertaUltimo() {
  const ult = linhasUltimoGrupo();
  if (!ult.length) return aviso('Primeiro indique a quantidade e clique no produto.\nDepois carregue em OFERTA.', 'Oferta');
  if (ult[0].fmt === 'Oferta') return aviso('O último produto do pedido já é uma oferta.', 'Oferta');
  const i = ult[0].prod;
  const q = ult.reduce((s, l) => s + l.qtd, 0);
  const motivo = await perguntar(
    `Oferecer <b>${q}</b> senha(s) de <b>${esc(prod(i).nome.toUpperCase())}</b>.<br>Indique o motivo (ex.: oferta à organização):`,
    'Oferta', { max: 80, placeholder: 'Motivo da oferta' });
  if (motivo === null) return;
  if (!motivo) return aviso('Sem motivo, a oferta não foi feita.', 'Oferta');
  const g = ult[0].grupo;
  E.pedido = E.pedido.filter(l => l.grupo !== g);
  E.pedido.push({ prod: i, qtd: q, fmt: 'Oferta', valor: 0, desc: 0, motivo, grupo: g });
  renderPedido();
  guardar();
}

async function removerUltimo() {
  if (!E.pedido.length) return aviso('O pedido está vazio.');
  const g = E.pedido[E.pedido.length - 1].grupo;
  E.pedido = E.pedido.filter(l => l.grupo !== g);
  renderPedido();
  guardar();
}

async function limparPedido() {
  if (!E.pedido.length) return;
  if (!await confirmar('Apagar o pedido todo?')) return;
  E.pedido = [];
  renderPedido();
  guardar();
}

function totalPedido() { return r2(E.pedido.reduce((s, l) => s + l.valor, 0)); }

function renderPedido() {
  const caixa = $('pedidoLista');
  if (!E.pedido.length) {
    caixa.innerHTML = '<div class="pedido-vazio">Pedido vazio.<br>Indique a quantidade e clique num produto.</div>';
  } else {
    let h = '<table><thead><tr><th>Produto</th><th class="tipo">Tipo</th><th class="num">Qtd</th><th class="num">Valor</th></tr></thead><tbody>';
    for (const l of E.pedido) {
      h += `<tr${l.fmt === 'Oferta' ? ' class="of"' : ''}><td>${esc(prod(l.prod).nome)}</td>` +
        `<td class="tipo">${fmtCurto(l.fmt)}</td><td class="num">${l.qtd}</td><td class="num">${euro(l.valor)}</td></tr>`;
    }
    caixa.innerHTML = h + '</tbody></table>';
    caixa.scrollTop = caixa.scrollHeight;
  }
  $('pedidoTotal').textContent = 'TOTAL ' + euro(totalPedido());
}

async function imprimirPedido() {
  if (!E.pedido.length) return aviso('O pedido está vazio.\nIndique a quantidade e clique num produto.');
  const erros = verificarProdutos(E.produtos);
  if (erros.length) return aviso('A tabela de produtos tem problemas:\n\n' + erros.join('\n') + '\n\nPeça ao administrador para corrigir.');
  for (const l of E.pedido) {
    if (!prodExiste(l.prod) || !prod(l.prod).ativo)
      return aviso(`O produto ${prod(l.prod).nome || 'nº ' + (l.prod + 1)} está indisponível.\nUse REMOVER ÚLTIMO ou LIMPAR para o tirar do pedido.`);
  }

  const total = totalPedido();
  const senhas = E.pedido.reduce((s, l) => s + l.qtd, 0);
  let h = '<table class="resumo">';
  for (const l of E.pedido) {
    h += `<tr><td><b>${esc(prod(l.prod).nome.toUpperCase())}</b> · ${esc(l.fmt)}</td><td class="num">${l.qtd} senhas</td><td class="num">${euro(l.valor)}</td></tr>`;
    if (l.fmt === 'Oferta') h += `<tr><td colspan="3"><i>Motivo: ${esc(l.motivo)}</i></td></tr>`;
  }
  h += `</table><p>Total de senhas a imprimir: <b>${senhas}</b></p><div class="cobrar">A COBRAR: ${euro(total)}</div><p>Receba o dinheiro e confirme para imprimir.</p>`;
  if (!await janela({ titulo: 'Confirmar pedido', html: h, botoes: [{ texto: 'NÃO', classe: 'cinza', valor: false }, { texto: 'SIM, IMPRIMIR', classe: 'verde', valor: true }] })) return;

  // A impressora tem de estar pronta antes de gravar
  try {
    await prepararImpressora();
  } catch (e) {
    return aviso('O pedido NÃO foi registado.\n\n' + msgErro(e), 'Impressora');
  }

  // 1) Gravar primeiro (uma linha do registo por linha do pedido)
  const agora = new Date();
  const nPed = E.registo.reduce((m, l) => Math.max(m, l.pedido), 0) + 1;
  let nVenda = E.registo.reduce((m, l) => Math.max(m, l.venda), 0);
  const nomes = [];
  for (const l of E.pedido) {
    const p = prod(l.prod);
    const ini = p.prox;
    E.registo.push({
      venda: ++nVenda, data: agora.toISOString(), produto: p.nome, prodN: l.prod + 1,
      qtd: l.qtd, ini: p.prefixo + '-' + String(ini).padStart(4, '0'),
      fim: p.prefixo + '-' + String(ini + l.qtd - 1).padStart(4, '0'),
      preco: precoParte(l.prod, l.fmt), valor: l.valor, desconto: l.desc,
      estado: 'Válida', fecho: null, anuladaEm: null, pedido: nPed,
      formato: l.fmt, motivo: l.motivo || '', posto: E.config.posto || ''
    });
    p.prox = ini + l.qtd;
    for (let s = 0; s < l.qtd; s++) nomes.push(p.nome);
  }
  E.ultimoPedido = `Nº ${nPed} · ${E.pedido.length} linha(s) · ${senhas} senhas · ${euro(total)} · ${horaPT(agora)}`;
  E.pedido = [];
  await guardar();
  renderVenda();
  renderTopo();

  // 2) Imprimir (se falhar, o pedido já está registado: tentar outra vez)
  for (;;) {
    try {
      await imprimirSenhas(nomes);
      break;
    } catch (e) {
      const outra = await janela({
        titulo: 'Impressão',
        html: `O pedido Nº ${nPed} ficou registado, mas as senhas não saíram.<br><br><i>${esc(msgErro(e))}</i><br><br>` +
          'Resolva o problema (impressora ligada, com papel, QZ Tray aberto) e carregue em TENTAR OUTRA VEZ.',
        botoes: [{ texto: 'DESISTIR', classe: 'cinza', valor: false }, { texto: 'TENTAR OUTRA VEZ', classe: 'verde', valor: true }]
      });
      if (!outra) {
        E.ultimoPedido += ' · NÃO IMPRESSO';
        await guardar();
        renderVenda();
        break;
      }
    }
  }
}

/* =====================================================================
   IMPRESSÃO DAS SENHAS
   - QZ Tray: a app envia a senha (imagem) diretamente à térmica, em ESC/POS,
     com o comprimento certo e corte depois de cada senha.
   - Browser: janela de impressão do browser (uma página por senha).
   ===================================================================== */
function mmUtil() { return int(E.config.largura) === 58 ? 48 : 72; }
function pontosLargura() { return mmUtil() * 8; } // 203 ppp = 8 pontos por mm

function msgErro(e) {
  const m = (e && (e.message || e.toString())) || 'erro desconhecido';
  if (/Unable to establish connection|failed to connect|websocket|connection/i.test(m))
    return 'Não foi possível ligar ao QZ Tray. Confirme que o QZ Tray está aberto (ícone junto ao relógio do Windows).';
  if (/not found|Cannot find printer|printer.*not/i.test(m))
    return `A impressora «${E.config.impressora}» não foi encontrada. Escolha-a outra vez em DEFINIÇÕES → PROCURAR IMPRESSORAS.`;
  if (/blocked|rejected|denied/i.test(m))
    return 'O QZ Tray recusou o pedido. Na janela do QZ Tray carregue em «Allow» (Permitir).';
  return m;
}

/* ---------- QZ Tray ---------- */
let qzConfigurado = false;
let chaveCripto = null, chaveCriptoTexto = null;

function pemParaBytes(pem) {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

async function importarChave(pem) {
  return crypto.subtle.importKey('pkcs8', pemParaBytes(pem), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-512' }, false, ['sign']);
}

async function assinar(texto) {
  if (chaveCriptoTexto !== E.config.chaveQZ) {
    chaveCripto = await importarChave(E.config.chaveQZ);
    chaveCriptoTexto = E.config.chaveQZ;
  }
  const sig = await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, chaveCripto, new TextEncoder().encode(texto));
  let s = '';
  new Uint8Array(sig).forEach(b => { s += String.fromCharCode(b); });
  return btoa(s);
}

function configurarQZ() {
  if (typeof qz === 'undefined') throw new Error('A peça de ligação ao QZ Tray (qz-tray.js) não carregou.');
  if (qzConfigurado) return;
  qz.security.setCertificatePromise((resolve) => resolve(E.config.chaveQZ ? CERT_QZ : ''));
  qz.security.setSignatureAlgorithm('SHA512');
  qz.security.setSignaturePromise(texto => (resolve, reject) => {
    if (!E.config.chaveQZ) return resolve('');
    assinar(texto).then(resolve).catch(reject);
  });
  qzConfigurado = true;
}

async function ligarQZ() {
  configurarQZ();
  if (qz.websocket.isActive()) return;
  await qz.websocket.connect({ retries: 1, delay: 1 });
}

async function prepararImpressora() {
  if (E.config.modoImpressao !== 'qz') return;
  if (!E.config.impressora) throw new Error('Ainda não foi escolhida a impressora (DEFINIÇÕES → PROCURAR IMPRESSORAS).');
  await ligarQZ();
}

/* ---------- Desenho da senha (imagem a preto e branco) ---------- */
function carregarImagem(src) {
  return new Promise((ok, erro) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => erro(new Error('Não foi possível ler o logótipo.'));
    i.src = src;
  });
}

// Pontilhado Floyd–Steinberg: tons de cinzento em pontos pretos e brancos
function pontilhar(ctx, w, h) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const g = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const a = d[i * 4 + 3] / 255;
    g[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) * a + 255 * (1 - a);
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const novo = g[i] < 128 ? 0 : 255;
      const erro = g[i] - novo;
      g[i] = novo;
      if (x + 1 < w) g[i + 1] += erro * 7 / 16;
      if (y + 1 < h) {
        if (x > 0) g[i + w - 1] += erro * 3 / 16;
        g[i + w] += erro * 5 / 16;
        if (x + 1 < w) g[i + w + 1] += erro * 1 / 16;
      }
    }
  }
  for (let i = 0; i < w * h; i++) {
    const v = g[i] < 128 ? 0 : 255;
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
    d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

// Senha = logótipo (2,5 cm de altura) + nome do produto (encolhe se não couber)
async function desenharSenha(nome) {
  const W = pontosLargura();
  const txt = nome.toUpperCase();
  const logo = E.config.logo ? await carregarImagem(E.config.logo) : null;
  let lw = 0, lh = 0;
  if (logo) {
    lh = 200; // 25 mm × 8 pontos/mm
    lw = Math.round(logo.width * lh / logo.height);
    if (lw > W - 16) { lw = W - 16; lh = Math.round(logo.height * lw / logo.width); }
  }
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  let fs = 50; // ≈ 18 pt
  ctx.font = `bold ${fs}px Arial, Helvetica, sans-serif`;
  const tw = ctx.measureText(txt).width;
  if (tw > W - 16) fs = Math.max(16, Math.floor(fs * (W - 16) / tw));
  const H = 8 + (logo ? lh + 12 : 0) + Math.round(fs * 1.2) + 8;
  c.width = W;
  c.height = H;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  let y = 8;
  if (logo) { ctx.drawImage(logo, Math.round((W - lw) / 2), y, lw, lh); y += lh + 12; }
  ctx.fillStyle = '#000';
  ctx.font = `bold ${fs}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(txt, W / 2, y + Math.round(fs * 0.08));
  pontilhar(ctx, W, H);
  return c.toDataURL('image/png');
}

async function imprimirQZ(nomes) {
  await prepararImpressora();
  const cfg = qz.configs.create(E.config.impressora);
  const avanco = Math.min(10, Math.max(0, int(E.config.avanco)));
  const cache = {};
  const dados = [];
  for (const n of nomes) {
    if (!cache[n]) cache[n] = (await desenharSenha(n)).split(',')[1];
    dados.push('\x1B\x40');                                   // iniciar
    dados.push({
      type: 'raw', format: 'image', flavor: 'base64', data: cache[n],
      options: { language: 'ESCPOS', dotDensity: 'double', imageEncoding: E.config.imgModo || 'gs_v_0' }
    });
    dados.push('\x1B\x64' + String.fromCharCode(avanco));    // avançar n linhas
    dados.push('\x1D\x56\x42\x00');                           // cortar
  }
  await qz.print(cfg, dados);
}

/* ---------- Impressão pelo browser ---------- */
function letraNome(nome) {
  const max = 18; // pt
  const c = letraNome.c || (letraNome.c = document.createElement('canvas').getContext('2d'));
  c.font = `bold ${max}pt Arial`;
  const largPx = c.measureText(nome).width;
  const dispPx = (mmUtil() - 2) * 96 / 25.4;
  return largPx > dispPx ? Math.max(8, Math.floor(max * dispPx / largPx * 10) / 10) : max;
}

function criarSenha(nome) {
  const d = document.createElement('div');
  d.className = 'senha';
  d.style.width = int(E.config.largura) + 'mm';
  d.style.height = int(E.config.alturaSenha) + 'mm';
  if (E.config.logo) {
    const img = document.createElement('img');
    img.className = 's-logo';
    img.src = E.config.logo;
    img.style.height = '25mm';
    img.style.maxWidth = mmUtil() + 'mm';
    d.appendChild(img);
  }
  const n = document.createElement('div');
  n.className = 's-nome';
  n.textContent = nome.toUpperCase();
  n.style.fontSize = letraNome(nome.toUpperCase()) + 'pt';
  n.style.maxWidth = mmUtil() + 'mm';
  n.style.marginTop = E.config.logo ? '1.5mm' : '0';
  d.appendChild(n);
  return d;
}

function definirPagina() {
  $('estiloPagina').textContent = `@page { size: ${int(E.config.largura)}mm ${int(E.config.alturaSenha)}mm; margin: 0; }`;
}

async function imprimirBrowser(nomes) {
  definirPagina();
  const area = $('areaImpressao');
  area.innerHTML = '';
  for (const n of nomes) area.appendChild(criarSenha(n));
  const imgs = Array.from(area.querySelectorAll('img'));
  await Promise.all(imgs.map(i => i.decode ? i.decode().catch(() => {}) : Promise.resolve()));
  await new Promise(r => setTimeout(r, 30));
  window.print();
  area.innerHTML = '';
}

// Imprime uma senha por nome. Em caso de erro, lança-o (quem chama decide o que fazer).
async function imprimirSenhas(nomes) {
  if (!nomes.length) return;
  if (E.config.modoImpressao === 'qz') await imprimirQZ(nomes);
  else await imprimirBrowser(nomes);
}

function nomeMaisComprido() {
  let m = 'TESTE';
  for (let i = 0; i < PROD_N; i++) if (prodExiste(i) && prod(i).nome.length > m.length) m = prod(i).nome;
  return m;
}

async function preVisualizar() {
  let html;
  if (E.config.modoImpressao === 'qz') {
    const src = await desenharSenha(nomeMaisComprido());
    html = `<div class="previa"><img class="raster" src="${src}" alt=""></div>` +
      `<p class="nota">Assim sai na térmica (rolo de ${int(E.config.largura)} mm, pontos a preto e branco). Nome mais comprido dos produtos.</p>`;
  } else {
    const caixa = document.createElement('div');
    caixa.className = 'previa';
    caixa.appendChild(criarSenha(nomeMaisComprido()));
    html = caixa.outerHTML + `<p class="nota">Rolo de ${int(E.config.largura)} mm · senha com ${int(E.config.alturaSenha)} mm de altura · nome mais comprido dos produtos.</p>`;
  }
  await janela({ titulo: 'Pré-visualização da senha', html });
}

async function testeImpressao() {
  if (!await confirmar('Imprimir uma senha de teste?<br>Não fica registada nem gasta numeração.', 'Teste de impressão')) return;
  try {
    await imprimirSenhas([nomeMaisComprido()]);
  } catch (e) {
    aviso('A impressão falhou.\n\n' + msgErro(e), 'Teste de impressão');
  }
}

/* ---------- Definições da impressora (QZ Tray) ---------- */
function estadoQZ(texto, classe) {
  const el = $('qzEstado');
  el.textContent = texto;
  el.className = 'estado-qz' + (classe ? ' ' + classe : '');
}

function preencherImpressoras(lista) {
  const sel = $('defImpressora');
  const atual = E.config.impressora;
  const nomes = lista.slice();
  if (atual && !nomes.includes(atual)) nomes.unshift(atual);
  sel.innerHTML = nomes.map(n => `<option>${esc(n)}</option>`).join('') || '<option value="">(nenhuma)</option>';
  if (atual) sel.value = atual;
}

async function procurarImpressoras() {
  estadoQZ('A ligar ao QZ Tray…');
  try {
    await ligarQZ();
    const lista = await qz.printers.find();
    const v = qz.websocket.getConnectionInfo ? qz.websocket.getConnectionInfo() : null;
    preencherImpressoras(Array.isArray(lista) ? lista : [lista]);
    estadoQZ(`QZ Tray ligado${v && v.version ? ' (versão ' + v.version + ')' : ''} · ${Array.isArray(lista) ? lista.length : 1} impressora(s) encontradas. Escolha a térmica e carregue em GRAVAR IMPRESSÃO.`, 'ok');
  } catch (e) {
    estadoQZ(msgErro(e), 'erro');
  }
}

function renderChave() {
  $('defChave').value = '';
  const el = $('chaveEstado');
  el.textContent = E.config.chaveQZ ? 'Chave instalada neste computador.' : 'Sem chave: o QZ Tray vai pedir autorização («Allow») ao imprimir.';
  el.className = 'estado-qz' + (E.config.chaveQZ ? ' ok' : '');
}

async function gravarChave() {
  const pem = $('defChave').value.trim();
  if (!/-----BEGIN PRIVATE KEY-----[\s\S]+-----END PRIVATE KEY-----/.test(pem))
    return aviso('O texto não parece uma chave válida.\nCole o conteúdo completo do ficheiro chave-impressao.txt, incluindo as linhas BEGIN e END.');
  try {
    await importarChave(pem);
  } catch (e) {
    return aviso('A chave não é válida: ' + msgErro(e));
  }
  E.config.chaveQZ = pem;
  await guardar();
  renderChave();
  if (typeof qz !== 'undefined' && qz.websocket.isActive()) { try { await qz.websocket.disconnect(); } catch (e) { /* nada */ } }
  aviso('Chave gravada neste computador.');
}

async function apagarChave() {
  if (!E.config.chaveQZ) return;
  if (!await confirmar('Apagar a chave de impressão deste computador?')) return;
  E.config.chaveQZ = '';
  await guardar();
  renderChave();
  if (typeof qz !== 'undefined' && qz.websocket.isActive()) { try { await qz.websocket.disconnect(); } catch (e) { /* nada */ } }
}

function mostrarBlocosImpressao() {
  const qzModo = $('defModo').value === 'qz';
  $('blocoQZ').hidden = !qzModo;
  $('blocoBrowser').hidden = qzModo;
}

/* =====================================================================
   DEFINIÇÕES
   ===================================================================== */
function renderDefinicoes() {
  const c = E.config;
  $('defEvento').value = c.evento;
  $('defData').value = c.data;
  $('defPosto').value = c.posto;
  $('defLargura').value = String(c.largura);
  $('defAltura').value = c.alturaSenha;
  $('defModo').value = c.modoImpressao;
  $('defAvanco').value = c.avanco;
  $('defImgModo').value = c.imgModo;
  preencherImpressoras([]);
  mostrarBlocosImpressao();
  renderChave();
  renderLogoDef();

  let h = '';
  for (let k = 1; k <= PAC_N; k++) {
    const p = E.pacotes[k - 1];
    h += `<tr><td><b>Pacote ${k}</b></td>` +
      `<td><input id="pacSen${k}" type="number" min="0" max="999" step="1" value="${p.senhas}"></td>` +
      `<td><input id="pacVal${k}" type="number" min="0" step="0.01" value="${p.valor}"></td>` +
      `<td class="calc" id="pacUni${k}"></td></tr>`;
  }
  $('defPacotes').innerHTML = h;
  for (let k = 1; k <= PAC_N; k++) {
    $('pacSen' + k).oninput = $('pacVal' + k).oninput = () => calcPacote(k);
    calcPacote(k);
  }

  const opcoes = Object.keys(CORES).map(n => `<option>${n}</option>`).join('');
  h = '';
  for (let i = 0; i < PROD_N; i++) {
    const p = prod(i);
    h += `<tr><td>${i + 1}</td>` +
      `<td><input id="pNome${i}" maxlength="20" value="${esc(p.nome)}"></td>` +
      `<td><input id="pPreco${i}" type="number" min="0" step="0.01" value="${p.preco}"></td>` +
      `<td><input id="pPref${i}" maxlength="5" value="${esc(p.prefixo)}"></td>` +
      `<td><select id="pCor${i}">${opcoes}</select></td>` +
      `<td><input id="pAtivo${i}" type="checkbox"${p.ativo ? ' checked' : ''}></td>` +
      `<td><input id="pPac${i}" type="checkbox"${p.usaPacotes ? ' checked' : ''}></td>` +
      `<td><input id="pProx${i}" type="number" min="1" step="1" value="${p.prox}"></td></tr>`;
  }
  $('defProdutos').innerHTML = h;
  for (let i = 0; i < PROD_N; i++) {
    $('pCor' + i).value = prod(i).cor;
    $('pCor' + i).style.borderLeft = '8px solid ' + corProd(i);
    $('pCor' + i).onchange = e => { e.target.style.borderLeft = '8px solid ' + (CORES[e.target.value] || '#999'); };
  }
  $('pwAtual').value = $('pwNova').value = $('pwNova2').value = '';
  $('versaoDef').textContent = 'Senhas v' + VERSAO + ' · dados guardados neste computador';
}

function calcPacote(k) {
  const s = int($('pacSen' + k).value), v = num($('pacVal' + k).value);
  $('pacUni' + k).textContent = s > 0 && v > 0
    ? (v / s).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + ' €'
    : 'não usado';
}

function renderLogoDef() {
  const img = $('defLogoImg');
  img.hidden = !E.config.logo;
  $('defLogoVazio').hidden = !!E.config.logo;
  if (E.config.logo) img.src = E.config.logo;
}

async function gravarEvento() {
  const ev = $('defEvento').value.trim();
  if (!ev) return aviso('Escreva o nome do evento.');
  if (!$('defData').value) return aviso('Escolha a data do evento.');
  E.config.evento = ev;
  E.config.data = $('defData').value;
  E.config.posto = $('defPosto').value.trim() || 'Posto 1';
  await guardar();
  renderTopo();
  aviso('Evento gravado.');
}

async function gravarImpressao() {
  const alt = int($('defAltura').value);
  if (alt < 25 || alt > 120) return aviso('A altura da senha tem de estar entre 25 e 120 mm.');
  const av = int($('defAvanco').value);
  if (av < 0 || av > 10) return aviso('O avanço do papel tem de estar entre 0 e 10 linhas.');
  E.config.modoImpressao = $('defModo').value;
  E.config.largura = int($('defLargura').value);
  E.config.alturaSenha = alt;
  E.config.impressora = $('defImpressora').value || E.config.impressora;
  E.config.avanco = av;
  E.config.imgModo = $('defImgModo').value;
  await guardar();
  aviso('Impressão gravada.' + (E.config.modoImpressao === 'qz' ? '\nImpressora: ' + E.config.impressora : ''));
}

$('defModo').addEventListener('change', mostrarBlocosImpressao);

$('defLogoFicheiro').addEventListener('change', async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    E.config.logo = await reduzirImagem(f, 600);
    await guardar();
    renderLogoDef();
    aviso('Logótipo gravado.');
  } catch (err) {
    aviso('Não foi possível ler a imagem: ' + err);
  }
});

function reduzirImagem(ficheiro, maxLado) {
  return new Promise((ok, erro) => {
    const leitor = new FileReader();
    leitor.onerror = () => erro(leitor.error);
    leitor.onload = () => {
      const img = new Image();
      img.onerror = () => erro('formato não suportado');
      img.onload = () => {
        const f = Math.min(1, maxLado / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * f);
        c.height = Math.round(img.height * f);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        ok(c.toDataURL('image/png'));
      };
      img.src = leitor.result;
    };
    leitor.readAsDataURL(ficheiro);
  });
}

async function removerLogo() {
  if (!E.config.logo) return;
  if (!await confirmar('Tirar o logótipo das senhas?')) return;
  E.config.logo = '';
  await guardar();
  renderLogoDef();
}

async function gravarPacotes() {
  const novos = [];
  for (let k = 1; k <= PAC_N; k++) {
    const s = int($('pacSen' + k).value), v = r2(num($('pacVal' + k).value));
    if (s < 0 || s > 999 || v < 0) return aviso(`Pacote ${k}: valores inválidos.`);
    novos.push({ senhas: s, valor: v });
  }
  if (novos[0].senhas > 0 && novos[1].senhas > 0 && novos[0].senhas === novos[1].senhas)
    return aviso('Os dois pacotes não podem ter o mesmo número de senhas.');
  E.pacotes = novos;
  await guardar();
  aviso('Pacotes gravados.');
}

async function gravarProdutos() {
  const lista = [];
  for (let i = 0; i < PROD_N; i++) {
    const prox = int($('pProx' + i).value);
    const preco = r2(num($('pPreco' + i).value));
    if (preco < 0) return aviso(`Nº ${i + 1}: o preço não pode ser negativo.`);
    if (prox < 1) return aviso(`Nº ${i + 1}: o próximo nº tem de ser 1 ou mais.`);
    lista.push({
      nome: $('pNome' + i).value.trim(),
      preco,
      prefixo: $('pPref' + i).value.trim().toUpperCase(),
      cor: $('pCor' + i).value,
      ativo: $('pAtivo' + i).checked,
      usaPacotes: $('pPac' + i).checked,
      prox
    });
  }
  const erros = verificarProdutos(lista);
  if (erros.length) return aviso('Corrija antes de gravar:\n\n' + erros.join('\n'));
  if (E.pedido.length && !await confirmar('Há um pedido por imprimir. Gravar os produtos na mesma?')) return;
  const comPac = lista.filter(p => p.nome && p.usaPacotes).length;
  E.produtos = lista;
  await guardar();
  let msg = 'Produtos gravados.';
  if (comPac > 1) msg += '\n\nAtenção: há mais de um produto com «Usa pacotes». Os botões PACOTE 1 e PACOTE 2 vendem o primeiro da lista.';
  aviso(msg);
}

async function mudarPalavraPasse() {
  const atual = $('pwAtual').value, nova = $('pwNova').value, nova2 = $('pwNova2').value;
  if (await hash(atual) !== E.config.senhaHash) return aviso('A palavra-passe atual está errada.');
  if (nova.length < 4) return aviso('A nova palavra-passe tem de ter pelo menos 4 caracteres.');
  if (nova !== nova2) return aviso('As duas novas palavras-passe não são iguais.');
  E.config.senhaHash = await hash(nova);
  await guardar();
  $('pwAtual').value = $('pwNova').value = $('pwNova2').value = '';
  aviso('Palavra-passe mudada.\nGuarde-a num local seguro: sem ela não se entra como administrador.');
}

/* =====================================================================
   Arranque
   ===================================================================== */
async function arrancar() {
  try {
    E = await lerEstado();
  } catch (e) {
    document.body.innerHTML = '<p style="padding:20px;font:16px Arial">Não foi possível abrir os dados deste aparelho: ' + esc(e) + '</p>';
    return;
  }
  if (!E) {
    E = estadoInicial();
    E.config.senhaHash = await hash(SENHA_INICIAL);
    await guardar();
  } else {
    E.config = { ...CONFIG_PADRAO, ...E.config };   // campos novos das versões seguintes
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  mostrar('entrada');
}

arrancar();
