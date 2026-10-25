// Aba NÚMEROS do Games Up.
// - "Jogo agora": números ao vivo da página pública do jogo + botão para abrir na Roblox.
// - Thumbnails: imagens, ranking da semana (selo PROTEGIDA), gráficos e seletor de semanas (folha).
// - Relatório da semana: cards com ícones, gráficos SVG/HTML próprios e textos longos em folhas.
// Nada expande para baixo; nenhum gráfico força rolagem horizontal (larguras em %, SVG com viewBox).
import { h, s, icone, abrirFolha, chip, vazio } from '../ui/componentes.js';
import { ctx } from '../ui/contexto.js';
import { classificarThumbnail, thumbnailsProtegidas } from '../nucleo/estatistica.js';

// ------------------------------------------------------------------ formatação
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const nf = new Intl.NumberFormat('pt-BR');
const nfc = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const num = x => (x == null || !Number.isFinite(+x) ? '—' : nf.format(x));
const compacto = x => (x == null || !Number.isFinite(+x) ? '—' : (Math.abs(x) < 10000 ? nf.format(x) : nfc.format(x)));
const pct = (x, casas = 2) => (x == null ? '—' : `${(x * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`);
function data(iso) {
  if (!iso) return null;
  const t = String(iso);
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) { const [a, m, d] = t.split('-').map(Number); return new Date(a, m - 1, d, 12); }
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : new Date(d.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
}
const dataCurta = iso => { const d = data(iso); return d ? `${d.getDate()} ${MESES[d.getMonth()]}` : '—'; };
const dataHora = iso => { const d = data(iso); return d ? `${d.getDate()} ${MESES[d.getMonth()]}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '—'; };
/** "14–21 out" ou "28 out – 4 nov". */
function rotuloSemana(p) {
  const a = data(p?.inicio), b = data(p?.fim);
  if (!a || !b) return 'Semana';
  return a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ${MESES[b.getMonth()]}` : `${a.getDate()} ${MESES[a.getMonth()]} – ${b.getDate()} ${MESES[b.getMonth()]}`;
}
function curto(texto, limite = 120) {
  const t = String(texto || '').trim();
  return t.length <= limite ? t : `${t.slice(0, limite).replace(/\s+\S*$/, '')}…`;
}
const dados = () => ctx.estado?.dados || {};
const jog = x => (Number.isFinite(x.jogadasQualificadas) ? x.jogadasQualificadas : Number.isFinite(x.jogadasEstimadas) ? x.jogadasEstimadas : Math.round((x.impressoes || 0) * (x.qptr || 0)));
const linkSeguro = (url, conteudo, classe = '') => (/^https:\/\//.test(url || '') ? h('a', { href: url, target: '_blank', rel: 'noopener noreferrer', class: classe }, conteudo) : h('span', { class: classe }, conteudo));

// ------------------------------------------------------------------ imagens (baixadas uma vez só)
const cachePrevia = new Map();
function imagemDados(caminho, alt) {
  if (typeof ctx.imagemPrivada === 'function') return ctx.imagemPrivada(caminho, { alt, classe: 'nm-img' });
  const rel = String(caminho).replace(/^dados\//, '');
  const img = h('img', { alt, class: 'nm-img', loading: 'lazy', decoding: 'async' });
  if (!cachePrevia.has(rel)) cachePrevia.set(rel, ctx.estado.repo.lerImagem(rel).then(b => (b ? URL.createObjectURL(b) : null)).catch(() => null));
  cachePrevia.get(rel).then(u => { if (u) img.src = u; else img.remove(); });
  return img;
}
function moldura(classe, conteudoReserva, img) {
  const caixa = h('div', { class: `nm-midia ${classe}` }, h('div', { class: 'nm-midia-reserva' }, conteudoReserva));
  if (img) { img.addEventListener('error', () => img.remove()); caixa.append(img); }
  return caixa;
}
function miniaturaThumb(x, posicao, classe = 'nm-midia-thumb') {
  const reserva = [icone('thumbnail', { tamanho: 30 }), h('span', {}, x.nome?.replace('Thumbnail ', 'Thumb ') || '')];
  return moldura(classe, reserva, x.previa ? imagemDados(x.previa, x.nome) : null);
}

// ------------------------------------------------------------------ peças
function segmentos(chave, opcoes) {
  const sub = ctx.estado.sub || (ctx.estado.sub = {});
  const atual = opcoes.some(o => o[0] === sub[chave]) ? sub[chave] : opcoes[0][0];
  return [atual, h('div', { class: 'nm-seg', role: 'tablist' }, opcoes.map(([id, nome, ic]) =>
    h('button', { type: 'button', role: 'tab', 'aria-selected': String(atual === id), onclick: () => { sub[chave] = id; ctx.render?.(); } }, icone(ic, { tamanho: 18 }), nome)))];
}
function tituloCard(ic, texto, extra = null) {
  return h('div', { class: 'nm-card-topo' }, h('span', { class: 'nm-card-icone' }, icone(ic, { tamanho: 20 })), h('h3', {}, texto), extra);
}
function botaoFolha(ic, titulo, resumo, abrir, tom = '') {
  return h('button', { type: 'button', class: `nm-mini ${tom}`, onclick: abrir },
    h('span', { class: 'nm-mini-icone' }, icone(ic, { tamanho: 20 })),
    h('span', { class: 'nm-mini-txt' }, h('span', { class: 'nm-mini-titulo' }, titulo), h('span', { class: 'nm-mini-resumo' }, resumo)),
    icone('direita', { tamanho: 18, classe: 'nm-mini-seta' }));
}
const folhaTexto = (titulo, texto) => abrirFolha({ titulo, conteudo: h('p', { class: 'nm-texto-folha' }, texto) });
const folhaLista = (titulo, itens, vazioTxt = 'Nada por aqui.') => abrirFolha({ titulo, conteudo: itens.length ? h('ul', { class: 'nm-lista-folha' }, itens.map(i => h('li', {}, i))) : vazio(vazioTxt) });

/** Variação em seta + cor + texto (nunca só cor). */
function variacao(antes, agora, ehTaxa = false) {
  if (antes == null || agora == null) return h('span', { class: 'nm-delta neutro' }, 'sem comparação');
  const dif = agora - antes;
  const txt = ehTaxa ? `${dif >= 0 ? '+' : ''}${(dif * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} p.p.` : antes ? `${dif >= 0 ? '+' : ''}${((dif / antes) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '—';
  const tom = Math.abs(dif) < 1e-12 ? 'neutro' : dif > 0 ? 'sobe' : 'desce';
  return h('span', { class: `nm-delta ${tom}` }, tom === 'neutro' ? null : icone(tom === 'sobe' ? 'grafico' : 'queda', { tamanho: 14 }), txt);
}

// ------------------------------------------------------------------ jogo agora
function blocoJogoAgora() {
  const j = dados().jogo;
  if (!j?.atual) return null;
  const a = j.atual;
  const tile = (ic, valor, rotulo, tom = '') => h('div', { class: `nm-tile ${tom}` }, icone(ic, { tamanho: 18 }), h('strong', {}, valor), h('span', {}, rotulo));
  return h('section', { class: 'nm-jogo' },
    h('div', { class: 'nm-jogo-topo' },
      j.icone && /^https:\/\//.test(j.icone) ? h('img', { class: 'nm-jogo-icone', src: j.icone, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }) : h('span', { class: 'nm-jogo-icone nm-jogo-icone-vazio' }, icone('roblox', { tamanho: 26 })),
      h('div', { class: 'nm-jogo-nome' }, h('span', { class: 'nm-sobre' }, 'Jogo agora'), h('strong', {}, j.nome || 'Escola Brasileira'), h('span', { class: 'nm-fraco' }, `Atualizado ${dataHora(a.em)}`)),
      j.link ? linkSeguro(j.link, [icone('externo', { tamanho: 16 }), h('span', {}, 'Ver na Roblox')], 'nm-btn nm-btn-amarelo') : null),
    h('div', { class: 'nm-tiles' },
      h('div', { class: 'nm-tile destaque' }, h('span', { class: 'nm-ao-vivo', 'aria-hidden': 'true' }), h('strong', {}, num(a.jogando)), h('span', {}, 'jogando agora')),
      tile('olho', compacto(a.visitas), 'visitas'),
      tile('estrela', compacto(a.favoritos), 'favoritos'),
      tile('like', a.aprovacao != null ? pct(a.aprovacao, 0) : '—', 'aprovação')));
}

// ------------------------------------------------------------------ thumbnails
function analisar(snap) {
  const itens = snap.itens || [];
  if (!itens.length) return { itens, ranking: [], protegidas: new Map(), analise: {} };
  const ref = itens.reduce((a, b) => (jog(b) > jog(a) ? b : a));
  const analise = Object.fromEntries(itens.map(x => [x.id, classificarThumbnail(x, ref)]));
  const qptrGeral = snap.total?.qptr ?? null;
  const protegidas = thumbnailsProtegidas(itens, { qptrGeral });
  const ranking = [...itens].sort((a, b) => jog(b) - jog(a));
  return { itens, ranking, protegidas, analise, qptrGeral };
}
const FRASES = {
  MANTER: ['Vai bem', 'ok', 'ok', 'Vai bem. Fica como está.'],
  OBSERVAR: ['Observando', 'warn', 'olho', 'Ainda tem poucos dados. Continua no ar e é revista na próxima semana.'],
  SUBSTITUIR: ['Pode trocar', 'bad', 'queda', 'Trouxe bem menos jogadores que a melhor. Pode ser trocada, mas só se você aprovar.'],
};
function seloSituacao(x, A) {
  if (A.protegidas.has(x.id)) return h('span', { class: 'nm-protegida' }, icone('escudo', { tamanho: 14 }), 'PROTEGIDA');
  const [t, tom, ic] = FRASES[A.analise[x.id]?.recomendacao] || ['—', 'neutro', 'estrela'];
  return chip(t, { tom, iconeNome: ic });
}

function folhaThumb(x, pos, A, total) {
  const a = A.analise[x.id] || {};
  const prot = A.protegidas.get(x.id);
  const frase = prot ? `Não será trocada. Motivo: ${prot.join(' e ')}.` : (FRASES[a.recomendacao]?.[3] || a.motivo || '');
  abrirFolha({
    titulo: `${pos}º · ${x.nome}`,
    conteudo: h('div', { class: 'nm-folha-thumb' },
      miniaturaThumb(x, pos, 'nm-midia-grande'),
      h('div', { class: 'nm-linha-chips' }, seloSituacao(x, A)),
      h('p', { class: 'nm-frase' }, frase),
      h('div', { class: 'nm-tiles' },
        h('div', { class: 'nm-tile destaque' }, icone('jogadores', { tamanho: 18 }), h('strong', {}, num(jog(x))), h('span', {}, 'jogadores')),
        h('div', { class: 'nm-tile' }, icone('olho', { tamanho: 18 }), h('strong', {}, compacto(x.impressoes)), h('span', {}, 'vezes vista')),
        h('div', { class: 'nm-tile' }, icone('alvo', { tamanho: 18 }), h('strong', {}, pct(x.qptr)), h('span', {}, 'taxa de jogadas')),
        h('div', { class: 'nm-tile' }, icone('numeros', { tamanho: 18 }), h('strong', {}, total ? pct(x.impressoes / total, 1) : '—'), h('span', {}, 'das vezes vista'))),
      a.ic?.inf != null ? h('p', { class: 'nm-fraco' }, `A taxa real deve estar entre ${pct(a.ic.inf)} e ${pct(a.ic.sup)} (quanto maior a faixa, menos certeza).`) : null,
      a.motivo && !prot ? h('p', { class: 'nm-fraco' }, `Detalhe técnico: ${a.motivo}`) : null,
      x.segmentoVencedor ? h('p', { class: 'nm-fraco' }, `Público que mais gostou: ${x.segmentoVencedor}`) : null),
  });
}

/** Barras horizontais em HTML (texto sempre legível no celular). */
function barrasHtml(linhas, { formato = num, miniaturas = false } = {}) {
  const max = Math.max(1, ...linhas.map(l => l.valor || 0));
  return h('ul', { class: 'nm-barras', role: 'list' }, linhas.map(l => h('li', { title: `${l.rotulo}: ${formato(l.valor)}` },
    miniaturas && l.item ? miniaturaThumb(l.item, 0, 'nm-midia-barra') : null,
    h('div', { class: 'nm-barra-corpo' },
      h('div', { class: 'nm-barra-rot' }, h('span', {}, l.rotulo), h('strong', {}, formato(l.valor)), l.extra ? h('span', { class: 'nm-fraco' }, l.extra) : null),
      h('div', { class: 'nm-barra-trilho' }, h('span', { class: `nm-barra-cheia${l.destaque ? ' forte' : ''}`, style: { width: `${Math.max(1.5, (100 * (l.valor || 0)) / max)}%` } }))))));
}

/** Colunas SVG da taxa de jogadas, com linha tracejada da média do jogo. */
function colunasTaxa(itens, media) {
  const W = 360, H = 200, m = { l: 40, r: 8, t: 16, b: 30 };
  const maxV = Math.max(media || 0, ...itens.map(x => x.qptr || 0)) * 1.15 || 0.01;
  const y = v => m.t + (H - m.t - m.b) * (1 - v / maxV);
  const bw = (W - m.l - m.r) / itens.length;
  const g = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'nm-svg', role: 'img', 'aria-label': `Taxa de jogadas: ${itens.map(x => `${x.nome} ${pct(x.qptr)}`).join(', ')}` });
  [0, 0.5, 1].forEach(f => { const v = maxV * f / 1.15; g.append(s('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: 'nm-grade' }), s('text', { x: m.l - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'nm-eixo' }, pct(v, 1))); });
  itens.forEach((x, i) => {
    const larg = Math.min(34, bw * 0.56), cx = m.l + bw * i + bw / 2;
    const acima = media != null && x.qptr >= media;
    const grupo = s('g', {}, s('title', {}, `${x.nome}: ${pct(x.qptr)}`));
    grupo.append(s('rect', { x: cx - larg / 2, y: y(x.qptr), width: larg, height: Math.max(1, y(0) - y(x.qptr)), rx: 4, class: acima ? 'nm-col forte' : 'nm-col' }));
    grupo.append(s('text', { x: cx, y: y(x.qptr) - 5, 'text-anchor': 'middle', class: 'nm-valor' }, pct(x.qptr, 2)));
    grupo.append(s('text', { x: cx, y: H - 10, 'text-anchor': 'middle', class: 'nm-eixo' }, (x.nome || '').replace('Thumbnail ', 'T')));
    g.append(grupo);
  });
  if (media != null) {
    g.append(s('line', { x1: m.l, x2: W - m.r, y1: y(media), y2: y(media), class: 'nm-media' }));
  }
  return h('div', {}, g, h('div', { class: 'nm-legenda' },
    h('span', {}, h('i', { class: 'nm-leg-agora' }), 'Na média ou acima'), h('span', {}, h('i', { class: 'nm-leg-antes' }), 'Abaixo da média'),
    media != null ? h('span', {}, h('i', { class: 'nm-leg-media' }), `Média do jogo: ${pct(media)}`) : null));
}

function folhaSemanas(snaps, atualIdx) {
  abrirFolha({
    titulo: 'Escolha a semana',
    conteudo: fechar => h('div', { class: 'nm-semanas' }, [...snaps.keys()].reverse().map(i => {
      const sn = snaps[i];
      const total = sn.total?.impressoes ?? (sn.itens || []).reduce((a, b) => a + (b.impressoes || 0), 0);
      return h('button', { type: 'button', class: `nm-semana${i === atualIdx ? ' ativa' : ''}`, onclick: () => { ctx.estado.sub.numerosSemana = i; fechar(); ctx.render?.(); } },
        h('span', { class: 'nm-semana-icone' }, icone('calendario', { tamanho: 20 })),
        h('span', { class: 'nm-semana-txt' }, h('strong', {}, rotuloSemana(sn.periodo)), h('span', {}, `${compacto(total)} vezes vista · ${sn.itens?.length || 0} thumbnails`)),
        i === atualIdx ? icone('ok', { tamanho: 20 }) : icone('direita', { tamanho: 18 }));
    })),
  });
}

function telaThumbnails() {
  const t = dados().thumbnails;
  const snaps = t?.snapshots || [];
  if (!snaps.length) return vazio('Ainda não há números de thumbnails. Eles chegam com a leitura do Creator Hub.', 'thumbnail');
  const sub = ctx.estado.sub;
  const idx = Number.isInteger(sub.numerosSemana) && snaps[sub.numerosSemana] ? sub.numerosSemana : snaps.length - 1;
  const snap = snaps[idx];
  const anterior = idx > 0 ? snaps[idx - 1] : null;
  const A = analisar(snap);
  const total = snap.total?.impressoes || A.itens.reduce((a, b) => a + (b.impressoes || 0), 0);
  const totalAnt = anterior ? (anterior.total?.impressoes || anterior.itens.reduce((a, b) => a + (b.impressoes || 0), 0)) : null;
  const jogTotal = A.itens.reduce((a, b) => a + jog(b), 0);
  const jogAnt = anterior ? anterior.itens.reduce((a, b) => a + jog(b), 0) : null;
  const temPrevias = A.itens.some(x => x.previa);
  const galeria = (dados().jogo?.imagensDaPagina || []).filter(i => /^https:\/\/|^\//.test(i.url || ''));
  const melhor = A.ranking[0];

  const seletor = h('button', { type: 'button', class: 'nm-seletor', onclick: () => folhaSemanas(snaps, idx), 'aria-label': 'Escolher outra semana' },
    icone('calendario', { tamanho: 20 }),
    h('span', {}, h('span', { class: 'nm-sobre' }, idx === snaps.length - 1 ? 'Semana mais recente' : 'Semana anterior'), h('strong', {}, rotuloSemana(snap.periodo))),
    snaps.length > 1 ? h('span', { class: 'nm-seletor-trocar' }, 'Trocar', icone('direita', { tamanho: 16 })) : null);

  return h('div', { class: 'nm-pilha' },
    seletor,
    // Destaque: a melhor da semana
    melhor ? h('button', { type: 'button', class: 'nm-campea', onclick: () => folhaThumb(melhor, 1, A, total) },
      miniaturaThumb(melhor, 1, 'nm-midia-campea'),
      h('span', { class: 'nm-campea-faixa' }, icone('trofeu', { tamanho: 18 }), 'Mais jogadores da semana'),
      h('span', { class: 'nm-campea-info' },
        h('span', { class: 'nm-campea-nome' }, melhor.nome, seloSituacao(melhor, A)),
        h('span', { class: 'nm-campea-num' }, h('strong', {}, num(jog(melhor))), ' jogadores'),
        h('span', { class: 'nm-fraco' }, `Vista ${compacto(melhor.impressoes)} vezes · taxa ${pct(melhor.qptr)}`))) : null,
    // Totais da semana
    h('div', { class: 'nm-tiles nm-tiles-3' },
      h('div', { class: 'nm-tile' }, icone('olho', { tamanho: 18 }), h('strong', {}, compacto(total)), h('span', {}, 'vezes vista'), anterior ? variacao(totalAnt, total) : null),
      h('div', { class: 'nm-tile' }, icone('jogadores', { tamanho: 18 }), h('strong', {}, compacto(jogTotal)), h('span', {}, 'jogadores'), anterior ? variacao(jogAnt, jogTotal) : null),
      h('div', { class: 'nm-tile' }, icone('alvo', { tamanho: 18 }), h('strong', {}, snap.total?.qptr != null ? pct(snap.total.qptr) : total ? pct(jogTotal / total) : '—'), h('span', {}, 'taxa geral'))),
    // Ranking com miniaturas grandes
    h('section', { class: 'nm-card' },
      tituloCard('trofeu', 'Ranking da semana', h('button', { type: 'button', class: 'nm-ajuda', 'aria-label': 'O que é PROTEGIDA', onclick: () => folhaTexto('O que é PROTEGIDA', 'PROTEGIDA quer dizer que a imagem está entre as melhores e não será trocada. As outras só são trocadas com a sua aprovação.\n\nO ranking conta quantos jogadores cada thumbnail trouxe (pessoas que viram a imagem na Página Inicial e entraram no jogo).') }, icone('escudo', { tamanho: 16 }), 'O que é?')),
      h('ol', { class: 'nm-ranking' }, A.ranking.map((x, i) => h('li', {},
        h('button', { type: 'button', class: `nm-rank${A.protegidas.has(x.id) ? ' protegida' : ''}`, onclick: () => folhaThumb(x, i + 1, A, total) },
          h('span', { class: 'nm-rank-midia' }, miniaturaThumb(x, i + 1), h('span', { class: `nm-pos p${i + 1}` }, `${i + 1}º`)),
          h('span', { class: 'nm-rank-info' },
            h('span', { class: 'nm-rank-nome' }, x.nome),
            seloSituacao(x, A),
            h('span', { class: 'nm-rank-num' }, h('strong', {}, compacto(jog(x))), ' jogadores'),
            h('span', { class: 'nm-fraco' }, `${pct(x.qptr)} · ${compacto(x.impressoes)} vistas`))))))),
    !temPrevias ? h('section', { class: 'nm-card' },
      tituloCard('imagem', 'Imagens do jogo'),
      galeria.length ? h('div', { class: 'nm-galeria' }, galeria.slice(0, 10).map(i => h('div', { class: 'nm-midia nm-midia-thumb' }, h('div', { class: 'nm-midia-reserva' }, icone('imagem', { tamanho: 24 })), h('img', { class: 'nm-img', src: i.url, alt: 'Imagem da página do jogo', loading: 'lazy', referrerpolicy: 'no-referrer' })))) : null,
      h('p', { class: 'nm-nota' }, icone('relogio', { tamanho: 16 }), 'As 5 imagens da personalização chegam na próxima leitura do Creator Hub. ', galeria.length ? 'Por enquanto, estas são as imagens públicas da página do jogo.' : '')) : null,
    // Gráficos
    h('section', { class: 'nm-card' },
      tituloCard('olho', 'Quantas vezes cada uma foi vista'),
      barrasHtml([...A.itens].sort((a, b) => b.impressoes - a.impressoes).map((x, i) => ({ rotulo: x.nome, valor: x.impressoes, item: x, destaque: i === 0, extra: total ? pct(x.impressoes / total, 1) : null })), { formato: compacto, miniaturas: temPrevias })),
    h('section', { class: 'nm-card' },
      tituloCard('alvo', 'Taxa de jogadas', h('button', { type: 'button', class: 'nm-ajuda', onclick: () => folhaTexto('Taxa de jogadas', 'De cada 100 pessoas que viram a imagem, quantas entraram no jogo. Barra mais alta é melhor.\n\nA linha tracejada é a média do jogo. Barras roxas fortes estão na média ou acima.') }, icone('lampada', { tamanho: 16 }), 'Entenda')),
      colunasTaxa(A.itens, A.qptrGeral ?? (total ? jogTotal / total : null))),
    (snap.pendencias || []).length ? botaoFolha('alerta', 'Ainda falta receber', `${snap.pendencias.length} ${snap.pendencias.length === 1 ? 'item' : 'itens'} do Creator Hub`, () => folhaLista('Ainda falta receber', snap.pendencias), 'warn') : null,
    h('p', { class: 'nm-fonte' }, icone('noticia', { tamanho: 14 }), `Fonte: ${snap.fonte || '—'} · ${dataHora(snap.coletadoEm)}`));
}

// ------------------------------------------------------------------ relatório semanal
const cacheRelatorio = new Map(); // arquivo -> relatório (lido uma vez por sessão)

function linhaJogadores() {
  const hist = (dados().jogo?.historico || []).filter(x => Number.isFinite(x.jogando) && x.em);
  const limite = Date.now() - 7 * 86400_000;
  const pts = hist.filter(x => new Date(x.em).getTime() >= limite).sort((a, b) => new Date(a.em) - new Date(b.em));
  if (pts.length < 2) {
    const ult = pts.at(-1) || hist.at(-1);
    return h('div', { class: 'nm-linha-vazia' },
      h('div', { class: 'nm-tile destaque' }, h('span', { class: 'nm-ao-vivo', 'aria-hidden': 'true' }), h('strong', {}, ult ? num(ult.jogando) : '—'), h('span', {}, ult ? `jogando em ${dataHora(ult.em)}` : 'sem leitura')),
      h('p', { class: 'nm-nota' }, icone('relogio', { tamanho: 16 }), 'O gráfico da semana aparece quando houver mais leituras do jogo.'));
  }
  const W = 360, H = 170, m = { l: 36, r: 10, t: 18, b: 26 };
  const t0 = new Date(pts[0].em).getTime(), t1 = new Date(pts.at(-1).em).getTime() || t0 + 1;
  const maxV = Math.max(...pts.map(p => p.jogando)) * 1.1 || 1;
  const x = t => m.l + (W - m.l - m.r) * ((t - t0) / Math.max(1, t1 - t0));
  const y = v => m.t + (H - m.t - m.b) * (1 - v / maxV);
  const coords = pts.map(p => [x(new Date(p.em).getTime()), y(p.jogando)]);
  const caminho = coords.map(([a, b], i) => `${i ? 'L' : 'M'}${a.toFixed(1)},${b.toFixed(1)}`).join(' ');
  const area = `${caminho} L${coords.at(-1)[0].toFixed(1)},${y(0)} L${coords[0][0].toFixed(1)},${y(0)} Z`;
  const pico = pts.reduce((a, b) => (b.jogando > a.jogando ? b : a));
  const g = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'nm-svg', role: 'img', 'aria-label': `Jogadores online nos últimos 7 dias. Pico de ${num(pico.jogando)} em ${dataHora(pico.em)}.` },
    s('defs', {}, s('linearGradient', { id: 'nm-grad-linha', x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: '0', class: 'nm-grad-a' }), s('stop', { offset: '1', class: 'nm-grad-b' }))));
  [0, 0.5, 1].forEach(f => { const v = (maxV / 1.1) * f; g.append(s('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: 'nm-grade' }), s('text', { x: m.l - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'nm-eixo' }, compacto(Math.round(v)))); });
  g.append(s('path', { d: area, fill: 'url(#nm-grad-linha)' }), s('path', { d: caminho, class: 'nm-linha' }));
  const [px, py] = coords[pts.indexOf(pico)];
  const [ux, uy] = coords.at(-1);
  g.append(s('circle', { cx: px, cy: py, r: 4.5, class: 'nm-ponto' }), s('text', { x: Math.min(W - m.r, Math.max(m.l + 20, px)), y: py - 8, 'text-anchor': 'middle', class: 'nm-valor' }, `pico ${num(pico.jogando)}`));
  g.append(s('circle', { cx: ux, cy: uy, r: 4.5, class: 'nm-ponto agora' }));
  g.append(s('text', { x: m.l, y: H - 6, class: 'nm-eixo' }, dataCurta(pts[0].em)), s('text', { x: W - m.r, y: H - 6, 'text-anchor': 'end', class: 'nm-eixo' }, dataCurta(pts.at(-1).em)));
  return h('div', {}, g, h('div', { class: 'nm-legenda' }, h('span', {}, h('i', { class: 'nm-leg-ponto' }), `Agora: ${num(pts.at(-1).jogando)}`), h('span', {}, `Pico: ${num(pico.jogando)} em ${dataHora(pico.em)}`)));
}

const INDICADORES = [
  ['impressoes', 'Vezes vista', 'olho', compacto, false],
  ['jogadasQualificadas', 'Jogadores', 'jogadores', compacto, false],
  ['qptr', 'Taxa de jogadas', 'alvo', v => pct(v), true],
  ['tempoMedioSessaoMin', 'Tempo médio', 'relogio', v => (v == null ? '—' : `${String(v).replace('.', ',')} min`), false],
];

/** Compara a semana do relatório com a anterior (dados.metricas.periodos; reserva: indicadores do relatório). */
function comparacaoSemanas(r) {
  const periodos = dados().metricas?.periodos || [];
  let i = periodos.findIndex(p => p.fim === r.periodo?.fim);
  if (i < 0) i = periodos.length - 1;
  const atual = periodos[i]?.indicadores || {};
  const ant = i > 0 ? periodos[i - 1]?.indicadores || {} : {};
  const doRel = Object.fromEntries((r.indicadores || []).map(x => [x.chave, x]));
  const linhas = INDICADORES.map(([chave, nome, ic, fmt, taxa]) => {
    const agora = atual[chave] ?? doRel[chave]?.atual ?? null;
    const antes = ant[chave] ?? doRel[chave]?.anterior ?? null;
    return { chave, nome, ic, fmt, taxa, agora, antes };
  }).filter(l => l.agora != null || l.antes != null);
  const temAnterior = linhas.some(l => l.antes != null);
  return h('div', { class: 'nm-comparacao' },
    h('div', { class: 'nm-legenda' }, h('span', {}, h('i', { class: 'nm-leg-antes' }), 'Semana anterior'), h('span', {}, h('i', { class: 'nm-leg-agora' }), 'Esta semana')),
    linhas.map(l => {
      const max = Math.max(l.agora || 0, l.antes || 0) || 1;
      return h('div', { class: 'nm-comp' },
        h('div', { class: 'nm-comp-topo' }, h('span', { class: 'nm-comp-nome' }, icone(l.ic, { tamanho: 16 }), l.nome), h('strong', {}, l.fmt(l.agora)), variacao(l.antes, l.agora, l.taxa)),
        h('div', { class: 'nm-comp-barras' },
          h('div', { class: 'nm-barra-trilho fino', title: `Semana anterior: ${l.fmt(l.antes)}` }, l.antes != null ? h('span', { class: 'nm-barra-cheia antes', style: { width: `${(100 * l.antes) / max}%` } }) : null),
          h('div', { class: 'nm-barra-trilho fino', title: `Esta semana: ${l.fmt(l.agora)}` }, h('span', { class: 'nm-barra-cheia forte', style: { width: `${(100 * (l.agora || 0)) / max}%` } }))));
    }),
    temAnterior ? null : h('p', { class: 'nm-nota' }, icone('relogio', { tamanho: 16 }), 'Ainda não há semana anterior para comparar. A comparação aparece na próxima leitura.'));
}

function graficoThumbsRelatorio(r) {
  const itens = (r.thumbnails || []).map(t => ({ ...t, jogadas: jog(t) }));
  if (!itens.length) return null;
  const sub = ctx.estado.sub;
  const modo = sub.numerosRelThumb === 'jogadas' ? 'jogadas' : 'impressoes';
  const caixa = h('div');
  const desenhar = m => {
    sub.numerosRelThumb = m;
    const ord = [...itens].sort((a, b) => (m === 'jogadas' ? b.jogadas - a.jogadas : b.impressoes - a.impressoes));
    caixa.replaceChildren(
      h('div', { class: 'nm-alternar', role: 'tablist' },
        h('button', { type: 'button', role: 'tab', 'aria-selected': String(m === 'impressoes'), onclick: () => desenhar('impressoes') }, 'Vezes vista'),
        h('button', { type: 'button', role: 'tab', 'aria-selected': String(m === 'jogadas'), onclick: () => desenhar('jogadas') }, 'Jogadores')),
      barrasHtml(ord.map((t, i) => ({ rotulo: t.nome, valor: m === 'jogadas' ? t.jogadas : t.impressoes, item: t, destaque: i === 0, extra: t.recomendacao ? (FRASES[t.recomendacao]?.[0] || '') : null })), { formato: compacto, miniaturas: true }));
  };
  desenhar(modo);
  return caixa;
}

function folhaRelatorios(indice, atualArquivo) {
  abrirFolha({
    titulo: 'Escolha o relatório',
    conteudo: fechar => h('div', { class: 'nm-semanas' }, [...indice].reverse().map(r => h('button', {
      type: 'button', class: `nm-semana${r.arquivo === atualArquivo ? ' ativa' : ''}`,
      onclick: async () => {
        try {
          if (!cacheRelatorio.has(r.arquivo)) cacheRelatorio.set(r.arquivo, await ctx.api(`/api/relatorio?arquivo=${encodeURIComponent(r.arquivo)}`));
          ctx.estado.sub.numerosRelatorio = r.arquivo; fechar(); ctx.render?.();
        } catch (e) { ctx.avisar?.(e.message, true); }
      },
    },
    h('span', { class: 'nm-semana-icone' }, icone('noticia', { tamanho: 20 })),
    h('span', { class: 'nm-semana-txt' }, h('strong', {}, `Relatório de ${dataCurta(r.data)}`), h('span', {}, `${r.tipo || 'semanal'}${r.completo ? '' : ' · incompleto'}`)),
    r.arquivo === atualArquivo ? icone('ok', { tamanho: 20 }) : icone('direita', { tamanho: 18 })))),
  });
}

function telaRelatorio() {
  const indice = dados().relatorios_indice?.relatorios || [];
  const pedido = ctx.estado.sub.numerosRelatorio;
  const ultimo = indice.at(-1)?.arquivo;
  if (ultimo && dados().relatorioAtual && !cacheRelatorio.has(ultimo)) cacheRelatorio.set(ultimo, dados().relatorioAtual);
  const arquivo = pedido && cacheRelatorio.has(pedido) ? pedido : ultimo;
  const r = (arquivo && cacheRelatorio.get(arquivo)) || dados().relatorioAtual;
  if (!r) return vazio('Nenhum relatório gerado ainda. O primeiro sai depois de uma semana de números.', 'noticia');
  const meta = dados().metricas?.meta?.impressoes7dias;
  const impressoes = (r.indicadores || []).find(i => i.chave === 'impressoes')?.atual;
  const progressoMeta = meta && impressoes ? Math.min(1, impressoes / meta) : null;
  const res = r.resumo || {};
  const cardResumo = (ic, titulo, texto, tom = '') => h('button', { type: 'button', class: `nm-resumo ${tom}`, onclick: () => folhaTexto(titulo, texto || '—') },
    h('span', { class: 'nm-mini-icone' }, icone(ic, { tamanho: 20 })), h('span', { class: 'nm-mini-titulo' }, titulo), h('span', { class: 'nm-resumo-txt' }, curto(texto || '—', 90)));
  const contador = (ic, n, rotulo, tom, itens) => h('button', { type: 'button', class: `nm-contador ${tom}`, onclick: () => folhaLista(rotulo, itens) },
    icone(ic, { tamanho: 20 }), h('strong', {}, String(itens.length)), h('span', {}, rotulo));

  return h('div', { class: 'nm-pilha' },
    h('button', { type: 'button', class: 'nm-seletor', onclick: () => folhaRelatorios(indice, arquivo), disabled: indice.length < 2 ? null : null },
      icone('noticia', { tamanho: 20 }),
      h('span', {}, h('span', { class: 'nm-sobre' }, r.preliminar ? 'Relatório preliminar' : 'Relatório semanal'), h('strong', {}, rotuloSemana(r.periodo))),
      h('span', { class: 'nm-seletor-trocar' }, indice.length > 1 ? 'Trocar' : 'Detalhes', icone('direita', { tamanho: 16 }))),
    h('div', { class: 'nm-linha-chips' },
      r.completo ? chip('Completo', { tom: 'ok', iconeNome: 'ok' }) : chip('Incompleto', { tom: 'warn', iconeNome: 'alerta' }),
      r.preliminar ? chip('Primeira leitura (1 dia)', { tom: 'curiosidade', iconeNome: 'relogio' }) : null,
      chip(`Feito ${dataCurta(r.geradoEm)}`, { iconeNome: 'calendario' })),
    !r.completo && (r.faltando || []).length ? botaoFolha('alerta', 'O que faltou neste relatório', `${r.faltando.length} ${r.faltando.length === 1 ? 'item' : 'itens'} sem dados`, () => folhaLista('O que faltou', r.faltando), 'warn') : null,

    // Prioridade em destaque
    r.diagnostico?.acaoPrioritaria ? h('section', { class: 'nm-prioridade' },
      h('span', { class: 'nm-prioridade-icone' }, icone('alvo', { tamanho: 24 })),
      h('div', {}, h('span', { class: 'nm-sobre' }, 'Fazer primeiro'), h('p', {}, r.diagnostico.acaoPrioritaria))) : null,

    progressoMeta != null ? h('section', { class: 'nm-card' },
      tituloCard('trofeu', 'Meta de vezes vista (7 dias)'),
      h('div', { class: 'nm-meta-num' }, h('strong', {}, compacto(impressoes)), h('span', {}, ` de ${compacto(meta)}`), h('span', { class: 'nm-meta-pct' }, pct(progressoMeta, 0))),
      h('div', { class: 'nm-barra-trilho grosso', role: 'progressbar', 'aria-valuenow': Math.round(progressoMeta * 100), 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('span', { class: 'nm-barra-cheia forte', style: { width: `${progressoMeta * 100}%` } })),
      h('p', { class: 'nm-fraco' }, dados().metricas?.meta?.descricao || '')) : null,

    h('div', { class: 'nm-grade-resumo' },
      cardResumo('grafico', 'Como está', res.tendencia),
      cardResumo('lampada', 'O que descobrimos', res.descoberta),
      cardResumo('alerta', 'Maior risco', res.maiorRisco, 'cuidado'),
      cardResumo('decisoes', 'Prioridade', res.prioridade)),

    h('section', { class: 'nm-card' }, tituloCard('numeros', 'Esta semana x semana anterior'), comparacaoSemanas(r)),
    h('section', { class: 'nm-card' }, tituloCard('jogadores', 'Jogadores online na semana'), linhaJogadores()),
    (r.thumbnails || []).length ? h('section', { class: 'nm-card' }, tituloCard('thumbnail', 'Thumbnails no relatório'), graficoThumbsRelatorio(r)) : null,

    h('div', { class: 'nm-contadores' },
      contador('ok', 0, 'Deu certo', 'ok', r.deuCerto || []),
      contador('fechar', 0, 'Não deu certo', 'bad', r.naoDeuCerto || []),
      contador('relogio', 0, 'Ainda incerto', 'warn', r.incertezas || [])),

    h('div', { class: 'nm-pilha-mini' },
      botaoFolha('martelo', 'O que mudou no jogo', (r.atualizado || []).length ? `${r.atualizado.length} atualização(ões)` : curto(r.observacoesAtualizacao || 'Nada publicado', 60),
        () => folhaLista('O que mudou no jogo', (r.atualizado || []).length ? r.atualizado.map(a => `${a.versao}: ${(a.propostas || []).join(', ')}`) : [r.observacoesAtualizacao || 'Nada publicado.'])),
      botaoFolha('fogo', 'Tendências da semana', `${(r.tendencias || []).length} ideias de fora`,
        () => folhaLista('Tendências da semana', (r.tendencias || []).map(t => h('div', {}, h('strong', {}, t.nome), h('div', { class: 'nm-fraco' }, t.adaptacao || ''))))),
      botaoFolha('chat', 'Discord', r.discordAcesso ? `${(r.discord || []).length} sugestões` : 'Sem acesso ao servidor',
        () => folhaLista('Discord', (r.discord || []).map(d => h('div', {}, h('strong', {}, d.resumo), h('div', { class: 'nm-fraco' }, d.triagem || ''))), 'Nenhuma sugestão.')),
      (r.diagnostico?.experimentos || []).length ? botaoFolha('pesquisa', 'Experimentos', `${r.diagnostico.experimentos.length} em andamento`,
        () => folhaLista('Experimentos', r.diagnostico.experimentos.map(e => h('div', {}, h('strong', {}, e.nome), h('div', { class: 'nm-fraco' }, e.decisao))))) : null),

    (r.proximaAtualizacao || []).length ? h('section', { class: 'nm-card' },
      tituloCard('foguete', 'Próxima atualização proposta'),
      h('div', { class: 'nm-proximas' }, r.proximaAtualizacao.map(p => h('button', { type: 'button', class: 'nm-proxima', onclick: () => ctx.irPara?.('decisoes') },
        h('span', { class: 'nm-proxima-id' }, p.id), h('span', { class: 'nm-proxima-tit' }, curto(p.titulo, 70)), icone('direita', { tamanho: 16 })))),
      r.avisoAprovacao ? h('p', { class: 'nm-nota' }, icone('escudo', { tamanho: 16 }), curto(r.avisoAprovacao, 140)) : null) : null,
    r.diagnostico?.meta ? h('p', { class: 'nm-fonte' }, icone('noticia', { tamanho: 14 }), r.diagnostico.meta) : null);
}

// ------------------------------------------------------------------ tela
export function telaNumeros() {
  if (!ctx.estado?.dados) return vazio('Carregando…', 'relogio');
  ctx.estado.sub = ctx.estado.sub || {};
  const [aba, seg] = segmentos('numeros', [['thumbs', 'Thumbnails', 'thumbnail'], ['relatorio', 'Relatório da semana', 'noticia']]);
  return h('div', { class: 'tela-numeros' },
    blocoJogoAgora(),
    seg,
    aba === 'thumbs' ? telaThumbnails() : telaRelatorio());
}
