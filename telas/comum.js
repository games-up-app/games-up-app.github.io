// Peças compartilhadas pelas telas Início, Ajustes, Pesquisa e Tarefas.
// Tudo com h()/s() (sem innerHTML) e ícones próprios (sem emojis).
import { h, s, icone, abrirFolha, chip } from '../ui/componentes.js?v=20261025-categorias4';
import { ctx } from '../ui/contexto.js?v=20261025-categorias4';

export const FUSO = 'America/Sao_Paulo';
export const num = x => (x == null || !Number.isFinite(Number(x)) ? '—' : Number(x).toLocaleString('pt-BR'));
export const pct = (x, casas = 0) => (x == null ? '—' : `${(x * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`);

/** Número curto: 12,2 mi · 252 mil · 373. */
export function compacto(x) {
  if (x == null || !Number.isFinite(Number(x))) return '—';
  const v = Number(x);
  const f = (n, suf) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: n < 10 ? 1 : 0 })} ${suf}`;
  if (Math.abs(v) >= 1e9) return f(v / 1e9, 'bi');
  if (Math.abs(v) >= 1e6) return f(v / 1e6, 'mi');
  if (Math.abs(v) >= 1e4) return f(v / 1e3, 'mil');
  return v.toLocaleString('pt-BR');
}

export const dataBR = iso => {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00-03:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', { timeZone: FUSO, dateStyle: 'short', ...(iso.length > 10 ? { timeStyle: 'short' } : {}) });
};
export const horaBR = iso => {
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' });
};

/** "agora há pouco", "há 3 h", "há 2 dias". */
export function haQuanto(iso) {
  if (!iso) return 'nunca';
  const min = (Date.now() - new Date(iso).getTime()) / 60000;
  if (!Number.isFinite(min)) return '—';
  if (min < 2) return 'agora há pouco';
  if (min < 60) return `há ${Math.round(min)} min`;
  if (min < 48 * 60) return `há ${Math.round(min / 60)} h`;
  return `há ${Math.round(min / 1440)} dias`;
}

export function textoCurto(texto, limite = 140) {
  const v = String(texto || '').trim();
  if (v.length <= limite) return v;
  const corte = v.slice(0, limite).replace(/\s+\S*$/, '');
  return `${corte || v.slice(0, limite)}…`;
}

/** URL https/http segura ou null. */
export function urlSegura(url) {
  try { const u = new URL(url); return ['https:', 'http:'].includes(u.protocol) ? u.href : null; } catch { return null; }
}
export function linkSeguro(url, texto) {
  const u = urlSegura(url);
  return u ? h('a', { href: u, target: '_blank', rel: 'noopener noreferrer' }, texto || new URL(u).hostname) : h('span', {}, texto || '—');
}
/** Botão grande que abre um link externo (Roblox, fonte da notícia...). */
export function botaoLink(url, rotulo, { classe = 'btn', iconeNome = 'externo' } = {}) {
  const u = urlSegura(url);
  if (!u) return null;
  return h('a', { class: classe, href: u, target: '_blank', rel: 'noopener noreferrer', onclick: e => e.stopPropagation() }, icone(iconeNome, { tamanho: 18 }), rotulo);
}

/** Imagem externa (https) com reserva bonita se falhar. */
export function imagemExterna(url, { alt = '', classe = '', reserva = null } = {}) {
  const u = urlSegura(url);
  if (!u || !u.startsWith('https:')) return reserva;
  const img = h('img', { src: u, alt, class: classe, loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer' });
  if (reserva) img.addEventListener('error', () => img.replaceWith(reserva));
  else img.addEventListener('error', () => img.remove());
  return img;
}

/** Bloco colorido com ícone (miniatura quando não há imagem). */
export function miniaturaIcone(nomeIcone, tom = 'roxo', classe = '') {
  return h('div', { class: `mini-icone tom-${tom} ${classe}`.trim(), 'aria-hidden': 'true' }, icone(nomeIcone, { tamanho: 26 }));
}

// ------------------------------------------------------------------ status
const ROTULOS = {
  'PROPOSTA': 'Em preparo', 'AGUARDANDO APROVAÇÃO': 'Esperando decisão', 'ADIADA': 'Adiada',
  'APROVADA PARA DESENVOLVIMENTO': 'Aprovada', 'REJEITADA': 'Rejeitada', 'DEVOLVIDA PARA AJUSTES': 'Voltou para ajustes',
  'EM DESENVOLVIMENTO': 'Sendo feita', 'EM TESTES': 'Em testes', 'AGUARDANDO AUTORIZAÇÃO FINAL': 'Esperando sua autorização',
  'APROVADA PARA PUBLICAÇÃO': 'Autorizada', 'PUBLICADA': 'Publicada', 'BLOQUEADA': 'Bloqueada',
  'A FAZER': 'A fazer', 'CONCLUÍDA': 'Concluída', 'IMPEDIDA': 'Travada',
  'ok': 'Funcionando', 'falhou': 'Falhou', 'parcial': 'Parcial', 'indisponível': 'Indisponível', 'nunca executado': 'Ainda não rodou',
};
export const rotuloStatus = st => ROTULOS[st] || st || '—';
export function tomStatus(st) {
  if (['APROVADA PARA DESENVOLVIMENTO', 'APROVADA PARA PUBLICAÇÃO', 'PUBLICADA', 'CONCLUÍDA', 'ok'].includes(st)) return 'ok';
  if (['REJEITADA', 'BLOQUEADA', 'falhou', 'IMPEDIDA'].includes(st)) return 'bad';
  if (['AGUARDANDO APROVAÇÃO', 'AGUARDANDO AUTORIZAÇÃO FINAL', 'DEVOLVIDA PARA AJUSTES', 'ADIADA', 'parcial', 'indisponível'].includes(st)) return 'warn';
  if (['EM DESENVOLVIMENTO', 'EM TESTES'].includes(st)) return 'relevante';
  return 'neutro';
}
export function chipStatus(st) {
  const tom = tomStatus(st);
  const ic = { ok: 'ok', bad: 'alerta', warn: 'relogio', relevante: 'martelo' }[tom] || null;
  return chip(rotuloStatus(st), { tom, iconeNome: ic });
}

// ------------------------------------------------------------------ estrutura de página
/** Cabeçalho de seção com ícone e ação opcional à direita. */
export function cabecalhoSecao(nomeIcone, texto, acao = null) {
  return h('div', { class: 'secao-topo' },
    h('h2', { class: 'secao-titulo' }, h('span', { class: 'secao-icone' }, icone(nomeIcone, { tamanho: 18 })), texto),
    acao);
}
export function botaoTexto(rotulo, aoClicar, iconeNome = 'direita') {
  return h('button', { class: 'link-botao', type: 'button', onclick: aoClicar }, rotulo, icone(iconeNome, { tamanho: 16 }));
}
/** Topo de subpágina com botão voltar. */
export function topoSubpagina(titulo, aoVoltar, subtitulo = null) {
  return h('div', { class: 'topo-sub' },
    h('button', { class: 'voltar', type: 'button', 'aria-label': 'Voltar', onclick: aoVoltar }, icone('esquerda', { tamanho: 22 })),
    h('div', {}, h('h1', { tabindex: '-1' }, titulo), subtitulo ? h('p', { class: 'topo-sub-texto' }, subtitulo) : null));
}

/** Botões segmentados (escolha única), sem rolagem lateral: quebram linha se precisar. */
export function segmentado(opcoes, atual, aoEscolher, { rotulo = 'Opções', classe = '' } = {}) {
  return h('div', { class: `segmentado ${classe}`.trim(), role: 'tablist', 'aria-label': rotulo },
    opcoes.map(([id, nome, ic]) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(atual === id), class: atual === id ? 'ativo' : null, onclick: () => aoEscolher(id) },
      ic ? icone(ic, { tamanho: 16 }) : null, h('span', {}, nome))));
}
/** Fileira de chips de filtro (quebra linha; nunca rola para o lado). */
export function filtrosChips(opcoes, atual, aoEscolher, rotulo = 'Filtro') {
  return h('div', { class: 'filtros-chips', role: 'group', 'aria-label': rotulo },
    opcoes.map(([id, nome, ic]) => h('button', { type: 'button', class: `filtro-chip${atual === id ? ' ativo' : ''}`, 'aria-pressed': String(atual === id), onclick: () => aoEscolher(id) },
      ic ? icone(ic, { tamanho: 15 }) : null, nome)));
}

/** Bloco de campo dentro de folhas: ícone + rótulo + texto. */
export function campo(nomeIcone, rotulo, conteudo) {
  if (conteudo == null || conteudo === '' || (Array.isArray(conteudo) && !conteudo.length)) return null;
  return h('div', { class: 'campo-folha' },
    h('div', { class: 'campo-icone' }, icone(nomeIcone, { tamanho: 18 })),
    h('div', { class: 'campo-texto' }, h('div', { class: 'campo-rotulo' }, rotulo), h('div', { class: 'campo-valor' }, conteudo)));
}
/** Número em destaque (folhas de detalhes). */
export function blocoNumero(nomeIcone, valor, rotulo, tom = '') {
  return h('div', { class: `bloco-numero ${tom}`.trim() }, h('span', { class: 'bloco-numero-icone' }, icone(nomeIcone, { tamanho: 18 })), h('strong', {}, valor), h('span', {}, rotulo));
}

// ------------------------------------------------------------------ mini gráfico
/** Linha suave com área (SVG). valores: números. Retorna nó ou null. */
export function miniGrafico(valores, { largura = 300, altura = 64, rotulo = 'Gráfico', classe = '' } = {}) {
  const v = (valores || []).filter(x => Number.isFinite(x));
  if (v.length < 2) return null;
  const min = Math.min(...v), max = Math.max(...v);
  const faixa = max - min || 1;
  const pad = 4;
  const pts = v.map((y, i) => [pad + (i * (largura - pad * 2)) / (v.length - 1), pad + (altura - pad * 2) * (1 - (y - min) / faixa)]);
  const linha = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${linha} L${pts.at(-1)[0].toFixed(1)},${altura} L${pts[0][0].toFixed(1)},${altura} Z`;
  const ult = pts.at(-1);
  return s('svg', { viewBox: `0 0 ${largura} ${altura}`, preserveAspectRatio: 'none', class: `mini-grafico ${classe}`.trim(), role: 'img', 'aria-label': rotulo },
    s('path', { d: area, class: 'mg-area' }),
    s('path', { d: linha, class: 'mg-linha', 'vector-effect': 'non-scaling-stroke' }),
    s('circle', { cx: ult[0], cy: ult[1], r: 3.5, class: 'mg-ponto' }));
}

