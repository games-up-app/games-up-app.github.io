// Games Up — Central da Escola Brasileira (casca do app).
// Site estático (GitHub Pages). Os dados ficam no repositório PRIVADO e são lidos/gravados
// direto pelo navegador com o token do GitHub do proprietário, guardado só neste aparelho.
// A publicação no jogo exige a assinatura feita pela chave deste aparelho (ver nucleo/).
// Este arquivo cuida de: entrar, carregar os dados, barra de abas, notificações e o objeto ctx.
// Cada tela fica em painel/telas/*.js e só usa o ctx.
import { CONFIG } from './config.js';
import { RepoGitHub } from './nucleo/github.js';
import { criarApi } from './nucleo/api.js';
import { lerToken, gravarToken, esquecerToken, atualizarCadastroDoAparelho, criarChaveDoAparelho, assinadorDoAparelho } from './nucleo/aparelho.js';
import { chavePublicaVapid } from './nucleo/vapid.js';
import { ativarNoAparelho, notificacoesAtivas } from './nucleo/notificacoes.js';
import { h, icone, abrirFolha, fecharTudo } from './ui/componentes.js';
import { ctx } from './ui/contexto.js';
import { telaInicio } from './telas/inicio.js';
import { telaDecisoes } from './telas/decisoes.js';
import { telaNumeros } from './telas/numeros.js';
import { telaPesquisa } from './telas/pesquisa.js';
import { telaAjustes } from './telas/ajustes.js';
import { telaTarefas } from './telas/tarefas.js';

const estado = { usuario: null, dados: null, aba: 'inicio', sub: {}, filtros: {}, repo: null, cliente: null, chave: null, pushAtivo: null };
// Os dados ficam na organização games-up-app: o token precisa ter ela como "Resource owner".
const LINK_TOKEN = 'https://github.com/settings/personal-access-tokens/new?name=Games%20Up&description=Painel%20da%20Escola%20Brasileira&target_name=games-up-app&expires_in=366&contents=write&issues=write';
// Equipe: só lê os dados e comenta (os comentários vão para um tópico de Issues).
const LINK_TOKEN_EQUIPE = 'https://github.com/settings/personal-access-tokens/new?name=Games%20Up%20Equipe&description=Games%20Up%20-%20equipe%20(ver%20e%20comentar)&target_name=games-up-app&expires_in=366&contents=read&issues=write';

// Abas da barra (embaixo no celular, na lateral no computador).
const ABAS = [
  { id: 'inicio', nome: 'Início', icone: 'inicio', tela: telaInicio },
  { id: 'decisoes', nome: 'Decisões', icone: 'decisoes', tela: telaDecisoes },
  { id: 'numeros', nome: 'Números', icone: 'numeros', tela: telaNumeros },
  { id: 'pesquisa', nome: 'Pesquisa', icone: 'pesquisa', tela: telaPesquisa },
  { id: 'ajustes', nome: 'Ajustes', icone: 'ajustes', tela: telaAjustes },
];
// Páginas que não estão na barra: abrem por atalhos e mostram "voltar".
const PAGINAS = [
  { id: 'tarefas', nome: 'Tarefas', icone: 'tarefas', tela: telaTarefas, pai: 'inicio' },
];
const TODAS = [...ABAS, ...PAGINAS];

// ------------------------------------------------------------------ utilidades da casca
function avisar(msg, erro = false) {
  const a = document.getElementById('aviso');
  a.replaceChildren(h('div', { class: `toast${erro ? ' erro' : ''}` }, icone(erro ? 'alerta' : 'ok', { tamanho: 18 }), h('span', {}, msg)));
  clearTimeout(avisar.t);
  avisar.t = setTimeout(() => a.replaceChildren(), erro ? 7000 : 4000);
}

/** Chama a "API" local (roda no navegador e grava no repositório privado). */
async function api(caminho, opcoes = {}) {
  const u = new URL(caminho, 'https://x.invalid');
  const metodo = opcoes.method || 'GET';
  const corpo = opcoes.body ? JSON.parse(opcoes.body) : Object.fromEntries(u.searchParams);
  try {
    return await estado.cliente.chamar(metodo, u.pathname, corpo);
  } catch (e) {
    if (e.status === 401) { await esquecerToken(); estado.usuario = null; fecharTudo(); telaLogin(e.message); }
    throw e;
  }
}

