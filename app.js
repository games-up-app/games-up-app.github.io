// Central de Controle — Escola Brasileira
// Site estático (GitHub Pages). Os dados ficam no repositório PRIVADO e são lidos/gravados
// direto pelo navegador com o token do GitHub do proprietário, guardado só neste aparelho.
// A publicação no jogo exige a assinatura feita pela chave deste aparelho (ver nucleo/).
import { CONFIG } from './config.js';
import { RepoGitHub } from './nucleo/github.js';
import { criarApi } from './nucleo/api.js';
import { lerToken, gravarToken, esquecerToken, chaveDoAparelho, criarChaveDoAparelho, assinadorDoAparelho } from './nucleo/aparelho.js';
import { chavePublicaVapid } from './nucleo/vapid.js';
import { classificarThumbnail, thumbnailsProtegidas } from './nucleo/estatistica.js';

const estado = { usuario: null, dados: null, aba: 'inicio', sub: {}, filtros: {}, repo: null, cliente: null, chave: null };
const LINK_TOKEN = 'https://github.com/settings/personal-access-tokens/new?name=Games%20Up&description=Painel%20da%20Escola%20Brasileira&expires_in=366&contents=write&variables=write';
// Seis abas simples. As seções antigas viraram sub-abas dentro delas.
const ABAS = [
  ['inicio', 'Início'], ['decisoes', 'Decisões'], ['tarefas', 'Tarefas'],
  ['numeros', 'Números'], ['pesquisa', 'Pesquisa'], ['ajustes', 'Ajustes'],
];
const DECIDIVEIS = ['PROPOSTA', 'AGUARDANDO APROVAÇÃO', 'ADIADA'];

