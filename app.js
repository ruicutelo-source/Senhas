'use strict';
/* =====================================================================
   Senhas — venda e impressão de senhas (Fase 1)
   Dados guardados só neste aparelho (IndexedDB «senhas-bd»).
   A estrutura dos dados está pensada para passar mais tarde ao Firebase.
   ===================================================================== */

const VERSAO = '3.3';
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
  modoImpressao: 'qz', impressora: 'BP-T3', avanco: 3, imgModo: 'gs_v_0', chaveQZ: '', claridade: 0, modoDetetado: false
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
  $('ecraTurno').hidden = qual !== 'turno';
  $('ecraHistorico').hidden = qual !== 'historico';
  $('navHistorico').classList.toggle('ativo', qual === 'historico');
  $('navHistorico').hidden = modo !== 'ADMIN';
  $('navVenda').classList.toggle('ativo', qual === 'venda');
  $('navTurno').classList.toggle('ativo', qual === 'turno');
  $('navDefinicoes').classList.toggle('ativo', qual === 'definicoes');
  $('navDefinicoes').hidden = modo !== 'ADMIN';
  $('navModo').textContent = modo === 'ADMIN' ? 'MODO: ADMIN' : 'MODO: VENDEDOR';
  if (qual === 'venda') renderVenda();
  if (qual === 'definicoes') renderDefinicoes();
  if (qual === 'turno') renderTurno();
  if (qual === 'historico') renderHistorico();
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
  irTurno() { mostrar('turno'); },
  irHistorico() { if (modo === 'ADMIN') mostrar('historico'); },
  histAba(el) { histAba = el.dataset.aba; renderHistorico(); },
  exportarExcel() { exportarExcel(); },
  copiaSeguranca() { copiaSeguranca(); },
  novoEvento() { novoEvento(); },
  fecharCaixa() { fecharCaixa(); },
  anular() { anularVenda(); },
  reimprimir() { reimprimirPedido(); },
  reimprimirTalao(el) { reimprimirTalao(int(el.dataset.n)); },
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
  renderGraficoArtigos();
  renderPedido();
}

// Gráfico do ecrã Venda: senhas vendidas no turno por artigo (atualiza a cada impressão, anulação e fecho)
function renderGraficoArtigos() {
  const caixa = $('graficoArtigos');
  if (!caixa) return;
  const m = new Map();
  for (const l of E.registo) {
    if (l.fecho || l.estado !== 'Válida') continue;
    const a = m.get(l.produto) || { nome: l.produto, prodN: l.prodN, senhas: 0, valor: 0 };
    a.senhas += l.qtd; a.valor = r2(a.valor + l.valor);
    m.set(l.produto, a);
  }
  const lista = Array.from(m.values()).sort((a, b) => b.senhas - a.senhas || b.valor - a.valor);
  if (!lista.length) { caixa.innerHTML = '<div class="ga-vazio">Ainda não há vendas neste turno. O gráfico aparece com o primeiro pedido impresso.</div>'; return; }
  const max = lista[0].senhas || 1;
  const cor = a => {
    const i = a.prodN - 1;
    return prod(i) && prod(i).nome === a.nome ? corProd(i) : '#7f8c8d';
  };
  caixa.innerHTML = lista.map(a =>
    `<div class="ga-linha"><div class="ga-nome">${esc(a.nome)}</div>` +
    `<div class="ga-pista"><div class="ga-barra" style="width:${Math.max(1.5, a.senhas / max * 100)}%;background:${cor(a)}"></div></div>` +
    `<div class="ga-valor"><b>${a.senhas}</b> ${a.senhas === 1 ? 'senha' : 'senhas'} · ${euro(a.valor)}</div></div>`).join('');
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
        `<td class="tipo">${esc(l.fmt)}</td><td class="num">${l.qtd}</td><td class="num">${euro(l.valor)}</td></tr>`;
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
          'Resolva o problema (impressora ligada, com papel, QZ Tray aberto no PC ou RawBT no tablet) e carregue em TENTAR OUTRA VEZ.',
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

// Claridade do logótipo: -50 (mais escuro) a +50 (mais claro), aplicada só à zona do logótipo
function aplicarClaridade(ctx, x, y, w, h, claridade) {
  if (!claridade || w <= 0 || h <= 0) return;
  const g = Math.pow(2, -claridade / 50);            // +50 → 0,5 (clareia) · -50 → 2 (escurece)
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) lut[i] = Math.round(255 * Math.pow(i / 255, g));
  const img = ctx.getImageData(x, y, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = lut[Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])];
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, x, y);
}

// Pontilhado Atkinson (o mais indicado para térmicas): tons de cinzento em pontos pretos e brancos.
// Espalha só 3/4 do erro, por isso as zonas escuras ficam mais limpas e o desenho mais nítido.
function pontilhar(ctx, w, h) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const g = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const a = d[i * 4 + 3] / 255;
    g[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) * a + 255 * (1 - a);
  }
  const viz = [[1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [0, 2]];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const novo = g[i] < 128 ? 0 : 255;
      const erro = (g[i] - novo) / 8;
      g[i] = novo;
      for (const [dx, dy] of viz) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && xx < w && yy < h) g[yy * w + xx] += erro;
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
async function desenharSenha(nome, claridade) {
  return (await desenharSenhaCanvas(nome, claridade)).toDataURL('image/png');
}