/** Envia uma gravação e só mostra sucesso depois que o servidor confirmar. */
async function gravar(caminho, corpo, botoes = [], mensagemOk = 'Gravado.') {
  botoes.forEach(b => (b.disabled = true));
  const original = botoes[0] ? [...botoes[0].childNodes] : null;
  if (botoes[0]) botoes[0].replaceChildren(icone('relogio', { tamanho: 18 }), 'Gravando…');
  try {
    await api(caminho, { method: 'POST', body: JSON.stringify(corpo) });
    avisar(mensagemOk);
    fecharTudo();
    await carregar();
    return true;
  } catch (e) {
    avisar(`Não gravado: ${e.message}`, true);
    botoes.forEach(b => (b.disabled = false));
    if (botoes[0] && original) botoes[0].replaceChildren(...original);
    return false;
  }
}

// Imagens do repositório privado: baixadas UMA vez por sessão e reaproveitadas (sem baixar de novo a cada tela).
const cacheImagens = new Map();
function carregarUmaVez(chave, baixar) {
  if (!cacheImagens.has(chave)) {
    cacheImagens.set(chave, baixar().then(b => (b ? URL.createObjectURL(b) : null)).catch(e => { cacheImagens.delete(chave); throw e; }));
  }
  return cacheImagens.get(chave);
}
function imgCarregada(promessa, { alt = '', classe = '' } = {}) {
  const img = h('img', { alt, class: `img-privada ${classe}`.trim(), decoding: 'async' });
  const lugar = h('div', { class: `img-carregando ${classe}`.trim(), 'aria-hidden': 'true' }, icone('imagem', { tamanho: 24 }));
  promessa.then(url => {
    if (!url) { lugar.replaceChildren(icone('imagem', { tamanho: 24 }), h('span', {}, 'Imagem não encontrada')); return; }
    img.src = url; lugar.replaceWith(img);
  }).catch(() => lugar.replaceChildren(icone('alerta', { tamanho: 24 }), h('span', {}, 'Não foi possível carregar')));
  // Devolve o espaço reservado; ele vira a imagem quando terminar.
  return lugar;
}
function imagemPrivada(caminhoEmDados, opcoes = {}) {
  const rel = String(caminhoEmDados || '').replace(/^dados\//, '');
  if (!/^previas\/[a-z0-9][a-z0-9\-_/]*\.(png|jpg|jpeg|webp)$/.test(rel)) return h('div', { class: `img-carregando ${opcoes.classe || ''}`.trim() }, icone('imagem', { tamanho: 24 }));
  return imgCarregada(carregarUmaVez(`d:${rel}`, () => estado.repo.lerImagem(rel)), opcoes);
}
/** Imagem exata de um pacote (builds/*.png), também baixada uma vez só. */
function imagemDoPacote(caminho, opcoes = {}) {
  return imgCarregada(carregarUmaVez(`p:${caminho}`, () => estado.repo.lerImagemDoPacote(caminho)), opcoes);
}

// ------------------------------------------------------------------ inicialização
async function iniciar() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  const busca = new URLSearchParams(location.search);
  const pedida = busca.get('aba');
  const noticias = busca.get('noticias') === '1';
  if (pedida || noticias) history.replaceState(null, '', location.pathname);
  let token = null;
  try { token = await lerToken(); } catch {}
  if (!token) return telaLogin();
  try {
    await entrar(token);
    try { estado.aba = pedida || sessionStorage.getItem('eb-aba') || 'inicio'; } catch {}
    if (!TODAS.some(a => a.id === estado.aba)) estado.aba = 'inicio';
    if (noticias) { estado.aba = 'inicio'; estado.sub.inicio = 'noticias'; }
    await carregar();
  } catch (e) {
    if (e.status === 401 || e.status === 403 || e.status === 404) { await esquecerToken().catch(() => {}); return telaLogin(e.message); }
    document.getElementById('raiz').replaceChildren(h('main', { class: 'login', id: 'conteudo' }, h('section', { class: 'login-acesso' },
      h('div', { class: 'login-icone' }, icone('alerta', { tamanho: 30 })),
      h('h1', {}, 'Não foi possível abrir'), h('p', {}, e.message),
      h('button', { class: 'btn primario grande', onclick: () => location.reload() }, icone('raio', { tamanho: 18 }), 'Tentar de novo'))));
  }
}