// ------------------------------------------------------------------ utilidades
function h(tag, attrs = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') throw new Error('html não permitido');
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const f of filhos.flat(Infinity)) {
    if (f == null || f === false) continue;
    el.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
  return el;
}
const svgNS = 'http://www.w3.org/2000/svg';
function s(tag, attrs = {}, ...filhos) {
  const el = document.createElementNS(svgNS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  for (const f of filhos.flat()) if (f != null) el.append(f instanceof Node ? f : document.createTextNode(String(f)));
  return el;
}
const num = x => (x == null ? '—' : Number(x).toLocaleString('pt-BR'));
const pct = (x, casas = 2) => (x == null ? '—' : `${(x * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`);
const dataBR = iso => {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00-03:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', ...(iso.length > 10 ? { timeStyle: 'short' } : {}) });
};
function linkSeguro(url, texto) {
  try {
    const u = new URL(url);
    if (!['https:', 'http:'].includes(u.protocol)) throw 0;
    return h('a', { href: u.href, target: '_blank', rel: 'noopener noreferrer' }, texto || u.hostname);
  } catch { return h('span', {}, texto || '—'); }
}
function selo(texto, tom = 'neutro') { return h('span', { class: `selo ${tom}` }, texto); }
// Nome simples para cada status (o valor original continua gravado e aparece ao passar o dedo/mouse).
const ROTULOS = {
  'PROPOSTA': 'Em preparo', 'AGUARDANDO APROVAÇÃO': 'Esperando você', 'ADIADA': 'Adiada',
  'APROVADA PARA DESENVOLVIMENTO': 'Aprovada', 'REJEITADA': 'Rejeitada', 'DEVOLVIDA PARA AJUSTES': 'Voltou para ajustes',
  'EM DESENVOLVIMENTO': 'Sendo feita', 'EM TESTES': 'Em testes', 'AGUARDANDO AUTORIZAÇÃO FINAL': 'Esperando sua autorização',
  'APROVADA PARA PUBLICAÇÃO': 'Autorizada', 'PUBLICADA': 'Publicada', 'BLOQUEADA': 'Bloqueada',
  'A FAZER': 'A fazer', 'CONCLUÍDA': 'Concluída', 'IMPEDIDA': 'Travada',
  'MANTER': 'Manter', 'OBSERVAR': 'Observar', 'SUBSTITUIR': 'Pode trocar',
  'ok': 'Funcionando', 'falhou': 'Falhou', 'parcial': 'Parcial', 'indisponível': 'Indisponível',
};
const rotuloStatus = st => ROTULOS[st] || st || '—';
function seloStatus(st) { const el = selo(rotuloStatus(st), tomStatus(st)); if (ROTULOS[st]) el.title = st; return el; }
/** Tabela que vira lista de linhas no celular (cada célula mostra o nome da coluna). */
function tabela(cabecalhos, linhas, { num: colNum = [], rodape = null } = {}) {
  const vazio = c => c == null || c === '' || (Array.isArray(c) && c.every(vazio));
  const cel = (tag, i, conteudo) => h(tag, { class: [colNum.includes(i) ? 'num' : '', vazio(conteudo) ? 'vazia' : ''].join(' ').trim() || null, 'data-rotulo': cabecalhos[i] }, h('span', { class: 'v' }, conteudo));
  return h('div', { class: 'tabela-wrap' }, h('table', { class: 'tabela-pilha' },
    h('thead', {}, h('tr', {}, cabecalhos.map((c, i) => h('th', { class: colNum.includes(i) ? 'num' : null }, c)))),
    h('tbody', {}, linhas.map(l => h('tr', {}, l.map((c, i) => cel('td', i, c))))),
    rodape ? h('tfoot', {}, h('tr', {}, rodape.map((c, i) => cel('td', i, c)))) : null));
}
// Ícones simples (traço) para o menu. Sem emojis na interface.
const ICONES = {
  inicio: 'M3 11l9-7 9 7v8a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  decisoes: 'M4 4h16v16H4zM8 12l3 3 5-6',
  tarefas: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  numeros: 'M5 20V11M12 20V5M19 20v-6M3 20h18',
  pesquisa: 'M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14zM20 20l-4-4',
  ajustes: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  escudo: 'M12 3l7 3v5c0 4.5-3 8-7 10c-4-2-7-5.5-7-10V6zM9 12l2 2 4-4',
  alerta: 'M12 4L2.5 20h19zM12 10v4M12 17h.01',
  info: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 11v5M12 8h.01',
  relogio: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 7v5l3 2',
  check: 'M5 12l5 5 9-10',
  troca: 'M4 8h13l-3-3M20 16H7l3 3',
  olho: 'M2 12s3.5-6 10-6s10 6 10 6s-3.5 6-10 6s-10-6-10-6zM12 9.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5z',
  celular: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2',
  chave: 'M7.5 15a3.5 3.5 0 1 0 0-7a3.5 3.5 0 1 0 0 7zM11 11.5h9M17 11.5v3M20 11.5v2',
  calendario: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  robo: 'M6 8h12v10H6zM12 4v4M9.5 13h.01M14.5 13h.01M3 12v3M21 12v3',
  pessoa: 'M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8zM4 21c0-4 3.5-7 8-7s8 3 8 7',
  grafico: 'M4 4v16h16M8 15l4-4 3 3 5-6',
  documento: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7',
  seta: 'M9 6l6 6-6 6',
};
/** Título de seção com ícone à esquerda. */
const titulo = (nomeIcone, texto, tag = 'h2', attrs = {}) => h(tag, { class: 'titulo-icone', ...attrs }, icone(nomeIcone), h('span', {}, texto));
/** Selo com ícone (ex.: PROTEGIDA). */
function seloIcone(nomeIcone, texto, tom) { return h('span', { class: `selo ${tom}` }, icone(nomeIcone), texto); }
const icone = nome => s('svg',{ viewBox: '0 0 24 24', class: 'icone', 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, s('path', { d: ICONES[nome] }));
function tomStatus(st) {
  if (['APROVADA PARA DESENVOLVIMENTO', 'APROVADA PARA PUBLICAÇÃO', 'PUBLICADA', 'CONCLUÍDA', 'ok', 'MANTER'].includes(st)) return 'ok';
  if (['REJEITADA', 'BLOQUEADA', 'falhou', 'SUBSTITUIR', 'IMPEDIDA'].includes(st)) return 'bad';
  if (['AGUARDANDO APROVAÇÃO', 'AGUARDANDO AUTORIZAÇÃO FINAL', 'DEVOLVIDA PARA AJUSTES', 'ADIADA', 'parcial', 'indisponível', 'OBSERVAR'].includes(st)) return 'warn';
  if (['EM DESENVOLVIMENTO', 'EM TESTES'].includes(st)) return 'info';
  return 'neutro';
}
function avisar(msg, erro = false) {
  const a = document.getElementById('aviso');
  a.replaceChildren(h('div', { class: `toast${erro ? ' erro' : ''}` }, msg));
  clearTimeout(avisar.t);
  avisar.t = setTimeout(() => a.replaceChildren(), erro ? 7000 : 4000);
}
const ehDono = () => estado.usuario?.papel === 'proprietario';

/** Chama a "API" local (roda no navegador e grava no repositório privado). */
async function api(caminho, opcoes = {}) {
  const u = new URL(caminho, 'https://x.invalid');
  const metodo = opcoes.method || 'GET';
  const corpo = opcoes.body ? JSON.parse(opcoes.body) : Object.fromEntries(u.searchParams);
  try {
    return await estado.cliente.chamar(metodo, u.pathname, corpo);
  } catch (e) {
    if (e.status === 401) { await esquecerToken(); estado.usuario = null; telaLogin(e.message); }
    throw e;
  }
}

/** Envia uma gravação e só mostra sucesso depois que o servidor confirmar. */
async function gravar(caminho, corpo, botoes, mensagemOk) {
  botoes.forEach(b => (b.disabled = true));
  const textoOriginal = botoes[0]?.textContent;
  if (botoes[0]) botoes[0].textContent = 'Gravando…';
  try {
    await api(caminho, { method: 'POST', body: JSON.stringify(corpo) });
    avisar(mensagemOk);
    await carregar();
  } catch (e) {
    avisar(`Não gravado: ${e.message}`, true);
    botoes.forEach(b => (b.disabled = false));
    if (botoes[0]) botoes[0].textContent = textoOriginal;
  }
}

// ------------------------------------------------------------------ inicialização
async function iniciar() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  const pedida = new URLSearchParams(location.search).get('aba');
  if (pedida) history.replaceState(null, '', location.pathname);
  let token = null;
  try { token = await lerToken(); } catch {}
  if (!token) return telaLogin();
  try {
    await entrar(token);
    try { estado.aba = pedida || sessionStorage.getItem('eb-aba') || 'inicio'; } catch {}
    if (!ABAS.some(a => a[0] === estado.aba)) estado.aba = 'inicio';
    await carregar();
  } catch (e) {
    if (e.status === 401 || e.status === 403 || e.status === 404) { await esquecerToken().catch(() => {}); return telaLogin(e.message); }
    document.getElementById('raiz').replaceChildren(h('main', { class: 'login', id: 'conteudo' }, h('section', { class: 'login-acesso' }, h('h1', {}, 'Não foi possível abrir'), h('p', {}, e.message), h('button', { class: 'btn primario', onclick: () => location.reload() }, 'Tentar de novo'))));
  }
}

async function entrar(token) {
  const repo = new RepoGitHub({ token, ...CONFIG });
  const eu = await repo.usuario();
  await repo.conferirAcesso();
  estado.repo = repo;
  estado.chave = await chaveDoAparelho().catch(() => null);
  estado.cliente = criarApi({ store: repo, usuario: { id: eu.login, nome: eu.nome }, assinar: await assinadorDoAparelho().catch(() => null) });
  estado.usuario = estado.cliente.usuario;
}

async function carregar() {
  const p = await api('/api/painel');
  estado.usuario = p.usuario; estado.dados = p.dados;
  render();
}

function telaLogin(msg) {
  const campo = h('input', { type: 'password', id: 'token', autocomplete: 'off', spellcheck: 'false', placeholder: 'github_pat_…', 'aria-label': 'Token do GitHub' });
  const botao = h('button', { class: 'btn primario', type: 'submit' }, 'Entrar');
  const erro = h('p', { class: 'login-erro', role: 'alert', hidden: !msg }, msg || '');
  const enviar = async ev => {
    ev.preventDefault();
    const t = campo.value.trim();
    if (!/^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$/.test(t)) { erro.textContent = 'Isso não parece um token do GitHub. Ele começa com github_pat_.'; erro.hidden = false; return; }
    botao.disabled = true; botao.textContent = 'Conferindo…';
    try {
      await entrar(t);
      await gravarToken(t);
      estado.aba = 'inicio';
      await carregar();
    } catch (e) {
      erro.textContent = e.message; erro.hidden = false;
      botao.disabled = false; botao.textContent = 'Entrar';
    }
  };
  document.getElementById('raiz').replaceChildren(
    h('main', { class: 'login', id: 'conteudo' },
      h('section', { class: 'login-marca' },
        h('img', { class: 'login-logo', src: 'marca/logo-escuro.png', alt: 'Level Up', width: 320, height: 90 }),
        h('p', {}, 'Games Up · Central da Escola Brasileira')),
      h('section', { class: 'login-acesso' },
        h('h1', {}, 'Entrar'),
        h('p', { class: 'login-texto' }, 'Só você entra, usando uma chave de acesso do GitHub (token). Isso é feito uma vez em cada aparelho.'),
        h('ol', { class: 'passos' },
          h('li', {}, h('a', { href: LINK_TOKEN, target: '_blank', rel: 'noopener noreferrer' }, 'Toque aqui para criar o token'), '. O nome e as permissões já vêm preenchidos.'),
          h('li', {}, 'Em ', h('strong', {}, 'Repository access'), ', escolha ', h('strong', {}, 'Only select repositories'), ' e marque ', h('strong', {}, 'Automatizar-Escola-Brasileira'), '.'),
          h('li', {}, 'Toque em ', h('strong', {}, 'Generate token'), ', copie e cole abaixo.')),
        h('form', { onsubmit: enviar }, h('label', { for: 'token' }, 'Token'), campo, erro, h('div', { class: 'acoes' }, botao)),
        h('p', { class: 'sinc' }, 'O token fica guardado só neste aparelho e só é usado para falar com o GitHub.'))));
}

function alternarTema() {
  const atual = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const novo = atual === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = novo;
  try { localStorage.setItem('eb-tema', novo); } catch {}
}

async function sair() {
  if (!confirm('Sair deste aparelho? Você vai precisar colar o token de novo.')) return;
  await esquecerToken().catch(() => {});
  estado.usuario = null; estado.repo = null; estado.cliente = null;
  telaLogin('Você saiu.');
}

// ------------------------------------------------------------------ casca
function render() {
  const d = estado.dados;
  const pendentes = (d.propostas?.propostas || []).filter(p => p.status === 'AGUARDANDO APROVAÇÃO').length;
  const finais = (d.lancamentos?.lancamentos || []).filter(l => l.status === 'AGUARDANDO AUTORIZAÇÃO FINAL').length;
  const nav = h('nav', { class: 'nav', 'aria-label': 'Seções' }, ABAS.map(([id, nome]) =>
    h('button', { 'aria-current': estado.aba === id ? 'page' : null, onclick: () => irPara(id) },
      icone(id),
      h('span', { class: 'nav-nome' }, nome),
      id === 'decisoes' && pendentes + finais ? h('span', { class: 'contador', title: 'Esperando sua decisão', 'aria-label': `${pendentes + finais} esperando sua decisão` }, pendentes + finais) : null)));
  const conteudo = { inicio, decisoes, tarefas: tarefasAba, numeros, pesquisa, ajustes }[estado.aba]();
  document.getElementById('raiz').replaceChildren(
    h('div', { class: 'app' },
      h('aside', { class: 'lateral' },
        h('div', { class: 'marca' }, h('div', {}, [h('img', { class: 'logo logo-claro', src: 'marca/logo-claro.png', alt: 'Level Up', width: 160, height: 45 }), h('img', { class: 'logo logo-escuro', src: 'marca/logo-escuro.png', alt: 'Level Up', width: 160, height: 45 })], h('small', {}, 'Games Up'))),
        nav),
      h('main', { class: 'principal', id: 'conteudo' },
        h('div', { class: 'topo' },
          h('div', {}, h('div', { class: 'titulo-jogo' }, h('img', { class: 'logo-jogo', src: 'marca/jogo.png', alt: 'Escola Brasileira', width: 44, height: 44, onerror: e => e.target.remove() }), h('h1', {}, ABAS.find(a => a[0] === estado.aba)[1])),
            h('div', { class: 'sinc' }, `Atualizado em ${dataBR(d.meta?.ultimaSincronizacao)}`)),
          h('div', { class: 'topo-acoes' },
            h('span', { class: 'sinc' }, estado.usuario.nome),
            h('button', { class: 'btn', onclick: alternarTema, 'aria-label': 'Alternar tema claro/escuro' }, 'Tema'),
            h('button', { class: 'btn', onclick: sair }, 'Sair'))),
        // O aviso de dados velhos só importa onde há números do jogo.
        estado.aba === 'numeros' ? alertaDesatualizado() : null,
        conteudo)),
    h('div', { class: 'dica', id: 'dica', role: 'tooltip' }));
}

function irPara(id) {
  estado.aba = id;
  try { sessionStorage.setItem('eb-aba', id); } catch {}
  render();
  window.scrollTo(0, 0);
}

function horasDesde(iso) { return iso ? (Date.now() - new Date(iso).getTime()) / 3600_000 : Infinity; }

function alertaDesatualizado() {
  const hrs = horasDesde(estado.dados.meta?.ultimaSincronizacao);
  if (hrs <= 26) return null;
  const quanto = hrs === Infinity ? 'nunca' : hrs < 48 ? `há ${Math.round(hrs)} h` : `há ${Math.round(hrs / 24)} dias`;
  return h('div', { class: 'alerta warn', role: 'status' }, h('strong', {}, 'Números antigos.'), h('span', {}, `A última leitura do Roblox foi ${quanto}. O jogo pode estar diferente agora.`));
}

function kpi(rotulo, valor, explicacao, detalhe, progresso) {
  return h('div', { class: 'cartao kpi' }, h('div', { class: 'rotulo' }, rotulo), h('div', { class: 'valor' }, valor),
    explicacao ? h('div', { class: 'explica' }, explicacao) : null,
    detalhe ? h('div', { class: 'detalhe' }, detalhe) : null,
    progresso != null ? h('div', { class: 'barra', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(Math.min(1, progresso) * 100), 'aria-label': 'Progresso até a meta' }, h('span', { style: `width:${Math.min(100, progresso * 100).toFixed(1)}%` })) : null);
}

function listaSaude() {
  const t = estado.dados['saude-agendamentos']?.tarefas || {};
  const itens = Object.entries(t);
  if (!itens.length) return h('p', { class: 'vazio' }, 'Sem registros.');
  return h('ul', { class: 'lista-limpa' }, itens.map(([nome, v]) => h('li', {},
    h('div', { class: 'linha-titulo' }, h('strong', {}, nome), seloStatus(v.status)),
    h('div', { class: 'sinc', title: v.cron ? `Agenda: ${v.cron}` : null }, `Última vez: ${v.ultimaExecucao ? dataBR(v.ultimaExecucao) : 'ainda não rodou'}`, v.detalhe ? ` · ${v.detalhe}` : ''))));
}

function proximoSabado() {
  const agora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const d = new Date(agora); d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  if (agora.getDay() === 6) d.setDate(agora.getDate());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ------------------------------------------------------------------ 2. propostas
function filtroSelect(chave, rotuloTodos, opcoes) {
  return h('select', { 'aria-label': rotuloTodos, onchange: e => { estado.filtros[chave] = e.target.value || null; render(); } },
    h('option', { value: '' }, rotuloTodos), opcoes.map(o => h('option', { value: o, selected: estado.filtros[chave] === o }, o)));
}

function cartaoProposta(p) {
  const comentarios = (estado.dados.comentarios?.itens || []).filter(c => c.alvoTipo === 'proposta' && c.alvoId === p.id);
  const fontes = p.origem?.fontes || [];
  const lista = itens => h('ul', { style: 'margin:0;padding-left:18px' }, itens);
  return h('article', { class: 'cartao', 'aria-labelledby': `tit-${p.id}` },
    h('div', { class: 'linha-titulo' }, h('span', { class: 'codigo' }, p.id), seloStatus(p.status)),
    h('h2', { id: `tit-${p.id}` }, p.titulo),
    p.bloqueio ? h('div', { class: 'alerta warn' }, h('strong', {}, 'Ainda não dá para decidir.'), h('span', {}, p.bloqueio)) : null,
    p.resumo ? h('p', { class: 'resumo' }, p.resumo) : null,
    (p.previas || []).length
      ? h('div', { class: 'previas referencia' }, p.previas.map(previa))
      : h('div', { class: 'alerta warn' }, h('strong', {}, p.tipo === 'thumbnail' ? 'Falta a thumbnail candidata.' : 'Falta a imagem de referência.'), h('span', {}, p.tipo === 'thumbnail' ? 'A arte nova ainda vai ser criada. Espere por ela antes de decidir.' : 'Ainda vai ser criada uma imagem explicando a ideia. Espere por ela antes de decidir.')),
    h('p', { class: 'descricao' }, p.descricao),
    h('dl', { class: 'campos' },
      h('dt', {}, 'Por que fazer'), h('dd', {}, p.motivacao),
      h('dt', {}, 'O que o jogador ganha'), h('dd', {}, p.beneficio),
      h('dt', {}, 'Quanto trabalho dá'), h('dd', {}, p.esforco),
      h('dt', {}, 'O que pode dar errado'), h('dd', {}, p.risco)),
    h('details', {}, h('summary', {}, 'Mais detalhes'),
      h('dl', { class: 'campos' },
        h('dt', {}, 'Como vamos medir'), h('dd', {}, p.hipotese ? [selo(p.hipotese.classificacao, 'info'), ` ${p.hipotese.metrica}: ${p.hipotese.esperado}`] : '—'),
        h('dt', {}, 'Evidências'), h('dd', {}, (p.evidencias || []).length ? lista(p.evidencias.map(e => h('li', {}, e))) : '—'),
        h('dt', {}, 'Fontes'), h('dd', {}, fontes.length ? lista(fontes.map(fo => h('li', {}, fo.url ? linkSeguro(fo.url, fo.titulo) : fo.titulo, ` (${fo.data})`))) : '—'),
        h('dt', {}, 'Se der errado'), h('dd', {}, p.recuperacao),
        h('dt', {}, 'Responsável'), h('dd', {}, p.responsavel || '—'),
        h('dt', {}, 'Lançamento previsto'), h('dd', {}, `Sábado ${dataBR(p.semanaAlvo)} · versão ${p.versao} · tipo ${p.tipo}`))),
    (p.decisoes || []).length ? h('details', {}, h('summary', {}, `Decisões anteriores (${p.decisoes.length})`),
      h('ul', { class: 'lista-limpa' }, p.decisoes.map(dc => h('li', {}, selo(dc.acao, 'neutro'), ` por ${dc.por.nome} em ${dataBR(dc.em)}`, dc.comentario ? ` — “${dc.comentario}”` : '')))) : null,
    ehDono() && DECIDIVEIS.includes(p.status) ? painelDecisao(p) : null,
    blocoComentarios('proposta', p.id, comentarios));
}

/** Imagem guardada no repositório privado: baixada com o token e exibida localmente. */
function previa(caminho) {
  const rel = String(caminho).replace(/^dados\//, '');
  const nome = rel.split('/').pop();
  if (!/^previas\/[a-z0-9][a-z0-9\-_/]*\.(svg|png|jpg|jpeg|webp)$/.test(rel)) return h('div', { class: 'placeholder-img' }, nome);
  const ehThumb = rel.startsWith('previas/thumbnails/');
  const legenda = ehThumb ? 'Thumbnail candidata — só vai para a vitrine do Roblox se você autorizar' : 'Imagem de referência — só explica a ideia; não vai para o jogo';
  const img = h('img', { alt: legenda, loading: 'lazy' });
  const fig = h('figure', {}, img, h('figcaption', {}, legenda));
  estado.repo.lerImagem(rel).then(b => {
    if (!b) { fig.replaceChildren(h('div', { class: 'placeholder-img' }, 'Imagem não encontrada')); return; }
    img.src = URL.createObjectURL(b);
    img.addEventListener('click', () => window.open(img.src, '_blank', 'noopener'));
  }).catch(() => fig.replaceChildren(h('div', { class: 'placeholder-img' }, 'Não foi possível carregar')));
  return fig;
}

function painelDecisao(p) {
  const texto = h('textarea', { id: `dec-${p.id}`, placeholder: 'Opcional. Obrigatório se for pedir alterações.', maxlength: 2000 });
  const botoes = [];
  const enviar = acao => () => {
    if (acao === 'pedir_alteracoes' && !texto.value.trim()) { avisar('Escreva o que precisa mudar.', true); texto.focus(); return; }
    const nomes = { aprovar: 'APROVAR PARA DESENVOLVIMENTO', rejeitar: 'REJEITAR', pedir_alteracoes: 'PEDIR ALTERAÇÕES', adiar: 'ADIAR' };
    if (!confirm(`${nomes[acao]}: ${p.id} (versão ${p.versao})?\n\nIsto NÃO autoriza publicação; a autorização final é separada.`)) return;
    gravar('/api/propostas/decisao', { propostaId: p.id, acao, comentario: texto.value, versao: p.versao }, botoes, `Decisão registrada para ${p.id}.`);
  };
  botoes.push(
    h('button', { class: 'btn primario', onclick: enviar('aprovar') }, 'Aprovar para desenvolvimento'),
    h('button', { class: 'btn', onclick: enviar('pedir_alteracoes') }, 'Pedir alterações'),
    h('button', { class: 'btn', onclick: enviar('adiar') }, 'Adiar'),
    h('button', { class: 'btn perigo', onclick: enviar('rejeitar') }, 'Rejeitar'));
  return h('div', { class: 'cartao decisao' },
    h('h3', {}, 'Sua decisão'),
    h('p', { class: 'sinc' }, 'Aprovar só libera o trabalho. Nada vai para o jogo sem a sua autorização final, que é pedida depois.'),
    h('label', { for: `dec-${p.id}` }, 'Comentário'), texto, h('div', { class: 'acoes' }, botoes));
}

function blocoComentarios(alvoTipo, alvoId, comentarios) {
  const texto = h('textarea', { placeholder: 'Escreva um comentário…', maxlength: 2000, 'aria-label': 'Novo comentário' });
  const btn = h('button', { class: 'btn', onclick: () => {
    if (!texto.value.trim()) return;
    gravar('/api/comentarios', { alvoTipo, alvoId, texto: texto.value }, [btn], 'Comentário publicado no painel.');
  } }, 'Comentar');
  return h('details', {}, h('summary', {}, `Comentários (${comentarios.length})`),
    comentarios.map(c => h('div', { class: 'comentario' }, h('div', { class: 'quem' }, `${c.por.nome} · ${dataBR(c.em)}`), h('div', {}, c.texto))),
    texto, h('div', { class: 'acoes' }, btn));
}

// ------------------------------------------------------------------ 3. desenvolvimento + lançamentos
function cartaoLancamento(l) {
  const blocos = [
    h('div', { class: 'linha-titulo' }, h('h3', {}, `Atualização ${l.id}${l.versao ? ` · ${l.versao}` : ''}`), seloStatus(l.status)),
    h('dl', { class: 'campos' },
      h('dt', {}, 'Vai para o jogo em'), h('dd', {}, dataBR(l.dataAlvo)),
      h('dt', {}, 'Propostas incluídas'), h('dd', {}, (l.propostaIds || []).join(', ') || '—'),
      h('dt', {}, 'O que muda'), h('dd', {}, (l.changelog || []).length ? h('ul', { style: 'margin:0;padding-left:18px' }, l.changelog.map(c => h('li', {}, c))) : '—'),
      h('dt', {}, 'Testes'), h('dd', {}, l.testes ? [selo(l.testes.resultado, l.testes.resultado === 'aprovado' ? 'ok' : 'bad'), ` ${l.testes.detalhes || ''}`] : '—'),
      h('dt', {}, 'O que pode dar errado'), h('dd', {}, l.riscos || '—'),
      h('dt', {}, 'Como desfazer'), h('dd', {}, l.planoReversao || '—'),
      h('dt', {}, 'Sua autorização'), h('dd', {}, l.autorizacao ? `Assinada por ${l.autorizacao.dados.por} em ${dataBR(l.autorizacao.dados.em)}; vale até ${dataBR(l.autorizacao.dados.expiraEm)}` : 'Ainda não'),
      h('dt', {}, 'Código do pacote (SHA-256)'), h('dd', { class: 'hash' }, l.artefato?.sha256 || '—')),
  ];
  if (l.status === 'AGUARDANDO AUTORIZAÇÃO FINAL' && !estado.chave) {
    blocos.push(h('div', { class: 'alerta warn' }, h('strong', {}, 'Falta a chave deste aparelho.'), h('span', {}, 'Para autorizar, crie a chave em Ajustes → Chave de autorização. É um toque só.')));
  } else if (l.status === 'AGUARDANDO AUTORIZAÇÃO FINAL') {
    const conf = h('input', { type: 'text', placeholder: '8 primeiros caracteres do código', 'aria-label': 'Confirmação do código do pacote', autocomplete: 'off' });
    const coment = h('textarea', { placeholder: 'Opcional. Obrigatório se for devolver.', maxlength: 2000, 'aria-label': 'Comentário' });
    const botoes = [];
    const enviar = acao => () => {
      if (acao === 'autorizar' && conf.value.trim().toLowerCase() !== (l.artefato?.sha256 || '').slice(0, 8)) { avisar('Os caracteres não conferem com o hash do artefato.', true); return; }
      if (acao === 'devolver' && !coment.value.trim()) { avisar('Explique o que precisa ser ajustado.', true); return; }
      const msg = acao === 'autorizar' ? `Você autoriza a publicação desta atualização (${l.id}) no próximo sábado?\n\nVale somente para o artefato ${l.artefato.sha256.slice(0, 12)}…` : `Confirmar: ${acao} ${l.id}?`;
      if (!confirm(msg)) return;
      gravar('/api/lancamentos/decisao', { lancamentoId: l.id, acao, artefatoSha256: l.artefato?.sha256, comentario: coment.value }, botoes, acao === 'autorizar' ? 'Autorização final gravada e assinada.' : 'Decisão registrada.');
    };
    botoes.push(h('button', { class: 'btn publicar', onclick: enviar('autorizar') }, 'AUTORIZAR PUBLICAÇÃO'),
      h('button', { class: 'btn', onclick: enviar('devolver') }, 'Devolver para ajustes'),
      h('button', { class: 'btn perigo', onclick: enviar('bloquear') }, 'Bloquear'));
    blocos.push(h('div', { class: 'cartao decisao' },
      h('h3', {}, 'Autorizar a publicação'),
      h('ol', { class: 'passos' },
        h('li', {}, 'Confira o que muda, acima.'),
        h('li', {}, 'Digite os 8 primeiros caracteres do código do pacote.'),
        h('li', {}, 'Toque em Autorizar publicação.')),
      h('p', { class: 'sinc' }, 'Se o pacote mudar depois, esta autorização deixa de valer sozinha.'),
      h('label', {}, 'Confirmação do código'), conf, h('label', {}, 'Comentário'), coment, h('div', { class: 'acoes' }, botoes)));
  }
  return h('div', { class: 'lancamento' }, blocos);
}

function cartaoTarefa(t) {
  const pode = true;
  const comentarios = (estado.dados.comentarios?.itens || []).filter(c => c.alvoTipo === 'tarefa' && c.alvoId === t.id);
  let form = null;
  if (pode) {
    const prog = h('input', { type: 'text', inputmode: 'numeric', value: String(t.progresso ?? 0), 'aria-label': 'Progresso (%)' });
    const st = h('select', { 'aria-label': 'Status' }, ['A FAZER', 'EM DESENVOLVIMENTO', 'EM TESTES', 'CONCLUÍDA', 'IMPEDIDA'].map(o => h('option', { value: o, selected: t.status === o }, o)));
    const checks = (t.checklist || []).map(() => null);
    const nota = h('input', { type: 'text', placeholder: 'Nota (opcional)', maxlength: 500, 'aria-label': 'Nota' });
    const caixas = (t.checklist || []).map((c, i) => h('label', { style: 'display:flex;gap:8px;align-items:center' }, checks[i] = h('input', { type: 'checkbox', checked: c.feito }), c.texto));
    const btn = h('button', { class: 'btn primario', onclick: () => {
      const v = Number(prog.value);
      if (!Number.isInteger(v) || v < 0 || v > 100) { avisar('Progresso deve ser um número inteiro de 0 a 100.', true); return; }
      gravar('/api/tarefas/progresso', { tarefaId: t.id, progresso: v, status: st.value, checklist: checks.map(c => c.checked), nota: nota.value }, [btn], 'Progresso atualizado.');
    } }, 'Salvar progresso');
    form = h('details', {}, h('summary', {}, 'Atualizar progresso'), caixas, h('label', {}, 'Progresso (%)'), prog, h('label', {}, 'Status'), st, h('label', {}, 'Nota'), nota, h('div', { class: 'acoes' }, btn));
  }
  return h('article', { class: 'cartao' },
    h('div', { class: 'linha-titulo' }, h('span', { class: 'codigo' }, t.id), seloStatus(t.status)),
    h('h3', {}, t.titulo),
    h('div', { class: 'meta-linha' }, h('span', {}, `Quem faz: ${t.responsavelNome || '—'}`), t.propostaId ? h('span', {}, `Da proposta ${t.propostaId}`) : h('span', {}, 'Preparação do sistema')),
    h('div', { class: 'barra', role: 'progressbar', 'aria-valuenow': t.progresso, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': 'Progresso' }, h('span', { style: `width:${t.progresso || 0}%` })),
    h('div', { class: 'sinc' }, `${t.progresso || 0}% pronto`),
    !form && (t.checklist || []).length ? h('ul', { style: 'padding-left:18px' }, t.checklist.map(c => h('li', {}, `${c.feito ? 'Feito' : 'Falta'}: ${c.texto}`))) : null,
    (t.impedimentos || []).length ? h('div', { class: 'alerta bad' }, h('strong', {}, 'O que está travando:'), h('span', {}, t.impedimentos.join('; '))) : null,
    (t.historico || []).length ? h('details', {}, h('summary', {}, `Histórico (${t.historico.length})`), h('ul', { class: 'lista-limpa' }, t.historico.map(x => h('li', { class: 'sinc' }, `${dataBR(x.em)} · ${x.por?.nome || 'automação'}: ${x.de?.progresso ?? '—'}% → ${x.para?.progresso ?? '—'}%${x.nota ? ` — ${x.nota}` : ''}`)))) : null,
    form, blocoComentarios('tarefa', t.id, comentarios));
}

// ------------------------------------------------------------------ 4. thumbnails
function thumbnails() {
  const t = estado.dados.thumbnails;
  const snap = t?.snapshots?.at(-1);
  if (!snap) return h('p', { class: 'vazio' }, 'Sem dados de thumbnails.');
  const itens = snap.itens;
  const jog = x => (Number.isFinite(x.jogadasQualificadas) ? x.jogadasQualificadas : Math.round(x.impressoes * x.qptr));
  const total = snap.total?.impressoes || itens.reduce((a, b) => a + b.impressoes, 0);
  const qptrGeral = snap.total?.qptr ?? null;
  const ref = itens.reduce((a, b) => (jog(b) > jog(a) ? b : a));
  const analise = Object.fromEntries(itens.map(x => {
    const c = classificarThumbnail(x, ref);
    return [x.id, { ...c, icInf: c.ic.inf, icSup: c.ic.sup }];
  }));
  const protegidas = thumbnailsProtegidas(itens, { qptrGeral });
  const ranking = [...itens].sort((a, b) => jog(b) - jog(a));
  const anterior = t.snapshots.length > 1 ? t.snapshots.at(-2) : null;
  // Frase simples para cada recomendação; o detalhe estatístico fica escondido em "Detalhe técnico".
  const FRASES = {
    MANTER: 'Vai bem. Fica como está.',
    OBSERVAR: 'Ainda tem poucos dados. Continua no ar e é revista na próxima semana.',
    SUBSTITUIR: 'Trouxe bem menos jogadores que a melhor. Pode ser trocada, mas só se você aprovar.',
  };
  const situacao = (x, completa = true) => {
    if (protegidas.has(x.id)) {
      return [seloIcone('escudo', 'PROTEGIDA', 'protegida'),
        completa ? h('div', { class: 'frase' }, 'Não será trocada. Motivo: ', protegidas.get(x.id).join(' e '), '.') : null];
    }
    const a = analise[x.id];
    return [seloStatus(a.recomendacao),
      completa ? h('div', { class: 'frase' }, FRASES[a.recomendacao] || a.motivo) : null,
      completa && FRASES[a.recomendacao] ? h('details', { class: 'tecnico' }, h('summary', {}, 'Detalhe técnico'), h('div', { class: 'sinc' }, a.motivo)) : null];
  };
  const tempo = v => (v != null ? `${String(v).replace('.', ',')} min` : '—');
  return h('div', {},
    h('section', { class: 'cartao destaque' },
      titulo('grafico', 'Mais cliques da semana'),
      h('p', { class: 'intro' }, `Qual thumbnail (a imagem de vitrine do jogo no Roblox) trouxe mais jogadores de ${dataBR(snap.periodo.inicio)} a ${dataBR(snap.periodo.fim)}. A primeira é a melhor.`),
      h('div', { class: 'explica-protegida' },
        seloIcone('escudo', 'PROTEGIDA', 'protegida'),
        h('span', {}, 'quer dizer que a imagem está entre as melhores e ', h('strong', {}, 'não será trocada'), '. As outras só são trocadas com a sua aprovação.')),
      h('ol', { class: 'ranking' }, ranking.map(x => h('li', { class: protegidas.has(x.id) ? 'protegida' : null },
        x.previa ? h('div', { class: 'ranking-img' }, previa(x.previa)) : null,
        h('div', { class: 'ranking-texto' },
          h('div', { class: 'linha-titulo' }, h('strong', { class: 'ranking-nome' }, x.nome), situacao(x, false)),
          h('div', { class: 'ranking-numero' }, h('strong', {}, num(jog(x))), ' jogadores'),
          h('div', { class: 'sinc' }, `Vista ${num(x.impressoes)} vezes · taxa de jogadas ${pct(x.qptr)}`),
          situacao(x).slice(1))))),
      h('p', { class: 'sinc' }, `Fonte: ${snap.fonte} (Página Inicial do Roblox). A troca de uma imagem só é proposta depois de ler os números mais novos do Creator Hub.`)),
    h('section', { class: 'cartao grafico' }, titulo('olho', 'Quem viu e entrou'),
      h('p', { class: 'intro' }, 'Taxa de jogadas (qPTR): de cada 100 pessoas que viram a imagem, quantas entraram no jogo. Barra mais alta é melhor.'),
      h('ul', { class: 'legenda-lista' },
        h('li', {}, h('i', { class: 'leg-tracejada' }), 'Linha tracejada: média do jogo.'),
        h('li', {}, h('i', { class: 'leg-bigode' }), 'Traço fino: margem de erro. Quanto mais comprido, menos certeza (poucos dados).')),
      graficoQptr(itens, analise, qptrGeral)),
    h('details', { class: 'cartao' }, h('summary', {}, 'Ver tabela completa'),
      tabela(['Thumbnail', 'Vezes vista', 'Jogadores', 'Taxa de jogadas', 'Tempo médio', 'Público que mais gostou', 'Situação'],
        itens.map(x => [x.nome, num(x.impressoes), num(jog(x)), pct(x.qptr), tempo(x.tempoMedioMin), x.segmentoVencedor || '—', situacao(x, false)]),
        { num: [1, 2, 3, 4], rodape: snap.total ? ['Total', num(snap.total.impressoes), num(snap.total.jogadasQualificadas), pct(snap.total.qptr), tempo(snap.total.tempoMedioMin), '', ''] : null }),
      anterior ? h('p', { class: 'sinc' }, `Semana anterior (${dataBR(anterior.periodo.inicio)} a ${dataBR(anterior.periodo.fim)}): ${num(anterior.itens.reduce((a, b) => a + b.impressoes, 0))} vezes vista.`) : null),
    (snap.pendencias || []).length ? h('section', { class: 'cartao' },
      h('div', { class: 'alerta warn' }, icone('alerta'), h('strong', {}, 'Ainda falta receber:'), h('span', {}, snap.pendencias.join('; ')))) : null,
    h('details', { class: 'cartao' }, h('summary', {}, 'Semanas anteriores'),
      h('ul', { class: 'lista-limpa' }, [...t.snapshots].reverse().map(sn => h('li', {}, `${dataBR(sn.periodo?.inicio)} a ${dataBR(sn.periodo?.fim)} · ${num(sn.total?.impressoes ?? sn.itens.reduce((a, b) => a + b.impressoes, 0))} vezes vista · ${sn.fonte}`)))));
}

function mostrarDica(ev, texto) {
  const d = document.getElementById('dica'); if (!d) return;
  d.textContent = texto; d.style.display = 'block';
  d.style.left = `${Math.min(ev.clientX + 12, innerWidth - 270)}px`; d.style.top = `${ev.clientY + 12}px`;
}
function esconderDica() { const d = document.getElementById('dica'); if (d) d.style.display = 'none'; }

function graficoQptr(itens, analise, geralInformado = null) {
  const W = 640, H = 260, m = { l: 48, r: 12, t: 12, b: 34 };
  const bruto = Math.max(...itens.map(x => analise[x.id]?.icSup ?? x.qptr));
  // Marcas uniformes: escolhe o menor passo "redondo" que gere até 6 divisões.
  const passo = [0.0005, 0.001, 0.002, 0.0025, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.25].find(p => bruto / p <= 6) || 0.25;
  const divisoes = Math.ceil(bruto / passo);
  const max = divisoes * passo;
  const y = v => m.t + (H - m.t - m.b) * (1 - v / max);
  const bw = (W - m.l - m.r) / itens.length;
  const geral = geralInformado ?? estado.dados.metricas?.periodos?.at(-1)?.indicadores?.qptr;
  const g = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `Taxa de jogadas por thumbnail: ${itens.map(x => `${x.nome} ${pct(x.qptr)}`).join(', ')}` });
  for (let i = 0; i <= divisoes; i++) {
    const v = passo * i;
    g.append(s('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: 'eixo' }), s('text', { x: m.l - 6, y: y(v) + 4, 'text-anchor': 'end' }, pct(v, passo < 0.001 ? 2 : 1)));
  }
  itens.forEach((x, i) => {
    const a = analise[x.id] || {};
    const cx = m.l + bw * i + bw / 2, larg = Math.min(46, bw * 0.5);
    const grupo = s('g', { tabindex: 0 });
    const texto = `${x.nome}: taxa de jogadas ${pct(x.qptr)}${a.icInf != null ? ` (pode estar entre ${pct(a.icInf)} e ${pct(a.icSup)})` : ''} · vista ${num(x.impressoes)} vezes`;
    grupo.append(s('rect', { x: cx - larg / 2, y: y(x.qptr), width: larg, height: Math.max(0, y(0) - y(x.qptr)), rx: 4, class: 'barra-serie' }));
    if (a.icInf != null) grupo.append(s('line', { x1: cx, x2: cx, y1: y(a.icSup), y2: y(a.icInf), class: 'bigode' }), s('line', { x1: cx - 6, x2: cx + 6, y1: y(a.icSup), y2: y(a.icSup), class: 'bigode' }), s('line', { x1: cx - 6, x2: cx + 6, y1: y(a.icInf), y2: y(a.icInf), class: 'bigode' }));
    grupo.append(s('rect', { x: m.l + bw * i, y: m.t, width: bw, height: H - m.t - m.b, fill: 'transparent' }));
    grupo.append(s('text', { x: cx, y: H - 12, 'text-anchor': 'middle' }, x.nome.replace('Thumbnail ', 'Thumb ')));
    grupo.addEventListener('pointermove', e => mostrarDica(e, texto));
    grupo.addEventListener('pointerleave', esconderDica);
    grupo.addEventListener('focus', e => { const r = e.target.getBoundingClientRect(); mostrarDica({ clientX: r.left + r.width / 2, clientY: r.top }, texto); });
    grupo.addEventListener('blur', esconderDica);
    g.append(grupo);
  });
  if (geral) g.append(s('line', { x1: m.l, x2: W - m.r, y1: y(geral), y2: y(geral), class: 'meta-linha-svg' }));
  return g;
}

function graficoParticipacao(itens, total) {
  const W = 640, linha = 30, H = itens.length * linha + 8, m = { l: 92, r: 64 };
  const g = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `Participação: ${itens.map(x => `${x.nome} ${pct(x.impressoes / total, 1)}`).join(', ')}` });
  itens.forEach((x, i) => {
    const frac = x.impressoes / total, yy = 4 + i * linha;
    const larg = Math.max(2, (W - m.l - m.r) * frac);
    const grupo = s('g', {});
    grupo.append(s('text', { x: m.l - 8, y: yy + 17, 'text-anchor': 'end' }, x.nome),
      s('rect', { x: m.l, y: yy + 6, width: larg, height: 16, rx: 4, class: 'barra-serie' }),
      s('text', { x: m.l + larg + 6, y: yy + 18 }, pct(frac, 1)));
    grupo.addEventListener('pointermove', e => mostrarDica(e, `${x.nome}: ${num(x.impressoes)} impressões (${pct(frac, 1)})`));
    grupo.addEventListener('pointerleave', esconderDica);
    g.append(grupo);
  });
  return g;
}

// ------------------------------------------------------------------ 5. tendências
function tendencias() {
  const semanas = estado.dados.tendencias?.semanas || [];
  if (!semanas.length) return h('p', { class: 'vazio' }, 'Nenhuma pesquisa registrada.');
  const cats = [...new Set(semanas.flatMap(s => s.itens.map(i => i.categoria)))];
  return h('div', {},
    h('div', { class: 'filtros' }, filtroSelect('categoria', 'Todas as categorias', cats)),
    [...semanas].reverse().map(sem => h('section', {},
      titulo('calendario', `Semana de ${dataBR(sem.semana)}`, 'h2', { style: 'margin:18px 0 4px' }),
      h('p', { class: 'sinc' }, `Pesquisado em ${dataBR(sem.pesquisadoEm)}. ${sem.metodo || ''}`),
      sem.itens.filter(i => !estado.filtros.categoria || i.categoria === estado.filtros.categoria).map(i => h('article', { class: 'cartao' },
        h('div', { class: 'linha-titulo' }, h('h3', {}, i.nome), selo(i.categoria, 'neutro')),
        h('dl', { class: 'campos' },
          h('dt', {}, 'O que vimos'), h('dd', {}, i.evidencia),
          h('dt', {}, 'Por que importa'), h('dd', {}, i.relevancia),
          h('dt', {}, 'Como usar no nosso jogo'), h('dd', {}, i.adaptacao),
          h('dt', {}, 'Dificuldade'), h('dd', {}, i.dificuldade),
          h('dt', {}, 'O que pode dar errado'), h('dd', {}, i.riscos),
          h('dt', {}, 'O que esperamos ganhar'), h('dd', {}, i.hipoteseImpacto),
          h('dt', {}, 'Fontes'), h('dd', {}, h('ul', { style: 'margin:0;padding-left:18px' }, i.fontes.map(f => h('li', {}, linkSeguro(f.url, f.titulo), ` (${f.data})`))))))))));
}

// ------------------------------------------------------------------ 6. discord
function discord() {
  const d = estado.dados.discord;
  const lista = (d?.sugestoes || []).filter(x => !estado.filtros.soEB || x.relacionada !== false && !/outro/i.test(x.jogo));
  return h('div', {},
    h('p', { class: 'intro' }, 'Sugestões dos jogadores no Discord. Votos mostram interesse, mas sozinhos não decidem o que entra no jogo.'),
    h('div', { class: `alerta ${d?.acesso ? 'ok' : 'warn'}` }, icone(d?.acesso ? 'check' : 'alerta'), h('strong', {}, d?.acesso ? 'Conectado.' : 'Sem acesso ao Discord.'), h('span', {}, `${d?.observacao || ''} Última leitura: ${dataBR(d?.ultimaLeitura)}.`)),
    h('div', { class: 'filtros' }, h('label', { style: 'display:flex;gap:6px;align-items:center;margin:0' }, h('input', { type: 'checkbox', checked: !!estado.filtros.soEB, onchange: e => { estado.filtros.soEB = e.target.checked; render(); } }), 'Só Escola Brasileira')),
    lista.length
      ? tabela(['Sugestão', 'Jogo', 'Data', 'Votos', 'Comentários', 'Moderação', 'Triagem'], lista.map(x => [
        [x.link ? linkSeguro(x.link, x.resumo) : x.resumo, x.confirmado ? null : [' ', selo('não confirmado', 'warn')]],
        x.jogo, dataBR(x.data), num(x.votos), num(x.comentarios), x.statusModeracao, x.triagem]), { num: [3, 4] })
      : h('p', { class: 'vazio' }, 'Nenhuma sugestão para mostrar.'),
    h('p', { class: 'sinc' }, 'Uma sugestão rejeitada só volta com um motivo novo e com a sua permissão.'));
}

// ------------------------------------------------------------------ 7. relatórios
function relatorios() {
  const indice = estado.dados.relatorios_indice?.relatorios || [];
  const atual = estado.relatorioAberto || estado.dados.relatorioAtual;
  const sel = h('select', { 'aria-label': 'Escolher relatório', onchange: async e => {
    try { estado.relatorioAberto = await api(`/api/relatorio?arquivo=${encodeURIComponent(e.target.value)}`); render(); } catch (err) { avisar(err.message, true); }
  } }, [...indice].reverse().map(r => h('option', { value: r.arquivo, selected: atual && r.data === (atual.periodo?.fim || '') }, `${dataBR(r.data)} · ${r.tipo}${r.completo ? '' : ' (incompleto)'}`)));
  if (!atual) return h('p', { class: 'vazio' }, 'Nenhum relatório gerado ainda.');
  const r = atual;
  return h('div', {},
    h('div', { class: 'filtros' }, sel),
    h('article', { class: 'cartao relatorio-md' },
      h('h2', {}, `${r.titulo}${r.preliminar ? ' (PRELIMINAR)' : ''}`),
      h('div', { class: 'meta-linha' }, h('span', {}, `Período: ${r.periodo ? `${dataBR(r.periodo.inicio)} a ${dataBR(r.periodo.fim)}` : '—'}`), h('span', {}, `Números de ${dataBR(r.ultimaSincronizacao)}`), h('span', {}, `Feito em ${dataBR(r.geradoEm)}`), h('span', {}, `Versão do jogo: ${r.versaoJogo}`)),
      !r.completo ? h('div', { class: 'alerta warn' }, icone('alerta'), h('strong', {}, 'Relatório incompleto.'), h('span', {}, `Falta: ${r.faltando.join('; ')}`)) : null,
      r.preliminar ? h('div', { class: 'alerta info' }, icone('relogio'), h('span', {}, 'Primeira leitura, só de um dia. O resultado de verdade sai depois de 7 dias.')) : null,
      h('h3', {}, 'Resumo'),
      h('ul', {}, h('li', {}, h('strong', {}, 'Como está: '), r.resumo.tendencia), h('li', {}, h('strong', {}, 'O que descobrimos: '), r.resumo.descoberta), h('li', {}, h('strong', {}, 'Maior risco: '), r.resumo.maiorRisco), h('li', {}, h('strong', {}, 'Prioridade: '), r.resumo.prioridade)),
      h('h3', {}, 'Números da semana'),
      h('p', { class: 'sinc' }, 'Compara com a semana anterior. "p.p." quer dizer pontos percentuais: de 0,80% para 0,90% é +0,10 p.p.'),
      tabela(['Indicador', 'Antes', 'Agora', 'Mudança', 'De onde veio'], r.indicadores.map(i => {
        const f = i.chave === 'qptr' ? pct : num;
        const v = i.variacaoPp != null ? `${i.variacaoPp.toFixed(2).replace('.', ',')} p.p.` : i.variacaoRelativaPct != null ? `${i.variacaoRelativaPct.toFixed(1).replace('.', ',')}%` : '—';
        return [i.chave === 'qptr' ? 'Taxa de jogadas (qPTR)' : i.nome, f(i.anterior), f(i.atual), v, h('span', { class: 'sinc' }, i.fonte || '—')];
      }), { num: [1, 2, 3] }),
      h('h3', {}, 'Thumbnails'),
      h('ul', {}, r.thumbnails.map(t => h('li', {}, `${t.nome}: vista ${num(t.impressoes)} vezes, taxa de jogadas ${pct(t.qptr)} (pode estar entre ${pct(t.icInf)} e ${pct(t.icSup)}). `, seloStatus(t.recomendacao), ` Certeza: ${t.confianca}.`))),
      h('h3', {}, 'O que mudou no jogo'), h('p', {}, r.atualizado.length ? r.atualizado.map(a => `${a.versao}: ${a.propostas.join(', ')}`).join('; ') : r.observacoesAtualizacao),
      h('h3', {}, 'Deu certo e não deu certo'), h('ul', { class: 'lista-resultado' }, [...r.deuCerto.map(x => h('li', { class: 'certo' }, h('strong', {}, 'Deu certo: '), x)), ...r.naoDeuCerto.map(x => h('li', { class: 'errado' }, h('strong', {}, 'Não deu certo: '), x)), ...r.incertezas.map(x => h('li', {}, h('strong', {}, 'Ainda incerto: '), x))]),
      h('h3', {}, 'Tendências da semana'), h('ul', {}, r.tendencias.map(t => h('li', {}, h('strong', {}, t.nome), ` — ${t.adaptacao}`))),
      h('h3', {}, 'Discord'), r.discordAcesso ? null : h('p', { class: 'sinc' }, 'Sem acesso ao servidor.'), h('ul', {}, r.discord.map(d => h('li', {}, `${d.resumo} — ${d.triagem}`))),
      h('h3', {}, 'Próxima atualização proposta'), h('ul', {}, r.proximaAtualizacao.map(p => h('li', {}, `${p.id} ${p.titulo} `, seloStatus(p.status)))),
      h('div', { class: 'alerta warn' }, icone('alerta'), h('strong', {}, 'Atenção:'), h('span', {}, r.avisoAprovacao)),
      h('h3', {}, 'Conclusão'), h('ul', {}, h('li', {}, r.diagnostico.meta), h('li', {}, h('strong', {}, 'Fazer primeiro: '), r.diagnostico.acaoPrioritaria), r.diagnostico.experimentos.map(e => h('li', {}, `${e.nome}: ${e.decisao}`)))));
}

// ------------------------------------------------------------------ 8. histórico
function historico() {
  const eventos = [...(estado.dados.auditoria || [])].reverse();
  const lancs = estado.dados.lancamentos?.lancamentos || [];
  return h('div', {},
    h('section', { class: 'cartao' }, titulo('calendario', 'Atualizações que foram para o jogo'),
      lancs.filter(l => ['PUBLICADA', 'BLOQUEADA'].includes(l.status) || l.revertidoEm).length
        ? h('ul', { class: 'lista-limpa' }, lancs.map(l => h('li', {}, `${l.id} ${l.versao || ''} `, seloStatus(l.status), l.publicadoEm ? ` publicada em ${dataBR(l.publicadoEm)}` : '', l.revertidoEm ? ` · desfeita em ${dataBR(l.revertidoEm)}` : '')))
        : h('p', { class: 'vazio' }, 'Nenhuma atualização publicada por aqui ainda.')),
    h('section', { class: 'cartao' }, titulo('documento', 'Registro de tudo o que foi decidido'),
      h('p', { class: 'sinc' }, 'Cada decisão fica gravada com quem fez e quando.'),
      eventos.length ? tabela(['Quando', 'O que', 'Onde', 'Quem', 'Resultado', 'Comentário'], eventos.map(e => [
        dataBR(e.em), e.acao, `${e.alvo?.tipo} ${e.alvo?.id}${e.alvo?.versao != null ? ` v${e.alvo.versao}` : ''}`,
        `${e.por?.nome} (${e.por?.papel})`, e.resultado?.para ? `${rotuloStatus(e.resultado.de)} → ${rotuloStatus(e.resultado.para)}` : '—', e.comentario || '—']))
        : h('p', { class: 'vazio' }, 'Nenhuma decisão registrada ainda.')));
}

// ------------------------------------------------------------------ 9. configurações
function config() {
  const c = estado.dados.config || {};
  const pausa = h('input', { type: 'checkbox', checked: !!c.lancamentosPausados, id: 'cfg-pausa' });
  const hora = h('input', { type: 'time', value: c.horarioPublicacao || '', id: 'cfg-hora' });
  const salvar = h('button', { class: 'btn primario', onclick: () => gravar('/api/config', { lancamentosPausados: pausa.checked, horarioPublicacao: hora.value || null }, [salvar], 'Configurações salvas.') }, 'Salvar');
  return h('div', {},
    blocoChave(),
    celular(true),
    h('section', { class: 'cartao' }, titulo('ajustes', 'Publicações'),
      h('label', { for: 'cfg-pausa', class: 'opcao' }, pausa, 'Pausar todas as publicações'),
      h('p', { class: 'sinc' }, 'Com isto marcado, nada vai para o jogo, mesmo o que já foi autorizado.'),
      h('label', { for: 'cfg-hora' }, 'Horário de publicação aos sábados (Brasília)'), hora,
      h('div', { class: 'acoes' }, salvar)),
    h('section', { class: 'cartao' }, titulo('calendario', 'Como é a semana'),
      h('p', { class: 'sinc' }, 'O que acontece em cada dia (horário de Brasília).'),
      tabela(['Dia', 'O que acontece', 'Quem faz'], (c.cronograma || []).map(x => [x.dia, x.atividade, x.automatico]))),
    h('section', { class: 'cartao' }, titulo('robo', 'As automações estão funcionando?'), h('p', { class: 'sinc' }, estado.dados['saude-agendamentos']?.observacao || ''), listaSaude()),
    h('section', { class: 'cartao' }, titulo('pessoa', 'Seu acesso'),
      h('p', {}, `Você entrou como ${estado.usuario.nome} (${estado.usuario.id}). O token fica só neste aparelho.`),
      h('p', { class: 'sinc' }, 'Para trocar o token (por exemplo, quando ele vencer), toque em Sair e entre de novo.')),
    h('section', { class: 'cartao' }, titulo('documento', 'Custos e limites'),
      h('dl', { class: 'campos' }, Object.entries(c.custos || {}).map(([k, v]) => [h('dt', {}, k), h('dd', {}, typeof v === 'boolean' ? (v ? 'Sim' : 'Não') : v)]))));
}

function blocoChave() {
  if (estado.chave) {
    return h('section', { class: 'cartao' }, titulo('chave', 'Chave de autorização'),
      h('p', { class: 'ok-linha' }, icone('check'), `Este aparelho pode autorizar publicações (chave criada em ${dataBR(estado.chave.criadaEm)}).`),
      h('p', { class: 'sinc' }, 'A chave não pode ser copiada. Se você trocar de celular ou limpar os dados do navegador, crie outra no aparelho novo.'));
  }
  const b = h('button', { class: 'btn primario', onclick: async () => {
    b.disabled = true; b.textContent = 'Criando…';
    try {
      estado.chave = await criarChaveDoAparelho(estado.repo);
      estado.cliente = criarApi({ store: estado.repo, usuario: { id: estado.usuario.id, nome: estado.usuario.nome }, assinar: await assinadorDoAparelho() });
      avisar('Chave criada. Este aparelho já pode autorizar publicações.');
      render();
    } catch (e) { avisar(`Não criada: ${e.message}`, true); b.disabled = false; b.textContent = 'Criar chave neste aparelho'; }
  } }, 'Criar chave neste aparelho');
  return h('section', { class: 'cartao destaque' }, titulo('chave', 'Falta criar a chave de autorização'),
    h('p', {}, 'Sem ela, este aparelho não consegue autorizar publicações. A chave fica presa neste aparelho: ninguém consegue copiá-la, nem a automação.'),
    h('div', { class: 'acoes' }, b));
}

// ------------------------------------------------------------------ abas simplificadas
function segmentos(chave, opcoes) {
  const atual = estado.sub[chave] || opcoes[0][0];
  return [atual, h('div', { class: 'segmentos', role: 'tablist' }, opcoes.map(([id, nome]) =>
    h('button', { role: 'tab', 'aria-selected': atual === id ? 'true' : 'false', onclick: () => { estado.sub[chave] = id; render(); } }, nome)))];
}

function inicio() {
  const d = estado.dados;
  const ind = d.metricas?.periodos?.at(-1)?.indicadores || {};
  const meta = d.metricas?.meta?.impressoes7dias;
  const pend = (d.propostas?.propostas || []).filter(p => p.status === 'AGUARDANDO APROVAÇÃO');
  const finais = (d.lancamentos?.lancamentos || []).filter(l => l.status === 'AGUARDANDO AUTORIZAÇÃO FINAL');
  const lanc = (d.lancamentos?.lancamentos || []).at(-1);
  // Tarefas de configuração que dependem do dono (não mexe em dados; só conta).
  const minhas = (d.tarefas?.tarefas || []).filter(t => /propriet/i.test(t.responsavelNome || '') && t.status !== 'CONCLUÍDA');
  const avisos = [];
  if (!estado.chave) avisos.push('Este aparelho ainda não tem a chave de autorização (Ajustes).');
  if (!d.meta?.coletaAutomaticaAtiva) avisos.push('A leitura automática dos números do Roblox ainda não está ligada.');
  if (!d.discord?.acesso) avisos.push('Ainda sem acesso ao Discord.');
  if (d.config?.lancamentosPausados) avisos.push('Publicações pausadas (Ajustes).');
  const falhas = Object.entries(d['saude-agendamentos']?.tarefas || {}).filter(([, t]) => t.status === 'falhou');
  falhas.forEach(([n]) => avisos.push(`Uma automação falhou: ${n}`));
  const total = finais.length + pend.length;
  const pedido = (texto, detalhe, aba, destaque = false) => h('li', {},
    h('button', { class: `pedido${destaque ? ' urgente' : ''}`, onclick: () => irPara(aba) },
      h('span', { class: 'pedido-texto' }, h('strong', {}, texto), detalhe ? h('span', { class: 'sinc' }, detalhe) : null),
      h('span', { class: 'seta' }, icone('seta'))));
  const ind2 = v => (v != null ? `${String(v).replace('.', ',')} min` : '—');
  const porMil = ind.qptr != null ? Math.round(ind.qptr * 1000) : null;

  return h('div', {},
    h('section', { class: 'cartao destaque' },
      titulo('pessoa', 'O que precisa de você'),
      total || minhas.length
        ? h('ul', { class: 'lista-pedidos' },
          finais.map(l => pedido(`Autorizar a publicação ${l.id}`, 'Ela só vai para o jogo se você autorizar.', 'decisoes', true)),
          pend.map(p => pedido(p.titulo, `${p.id} · aprovar, pedir mudança, adiar ou rejeitar`, 'decisoes')),
          minhas.length ? pedido(`${minhas.length} ${minhas.length === 1 ? 'tarefa de preparação' : 'tarefas de preparação'} com você`, 'Coisas que só você consegue fazer.', 'tarefas') : null)
        : h('p', { class: 'ok-linha' }, icone('check'), 'Nada esperando você agora.')),
    h('section', { class: 'cartao' },
      titulo('grafico', 'Como o jogo foi nos últimos 7 dias'),
      alertaDesatualizado(),
      h('div', { class: 'grade grade-4' },
        kpi('Vezes que o jogo apareceu', num(ind.impressoes), 'Quantas vezes o jogo foi mostrado para alguém no Roblox (impressões).', meta ? `${pct(ind.impressoes / meta, 0)} da meta de ${num(meta)}` : '', meta ? ind.impressoes / meta : null),
        kpi('Taxa de jogadas (qPTR)', pct(ind.qptr), porMil != null ? `De cada 1.000 pessoas que viram o jogo, cerca de ${porMil} entraram.` : 'De quem viu o jogo, quantos entraram.'),
        kpi('Entradas que contaram', num(ind.jogadasQualificadas), 'Pessoas que viram o jogo e entraram para jogar (jogadas qualificadas).'),
        kpi('Tempo jogando', ind2(ind.tempoMedioSessaoMin), 'Quanto tempo cada pessoa fica no jogo, em média, por vez.'))),
    blocoExecutor(),
    h('section', { class: 'cartao' }, titulo('calendario', `Próximo sábado, ${dataBR(proximoSabado())}`),
      lanc ? h('p', {}, `Atualização ${lanc.id}: `, seloStatus(lanc.status)) : h('p', {}, 'Nada vai para o jogo: nenhuma atualização foi autorizada.')),
    celular(),
    avisos.length ? h('details', { class: 'cartao' }, h('summary', {}, `Avisos do sistema (${avisos.length})`), h('ul', { class: 'lista-avisos' }, avisos.map(a => h('li', {}, a)))) : null);
}

function blocoExecutor() {
  const ex = estado.dados.executor;
  if (!ex) return null;
  const atual = ex.trabalhoAtual;
  return h('section', { class: 'cartao' }, titulo('robo', 'O que a automação está fazendo'),
    atual ? h('p', {}, selo(atual.quem || 'Claude', 'info'), ` ${atual.propostaId} — ${atual.etapa || 'trabalhando'}`) : h('p', {}, 'Nada em andamento. Quando você aprovar uma proposta, o trabalho começa sozinho.'),
    h('p', { class: 'sinc' }, `Última vez que conferiu: ${ex.ultimaVerificacao ? dataBR(ex.ultimaVerificacao) : 'nunca'}${ex.computador ? ` · ${ex.computador}` : ''}`),
    (ex.historico || []).length ? h('details', {}, h('summary', {}, 'Últimos passos'), h('ul', { class: 'lista-limpa' }, ex.historico.slice(-8).reverse().map(x => h('li', { class: 'sinc' }, `${dataBR(x.em)} · ${x.propostaId || ''} ${x.texto}`)))) : null);
}

function decisoes() {
  const lancs = (estado.dados.lancamentos?.lancamentos || []).filter(l => l.status !== 'PUBLICADA');
  const todas = estado.dados.propostas?.propostas || [];
  const abertas = todas.filter(p => DECIDIVEIS.includes(p.status));
  const [aba, seg] = segmentos('decisoes', [['abertas', `Em aberto (${abertas.length})`], ['todas', `Todas (${todas.length})`]]);
  const lista = aba === 'abertas' ? abertas : todas;
  return h('div', {},
    h('p', { class: 'intro' }, 'Aqui você decide o que entra no jogo. São dois passos: primeiro aprovar a ideia; depois, com tudo pronto e testado, autorizar a publicação.'),
    lancs.length ? h('section', { class: 'cartao destaque' }, titulo('chave', 'Autorização final de publicação'), lancs.map(cartaoLancamento)) : null,
    seg,
    lista.length ? lista.map(cartaoProposta) : h('p', { class: 'ok-linha' }, icone('check'), 'Nenhuma proposta esperando você.'));
}

function tarefasAba() {
  const t = estado.dados.tarefas?.tarefas || [];
  if (!t.length) return h('p', { class: 'vazio' }, 'Nenhuma tarefa.');
  const comVoce = t.filter(x => /propriet/i.test(x.responsavelNome || ''));
  const outras = t.filter(x => !comVoce.includes(x));
  return h('div', {},
    comVoce.length ? [titulo('pessoa', `Com você (${comVoce.length})`, 'h2', { class: 'titulo-icone grupo' }), h('p', { class: 'sinc' }, 'Coisas que só você consegue fazer. Depois de fazer, marque o progresso.'), comVoce.map(cartaoTarefa)] : null,
    outras.length ? [titulo('robo', `Com a equipe e a automação (${outras.length})`, 'h2', { class: 'titulo-icone grupo' }), outras.map(cartaoTarefa)] : null);
}

function numeros() {
  const [aba, seg] = segmentos('numeros', [['thumbs', 'Thumbnails'], ['relatorio', 'Relatório da semana']]);
  return h('div', {}, seg, aba === 'thumbs' ? thumbnails() : relatorios());
}

function pesquisa() {
  const [aba, seg] = segmentos('pesquisa', [['tend', 'O que está em alta'], ['discord', 'Discord']]);
  const fontes = estado.dados.config?.fontesTendencias || [];
  const cartaoFontes = fontes.length ? h('details', { class: 'cartao' }, h('summary', {}, `Onde pesquisamos toda segunda (${fontes.length})`),
    h('ul', { class: 'lista-limpa' }, fontes.map(f => h('li', {}, h('strong', {}, f.nome), h('div', { class: 'sinc' }, f.oQueObservar))))) : null;
  return h('div', {}, seg, aba === 'tend'
    ? [h('p', { class: 'intro' }, 'Ideias vistas em jogos que estão crescendo no Roblox, e como poderiam servir para a Escola Brasileira.'), cartaoFontes, tendencias()]
    : discord());
}

function ajustes() {
  const [aba, seg] = segmentos('ajustes', [['config', 'Configurações'], ['historico', 'Histórico']]);
  return h('div', {}, seg, aba === 'config' ? config() : historico());
}

// ------------------------------------------------------------------ celular: atalho + notificações
let pedidoInstalacao = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); pedidoInstalacao = e; if (estado.dados) render(); });
window.addEventListener('appinstalled', () => { pedidoInstalacao = null; avisar('Atalho adicionado à tela de início.'); });
const instalado = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const ehIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