/** Seta e texto da tendência de um jogo. */
export function chipTendencia(tendencia, variacao) {
  const pctTxt = Number.isFinite(variacao) ? ` ${variacao > 0 ? '+' : ''}${Math.round(variacao * (Math.abs(variacao) <= 1.5 ? 100 : 1))}%` : '';
  if (tendencia === 'subindo') return chip(`Subindo${pctTxt}`, { tom: 'ok', iconeNome: 'grafico' });
  if (tendencia === 'caindo') return chip(`Caindo${pctTxt}`, { tom: 'bad', iconeNome: 'queda' });
  if (tendencia === 'novo') return chip('Novo na lista', { tom: 'relevante', iconeNome: 'estrela' });
  return chip('Estável', { tom: 'neutro', iconeNome: 'direita' });
}

// ------------------------------------------------------------------ comentários (tarefas)
export function blocoComentarios(alvoTipo, alvoId) {
  const lista = (ctx.estado.dados.comentarios?.itens || []).filter(c => c.alvoTipo === alvoTipo && c.alvoId === alvoId);
  const texto = h('textarea', { placeholder: 'Escreva um comentário…', maxlength: 2000, 'aria-label': 'Novo comentário', rows: 2 });
  const btn = h('button', { class: 'btn', type: 'button', onclick: () => {
    if (!texto.value.trim()) { texto.focus(); return; }
    ctx.gravar('/api/comentarios', { alvoTipo, alvoId, texto: texto.value }, [btn], 'Comentário publicado.');
  } }, icone('chat', { tamanho: 18 }), 'Comentar');
  return h('div', { class: 'comentarios' },
    h('h3', { class: 'folha-subtitulo' }, icone('chat', { tamanho: 18 }), `Comentários (${lista.length})`),
    lista.map(c => h('div', { class: 'comentario' }, h('div', { class: 'quem' }, `${c.por?.nome || '—'} · ${dataBR(c.em)}`), h('div', {}, c.texto))),
    texto, h('div', { class: 'acoes' }, btn));
}

/** Atalho: abre uma folha com título e conteúdo. */
export function folha(titulo, conteudo, rodape = null) { return abrirFolha({ titulo, conteudo, rodape }); }

/** Card clicável que pode conter links/botões próprios (div com teclado). */
export function cardClicavel(classe, aoTocar, rotulo, ...filhos) {
  return h('div', { class: `card card-botao ${classe}`.trim(), role: 'button', tabindex: '0', 'aria-label': rotulo,
    onclick: e => { if (!e.target.closest('a, button')) aoTocar(); },
    onkeydown: e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); aoTocar(); } } }, ...filhos);
}

/** Card clicável (botão inteiro) — acessível por teclado. */
export function cardBotao(classe, aoTocar, ...filhos) {
  return h('button', { type: 'button', class: `card card-botao ${classe}`.trim(), onclick: aoTocar }, ...filhos);
}

/** Tira emojis de textos que vêm de fora (nomes de jogos da Roblox etc.): a interface não usa emojis. */
export const semEmoji = t => String(t ?? '').replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}️‍]/gu, '').replace(/\[\s*\]|\(\s*\)/g, '').replace(/\s{2,}/g, ' ').trim();