async function desenharSenhaCanvas(nome, claridade) {
  if (claridade === undefined) claridade = int(E.config.claridade);
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
  if (logo) {
    const lx = Math.round((W - lw) / 2);
    ctx.drawImage(logo, lx, y, lw, lh);
    aplicarClaridade(ctx, lx, y, lw, lh, claridade);
    y += lh + 12;
  }
  ctx.fillStyle = '#000';
  ctx.font = `bold ${fs}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(txt, W / 2, y + Math.round(fs * 0.08));
  pontilhar(ctx, W, H);
  return c;
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

/* ---------- Tablet / telemóvel Android: RawBT ----------
   A app gera os comandos ESC/POS (os mesmos do QZ Tray: imagem GS v 0, avanço e corte)
   e entrega-os ao RawBT, que os passa à impressora sem os converter. */
const RAWBT_MAX_SENHAS = 10;   // senhas por envio (cada envio vai num único endereço intent)

function bytesRaster(canvas) {
  const w = canvas.width, h = canvas.height, wb = Math.ceil(w / 8);
  const d = canvas.getContext('2d').getImageData(0, 0, w, h).data;
  const partes = [];
  const FAIXA = 128;                                       // linhas por comando GS v 0
  for (let y0 = 0; y0 < h; y0 += FAIXA) {
    const fh = Math.min(FAIXA, h - y0);
    const b = new Uint8Array(8 + wb * fh);
    b.set([0x1D, 0x76, 0x30, 0x00, wb & 255, wb >> 8, fh & 255, fh >> 8]);
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < w; x++) {
        const i = ((y0 + y) * w + x) * 4;
        if (d[i] < 128) b[8 + y * wb + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
    partes.push(b);
  }
  return partes;
}

// Um trabalho: para cada imagem → iniciar, imagem, avançar n linhas, cortar
function trabalhoESCPOS(canvases) {
  const avanco = Math.min(10, Math.max(0, int(E.config.avanco)));
  const partes = [];
  for (const c of canvases) {
    partes.push(new Uint8Array([0x1B, 0x40]));
    partes.push(...bytesRaster(c));
    partes.push(new Uint8Array([0x1B, 0x64, avanco]));
    partes.push(new Uint8Array([0x1D, 0x56, 0x42, 0x00]));
  }
  const total = partes.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of partes) { out.set(p, o); o += p.length; }
  return out;
}

function base64Bytes(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function enviarRawBT(bytes) {
  if (!/Android/i.test(navigator.userAgent))
    throw new Error('O modo RawBT só funciona num tablet ou telemóvel Android com a app RawBT instalada.');
  location.href = 'intent:base64,' + base64Bytes(bytes) + '#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;';
}

async function imprimirRawBT(nomes) {
  const cache = {};
  for (const n of nomes) if (!cache[n]) cache[n] = await desenharSenhaCanvas(n);
  for (let i = 0; i < nomes.length; i += RAWBT_MAX_SENHAS) {
    if (i > 0) {
      const seguir = await janela({
        titulo: 'Impressão',
        html: `Já foram enviadas <b>${i}</b> de <b>${nomes.length}</b> senhas.<br>Quando terminarem de sair, carregue em CONTINUAR.`,
        botoes: [{ texto: 'CONTINUAR', classe: 'verde', valor: true }]
      });
      if (!seguir) throw new Error(`Só saíram ${i} de ${nomes.length} senhas.`);
    }
    enviarRawBT(trabalhoESCPOS(nomes.slice(i, i + RAWBT_MAX_SENHAS).map(n => cache[n])));
    await new Promise(r => setTimeout(r, 300));
  }
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
  else if (E.config.modoImpressao === 'rawbt') await imprimirRawBT(nomes);
  else await imprimirBrowser(nomes);
}

function nomeMaisComprido() {
  let m = 'TESTE';
  for (let i = 0; i < PROD_N; i++) if (prodExiste(i) && prod(i).nome.length > m.length) m = prod(i).nome;
  return m;
}

async function preVisualizar() {
  let html;
  if (E.config.modoImpressao !== 'browser') {
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
  const m = $('defModo').value;
  $('blocoQZ').hidden = m === 'browser';
  $('soQZ').hidden = m !== 'qz';
  $('soQZ1').hidden = m !== 'qz';
  $('soRawBT').hidden = m !== 'rawbt';
  $('blocoBrowser').hidden = m !== 'browser';
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
  $('defClaridade').value = c.claridade;
  atualizarClaridade();
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
  E.config.claridade = int($('defClaridade').value);
  await guardar();
  aviso('Impressão gravada.' + (E.config.modoImpressao === 'qz' ? '\nImpressora: ' + E.config.impressora : ''));
}

$('defModo').addEventListener('change', mostrarBlocosImpressao);

// Claridade: mostra logo como fica (só o logótipo, já em pontos)
let previaPendente = null;
function atualizarClaridade() {
  const v = int($('defClaridade').value);
  $('defClaridadeValor').textContent = v > 0 ? '+' + v : String(v);
  clearTimeout(previaPendente);
  previaPendente = setTimeout(async () => {
    const img = $('defClaridadeImg');
    if (!E.config.logo) { img.hidden = true; return; }
    img.src = await desenharSenha(nomeMaisComprido(), v);
    img.hidden = false;
  }, 120);
}
$('defClaridade').addEventListener('input', atualizarClaridade);

$('defLogoFicheiro').addEventListener('change', async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    E.config.logo = await reduzirImagem(f, 600);
    await guardar();
    renderLogoDef();
    atualizarClaridade();
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
  atualizarClaridade();
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
   FASE 2 — escolher numa lista, anular, reimprimir, turno, fecho, talão
   ===================================================================== */
const ORDEM_FMT = { 'Pacote 1': 1, 'Pacote 2': 2, 'Avulso': 3, 'Normal': 4, 'Oferta': 5 };
const ordemFmt = f => ORDEM_FMT[f] || 9;
const dataHoraPT = iso => { const d = new Date(iso); return d.toLocaleDateString('pt-PT') + ' ' + horaPT(d); };

// Janela com uma lista de opções para tocar (devolve o valor escolhido ou null)
function escolherDaLista(titulo, texto, itens) {
  return new Promise(ok => {
    $('modalTitulo').textContent = titulo;
    $('modalInput').hidden = true;
    let h = texto ? `<p>${texto}</p>` : '';
    h += '<div class="lista-escolha">';
    itens.forEach((it, n) => { h += `<button class="item-escolha" data-n="${n}">${it.html}</button>`; });
    $('modalCorpo').innerHTML = h + '</div>';
    const caixa = $('modalBotoes');
    caixa.innerHTML = '<button class="btn cinza">CANCELAR</button>';
    const fechar = v => {
      $('fundoModal').hidden = true;
      document.removeEventListener('keydown', teclas);
      $('modalCorpo').onclick = null;
      ok(v);
    };
    const teclas = e => { if (e.key === 'Escape') fechar(null); };
    caixa.firstChild.onclick = () => fechar(null);
    $('modalCorpo').onclick = e => {
      const b = e.target.closest('.item-escolha');
      if (b) fechar(itens[int(b.dataset.n)].valor);
    };
    document.addEventListener('keydown', teclas);
    $('fundoModal').hidden = false;
  });
}

const linhasTurno = () => E.registo.filter(l => !l.fecho);
const valida = l => l.estado === 'Válida';

function pedidosDe(linhas) {
  const m = new Map();
  for (const l of linhas) {
    if (!m.has(l.pedido)) m.set(l.pedido, []);
    m.get(l.pedido).push(l);
  }
  return Array.from(m.entries()).sort((a, b) => b[0] - a[0]);   // mais recente primeiro
}

function resumoPedido(n, ls) {
  const sen = ls.reduce((s, l) => s + l.qtd, 0), val = r2(ls.reduce((s, l) => s + l.valor, 0));
  const prods = Array.from(new Set(ls.map(l => l.produto.toUpperCase()))).join(', ');
  return `<b>Pedido ${n}</b> · ${horaPT(new Date(ls[0].data))} · ${esc(prods)}<br><small>${ls.length} linha(s) · ${sen} senhas · ${euro(val)}</small>`;
}

/* ---------- ANULAR ---------- */
async function anularVenda() {
  if (E.pedido.length) return aviso('Há um pedido por imprimir.\nCarregue em IMPRIMIR PEDIDO ou em LIMPAR antes de anular.');
  if (modo !== 'ADMIN' && !await pedirPalavraPasse('Anular uma venda pede a palavra-passe de administrador.')) return;
  const vivas = linhasTurno().filter(valida);
  if (!vivas.length) return aviso('Não há vendas válidas no turno atual para anular.\n(Depois do fecho de caixa já não se pode anular.)', 'Anular');

  const tipo = await janela({
    titulo: 'Anular', html: 'O que quer anular?',
    botoes: [{ texto: 'CANCELAR', classe: 'cinza', valor: null }, { texto: 'SÓ UMA LINHA', classe: 'azul', valor: 'linha' },
      { texto: 'PEDIDO INTEIRO', classe: 'vermelho', valor: 'pedido' }]
  });
  if (!tipo) return;

  let alvo, texto;
  if (tipo === 'pedido') {
    const lista = pedidosDe(vivas).slice(0, 15);
    const n = await escolherDaLista('Anular pedido', 'Toque no pedido a anular (os 15 mais recentes do turno):',
      lista.map(([n, ls]) => ({ html: resumoPedido(n, ls), valor: n })));
    if (n === null) return;
    alvo = vivas.filter(l => l.pedido === n);
    texto = `o <b>pedido Nº ${n}</b> (${alvo.length} linha(s))`;
  } else {
    const lista = vivas.slice().sort((a, b) => b.venda - a.venda).slice(0, 15);
    const v = await escolherDaLista('Anular uma linha', 'Toque na linha a anular (as 15 mais recentes do turno):',
      lista.map(l => ({
        html: `<b>${esc(l.produto.toUpperCase())}</b> · ${fmtCurto(l.formato)} · ${l.qtd} senhas · ${euro(l.valor)}<br>` +
          `<small>Pedido ${l.pedido} · venda ${l.venda} · ${horaPT(new Date(l.data))} · ${esc(l.ini)} a ${esc(l.fim)}</small>`,
        valor: l.venda
      })));
    if (v === null) return;
    alvo = vivas.filter(l => l.venda === v);
    texto = `a <b>linha ${v}</b> (${esc(alvo[0].produto.toUpperCase())}, ${alvo[0].qtd} senhas, pedido ${alvo[0].pedido})`;
  }
  const devolver = r2(alvo.reduce((s, l) => s + l.valor, 0));
  if (!await confirmar(`Anular ${texto}?<br><br><span class="cobrar">DEVOLVER: ${euro(devolver)}</span><br><br>` +
    'As senhas destas linhas deixam de contar no turno.', 'Confirmar anulação', 'SIM, ANULAR', 'NÃO')) return;

  const agora = new Date().toISOString();
  for (const l of alvo) { l.estado = 'Anulada'; l.anuladaEm = agora; }
  E.ultimoPedido = `${tipo === 'pedido' ? 'Pedido Nº ' + alvo[0].pedido : 'Linha ' + alvo[0].venda} ANULADO às ${horaPT(new Date())} · devolver ${euro(devolver)}`;
  await guardar();
  renderVenda();
  renderTopo();
  aviso(`Anulação feita.\nDevolver ao cliente: ${euro(devolver)}\nRecolha as senhas.`, 'Anular');
}

/* ---------- REIMPRIMIR (pedido inteiro, mesmos números) ---------- */
async function reimprimirPedido() {
  const vivas = E.registo.filter(valida);
  if (!vivas.length) return aviso('Ainda não há pedidos para reimprimir.');
  const lista = pedidosDe(vivas).slice(0, 15);
  const n = await escolherDaLista('Reimprimir pedido', 'Toque no pedido a reimprimir (os 15 mais recentes). As senhas saem com os mesmos números.',
    lista.map(([n, ls]) => ({ html: resumoPedido(n, ls), valor: n })));
  if (n === null) return;
  const ls = vivas.filter(l => l.pedido === n);
  const nomes = [];
  for (const l of ls) for (let s = 0; s < l.qtd; s++) nomes.push(l.produto);
  if (!await confirmar(`Reimprimir as <b>${nomes.length}</b> senhas do pedido Nº ${n}?`, 'Reimprimir')) return;
  try {
    await imprimirSenhas(nomes);
  } catch (e) {
    return aviso('A impressão falhou.\n\n' + msgErro(e), 'Reimprimir');
  }
  const agora = new Date().toISOString();
  for (const l of ls) { l.reimpressoes = (l.reimpressoes || 0) + 1; l.reimpressoEm = agora; }
  E.ultimoPedido = `Pedido Nº ${n} REIMPRESSO às ${horaPT(new Date())} · ${nomes.length} senhas`;
  await guardar();
  renderVenda();
}

/* ---------- TOTAIS (turno e fecho) ---------- */
function calcularTotais(linhas) {
  const det = new Map();
  const t = { senhas: 0, valor: 0, desconto: 0, p1: 0, p2: 0, avulso: 0, ofertas: 0, anuladas: 0, valorAnulado: 0,
    pedidos: new Set(), vendaIni: 0, vendaFim: 0, porHora: new Map() };
  for (const l of linhas) {
    if (!t.vendaIni || l.venda < t.vendaIni) t.vendaIni = l.venda;
    if (l.venda > t.vendaFim) t.vendaFim = l.venda;
    const k = l.produto + '|' + l.formato;
    if (!det.has(k)) det.set(k, { produto: l.produto, prodN: l.prodN, formato: l.formato, preco: l.preco, senhas: 0, valor: 0, desconto: 0, anuladas: 0, valorAnulado: 0 });
    const d = det.get(k);
    if (valida(l)) {
      d.senhas += l.qtd; d.valor = r2(d.valor + l.valor); d.desconto = r2(d.desconto + l.desconto); d.preco = l.preco;
      t.senhas += l.qtd; t.valor += l.valor; t.desconto += l.desconto; t.pedidos.add(l.pedido);
      if (l.formato === 'Pacote 1') t.p1 += l.valor;
      else if (l.formato === 'Pacote 2') t.p2 += l.valor;
      else if (l.formato === 'Oferta') t.ofertas += l.qtd;
      else t.avulso += l.valor;
      const hb = Math.floor(new Date(l.data).getTime() / 3600000);
      const ph = t.porHora.get(hb) || { senhas: 0, valor: 0 };
      ph.senhas += l.qtd; ph.valor = r2(ph.valor + l.valor);
      t.porHora.set(hb, ph);
    } else {
      d.anuladas += 1; d.valorAnulado = r2(d.valorAnulado + l.valor);
      t.anuladas += 1; t.valorAnulado += l.valor;
    }
  }
  const detalhe = Array.from(det.values()).sort((a, b) => (a.prodN - b.prodN) || (ordemFmt(a.formato) - ordemFmt(b.formato)));
  // horas seguidas do primeiro ao último bloco (com zeros)
  const horas = [];
  if (t.porHora.size) {
    const ks = Array.from(t.porHora.keys());
    for (let h = Math.min(...ks); h <= Math.max(...ks); h++) {
      const v = t.porHora.get(h) || { senhas: 0, valor: 0 };
      horas.push({ inicio: new Date(h * 3600000).toISOString(), senhas: v.senhas, valor: v.valor });
    }
  }
  return {
    senhas: t.senhas, valor: r2(t.valor), desconto: r2(t.desconto), semDesconto: r2(t.valor + t.desconto),
    p1: r2(t.p1), p2: r2(t.p2), avulso: r2(t.avulso), ofertas: t.ofertas,
    anuladas: t.anuladas, valorAnulado: r2(t.valorAnulado), pedidos: t.pedidos.size,
    vendaIni: t.vendaIni, vendaFim: t.vendaFim, detalhe, horas
  };
}

/* ---------- Gráfico de barras (SVG) ---------- */
function graficoBarras(horas, chave, titulo, fmt, cor) {
  if (!horas.length) return `<div class="grafico vazio">${esc(titulo)}: ainda sem vendas.</div>`;
  const W = 640, H = 230, m = { e: 54, d: 12, t: 30, b: 34 };
  const iw = W - m.e - m.d, ih = H - m.t - m.b;
  const max = Math.max(1, ...horas.map(h => h[chave]));
  const passo = (() => { const bruto = max / 4, p = Math.pow(10, Math.floor(Math.log10(bruto))); const n = bruto / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; })();
  const topo = Math.ceil(max / passo) * passo;
  const bw = iw / horas.length;
  let s = `<svg viewBox="0 0 ${W} ${H}" class="grafico" role="img" aria-label="${esc(titulo)}">`;
  s += `<text x="${m.e}" y="18" class="g-titulo">${esc(titulo)}</text>`;
  for (let v = 0; v <= topo + 1e-9; v += passo) {
    const y = m.t + ih - (v / topo) * ih;
    s += `<line x1="${m.e}" x2="${W - m.d}" y1="${y}" y2="${y}" class="g-grelha"/>`;
    s += `<text x="${m.e - 6}" y="${y + 4}" class="g-eixo" text-anchor="end">${fmt(v)}</text>`;
  }
  horas.forEach((h, i) => {
    const v = h[chave], bh = (v / topo) * ih, x = m.e + i * bw + bw * 0.15, y = m.t + ih - bh;
    s += `<rect x="${x}" y="${y}" width="${bw * 0.7}" height="${bh}" rx="3" fill="${cor}"><title>${horaPT(new Date(h.inicio))}: ${fmt(v)}</title></rect>`;
    if (v > 0 && horas.length <= 14) s += `<text x="${x + bw * 0.35}" y="${y - 4}" class="g-valor" text-anchor="middle">${fmt(v)}</text>`;
    const passoRotulo = Math.ceil(horas.length / 12);
    if (i % passoRotulo === 0) s += `<text x="${x + bw * 0.35}" y="${H - 12}" class="g-eixo" text-anchor="middle">${new Date(h.inicio).getHours()}h</text>`;
  });
  return s + '</svg>';
}

/* ---------- ECRÃ TURNO ---------- */
function renderTurno() {
  const t = calcularTotais(linhasTurno());
  const cartao = (rot, val, cls = '') => `<div class="kpi ${cls}"><div class="kpi-rot">${rot}</div><div class="kpi-val">${val}</div></div>`;
  let h = '<div class="kpis">' +
    cartao('Valor em caixa', euro(t.valor), 'destaque') +
    cartao('Senhas', t.senhas) + cartao('Pedidos', t.pedidos) +
    cartao('Pacote 1', euro(t.p1)) + cartao('Pacote 2', euro(t.p2)) + cartao('Avulso / normal', euro(t.avulso)) +
    cartao('Ofertas', t.ofertas + (t.ofertas === 1 ? ' senha' : ' senhas')) + cartao('Desconto', euro(t.desconto)) +
    cartao('Anuladas', `${t.anuladas} · ${euro(t.valorAnulado)}`) + '</div>';

  h += '<div class="turno-grelha"><div class="cartao"><h2>Turno atual por produto <small>(desde o último fecho)</small></h2>';
  if (!t.detalhe.length) h += '<p class="nota">Ainda não há vendas neste turno.</p>';
  else {
    h += '<table class="tabela tab-turno"><thead><tr><th>Produto</th><th>Tipo</th><th>Senhas</th><th>Valor</th><th>Desconto</th><th>Anuladas</th></tr></thead><tbody>';
    for (const d of t.detalhe) {
      h += `<tr><td class="esq">${esc(d.produto)}</td><td>${esc(d.formato)}</td><td>${d.senhas}</td><td>${euro(d.valor)}</td><td>${euro(d.desconto)}</td><td>${d.anuladas ? d.anuladas + ' · ' + euro(d.valorAnulado) : ''}</td></tr>`;
    }
    h += `<tr class="total"><td class="esq">Total</td><td></td><td>${t.senhas}</td><td>${euro(t.valor)}</td><td>${euro(t.desconto)}</td><td>${t.anuladas ? t.anuladas + ' · ' + euro(t.valorAnulado) : ''}</td></tr></tbody></table>`;
  }
  h += '</div><div class="cartao"><h2>Vendas por hora</h2>' +
    graficoBarras(t.horas, 'valor', 'Euros por hora', v => euroCurto(v), '#2980b9') +
    graficoBarras(t.horas, 'senhas', 'Senhas por hora', v => String(Math.round(v)), '#e67e22') + '</div></div>';

  // fechos deste evento
  h += '<div class="cartao"><h2>Fechos de caixa deste evento</h2>';
  if (!E.fechos.length) h += '<p class="nota">Ainda não foi feito nenhum fecho.</p>';
  else {
    h += '<table class="tabela tab-turno"><thead><tr><th>Nº</th><th>Data/hora</th><th>Senhas</th><th>Pacote 1</th><th>Pacote 2</th><th>Avulso</th><th>Ofertas</th><th>Em caixa</th><th></th></tr></thead><tbody>';
    for (const f of E.fechos.slice().reverse()) {
      h += `<tr><td>${f.num}</td><td>${dataHoraPT(f.data)}</td><td>${f.senhas}</td><td>${euro(f.p1)}</td><td>${euro(f.p2)}</td><td>${euro(f.avulso)}</td><td>${f.ofertas}</td><td><b>${euro(f.valor)}</b></td>` +
        `<td><button class="btn cinza-escuro pequeno" data-acao="reimprimirTalao" data-n="${f.num}">TALÃO</button></td></tr>`;
    }
    h += '</tbody></table>';
  }
  h += '</div>';
  $('turnoConteudo').innerHTML = h;
}

/* ---------- FECHO DE CAIXA ---------- */
async function fecharCaixa() {
  if (E.pedido.length) return aviso('Há um pedido por imprimir.\nCarregue em IMPRIMIR PEDIDO ou em LIMPAR antes de fazer o fecho.', 'Fecho de caixa');
  const linhas = linhasTurno();
  if (!linhas.length) return aviso('Não há vendas no turno atual para fechar.', 'Fecho de caixa');
  const t = calcularTotais(linhas);

  let h = `<p>Vendas Nº ${t.vendaIni} a ${t.vendaFim} · ${t.pedidos} pedido(s)</p><table class="resumo">`;
  for (const d of t.detalhe) if (d.senhas > 0)
    h += `<tr><td><b>${esc(d.produto.toUpperCase())}</b> · ${esc(d.formato)}</td><td class="num">${d.senhas}</td><td class="num">${euro(d.valor)}</td></tr>`;
  h += `</table><table class="resumo apurado">
    <tr><td>Pacote 1</td><td class="num">${euro(t.p1)}</td></tr>
    <tr><td>Pacote 2</td><td class="num">${euro(t.p2)}</td></tr>
    <tr><td>Avulso / normal</td><td class="num">${euro(t.avulso)}</td></tr>
    <tr><td>Ofertas</td><td class="num">${t.ofertas} senha(s)</td></tr>
    <tr><td>Desconto concedido</td><td class="num">${euro(t.desconto)}</td></tr>
    <tr><td>Anuladas</td><td class="num">${t.anuladas} · ${euro(t.valorAnulado)}</td></tr></table>
    <div class="cobrar">VALOR EM CAIXA: ${euro(t.valor)}</div>
    <p>Conte o dinheiro: deve bater com o valor em caixa.<br>Depois do fecho, as vendas deste turno já não podem ser anuladas.</p>`;
  if (!await janela({ titulo: 'Fecho de caixa', html: h, botoes: [{ texto: 'NÃO', classe: 'cinza', valor: false }, { texto: 'FAZER O FECHO', classe: 'verde', valor: true }] })) return;

  const num = E.fechos.reduce((m, f) => Math.max(m, f.num), 0) + 1;
  const agora = new Date().toISOString();
  const f = {
    num, data: agora, evento: E.config.evento, posto: E.config.posto,
    vendaIni: t.vendaIni, vendaFim: t.vendaFim, pedidos: t.pedidos, senhas: t.senhas,
    valor: t.valor, desconto: t.desconto, semDesconto: t.semDesconto,
    p1: t.p1, p2: t.p2, avulso: t.avulso, ofertas: t.ofertas,
    anuladas: t.anuladas, valorAnulado: t.valorAnulado, horas: t.horas
  };
  E.fechos.push(f);
  for (const d of t.detalhe) E.fechosDetalhe.push({ fecho: num, data: agora, ...d });
  for (const l of linhas) l.fecho = num;
  E.ultimoPedido = `Fecho Nº ${num} feito às ${horaPT(new Date())} · em caixa: ${euro(t.valor)}`;
  await guardar();
  renderVenda();
  renderTopo();
  if (ecra === 'turno') renderTurno();

  if (await confirmar(`Fecho Nº ${num} gravado.<br><br>Imprimir o talão do fecho?`, 'Fecho de caixa')) await imprimirTalao(num);
}

/* ---------- TALÃO DO FECHO (imagem a preto e branco) ---------- */
function linhasTalao(f) {
  const L = [];
  L.push({ t: 'titulo', a: `FECHO DE CAIXA Nº ${f.num}` });
  L.push({ t: 'centro', a: f.evento, b: true });
  L.push({ t: 'centro', a: dataHoraPT(f.data) + (f.posto ? ' · ' + f.posto : '') });
  L.push({ t: 'centro', a: `Vendas Nº ${f.vendaIni} a ${f.vendaFim} · ${f.pedidos} pedido(s)` });
  L.push({ t: 'sep' });
  L.push({ t: 'sub', a: 'PRODUTOS' });
  const det = E.fechosDetalhe.filter(d => d.fecho === f.num && d.senhas > 0);
  let ant = null;
  for (const d of det) {
    if (d.produto !== ant) { L.push({ t: 'linha', a: d.produto.toUpperCase(), b: true }); ant = d.produto; }
    const pu = d.preco.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    L.push({ t: 'linha', a: `  ${d.formato}: ${d.senhas} x ${pu}`, d: euro(d.valor), p: true });
  }
  if (!det.length) L.push({ t: 'linha', a: 'Sem vendas' });
  L.push({ t: 'sep' });
  L.push({ t: 'sub', a: 'APURADO' });
  L.push({ t: 'linha', a: 'Pacote 1', d: euro(f.p1) });
  L.push({ t: 'linha', a: 'Pacote 2', d: euro(f.p2) });
  L.push({ t: 'linha', a: 'Avulso / normal', d: euro(f.avulso) });
  L.push({ t: 'linha', a: 'Ofertas (senhas)', d: String(f.ofertas) });
  L.push({ t: 'sep' });
  L.push({ t: 'sub', a: 'TOTAL' });
  L.push({ t: 'linha', a: 'Senhas', d: String(f.senhas) });
  L.push({ t: 'linha', a: 'Desconto concedido', d: euro(f.desconto) });
  L.push({ t: 'linha', a: 'Vendas anuladas', d: String(f.anuladas) });
  L.push({ t: 'linha', a: 'Valor anulado', d: euro(f.valorAnulado) });
  L.push({ t: 'sep' });
  L.push({ t: 'grande', a: 'VALOR EM CAIXA', d: euro(f.valor) });
  return L;
}

function desenharTalao(f) {
  return desenharTalaoCanvas(f).toDataURL('image/png');
}

function desenharTalaoCanvas(f) {
  const W = pontosLargura(), M = 6;
  const fonte = (px, b) => `${b ? 'bold ' : ''}${px}px Arial, Helvetica, sans-serif`;
  const alt = { titulo: 44, centro: 30, sub: 36, linha: 30, sep: 18, grande: 46 };
  const L = linhasTalao(f);
  const H = 10 + L.reduce((s, l) => s + alt[l.t], 0) + 10;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#000'; ctx.strokeStyle = '#000'; ctx.textBaseline = 'middle';
  const encaixar = (txt, px, b, max) => { let s = px; ctx.font = fonte(s, b); while (s > 12 && ctx.measureText(txt).width > max) { s--; ctx.font = fonte(s, b); } };
  let y = 10;
  for (const l of L) {
    const h = alt[l.t], cy = y + h / 2;
    if (l.t === 'sep') {
      ctx.setLineDash([6, 4]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(M, cy); ctx.lineTo(W - M, cy); ctx.stroke(); ctx.setLineDash([]);
    } else if (l.t === 'titulo' || l.t === 'centro' || l.t === 'sub') {
      ctx.textAlign = 'center';
      const px = l.t === 'titulo' ? 32 : l.t === 'sub' ? 26 : 22;
      encaixar(l.a, px, l.t !== 'centro' || l.b, W - 2 * M);
      ctx.fillText(l.a, W / 2, cy);
    } else {
      const px = l.t === 'grande' ? 30 : (l.p ? 20 : 22);
      const b = l.t === 'grande' || !!l.b;
      let larguraDir = 0;
      if (l.d) { ctx.font = fonte(px, b); larguraDir = ctx.measureText(l.d).width; ctx.textAlign = 'right'; ctx.fillText(l.d, W - M, cy); }
      ctx.textAlign = 'left';
      encaixar(l.a, px, b, W - 2 * M - larguraDir - 10);
      ctx.fillText(l.a, M, cy);
    }
    y += h;
  }
  // texto nítido: só preto e branco (sem cinzentos)
  const img = ctx.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const v = (d[i] + d[i + 1] + d[i + 2]) / 3 < 150 ? 0 : 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  return c;
}

async function imprimirTalao(num) {
  const f = E.fechos.find(x => x.num === num);
  if (!f) return aviso('O fecho Nº ' + num + ' não existe.');
  try {
    if (E.config.modoImpressao === 'rawbt') {
      enviarRawBT(trabalhoESCPOS([desenharTalaoCanvas(f)]));
      return;
    }
    const src = desenharTalao(f);
    if (E.config.modoImpressao === 'qz') {
      await prepararImpressora();
      const avanco = Math.min(10, Math.max(0, int(E.config.avanco)));
      await qz.print(qz.configs.create(E.config.impressora), [
        '\x1B\x40',
        { type: 'raw', format: 'image', flavor: 'base64', data: src.split(',')[1],
          options: { language: 'ESCPOS', dotDensity: 'double', imageEncoding: E.config.imgModo || 'gs_v_0' } },
        '\x1B\x64' + String.fromCharCode(avanco),
        '\x1D\x56\x42\x00'
      ]);
    } else {
      const img = new Image();
      img.src = src;
      await img.decode();
      const altMm = Math.ceil(img.height / 8) + 4;
      $('estiloPagina').textContent = `@page { size: ${int(E.config.largura)}mm ${altMm}mm; margin: 0; }`;
      img.style.width = mmUtil() + 'mm';
      img.style.display = 'block';
      img.style.margin = '2mm auto';
      const area = $('areaImpressao');
      area.innerHTML = '';
      area.appendChild(img);
      window.print();
      area.innerHTML = '';
    }
  } catch (e) {
    aviso('A impressão do talão falhou.\n\n' + msgErro(e) + '\n\nPode reimprimi-lo no ecrã TURNO.', 'Talão');
  }
}

async function reimprimirTalao(num) {
  if (modo !== 'ADMIN' && !await pedirPalavraPasse('Reimprimir o talão de um fecho pede a palavra-passe de administrador.')) return;
  if (!await confirmar(`Imprimir outra vez o talão do fecho Nº ${num}?`, 'Talão')) return;
  await imprimirTalao(num);
}

/* =====================================================================
   FASE 3 — histórico, exportar para Excel, cópia de segurança, novo evento
   ===================================================================== */
const nomeFicheiro = s => String(s || 'Evento').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Evento';
const carimbo = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`; };