async function entrar(token) {
  const repo = new RepoGitHub({ token, ...CONFIG });
  const eu = await repo.usuario();
  await repo.conferirAcesso();
  estado.repo = repo;
  estado.chave = await atualizarCadastroDoAparelho().catch(() => null);
  estado.cliente = criarApi({ store: repo, usuario: { id: eu.login, nome: eu.nome }, assinar: await assinadorDoAparelho().catch(() => null) });
  estado.usuario = estado.cliente.usuario;
}

async function carregar() {
  const p = await api('/api/painel');
  estado.usuario = p.usuario; estado.dados = p.dados;
  estado.pushAtivo = null;
  render();
  await conferirNotificacoes();
  render();
}

function telaLogin(msg) {
  const campo = h('input', { type: 'password', id: 'token', autocomplete: 'off', spellcheck: 'false', placeholder: 'github_pat_…', 'aria-label': 'Token do GitHub' });
  const botao = h('button', { class: 'btn primario grande', type: 'submit' }, icone('cadeado', { tamanho: 18 }), 'Entrar');
  const erro = h('p', { class: 'login-erro', role: 'alert', hidden: !msg }, msg || '');
  const enviar = async ev => {
    ev.preventDefault();
    const t = campo.value.trim();
    if (!/^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$/.test(t)) { erro.textContent = 'Isso não parece um token do GitHub. Ele começa com github_pat_.'; erro.hidden = false; return; }
    botao.disabled = true; botao.replaceChildren(icone('relogio', { tamanho: 18 }), 'Conferindo…');
    try {
      await entrar(t);
      await gravarToken(t);
      estado.aba = 'inicio';
      await carregar();
    } catch (e) {
      erro.textContent = e.message; erro.hidden = false;
      botao.disabled = false; botao.replaceChildren(icone('cadeado', { tamanho: 18 }), 'Entrar');
    }
  };
  const passo = (n, ...conteudo) => h('li', { class: 'passo' }, h('span', { class: 'passo-num' }, String(n)), h('div', {}, ...conteudo));
  const comoCriar = () => abrirFolha({ titulo: 'Criar o token', conteudo: h('ol', { class: 'passos-lista' },
    passo(1, 'Toque no link certo: ', h('a', { href: LINK_TOKEN, target: '_blank', rel: 'noopener noreferrer' }, 'sou o dono'), ' ou ', h('a', { href: LINK_TOKEN_EQUIPE, target: '_blank', rel: 'noopener noreferrer' }, 'sou da equipe'), '. O nome e as permissões já vêm preenchidos.'),
    passo(2, 'Em ', h('strong', {}, 'Resource owner'), ', confira se está ', h('strong', {}, 'games-up-app'), '. Em ', h('strong', {}, 'Repository access'), ', escolha ', h('strong', {}, 'Only select repositories'), ' e marque ', h('strong', {}, 'Automatizar-Escola-Brasileira'), '.'),
    passo(3, 'Toque em ', h('strong', {}, 'Generate token'), ', copie e cole no campo da tela de entrada. Se aparecer "pendente de aprovação", o dono aprova em games-up-app → Settings → Personal access tokens.')) });
  document.getElementById('raiz').replaceChildren(
    h('main', { class: 'login', id: 'conteudo' },
      h('section', { class: 'login-marca' },
        h('img', { class: 'login-logo', src: 'marca/logo-escuro.png', alt: 'Level Up', width: 320, height: 90 }),
        h('p', {}, 'Games Up · Central da Escola Brasileira')),
      h('section', { class: 'login-acesso' },
        h('div', { class: 'login-icone' }, icone('cadeado', { tamanho: 30 })),
        h('h1', {}, 'Entrar'),
        h('p', { class: 'login-texto' }, 'Cole seu token do GitHub para abrir o painel.'),
        h('form', { onsubmit: enviar }, h('label', { for: 'token' }, 'Token'), campo, erro, botao),
        h('button', { class: 'btn discreto', type: 'button', onclick: comoCriar }, icone('lampada', { tamanho: 18 }), 'Primeiro acesso? Criar um token'),
        h('p', { class: 'login-nota' }, icone('escudo', { tamanho: 16 }), 'Seu acesso fica guardado só neste aparelho.'))));
}

