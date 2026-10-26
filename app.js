// Games Up — Central da Escola Brasileira (casca do app).
// Site estático (GitHub Pages). Os dados ficam no repositório PRIVADO e são lidos/gravados
// direto pelo navegador com o token do GitHub do proprietário, guardado só neste aparelho.
// A publicação no jogo exige a assinatura feita pela chave deste aparelho (ver nucleo/).
// Este arquivo cuida de: entrar, carregar os dados, barra de abas, notificações e o objeto ctx.
// Cada tela fica em painel/telas/*.js e só usa o ctx.
import { CONFIG } from './config.js?v=20261025-comunicacao3';
import { RepoGitHub } from './nucleo/github.js?v=20261025-comunicacao3';
import { criarApi } from './nucleo/api.js?v=20261025-comunicacao3';
import { lerToken, gravarToken, esquecerToken, atualizarCadastroDoAparelho, criarChaveDoAparelho, assinadorDoAparelho } from './nucleo/aparelho.js?v=20261025-comunicacao3';
import { chavePublicaVapid } from './nucleo/vapid.js?v=20261025-comunicacao3';
import { ativarNoAparelho, diagnosticarNotificacoes } from './nucleo/notificacoes.js?v=20261025-comunicacao3';
import { criarSincronizacao } from './nucleo/sincronizacao.js?v=20261025-comunicacao3';
import { h, icone, abrirFolha, fecharTudo, temCamadaAberta } from './ui/componentes.js?v=20261025-comunicacao3';
import { ctx } from './ui/contexto.js?v=20261025-comunicacao3';
import { telaInicio } from './telas/inicio.js?v=20261025-comunicacao3';
import { telaDecisoes } from './telas/decisoes.js?v=20261025-comunicacao3';
import { telaNumeros } from './telas/numeros.js?v=20261025-comunicacao3';
import { telaPesquisa } from './telas/pesquisa.js?v=20261025-comunicacao3';
import { telaAjustes } from './telas/ajustes.js?v=20261025-comunicacao3';
import { telaTarefas } from './telas/tarefas.js?v=20261025-comunicacao3';
import { telaAndamento } from './telas/andamento.js?v=20261025-comunicacao3';
import { telaIdeias } from './telas/ideias.js?v=20261025-comunicacao3';
import { telaAvisos } from './telas/avisos.js?v=20261025-comunicacao3';
import { listarAvisos, novosAvisos, lerAvisosLidos } from './nucleo/central-avisos.js?v=20261025-comunicacao3';

const estado = { usuario: null, dados: null, aba: 'inicio', sub: {}, filtros: {}, repo: null, cliente: null, chave: null, pushAtivo: null };
// Os dados ficam na organização games-up-app: o token precisa ter ela como "Resource owner".
const LINK_TOKEN = 'https://github.com/settings/personal-access-tokens/new?name=Games%20Up&description=Painel%20da%20Escola%20Brasileira&target_name=games-up-app&expires_in=366&contents=write&issues=write';
// Equipe: só lê os dados e comenta (os comentários vão para um tópico de Issues).
const LINK_TOKEN_EQUIPE = 'https://github.com/settings/personal-access-tokens/new?name=Games%20Up%20Equipe&description=Games%20Up%20-%20equipe%20(ver%20e%20comentar)&target_name=games-up-app&expires_in=366&contents=read&issues=write';