function descarregar(nome, conteudo, tipo) {
  const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/* ---------- HISTÓRICO ---------- */
let histAba = 'registo', histFecho = null;

function renderHistorico() {
  $('histAbaRegisto').classList.toggle('ativo', histAba === 'registo');
  $('histAbaFechos').classList.toggle('ativo', histAba === 'fechos');
  if (histAba === 'registo') renderHistRegisto(); else renderHistFechos();
}

function opcoes(lista, atual) {
  return lista.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(atual) ? ' selected' : ''}>${esc(t)}</option>`).join('');
}

const filtro = { produto: '', formato: '', estado: '', fecho: '' };

function renderHistRegisto() {
  const prods = Array.from(new Set(E.registo.map(l => l.produto)));
  const fechos = E.fechos.map(f => [String(f.num), 'Fecho Nº ' + f.num]);
  let h = `<div class="filtros">
    <label>Produto <select data-filtro="produto">${opcoes([['', 'Todos'], ...prods.map(p => [p, p])], filtro.produto)}</select></label>
    <label>Tipo <select data-filtro="formato">${opcoes([['', 'Todos'], ['Pacote 1', 'Pacote 1'], ['Pacote 2', 'Pacote 2'], ['Avulso', 'Avulso'], ['Normal', 'Normal'], ['Oferta', 'Oferta']], filtro.formato)}</select></label>
    <label>Estado <select data-filtro="estado">${opcoes([['', 'Todos'], ['Válida', 'Válida'], ['Anulada', 'Anulada']], filtro.estado)}</select></label>
    <label>Fecho <select data-filtro="fecho">${opcoes([['', 'Todos'], ['turno', 'Turno atual (sem fecho)'], ...fechos], filtro.fecho)}</select></label>
  </div>`;
  const ls = E.registo.filter(l =>
    (!filtro.produto || l.produto === filtro.produto) &&
    (!filtro.formato || l.formato === filtro.formato) &&
    (!filtro.estado || l.estado === filtro.estado) &&
    (!filtro.fecho || (filtro.fecho === 'turno' ? !l.fecho : String(l.fecho) === filtro.fecho))
  ).sort((a, b) => b.venda - a.venda);
  const sen = ls.filter(valida).reduce((s, l) => s + l.qtd, 0);
  const val = r2(ls.filter(valida).reduce((s, l) => s + l.valor, 0));
  h += `<p class="hist-resumo">${ls.length} linha(s) · válidas: <b>${sen} senhas · ${euro(val)}</b>${ls.length > 400 ? ' · a mostrar as 400 mais recentes' : ''}</p>`;
  if (!ls.length) h += '<p class="nota">Sem linhas com estes filtros.</p>';
  else {
    h += '<div class="tabela-rolar"><table class="tabela tab-hist"><thead><tr><th>Nº</th><th>Data/hora</th><th>Produto</th><th>Tipo</th><th>Senhas</th><th>Números</th><th>Preço</th><th>Valor</th><th>Desconto</th><th>Estado</th><th>Fecho</th><th>Pedido</th><th>Motivo</th><th>Reimpr.</th></tr></thead><tbody>';
    for (const l of ls.slice(0, 400)) {
      const pu = l.preco.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
      h += `<tr class="${l.estado === 'Anulada' ? 'anulada' : ''}"><td>${l.venda}</td><td>${dataHoraPT(l.data)}</td><td class="esq">${esc(l.produto)}</td><td>${esc(l.formato)}</td><td>${l.qtd}</td>` +
        `<td>${esc(l.ini)} a ${esc(l.fim)}</td><td>${pu}</td><td>${euro(l.valor)}</td><td>${euro(l.desconto)}</td><td>${esc(l.estado)}</td>` +
        `<td>${l.fecho || ''}</td><td>${l.pedido}</td><td class="esq">${esc(l.motivo || '')}</td><td>${l.reimpressoes || ''}</td></tr>`;
    }
    h += '</tbody></table></div>';
  }
  $('histConteudo').innerHTML = h;
  $('histConteudo').querySelectorAll('[data-filtro]').forEach(s => {
    s.onchange = () => { filtro[s.dataset.filtro] = s.value; renderHistRegisto(); };
  });
}

function renderHistFechos() {
  let h = '';
  if (!E.fechos.length) { $('histConteudo').innerHTML = '<p class="nota">Ainda não há fechos de caixa neste evento.</p>'; return; }
  if (histFecho === null || !E.fechos.find(f => f.num === histFecho)) histFecho = E.fechos[E.fechos.length - 1].num;
  h += '<div class="tabela-rolar"><table class="tabela tab-hist"><thead><tr><th>Nº</th><th>Data/hora</th><th>Vendas</th><th>Pedidos</th><th>Senhas</th><th>Pacote 1</th><th>Pacote 2</th><th>Avulso</th><th>Ofertas</th><th>Desconto</th><th>Anuladas</th><th>Em caixa</th></tr></thead><tbody>';
  for (const f of E.fechos.slice().reverse()) {
    h += `<tr class="clicavel${f.num === histFecho ? ' escolhido' : ''}" data-fecho="${f.num}"><td>${f.num}</td><td>${dataHoraPT(f.data)}</td><td>${f.vendaIni}–${f.vendaFim}</td><td>${f.pedidos}</td><td>${f.senhas}</td>` +
      `<td>${euro(f.p1)}</td><td>${euro(f.p2)}</td><td>${euro(f.avulso)}</td><td>${f.ofertas}</td><td>${euro(f.desconto)}</td><td>${f.anuladas} · ${euro(f.valorAnulado)}</td><td><b>${euro(f.valor)}</b></td></tr>`;
  }
  h += '</tbody></table></div><p class="nota">Toque num fecho para ver o detalhe e os gráficos.</p>';

  const f = E.fechos.find(x => x.num === histFecho);
  const det = E.fechosDetalhe.filter(d => d.fecho === f.num);
  h += `<div class="turno-grelha"><div class="cartao"><h2>Fecho Nº ${f.num} <small>${dataHoraPT(f.data)}${f.posto ? ' · ' + esc(f.posto) : ''}</small></h2>`;
  h += '<table class="tabela tab-turno"><thead><tr><th>Produto</th><th>Tipo</th><th>Senhas</th><th>Valor</th><th>Desconto</th><th>Anuladas</th></tr></thead><tbody>';
  for (const d of det) h += `<tr><td class="esq">${esc(d.produto)}</td><td>${esc(d.formato)}</td><td>${d.senhas}</td><td>${euro(d.valor)}</td><td>${euro(d.desconto)}</td><td>${d.anuladas ? d.anuladas + ' · ' + euro(d.valorAnulado) : ''}</td></tr>`;
  h += `<tr class="total"><td class="esq">Total</td><td></td><td>${f.senhas}</td><td>${euro(f.valor)}</td><td>${euro(f.desconto)}</td><td>${f.anuladas ? f.anuladas + ' · ' + euro(f.valorAnulado) : ''}</td></tr></tbody></table>`;
  h += `<div class="botoes-linha" style="margin-top:12px"><button class="btn cinza-escuro" data-acao="reimprimirTalao" data-n="${f.num}">IMPRIMIR TALÃO</button></div></div>`;
  h += '<div class="cartao"><h2>Vendas por hora</h2>' +
    graficoBarras(f.horas || [], 'valor', 'Euros por hora', v => euroCurto(v), '#2980b9') +
    graficoBarras(f.horas || [], 'senhas', 'Senhas por hora', v => String(Math.round(v)), '#e67e22') + '</div></div>';
  $('histConteudo').innerHTML = h;
  $('histConteudo').querySelectorAll('[data-fecho]').forEach(tr => {
    tr.onclick = () => { histFecho = int(tr.dataset.fecho); renderHistFechos(); };
  });
}

/* ---------- EXPORTAR PARA EXCEL ---------- */
function serialExcel(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return (d.getTime() - d.getTimezoneOffset() * 60000) / 86400000 + 25569;   // dias desde 30/12/1899, hora local
}

function folha(cabecalho, linhas, formatos, larguras) {
  const ws = XLSX.utils.aoa_to_sheet([cabecalho, ...linhas]);
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let r = 1; r <= range.e.r; r++) {
    for (const [c, z] of Object.entries(formatos)) {
      const cel = ws[XLSX.utils.encode_cell({ r, c: int(c) })];
      if (cel && cel.t === 'n') cel.z = z;
    }
  }
  ws['!cols'] = larguras.map(w => ({ wch: w }));
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: cabecalho.length - 1 } }) };
  return ws;
}

async function exportarExcel() {
  if (typeof XLSX === 'undefined') return aviso('A peça de exportação para Excel não carregou. Recarregue a app (Ctrl+F5) com internet.');
  const EUR = '#,##0.00 €', EUR4 = '#,##0.00## €', DH = 'dd/mm/yyyy hh:mm', DHS = 'dd/mm/yyyy hh:mm:ss';
  const wb = XLSX.utils.book_new();
  const reg = E.registo.slice().sort((a, b) => a.venda - b.venda).map(l => [
    l.venda, serialExcel(l.data), l.produto, l.qtd, 0, l.qtd, l.ini, l.fim, l.preco, l.valor, l.desconto,
    l.estado, l.fecho || '', l.anuladaEm ? serialExcel(l.anuladaEm) : '', l.pedido, l.formato, l.motivo || '', l.posto || '', l.reimpressoes || 0
  ]);
  XLSX.utils.book_append_sheet(wb, folha(
    ['Nº venda', 'Data/hora', 'Tipo', 'Pagas', 'Oferta', 'Total senhas', 'Senha inicial', 'Senha final', 'Preço unit.', 'Valor vendido', 'Desconto',
      'Estado', 'Nº fecho', 'Anulada em', 'Nº pedido', 'Formato', 'Motivo', 'Posto', 'Reimpressões'],
    reg, { 1: DHS, 8: EUR4, 9: EUR, 10: EUR, 13: DHS }, [9, 19, 18, 7, 7, 11, 13, 13, 11, 12, 10, 9, 9, 19, 9, 11, 30, 10, 11]), 'Registo');

  const fec = E.fechos.map(f => [f.num, serialExcel(f.data), f.evento, f.vendaIni, f.vendaFim, f.pedidos, f.senhas, f.valor, f.desconto,
    f.semDesconto, f.p1, f.p2, f.avulso, f.ofertas, f.anuladas, f.valorAnulado, f.posto || '']);
  XLSX.utils.book_append_sheet(wb, folha(
    ['Nº fecho', 'Data/hora', 'Evento', '1ª venda', 'Última venda', 'Pedidos', 'Senhas', 'Valor vendido', 'Desconto', 'Valor sem desconto',
      'Pacote 1 (€)', 'Pacote 2 (€)', 'Avulso (€)', 'Senhas oferta', 'Vendas anuladas', 'Valor anulado', 'Posto'],
    fec, { 1: DH, 7: EUR, 8: EUR, 9: EUR, 10: EUR, 11: EUR, 12: EUR, 15: EUR }, [9, 17, 22, 9, 12, 9, 9, 13, 11, 16, 12, 12, 12, 12, 14, 12, 10]), 'Fechos');

  const det = E.fechosDetalhe.map(d => [d.fecho, serialExcel(d.data), d.produto, d.formato, d.preco, d.senhas, d.valor, d.desconto, d.anuladas, d.valorAnulado]);
  XLSX.utils.book_append_sheet(wb, folha(
    ['Nº fecho', 'Data/hora', 'Produto', 'Formato', 'Preço por senha', 'Senhas', 'Valor vendido', 'Desconto', 'Vendas anuladas', 'Valor anulado'],
    det, { 1: DH, 4: EUR4, 6: EUR, 7: EUR, 9: EUR }, [9, 17, 20, 11, 15, 9, 13, 11, 15, 13]), 'FechosDetalhe');

  const hora = [];
  for (const f of E.fechos) for (const x of (f.horas || [])) hora.push([f.num, serialExcel(x.inicio), x.senhas, x.valor]);
  XLSX.utils.book_append_sheet(wb, folha(['Nº fecho', 'Hora', 'Senhas', 'Valor'], hora, { 1: DH, 3: EUR }, [9, 17, 9, 12]), 'VendasPorHora');

  const nome = `Senhas_${nomeFicheiro(E.config.evento)}_${carimbo()}.xlsx`;
  const dados = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  descarregar(nome, new Blob([dados], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  aviso(`Ficheiro Excel criado:\n${nome}\n\nEstá na pasta Transferências.`, 'Exportar');
}

/* ---------- CÓPIA DE SEGURANÇA ---------- */
function conteudoCopia() {
  const copia = JSON.parse(JSON.stringify(E));
  copia.config.chaveQZ = '';   // a chave de impressão nunca sai deste computador
  return JSON.stringify({ app: 'Senhas', versaoApp: VERSAO, versaoDados: E.versaoDados || 1, criadaEm: new Date().toISOString(), estado: copia }, null, 1);
}

function fazerCopia(prefixo = 'Copia') {
  const nome = `Senhas_${prefixo}_${nomeFicheiro(E.config.evento)}_${carimbo()}.json`;
  descarregar(nome, conteudoCopia(), 'application/json');
  return nome;
}

async function copiaSeguranca() {
  const nome = fazerCopia();
  aviso(`Cópia de segurança criada:\n${nome}\n\nEstá na pasta Transferências. Guarde-a também fora do PC (pen ou nuvem).`, 'Cópia de segurança');
}

$('ficheiroRestaurar').addEventListener('change', async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  let dados;
  try {
    dados = JSON.parse(await f.text());
  } catch (err) {
    return aviso('O ficheiro não é uma cópia de segurança válida.', 'Restaurar');
  }
  const est = dados && dados.estado;
  if (!dados || dados.app !== 'Senhas' || !est || !Array.isArray(est.produtos) || !Array.isArray(est.registo) || !est.config)
    return aviso('O ficheiro não é uma cópia de segurança da app Senhas.', 'Restaurar');
  const info = `<b>${esc(f.name)}</b><br>Criada em ${dataHoraPT(dados.criadaEm)} (v${esc(dados.versaoApp)})<br>` +
    `Evento: <b>${esc(est.config.evento)}</b> · ${est.registo.length} linhas de venda · ${(est.fechos || []).length} fecho(s)`;
  if (!await confirmar(info + '<br><br><b>Os dados atuais desta app são substituídos por estes.</b> Continuar?', 'Restaurar cópia', 'SIM, RESTAURAR', 'NÃO')) return;
  if (!await confirmar('Tem a certeza? Esta operação não se pode desfazer.<br>(Se quiser, faça antes uma CÓPIA DE SEGURANÇA dos dados atuais.)', 'Restaurar cópia', 'RESTAURAR', 'CANCELAR')) return;
  const chave = E.config.chaveQZ;
  const novo = { ...estadoInicial(), ...est };
  novo.config = { ...CONFIG_PADRAO, ...est.config, chaveQZ: chave,
    // a forma de imprimir é deste aparelho (PC com QZ Tray, tablet com RawBT): não vem da cópia
    modoImpressao: E.config.modoImpressao, modoDetetado: E.config.modoDetetado };
  novo.pedido = [];
  E = novo;
  await guardar();
  modo = null;
  mostrar('entrada');
  aviso('Cópia restaurada. Entre outra vez na app.\n(A palavra-passe de administrador passa a ser a da cópia.)', 'Restaurar');
});

/* ---------- NOVO EVENTO ---------- */
async function novoEvento() {
  if (E.pedido.length) return aviso('Há um pedido por imprimir.\nCarregue em IMPRIMIR PEDIDO ou em LIMPAR antes do novo evento.', 'Novo evento');
  const abertas = linhasTurno().length;
  if (abertas) return aviso(`Há ${abertas} linha(s) de venda sem fecho de caixa.\nFaça primeiro o FECHO DE CAIXA e depois volte a carregar em NOVO EVENTO.`, 'Novo evento');
  if (!await confirmar(`<b>NOVO EVENTO</b><br><br>A app vai:<br>1. Descarregar uma cópia de segurança de tudo o que existe agora<br>` +
    `2. Apagar todas as vendas e todos os fechos<br>3. Pôr a numeração das senhas de todos os produtos a 1<br><br>` +
    `Produtos, preços, pacotes, logótipo e impressora mantêm-se.<br><br>Continuar?`, 'Novo evento', 'CONTINUAR', 'CANCELAR')) return;
  const nome = await perguntar('Nome do novo evento:', 'Novo evento', { valor: E.config.evento, max: 40 });
  if (!nome) return;
  const data = await perguntar('Data do novo evento:', 'Novo evento', { tipo: 'date', valor: new Date().toISOString().slice(0, 10) });
  if (!data) return;

  const copia = fazerCopia('AntesNovoEvento');
  E.registo = [];
  E.fechos = [];
  E.fechosDetalhe = [];
  E.pedido = [];
  E.ultimoPedido = '';
  E.produtos.forEach(p => { p.prox = 1; });
  E.config.evento = nome;
  E.config.data = data;
  await guardar();
  renderTopo();
  renderDefinicoes();
  aviso(`Novo evento pronto: ${nome} · ${dataPT(data)}\n\nCópia do evento anterior:\n${copia}\n(pasta Transferências)\n\nReveja produtos, preços e pacotes antes de começar a vender.`, 'Novo evento');
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
  // Primeira vez num aparelho: Android → RawBT; os outros ficam como estão
  if (!E.config.modoDetetado) {
    if (/Android/i.test(navigator.userAgent)) E.config.modoImpressao = 'rawbt';
    E.config.modoDetetado = true;
    await guardar();
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  mostrar('entrada');
}

arrancar();