function alternarTema() {
  const atual = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const novo = atual === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = novo;
  try { localStorage.setItem('eb-tema', novo); } catch {}
  return novo;
}
const temaAtual = () => document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

async function sair() {
  if (!confirm('Sair deste aparelho? Você vai precisar colar o token de novo.')) return;
  await esquecerToken().catch(() => {});
  estado.usuario = null; estado.repo = null; estado.cliente = null;
  fecharTudo();
  telaLogin('Você saiu.');
}

// ------------------------------------------------------------------ chave do aparelho
async function conferirCadastro() {
  estado.chave = await atualizarCadastroDoAparelho();
  estado.cliente = criarApi({ store: estado.repo, usuario: { id: estado.usuario.id, nome: estado.usuario.nome }, assinar: await assinadorDoAparelho() });
  return estado.chave?.estado === 'registrada';
}
async function criarChave() {
  estado.chave = await criarChaveDoAparelho(estado.repo, { usuarioId: estado.usuario.id });
  estado.cliente = criarApi({ store: estado.repo, usuario: { id: estado.usuario.id, nome: estado.usuario.nome }, assinar: await assinadorDoAparelho() });
  return estado.chave;
}

// ------------------------------------------------------------------ casca
function contagemDecisoes() {
  const d = estado.dados || {};
  const pend = (d.propostas?.propostas || []).filter(p => p.status === 'AGUARDANDO APROVAÇÃO').length;
  const fin = (d.lancamentos?.lancamentos || []).filter(l => l.status === 'AGUARDANDO AUTORIZAÇÃO FINAL').length;
  return pend + fin;
}

function render() {
  if (!estado.dados) return;
  const pagina = TODAS.find(a => a.id === estado.aba) || ABAS[0];
  const abaAtiva = pagina.pai || pagina.id;
  const n = contagemDecisoes();
  const botaoAba = a => h('button', { type: 'button', class: 'aba', 'aria-current': abaAtiva === a.id ? 'page' : null, onclick: () => irPara(a.id) },
    h('span', { class: 'aba-icone' }, icone(a.icone, { tamanho: 24 }),
      a.id === 'decisoes' && n ? h('span', { class: 'contador', 'aria-label': `${n} esperando sua decisão` }, n > 9 ? '9+' : String(n)) : null),
    h('span', { class: 'aba-nome' }, a.nome));

  let conteudo;
  try { conteudo = pagina.tela(); } catch (e) {
    console.error(e);
    conteudo = h('div', { class: 'card erro-tela' }, icone('alerta', { tamanho: 28 }), h('p', {}, 'Esta tela não abriu. Toque em outra aba e volte.'), h('p', { class: 'sinc' }, e.message));
  }
  // Início e subpáginas desenham o próprio topo; as demais ganham um título grande com ícone.
  const temTopoProprio = pagina.id === 'inicio';
  const topo = temTopoProprio ? null : pagina.pai
    ? h('div', { class: 'topo-sub' },
      h('button', { class: 'voltar', type: 'button', 'aria-label': 'Voltar', onclick: () => irPara(pagina.pai) }, icone('esquerda', { tamanho: 22 })),
      h('div', {}, h('h1', { tabindex: '-1' }, pagina.nome)))
    : h('header', { class: 'pagina-topo' },
      h('span', { class: 'pagina-topo-icone' }, icone(pagina.icone, { tamanho: 24 })),
      h('h1', { tabindex: '-1' }, pagina.nome));

  const rolagem = window.scrollY;
  document.getElementById('raiz').replaceChildren(
    h('div', { class: 'app' },
      h('aside', { class: 'lateral' },
        h('div', { class: 'marca' },
          h('img', { class: 'logo logo-claro', src: 'marca/logo-claro.png', alt: 'Level Up', width: 150, height: 42 }),
          h('img', { class: 'logo logo-escuro', src: 'marca/logo-escuro.png', alt: 'Level Up', width: 150, height: 42 }),
          h('small', {}, 'Games Up')),
        h('nav', { class: 'nav-lateral', 'aria-label': 'Menu principal' }, ABAS.map(botaoAba)),
        h('div', { class: 'lateral-rodape' },
          h('img', { class: 'lateral-jogo', src: 'marca/jogo.png', alt: '', width: 36, height: 36, onerror: e => e.target.remove() }),
          h('div', {}, h('strong', {}, 'Escola Brasileira'), h('small', {}, estado.usuario?.nome || '')))),
      h('main', { class: 'principal', id: 'conteudo' }, topo, conteudo),
      h('nav', { class: 'barra-abas', 'aria-label': 'Menu principal' }, ABAS.map(botaoAba))));
  if (render.mesmaTela) window.scrollTo(0, rolagem);
  render.mesmaTela = true;
}