// Abas da barra (embaixo no celular, na lateral no computador).
const ABAS = [
  { id: 'inicio', nome: 'Início', icone: 'inicio', tela: telaInicio },
  { id: 'decisoes', nome: 'Decisões', icone: 'decisoes', tela: telaDecisoes },
  { id: 'andamento', nome: 'Andamento', icone: 'martelo', tela: telaAndamento },
  { id: 'ideias', nome: 'Ideias', icone: 'lampada', tela: telaIdeias },
  { id: 'numeros', nome: 'Números', icone: 'numeros', tela: telaNumeros },
  { id: 'pesquisa', nome: 'Pesquisa', icone: 'pesquisa', tela: telaPesquisa },
  { id: 'ajustes', nome: 'Ajustes', icone: 'ajustes', tela: telaAjustes },
];
// Páginas que não estão na barra: abrem por atalhos e mostram "voltar".
const PAGINAS = [
  { id: 'tarefas', nome: 'Tarefas', icone: 'tarefas', tela: telaTarefas, pai: 'inicio' },
  { id: 'avisos', nome: 'Avisos', icone: 'sino', tela: telaAvisos, pai: 'inicio' },
];
const TODAS = [...ABAS, ...PAGINAS];
const PRINCIPAIS_CELULAR = ['inicio', 'decisoes', 'andamento', 'ideias'];

function abrirMais() {
  const atalhos = [...ABAS.filter(a => !PRINCIPAIS_CELULAR.includes(a.id)), ...PAGINAS];
  abrirFolha({ titulo: 'Mais', classe: 'folha-mais', conteudo: h('div', { class: 'menu-mais' },
    h('button', { type: 'button', class: 'mais-perfil', onclick: () => irPara('ajustes') },
      h('span', { class: 'mais-avatar', 'aria-hidden': 'true' }, String(estado.usuario?.nome || 'T').slice(0, 1).toUpperCase()),
      h('span', {}, h('strong', {}, estado.usuario?.nome || 'Tallyson'), h('small', {}, estado.usuario?.papel === 'proprietario' ? 'Proprietário · ver ajustes' : 'Equipe · ver ajustes')), icone('direita')),
    h('div', { class: 'mais-grade' }, atalhos.map(a => h('button', { type: 'button', class: 'mais-atalho', onclick: () => irPara(a.id) }, icone(a.icone, { tamanho: 26 }), h('strong', {}, a.nome)))),
    h('button', { type: 'button', class: 'mais-linha', onclick: () => { alternarTema(); fecharTudo(); abrirMais(); } }, icone('sol'), temaAtual() === 'dark' ? 'Usar modo claro' : 'Usar modo escuro'),
    h('button', { type: 'button', class: 'mais-linha mais-sair', onclick: sair }, icone('esquerda'), 'Sair do Games Up')) });
}

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
  const alvoId = /^[A-Za-z0-9_-]{1,100}$/.test(busca.get('id') || '') ? busca.get('id') : null;
  const alvoTipo = ['proposta', 'lancamento'].includes(busca.get('tipo')) ? busca.get('tipo') : null;
  if (pedida || noticias) history.replaceState(null, '', location.pathname);
  let token = null;
  try { token = await lerToken(); } catch {}
  if (!token) return telaLogin();
  try {
    await entrar(token);
    try { estado.aba = pedida || sessionStorage.getItem('eb-aba') || 'inicio'; } catch {}
    if (!TODAS.some(a => a.id === estado.aba)) estado.aba = 'inicio';
    if (noticias) { estado.aba = 'inicio'; estado.sub.inicio = 'noticias'; }
    if (alvoId && pedida === 'andamento') estado.sub.andamento = { id: alvoId };
    if (alvoId && pedida === 'decisoes' && alvoTipo) estado.sub.decisoes = { tipo: alvoTipo, id: alvoId };
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
  // Só o dono aprova e autoriza. Qualquer outra pessoa entra no modo Equipe (ver e comentar).
  const ehDonoLogin = eu.login.toLowerCase() === String(CONFIG.dono || '').toLowerCase();
  await repo.conferirAcesso({ exigirEscrita: ehDonoLogin });
  estado.repo = repo;
  estado.chave = ehDonoLogin ? await atualizarCadastroDoAparelho().catch(() => null) : null;
  estado.cliente = criarApi({
    store: repo, usuario: { id: eu.login, nome: eu.nome }, papel: ehDonoLogin ? 'proprietario' : 'equipe',
    topicoEquipe: CONFIG.topicoComentariosEquipe, dono: CONFIG.dono,
    assinar: ehDonoLogin ? await assinadorDoAparelho().catch(() => null) : null,
  });
  estado.usuario = estado.cliente.usuario;
  document.documentElement.dataset.papel = estado.usuario.papel;
}