function chaveParaBytes(b64) {
  const p = '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

async function inscricaoAtual() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

async function ativarNotificacoes(btn) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    avisar(ehIOS() ? 'No iPhone: primeiro adicione o atalho à tela de início e abra por ele.' : 'Este navegador não aceita notificações.', true);
    return;
  }
  btn.disabled = true;
  try {
    if (await Notification.requestPermission() !== 'granted') throw new Error('Permissão negada. Libere nas configurações do navegador.');
    const publica = await chavePublicaVapid(estado.repo);
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(publica) });
    await api('/api/push/inscrever', { method: 'POST', body: JSON.stringify({ inscricao: sub.toJSON() }) });
    estado.pushAtivo = true;
    avisar('Notificações ativadas neste aparelho.');
    render();
  } catch (e) {
    avisar(`Não ativado: ${e.message}`, true);
    btn.disabled = false;
  }
}

async function desativarNotificacoes(btn) {
  btn.disabled = true;
  try {
    const sub = await inscricaoAtual();
    if (sub) { await api('/api/push/cancelar', { method: 'POST', body: JSON.stringify({ endpoint: sub.endpoint }) }); await sub.unsubscribe(); }
    estado.pushAtivo = false;
    avisar('Notificações desativadas neste aparelho.');
    render();
  } catch (e) { avisar(e.message, true); btn.disabled = false; }
}