function irPara(aba, sub) {
  estado.aba = TODAS.some(a => a.id === aba) ? aba : 'inicio';
  if (sub !== undefined) estado.sub[estado.aba] = sub;
  try { sessionStorage.setItem('eb-aba', estado.aba); } catch {}
  fecharTudo();
  render.mesmaTela = false;
  render();
  window.scrollTo(0, 0);
  document.querySelector('.principal h1')?.focus({ preventScroll: true });
}

// ------------------------------------------------------------------ celular: atalho + notificações
let pedidoInstalacao = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); pedidoInstalacao = e; if (estado.dados) render(); });
window.addEventListener('appinstalled', () => { pedidoInstalacao = null; avisar('Atalho adicionado à tela de início.'); });
const instalado = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const ehIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

async function inscricaoAtual() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

async function conferirNotificacoes() {
  estado.pushAtivo = false;
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
  try {
    const publica = await chavePublicaVapid();
    estado.pushAtivo = await notificacoesAtivas({
      registration: navigator.serviceWorker.getRegistration(), permission: Notification.permission,
      publicKey: publica, inscricoes: estado.dados?.push_inscricoes, usuarioId: estado.usuario?.id,
    });
  } catch { estado.pushAtivo = false; }
}

async function ativarNotificacoes(btn) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    avisar(ehIOS() ? 'No iPhone: primeiro adicione o atalho à tela de início e abra por ele.' : 'Este navegador não aceita notificações.', true);
    return;
  }
  btn.disabled = true;
  try {
    await ativarNoAparelho({
      registration: navigator.serviceWorker.ready, notification: Notification, carregarChave: chavePublicaVapid,
      cadastrar: inscricao => api('/api/push/inscrever', { method: 'POST', body: JSON.stringify({ inscricao }) }),
    });
    await carregar();
    avisar('Aparelho cadastrado para receber notificações.');
  } catch (e) {
    estado.pushAtivo = false;
    avisar(`Não ativado: ${e.message}`, true);
    btn.disabled = false;
  }
}

async function desativarNotificacoes(btn) {
  btn.disabled = true;
  try {
    const sub = await inscricaoAtual();
    if (sub) { await api('/api/push/cancelar', { method: 'POST', body: JSON.stringify({ endpoint: sub.endpoint }) }); await sub.unsubscribe(); }
    await carregar();
    estado.pushAtivo = false;
    avisar('Notificações desativadas neste aparelho.');
    render();
  } catch (e) { avisar(e.message, true); btn.disabled = false; }
}

async function exemploNotificacao() {
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification('Games Up', { body: 'Exemplo local deste aparelho. Não testa o envio da automação.', icon: 'icones/icone-192.png', lang: 'pt-BR' });
}
async function instalarAtalho() {
  if (!pedidoInstalacao) return;
  pedidoInstalacao.prompt();
  await pedidoInstalacao.userChoice.catch(() => {});
  pedidoInstalacao = null; render();
}

// ------------------------------------------------------------------ ctx: ponte com as telas
Object.assign(ctx, {
  estado, api, gravar, avisar, irPara, imagemPrivada,
  recarregar: carregar,
  render: () => { render.mesmaTela = true; render(); },
  // Extras usados por Ajustes/Início (não fazem parte do contrato mínimo, mas ficam disponíveis).
  imagemDoPacote, sair, alternarTema, temaAtual, conferirCadastro, criarChave, contagemDecisoes,
  celular: {
    instalado, ehIOS, podeInstalar: () => !!pedidoInstalacao, instalar: instalarAtalho,
    ativar: ativarNotificacoes, desativar: desativarNotificacoes, exemplo: exemploNotificacao,
  },
});

// Não abre dentro de outro site (moldura): evita cliques enganados nos botões de aprovação.
if (window.top !== window.self) {
  document.getElementById('raiz').replaceChildren(h('p', { class: 'carregando' }, 'Abra o Games Up direto no navegador.'));
} else {
  iniciar();
}