async function carregar() {
  const ok = await sincronizacao.conferir({ forcar: true });
  if (!ok) throw new Error('Não consegui atualizar os dados. Confira a conexão e tente novamente.');
  await conferirNotificacoes();
  if (!temCamadaAberta() && !temEdicao()) render();
}

// Com o app visível, confere mudanças a cada 10 s. Os dados chegam mesmo com detalhes abertos;
// o texto digitado e a reprodução de mídia são preservados.
let telaPendente = false;
function temEdicao() {
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) ||
    [...document.querySelectorAll('textarea, input:not([type=checkbox]):not([type=radio])')].some(e => e.value !== e.defaultValue);
}
async function shaDados() {
  const r = estado.repo;
  if (!r?.req) return null;
  return (await r.req('GET', `/repos/${r.repo}/git/ref/heads/${encodeURIComponent(r.branch)}`))?.object?.sha || null;
}
function atualizarIndicador() {
  const el = document.getElementById('estado-sincronizacao');
  if (!el) return;
  el.textContent = estado.erroSincronizacao ? 'Sem atualização · dados podem estar antigos' : estado.conferidoEm
    ? `Conferido às ${new Date(estado.conferidoEm).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' })} · Brasília` : 'Conferindo dados…';
  el.classList.toggle('bad', !!estado.erroSincronizacao);
}
function mostrarDadosNovos(antes, depois) {
  document.getElementById('dados-novos')?.remove();
  const publicadas = (depois.lancamentos?.lancamentos || []).filter(l => l.status === 'PUBLICADA' &&
    !(antes?.lancamentos?.lancamentos || []).some(a => a.id === l.id && a.status === 'PUBLICADA'));
  const mensagem = publicadas.length ? `${publicadas[0].id}: publicação confirmada. Esta janela mostra uma versão anterior.`
    : 'Chegaram novas informações. Esta janela pode estar desatualizada; seu texto foi preservado.';
  document.body.append(h('aside', { id: 'dados-novos', class: 'dados-novos', role: 'status' },
    h('strong', {}, mensagem), h('button', { class: 'btn primario', type: 'button', onclick: () => {
      const rascunho = [...document.querySelectorAll('.camada-corpo textarea, .camada-corpo input:not([type=checkbox])')].some(e => e.value?.trim());
      if (rascunho && !confirm('Você está escrevendo. Abrir os dados atuais fecha esta janela e descarta o texto não enviado. Deseja continuar?')) return;
      fecharTudo(); document.getElementById('dados-novos')?.remove(); render();
    } }, 'Ver estado atualizado')));
}
const sincronizacao = criarSincronizacao({ lerSha: shaDados, lerPainel: () => api('/api/painel'),
  adiarTela: () => temCamadaAberta() || temEdicao(),
  aplicar: async (p, { adiar, mudou }) => {
    const antes = estado.dados;
    estado.usuario = p.usuario; estado.dados = p.dados;
    window.dispatchEvent(new CustomEvent('gamesup:dadosatualizados'));
    if (adiar && mudou) { telaPendente = true; mostrarDadosNovos(antes, p.dados); }
    else { telaPendente = false; const y = window.scrollY; render(); window.scrollTo(0, y); }
    // Diagnóstico não bloqueia a leitura de publicações e entregas.
    conferirNotificacoes().then(() => { if (estado.aba === 'ajustes' && !temCamadaAberta() && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) render(); });
  },
  atualizado: em => { estado.conferidoEm = em; estado.erroSincronizacao = null; atualizarIndicador(); },
  falhou: erro => { estado.erroSincronizacao = erro.message; atualizarIndicador(); },
});
async function atualizarSozinho() {
  if (document.hidden || !estado.dados) return;
  await sincronizacao.conferir();
}
setInterval(atualizarSozinho, 10_000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) atualizarSozinho(); });
window.addEventListener('focus', () => atualizarSozinho());
window.addEventListener('online', () => atualizarSozinho());
navigator.serviceWorker?.addEventListener('message', e => { if (e.data?.tipo === 'games-up:novidade') atualizarSozinho(); });
window.addEventListener('gamesup:camadafechada', () => {
  if (telaPendente && !temCamadaAberta() && !temEdicao()) {
    telaPendente = false; document.getElementById('dados-novos')?.remove(); render();
  }
});

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
  const menuMais = h('button', { type: 'button', class: 'aba', 'aria-haspopup': 'dialog', 'aria-current': !PRINCIPAIS_CELULAR.includes(pagina.id) ? 'page' : null, onclick: abrirMais },
    h('span', { class: 'aba-icone' }, icone('grade', { tamanho: 24 })), h('span', { class: 'aba-nome' }, 'Mais'));

  let conteudo;
  try { conteudo = pagina.tela(); } catch (e) {
    console.error(e);
    conteudo = h('div', { class: 'card erro-tela' }, icone('alerta', { tamanho: 28 }), h('p', {}, 'Esta tela não abriu. Toque em outra aba e volte.'), h('p', { class: 'sinc' }, e.message));
  }
  // Início e subpáginas desenham o próprio topo; as demais ganham um título grande com ícone.
  const temTopoProprio = ['inicio', 'avisos'].includes(pagina.id);
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
      h('main', { class: 'principal', id: 'conteudo' },
        h('div', { class: 'barra-acompanhamento' },
          h('span', { id: 'estado-sincronizacao', role: 'status' }, 'Conferindo dados…'),
          h('button', { type: 'button', class: 'btn', onclick: async e => {
            e.currentTarget.disabled = true;
            try { await carregar(); avisar('Dados atualizados.'); } catch (err) { avisar(err.message, true); e.currentTarget.disabled = false; }
          } }, icone('atualizar', { tamanho: 18 }), 'Atualizar agora'),
          h('button', { type: 'button', class: 'btn', onclick: () => irPara('avisos') }, icone('sino', { tamanho: 18 }),
            `Avisos (${novosAvisos(listarAvisos(estado.dados), lerAvisosLidos(estado.usuario)).length})`)),
        topo, conteudo),
      h('nav', { class: 'barra-abas', 'aria-label': 'Menu principal' }, ABAS.filter(a => PRINCIPAIS_CELULAR.includes(a.id)).map(botaoAba), menuMais)));
  if (render.mesmaTela) window.scrollTo(0, rolagem);
  render.mesmaTela = true;
  atualizarIndicador();
}