function celular(sempre = false) {
  if (estado.pushAtivo === undefined) {
    estado.pushAtivo = null;
    inscricaoAtual().then(s => { estado.pushAtivo = !!s; render(); }).catch(() => { estado.pushAtivo = false; });
  }
  const pronto = instalado() && estado.pushAtivo;
  if (pronto && !sempre) return null;
  const blocos = [];
  if (!instalado()) {
    if (pedidoInstalacao) {
      const b = h('button', { class: 'btn primario', onclick: async () => { pedidoInstalacao.prompt(); await pedidoInstalacao.userChoice.catch(() => {}); pedidoInstalacao = null; render(); } }, 'Adicionar à tela de início');
      blocos.push(b);
    } else if (ehIOS()) {
      blocos.push(h('p', {}, 'No iPhone/iPad (Safari): toque em ', h('strong', {}, 'Compartilhar'), ' → ', h('strong', {}, 'Adicionar à Tela de Início'), '. Depois abra pelo ícone para ativar as notificações.'));
    } else {
      blocos.push(h('p', {}, 'No Android (Chrome): menu de três pontinhos → ', h('strong', {}, 'Adicionar à tela inicial'), ' (ou "Instalar app").'));
    }
  } else {
    blocos.push(h('p', { class: 'ok-linha' }, icone('check'), 'Atalho na tela de início instalado.'));
  }
  if (estado.pushAtivo) {
    const teste = h('button', { class: 'btn', onclick: async () => {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification('Games Up', { body: 'Assim chegam os avisos da automação.', icon: 'icones/icone-192.png', lang: 'pt-BR' });
    } }, 'Ver exemplo');
    const off = h('button', { class: 'btn', onclick: () => desativarNotificacoes(off) }, 'Desativar');
    blocos.push(h('p', { class: 'ok-linha' }, icone('check'), 'Notificações ligadas neste aparelho.'), h('div', { class: 'acoes' }, teste, off));
  } else if (estado.pushAtivo === false) {
    const b = h('button', { class: 'btn primario', onclick: () => ativarNotificacoes(b) }, 'Ativar notificações');
    blocos.push(h('p', { class: 'sinc' }, 'Você recebe um aviso quando: chega proposta nova, tem atualização pronta para autorizar, sai o relatório da semana ou algo falha.'), h('div', { class: 'acoes' }, b));
  }
  return h('section', { class: 'cartao' }, titulo('celular', 'Usar no celular'), blocos);
}

// Não abre dentro de outro site (moldura): evita cliques enganados nos botões de aprovação.
if (window.top !== window.self) {
  document.getElementById('raiz').replaceChildren(h('p', { class: 'carregando' }, 'Abra o Games Up direto no navegador.'));
} else {
  iniciar();
}
