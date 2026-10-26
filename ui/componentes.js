// Componentes visuais compartilhados do Games Up (sem bibliotecas externas).
// - h()/s(): criam elementos com segurança (nunca innerHTML).
// - icone(nome): ícones SVG próprios, traço simples, cor do texto (currentColor).
// - abrirFolha(): painel que sobe de baixo; fecha arrastando para baixo, tocando fora ou no X.
// - abrirModal(): janela com fundo escuro, mostrando só um item (ex.: uma proposta).
// - interruptor(), botaoCopiar(), chip(), vazio().

export function h(tag, attrs = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
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
export function s(tag, attrs = {}, ...filhos) {
  const el = document.createElementNS(svgNS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  for (const f of filhos.flat()) if (f != null) el.append(f instanceof Node ? f : document.createTextNode(String(f)));
  return el;
}

// Cada ícone: lista de "d" de paths (viewBox 24x24, traço 2). Alguns usam círculos (c:cx,cy,r).
const ICONES = {
  atualizar: ['M20 7v5h-5', 'M4 17v-5h5', 'M6.1 7a7 7 0 0 1 11.6-2L20 8', 'M4 16l2.3 3A7 7 0 0 0 18 17'],
  grade: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h7v7h-7z'],
  inicio: ['M3 10.5 12 3l9 7.5', 'M5 9.5V21h5v-6h4v6h5V9.5'],
  decisoes: ['M9 11l3 3 8-8', 'M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9'],
  tarefas: ['M9 6h12', 'M9 12h12', 'M9 18h12', 'M4 6h.01', 'M4 12h.01', 'M4 18h.01'],
  numeros: ['M3 3v18h18', 'M8 17V11', 'M13 17V7', 'M18 17v-4'],
  pesquisa: ['c:11,11,7', 'M20 20l-4-4'],
  ajustes: ['M4 6h10', 'M18 6h2', 'c:16,6,2', 'M4 12h4', 'M12 12h8', 'c:10,12,2', 'M4 18h12', 'M20 18h0', 'c:18,18,2'],
  mais: ['c:5,12,1.5', 'c:12,12,1.5', 'c:19,12,1.5'],
  jogadores: ['c:9,8,3.5', 'M2 21c0-3.9 3.1-7 7-7s7 3.1 7 7', 'M16 4.5a3.5 3.5 0 0 1 0 7', 'M22 21c0-3.2-2-6-5-6.8'],
  olho: ['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z', 'c:12,12,3'],
  estrela: ['M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z'],
  like: ['M7 10v11H4V10z', 'M7 10l4-7a2 2 0 0 1 3 2l-1 5h6a2 2 0 0 1 2 2.3l-1.4 7A2 2 0 0 1 17.6 21H7'],
  fogo: ['M12 22c4 0 7-2.7 7-7 0-3.5-2.3-6-4-8 0 2.5-1.5 4-3 4 0-3-1.5-6-4-8 .5 3-3 5.5-3 11 0 4.3 3 8 7 8z'],
  alvo: ['c:12,12,9', 'c:12,12,5', 'c:12,12,1'],
  lampada: ['M9 18h6', 'M10 21h4', 'M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z'],
  calendario: ['M4 5h16v16H4z', 'M4 10h16', 'M8 3v4', 'M16 3v4'],
  relogio: ['c:12,12,9', 'M12 7v5l3 2'],
  imagem: ['M3 5h18v14H3z', 'c:8.5,9.5,1.5', 'M21 16l-5-5-9 8'],
  escudo: ['M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', 'M9 12l2 2 4-4'],
  copiar: ['M9 9h11v11H9z', 'M5 15H4V4h11v1'],
  fechar: ['M6 6l12 12', 'M18 6L6 18'],
  direita: ['M9 6l6 6-6 6'],
  esquerda: ['M15 6l-6 6 6 6'],
  externo: ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v6H4V6h6'],
  raio: ['M13 2L4 14h7l-1 8 9-12h-7z'],
  trofeu: ['M8 4h8v5a4 4 0 0 1-8 0z', 'M8 6H5a3 3 0 0 0 3 4', 'M16 6h3a3 3 0 0 1-3 4', 'M12 13v4', 'M8 21h8', 'M10 17h4v4h-4z'],
  sino: ['M6 16V11a6 6 0 0 1 12 0v5l2 2H4z', 'M10 21h4'],
  play: ['M3 6.5A3.5 3.5 0 0 1 6.5 3h11A3.5 3.5 0 0 1 21 6.5v11a3.5 3.5 0 0 1-3.5 3.5h-11A3.5 3.5 0 0 1 3 17.5z', 'M10 8.5v7l6-3.5z'],
  musica: ['M9 18V5l11-2v13', 'c:6,18,3', 'c:17,16,3'],
  camera: ['M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'c:12,13,4'],
  roblox: ['M6 2l16 4-4 16-16-4z', 'M10 10l4 1-1 4-4-1z'],
  martelo: ['M14 4l6 6-3 3-6-6z', 'M11 7L3 15l3 3 8-8'],
  pincel: ['M18 3l3 3-9 9-3-3z', 'M9 12c-3 0-5 2-5 5 0 1.5-1 2-2 2 1 2 3 3 5 3 3 0 5-2 5-5'],
  grafico: ['M3 17l6-6 4 4 8-8', 'M15 7h6v6'],
  queda: ['M3 7l6 6 4-4 8 8', 'M15 17h6v-6'],
  globo: ['c:12,12,9', 'M3 12h18', 'M12 3c3 3.5 3 14.5 0 18', 'M12 3c-3 3.5-3 14.5 0 18'],
  chat: ['M4 5h16v11H9l-5 4z'],
  alerta: ['M12 3l10 18H2z', 'M12 10v5', 'M12 18h.01'],
  ok: ['M5 12l5 5L20 7'],
  cadeado: ['M5 11h14v10H5z', 'M8 11V7a4 4 0 0 1 8 0v4'],
  assinatura: ['M3 21c3-3 5-8 8-8s1 5 3 5 3-3 4-3', 'M15 4l5 5-9 9H6v-5z'],
  foguete: ['M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2', 'M9 15l-3-3c2-6 7-9 13-9 0 6-3 11-9 13z', 'c:15,9,1.5'],
  sol: ['c:12,12,4', 'M12 2v2', 'M12 20v2', 'M2 12h2', 'M20 12h2', 'M4.9 4.9l1.4 1.4', 'M17.7 17.7l1.4 1.4', 'M4.9 19.1l1.4-1.4', 'M17.7 6.3l1.4-1.4'],
  noticia: ['M4 5h13v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z', 'M17 9h3v10a2 2 0 0 1-2 2', 'M7 9h7', 'M7 13h7', 'M7 17h4'],
  escola: ['M2 9l10-5 10 5-10 5z', 'M6 11v5c2 2 10 2 12 0v-5', 'M22 9v6'],
  thumbnail: ['M3 5h18v14H3z', 'M3 15l5-4 4 3 3-2 6 5'],
  gameplay: ['M6 9h12a4 4 0 0 1 0 8c-1.5 0-2.5-1-3-2H9c-.5 1-1.5 2-3 2a4 4 0 0 1 0-8z', 'M8 12v2', 'M7 13h2', 'M16 12h.01', 'M18 14h.01'],
  interface: ['M7 2h10v20H7z', 'M11 18h2'],
  evento: ['M12 3l2 5 5 .5-4 3.5 1.5 5L12 14l-4.5 3 1.5-5-4-3.5 5-.5z'],
  qualidade: ['M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z'],
  filtro: ['M3 5h18l-7 8v6l-4 2v-8z'],
  pausa: ['M8 5v14', 'M16 5v14'],
  editar: ['M4 20h4L19 9l-4-4L4 16z'],
};

/** Ícone SVG por nome. Nomes desconhecidos viram um ponto (nunca quebram a tela). */
export function icone(nome, { tamanho = 20, classe = '' } = {}) {
  const partes = ICONES[nome] || ['c:12,12,2'];
  return s('svg', { viewBox: '0 0 24 24', width: tamanho, height: tamanho, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: `icone ${classe}`.trim() },
    partes.map(p => (p.startsWith('c:') ? (([cx, cy, r]) => s('circle', { cx, cy, r }))(p.slice(2).split(',')) : s('path', { d: p }))));
}
export const NOMES_ICONES = Object.keys(ICONES);

/** Ícone por tipo de proposta/atividade. */
export function iconeDoTipo(tipo) {
  return { thumbnail: 'thumbnail', gameplay: 'gameplay', interface: 'interface', evento: 'evento', qualidade: 'qualidade',
    correcao: 'martelo', melhoria: 'grafico', novidade: 'raio', pesquisa: 'pesquisa', relatorio: 'numeros', publicacao: 'foguete',
    monitoramento: 'olho', desenvolvimento: 'martelo', propostas: 'decisoes', autorizacao: 'assinatura' }[tipo] || 'estrela';
}

// ------------------------------------------------------------------ camadas (folha e modal)
const pilha = [];
function travarRolagem(travar) { document.documentElement.classList.toggle('sem-rolagem', travar); }

function camada(tipo, { titulo, conteudo, rodape = null, aoFechar = null, classe = '' }) {
  const fundo = h('div', { class: `camada-fundo ${tipo}-fundo`, 'aria-hidden': 'true' });
  const fechar = () => {
    if (!caixa.isConnected) return;
    caixa.classList.add('saindo'); fundo.classList.add('saindo');
    setTimeout(() => { caixa.remove(); fundo.remove(); window.dispatchEvent(new CustomEvent('gamesup:camadafechada')); }, 220);
    const i = pilha.indexOf(fechar); if (i >= 0) pilha.splice(i, 1);
    if (!pilha.length) travarRolagem(false);
    aoFechar?.();
  };
  const botaoX = h('button', { class: 'camada-x', 'aria-label': 'Fechar', onclick: fechar }, icone('fechar', { tamanho: 22 }));
  const corpo = h('div', { class: 'camada-corpo' }, typeof conteudo === 'function' ? conteudo(fechar) : conteudo);
  const caixa = h('section', { class: `${tipo} ${classe}`.trim(), role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo || 'Detalhes' },
    tipo === 'folha' ? h('div', { class: 'folha-alca', 'aria-hidden': 'true' }) : null,
    h('header', { class: 'camada-topo' }, h('h2', {}, titulo || ''), botaoX),
    corpo,
    rodape ? h('footer', { class: 'camada-rodape' }, typeof rodape === 'function' ? rodape(fechar) : rodape) : null);
  fundo.addEventListener('click', fechar);
  document.body.append(fundo, caixa);
  requestAnimationFrame(() => { fundo.classList.add('aberto'); caixa.classList.add('aberto'); });
  pilha.push(fechar); travarRolagem(true);
  botaoX.focus({ preventScroll: true });
  if (tipo === 'folha') arrastarParaFechar(caixa, corpo, fechar);
  return { fechar, corpo, caixa };
}

/** Arrastar para baixo fecha a folha (só quando o conteúdo está no topo). */
function arrastarParaFechar(caixa, corpo, fechar) {
  let y0 = null, dy = 0;
  caixa.addEventListener('pointerdown', e => {
    if (e.target.closest('button, a, input, textarea, select, label')) return;
    if (corpo.scrollTop > 0 && !e.target.closest('.folha-alca, .camada-topo')) return;
    y0 = e.clientY; dy = 0; caixa.style.transition = 'none';
  });
  window.addEventListener('pointermove', e => {
    if (y0 == null) return;
    dy = Math.max(0, e.clientY - y0);
    caixa.style.transform = `translateY(${dy}px)`;
  });
  const soltar = () => {
    if (y0 == null) return;
    y0 = null; caixa.style.transition = ''; caixa.style.transform = '';
    if (dy > 90) fechar();
  };
  window.addEventListener('pointerup', soltar);
  window.addEventListener('pointercancel', soltar);
}

/** Painel que sobe de baixo. conteudo pode ser um nó ou uma função (fechar) => nó. */
export function abrirFolha(opcoes) { return camada('folha', opcoes); }
/** Janela central com fundo escuro (no celular ocupa quase a tela toda). */
export function abrirModal(opcoes) { return camada('modal', opcoes); }
export function fecharTudo() { [...pilha].reverse().forEach(f => f()); }
/** true quando há folha ou janela aberta (preserva mídia e rascunhos na atualização). */
export const temCamadaAberta = () => pilha.length > 0;
window.addEventListener('keydown', e => { if (e.key === 'Escape' && pilha.length) pilha.at(-1)(); });

// ------------------------------------------------------------------ peças pequenas
/** Botão liga/desliga (não use checkbox cru). */
export function interruptor({ ligado = false, rotulo, descricao = null, aoMudar, id }) {
  const botao = h('button', { class: `interruptor${ligado ? ' ligado' : ''}`, role: 'switch', 'aria-checked': String(!!ligado), id, type: 'button',
    onclick: () => { const novo = botao.getAttribute('aria-checked') !== 'true'; botao.setAttribute('aria-checked', String(novo)); botao.classList.toggle('ligado', novo); estadoTxt.textContent = novo ? 'Ativado' : 'Desativado'; aoMudar?.(novo); } },
  h('span', { class: 'interruptor-bolinha' }));
  const estadoTxt = h('span', { class: 'interruptor-estado' }, ligado ? 'Ativado' : 'Desativado');
  return h('div', { class: 'linha-interruptor' }, h('div', {}, h('div', { class: 'linha-rotulo' }, rotulo), descricao ? h('div', { class: 'linha-descricao' }, descricao) : null), h('div', { class: 'linha-acao' }, estadoTxt, botao));
}

/** Botão que copia um texto e confirma na hora. */
export function botaoCopiar(texto, rotulo = 'Copiar') {
  const b = h('button', { class: 'btn btn-copiar', type: 'button', onclick: async () => {
    try { await navigator.clipboard.writeText(texto); } catch {
      const t = h('textarea', { style: { position: 'fixed', opacity: '0' } }, texto); document.body.append(t); t.select(); document.execCommand('copy'); t.remove();
    }
    b.replaceChildren(icone('ok', { tamanho: 18 }), 'Copiado'); b.classList.add('copiado');
    setTimeout(() => { b.replaceChildren(icone('copiar', { tamanho: 18 }), rotulo); b.classList.remove('copiado'); }, 1800);
  } }, icone('copiar', { tamanho: 18 }), rotulo);
  return b;
}

export function chip(texto, { tom = 'neutro', iconeNome = null } = {}) {
  return h('span', { class: `chip ${tom}` }, iconeNome ? icone(iconeNome, { tamanho: 14 }) : null, texto);
}

export function vazio(texto, iconeNome = 'ok') {
  return h('div', { class: 'vazio-bonito' }, icone(iconeNome, { tamanho: 28 }), h('p', {}, texto));
}