function irPara(aba, sub) {
  telaPendente = false; document.getElementById('dados-novos')?.remove();
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
  try {
    const suportado = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    const publica = suportado && Notification.permission === 'granted' ? await chavePublicaVapid() : null;
    estado.pushDiagnostico = await diagnosticarNotificacoes({
      registration: suportado ? navigator.serviceWorker.getRegistration() : null, permission: suportado ? Notification.permission : null,
      publicKey: publica, inscricoes: estado.dados?.push_inscricoes, confirmacoes: estado.dados?.push_confirmacoes, usuarioId: estado.usuario?.id,
      suportado, ios: ehIOS(), instalado: instalado(),
    });
    estado.pushAtivo = estado.pushDiagnostico.ativo;
  } catch { estado.pushDiagnostico = { estado: 'falha', titulo: 'Não foi possível conferir os avisos', texto: 'A conexão ou a configuração do push não respondeu. Isso não significa que você desativou as notificações. Tente verificar novamente.', ativo: false }; }
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
    conferir: async () => { await carregar(); },
  },
});

// Não abre dentro de outro site (moldura): evita cliques enganados nos botões de aprovação.
if (window.top !== window.self) {
  document.getElementById('raiz').replaceChildren(h('p', { class: 'carregando' }, 'Abra o Games Up direto no navegador.'));
} else {
  iniciar();
}
