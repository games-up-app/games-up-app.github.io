// Tela Pesquisa: o que está em alta, sugestões do Discord e jogos de escola para acompanhar.
// Tudo em cards com miniatura; detalhes abrem numa folha de baixo para cima.
import { h, icone, chip, abrirFolha } from '../ui/componentes.js?v=20261026-automacao1';
import { ctx } from '../ui/contexto.js?v=20261026-automacao1';
import {
  num, pct, compacto, dataBR, haQuanto, textoCurto, linkSeguro, botaoLink, imagemExterna, miniaturaIcone,
  cabecalhoSecao, segmentado, filtrosChips, campo, blocoNumero, miniGrafico, chipTendencia, cardClicavel, semEmoji,
} from './comum.js?v=20261026-automacao1';

const d = () => ctx.estado.dados || {};

// Categoria da tendência -> ícone e cor da miniatura.
function visualCategoria(cat) {
  const c = String(cat || '').toLowerCase();
  if (/roblox/.test(c)) return ['roblox', 'roxo'];
  if (/youtube|video|vídeo/.test(c)) return ['play', 'vermelho'];
  if (/tiktok|som|music/.test(c)) return ['musica', 'rosa'];
  if (/insta/.test(c)) return ['camera', 'laranja'];
  if (/thumb|capa|imagem/.test(c)) return ['thumbnail', 'azul'];
  if (/evento|sazonal/.test(c)) return ['evento', 'amarelo'];
  if (/escola|educa/.test(c)) return ['escola', 'verde'];
  if (/mec|gameplay|jogo/.test(c)) return ['gameplay', 'azul'];
  return ['grafico', 'roxo'];
}
const nomeCategoria = c => ({ roblox: 'Roblox', video: 'Vídeos', youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram' }[String(c || '').toLowerCase()] || c || 'Geral');
function miniatura(item, classe = 'mini') {
  const [ic, tom] = visualCategoria(item.categoria);
  const reserva = miniaturaIcone(ic, tom, classe);
  return imagemExterna(item.imagem, { alt: '', classe, reserva }) || reserva;
}
const chipDificuldade = dif => {
  const x = String(dif || '').toLowerCase();
  if (!x) return null;
  return chip(`Dificuldade ${x}`, { tom: /baixa|fácil|facil/.test(x) ? 'ok' : /alta|difícil|dificil/.test(x) ? 'bad' : 'warn', iconeNome: 'martelo' });
};

// ------------------------------------------------------------------ em alta
function folhaTendencia(i) {
  abrirFolha({
    titulo: semEmoji(i.nome),
    conteudo: h('div', { class: 'folha-tendencia' },
      h('div', { class: 'folha-cabeca' }, miniatura(i, 'mini grande'), h('div', { class: 'chips-linha' }, chip(nomeCategoria(i.categoria), { tom: 'relevante', iconeNome: visualCategoria(i.categoria)[0] }), chipDificuldade(i.dificuldade))),
      campo('olho', 'O que vimos', i.evidencia),
      campo('alvo', 'Por que importa', i.relevancia),
      i.adaptacao ? h('div', { class: 'ideia' }, h('span', { class: 'ideia-icone' }, icone('lampada', { tamanho: 22 })), h('div', {}, h('strong', {}, 'Como usar no nosso jogo'), h('p', {}, i.adaptacao))) : null,
      campo('grafico', 'O que esperamos ganhar', i.hipoteseImpacto),
      campo('alerta', 'O que pode dar errado', i.riscos),
      campo('martelo', 'Dificuldade', i.dificuldade),
      (i.fontes || []).length ? [h('h3', { class: 'folha-subtitulo' }, icone('globo', { tamanho: 18 }), `Fontes (${i.fontes.length})`),
        h('div', { class: 'lista-fontes' }, i.fontes.map(f => h('div', { class: 'fonte' }, icone('externo', { tamanho: 16 }), h('span', {}, linkSeguro(f.url, f.titulo), f.data ? h('small', {}, ` · ${dataBR(f.data)}`) : null))))] : null),
  });
}

function emAlta() {
  const semanas = d().tendencias?.semanas || [];
  if (!semanas.length) return h('div', { class: 'card vazio-card' }, miniaturaIcone('grafico', 'roxo'), h('p', {}, 'A pesquisa da semana sai toda segunda às 09:30.'));
  const f = ctx.estado.filtros;
  const cats = [...new Set(semanas.flatMap(s => (s.itens || []).map(i => i.categoria)).filter(Boolean))];
  const cat = f.tendCat || 'todas';
  const fontes = d().config?.fontesTendencias || [];
  return h('div', {},
    cats.length > 1 ? filtrosChips([['todas', 'Todas'], ...cats.map(c => [c, nomeCategoria(c), visualCategoria(c)[0]])], cat, v => { f.tendCat = v; ctx.render(); }, 'Categoria') : null,
    [...semanas].reverse().map(sem => {
      const itens = (sem.itens || []).filter(i => cat === 'todas' || i.categoria === cat);
      if (!itens.length) return null;
      return h('section', { class: 'bloco-semana' },
        cabecalhoSecao('calendario', `Semana de ${dataBR(sem.semana)}`, h('span', { class: 'sinc' }, `${itens.length} ${itens.length === 1 ? 'ideia' : 'ideias'}`)),
        h('div', { class: 'lista-cards' }, itens.map(i => cardClicavel('card-item', () => folhaTendencia(i), `Abrir: ${i.nome}`,
          miniatura(i),
          h('div', { class: 'item-texto' },
            h('strong', {}, semEmoji(i.nome)),
            h('span', { class: 'sinc' }, textoCurto(i.adaptacao || i.relevancia, 90)),
            h('div', { class: 'chips-linha' }, chip(nomeCategoria(i.categoria), { iconeNome: visualCategoria(i.categoria)[0] }), chipDificuldade(i.dificuldade))),
          icone('direita', { tamanho: 20, classe: 'item-seta' })))));
    }),
    fontes.length ? h('button', { type: 'button', class: 'card card-botao card-atalho', onclick: () => abrirFolha({ titulo: 'Onde pesquisamos', conteudo: h('div', {}, fontes.map(fo => campo(fo.tipo === 'video' ? 'play' : 'roblox', fo.nome, fo.oQueObservar))) }) },
      h('span', { class: 'resumo-icone tom-azul' }, icone('globo', { tamanho: 22 })),
      h('span', { class: 'atalho-texto' }, h('strong', {}, 'Onde pesquisamos'), h('span', {}, `${fontes.length} fontes toda segunda`)),
      icone('direita', { tamanho: 20 })) : null);
}

// ------------------------------------------------------------------ discord
function folhaDiscord(x) {
  abrirFolha({
    titulo: 'Sugestão do Discord',
    conteudo: h('div', {},
      h('h3', { class: 'noticia-titulo-folha' }, x.resumo),
      h('div', { class: 'chips-linha' }, x.confirmado ? chip('Confirmada', { tom: 'ok', iconeNome: 'ok' }) : chip('Não confirmada', { tom: 'warn', iconeNome: 'alerta' }), x.data ? chip(dataBR(x.data), { iconeNome: 'calendario' }) : null),
      h('div', { class: 'grade-numeros' }, blocoNumero('like', num(x.votos), 'votos'), blocoNumero('chat', num(x.comentarios), 'comentários')),
      campo('gameplay', 'Jogo', x.jogo),
      campo('decisoes', 'O que fizemos com ela', x.triagem),
      campo('martelo', 'Dá para fazer?', x.viabilidade),
      campo('escudo', 'Moderação', x.statusModeracao)),
    rodape: botaoLink(x.link, 'Abrir no Discord', { classe: 'btn primario grande', iconeNome: 'chat' }),
  });
}

function discord() {
  const dc = d().discord || {};
  const f = ctx.estado.filtros;
  const so = f.discordSo || 'nosso';
  const todas = dc.sugestoes || [];
  const lista = todas.filter(x => so === 'todas' || (x.relacionada !== false && !/outro/i.test(x.jogo || '')));
  return h('div', {},
    h('div', { class: `card linha-status-card ${dc.acesso ? 'ok' : 'warn'}` },
      h('span', { class: `resumo-icone tom-${dc.acesso ? 'verde' : 'amarelo'}` }, icone('chat', { tamanho: 22 })),
      h('span', { class: 'atalho-texto' }, h('strong', {}, dc.acesso ? 'Discord conectado' : 'Sem acesso ao Discord'), h('span', {}, dc.ultimaLeitura ? `Última leitura ${haQuanto(dc.ultimaLeitura)}` : 'Ainda sem leitura')),
      dc.observacao ? h('button', { type: 'button', class: 'btn-icone', 'aria-label': 'Saber mais', onclick: () => abrirFolha({ titulo: 'Sobre o Discord', conteudo: h('div', {}, campo('lampada', 'Observação', dc.observacao), campo('escudo', 'Regra', 'Votos mostram interesse, mas sozinhos não decidem o que entra no jogo. Uma sugestão rejeitada só volta com motivo novo e com a sua permissão.')) }) }, icone('lampada', { tamanho: 20 })) : null),
    filtrosChips([['nosso', 'Só Escola Brasileira', 'escola'], ['todas', `Todas (${todas.length})`, 'chat']], so, v => { f.discordSo = v; ctx.render(); }, 'Filtro do Discord'),
    lista.length ? h('div', { class: 'lista-cards' }, lista.map(x => cardClicavel('card-item', () => folhaDiscord(x), `Abrir sugestão: ${x.resumo}`,
      miniaturaIcone('chat', x.confirmado ? 'roxo' : 'cinza', 'mini'),
      h('div', { class: 'item-texto' },
        h('strong', {}, x.resumo),
        h('div', { class: 'item-numeros' }, h('span', {}, icone('like', { tamanho: 14 }), num(x.votos)), h('span', {}, icone('chat', { tamanho: 14 }), num(x.comentarios))),
        h('div', { class: 'chips-linha' }, x.confirmado ? chip('Confirmada', { tom: 'ok', iconeNome: 'ok' }) : chip('Não confirmada', { tom: 'warn', iconeNome: 'alerta' }))),
      icone('direita', { tamanho: 20, classe: 'item-seta' }))))
      : h('div', { class: 'card vazio-card' }, miniaturaIcone('chat', 'cinza'), h('p', {}, 'Nenhuma sugestão para mostrar.')));
}

// ------------------------------------------------------------------ jogos de escola
const ehParecido = j => (typeof j.parecido === 'boolean' ? j.parecido : /\b(rp|roleplay|role ?play)\b/i.test(j.nome || ''));
const ehPequeno = j => j.porte === 'pequeno' || (j.porte == null && Number(j.jogando) < 20000);

function iconeJogo(j, classe = 'mini') {
  const reserva = miniaturaIcone('escola', 'azul', classe);
  return imagemExterna(j.icone, { alt: '', classe, reserva }) || reserva;
}

function folhaJogo(j) {
  const hist = j.historico || [];
  const graf = miniGrafico(hist.map(x => x.jogando), { altura: 110, rotulo: `Jogadores de ${j.nome}` });
  const aprov = j.likes != null && j.dislikes != null && j.likes + j.dislikes > 0 ? j.likes / (j.likes + j.dislikes) : null;
  abrirFolha({
    titulo: semEmoji(j.nome),
    conteudo: h('div', { class: 'folha-jogo' },
      h('div', { class: 'folha-jogo-topo' }, iconeJogo(j, 'jogo-icone grande'),
        h('div', {}, h('strong', { class: 'folha-grande' }, num(j.jogando)), h('span', { class: 'sinc' }, 'jogando agora'), h('div', { class: 'chips-linha' }, chipTendencia(j.tendencia, j.variacao7d), ehPequeno(j) ? chip('Pequeno', { tom: 'curiosidade', iconeNome: 'alvo' }) : chip('Referência', { iconeNome: 'trofeu' }), ehParecido(j) ? chip('Parecido com o nosso', { tom: 'relevante', iconeNome: 'escola' }) : null))),
      h('div', { class: 'grade-numeros' },
        blocoNumero('olho', compacto(j.visitas), 'visitas'),
        blocoNumero('estrela', compacto(j.favoritos), 'favoritos'),
        blocoNumero('like', compacto(j.likes), 'gostei', 'ok'),
        blocoNumero('escudo', pct(aprov), 'aprovação'),
        blocoNumero('relogio', j.atualizadoNoRoblox ? dataBR(j.atualizadoNoRoblox) : '—', 'última atualização')),
      h('h3', { class: 'folha-subtitulo' }, icone('grafico', { tamanho: 18 }), 'Jogadores nos últimos dias'),
      graf ? h('div', { class: 'grafico-folha' }, graf) : h('p', { class: 'sinc' }, 'O gráfico aparece depois de alguns dias de leitura.'),
      hist.length ? h('div', { class: 'lista-mini' }, [...hist].reverse().slice(0, 7).map(x => h('div', { class: 'lista-mini-item' }, h('span', {}, dataBR(x.data)), h('strong', {}, `${num(x.jogando)} jogando`)))) : null),
    rodape: botaoLink(j.link, 'Ver na Roblox', { classe: 'btn primario grande', iconeNome: 'roblox' }),
  });
}

function cardJogoEscola(j) {
  const graf = miniGrafico((j.historico || []).map(x => x.jogando), { largura: 120, altura: 36, rotulo: 'Tendência de jogadores' });
  return cardClicavel(`card-escola${ehPequeno(j) ? ' pequeno' : ''}`, () => folhaJogo(j), `Abrir ${j.nome}`,
    h('div', { class: 'escola-topo' },
      iconeJogo(j),
      h('div', { class: 'item-texto' },
        h('strong', { class: 'escola-nome' }, semEmoji(j.nome)),
        h('div', { class: 'escola-jogando' }, icone('jogadores', { tamanho: 16 }), h('b', {}, num(j.jogando)), ' jogando'),
        h('div', { class: 'chips-linha' }, chipTendencia(j.tendencia, j.variacao7d), ehParecido(j) ? chip('Parecido', { tom: 'relevante', iconeNome: 'escola' }) : null))),
    h('div', { class: 'escola-rodape' },
      graf ? h('div', { class: 'escola-grafico' }, graf) : h('span', { class: 'sinc escola-visitas' }, icone('olho', { tamanho: 14 }), `${compacto(j.visitas)} visitas`),
      botaoLink(j.link, 'Ver na Roblox', { classe: 'btn pequeno', iconeNome: 'roblox' })));
}

function jogosEscola() {
  const c = d().concorrentes || {};
  const jogos = [...(c.jogos || [])].sort((a, b) => (b.jogando || 0) - (a.jogando || 0));
  if (!jogos.length) return h('div', { class: 'card vazio-card' }, miniaturaIcone('escola', 'azul'), h('p', {}, 'A lista de jogos de escola aparece depois da primeira leitura.'));
  const f = ctx.estado.filtros;
  const filtro = f.escolaFiltro || 'pequenos';
  const subindo = jogos.filter(j => j.tendencia === 'subindo').length;
  const lista = jogos.filter(j => filtro === 'todos' || (filtro === 'pequenos' && ehPequeno(j)) || (filtro === 'parecidos' && ehParecido(j)) || (filtro === 'referencia' && !ehPequeno(j)));
  const nosso = d().jogo?.atual?.jogando;
  return h('div', {},
    h('div', { class: 'card card-escolas-topo' },
      h('span', { class: 'resumo-icone tom-azul' }, icone('escola', { tamanho: 22 })),
      h('span', { class: 'atalho-texto' }, h('strong', {}, `${jogos.length} jogos de escola`), h('span', {}, `${jogos.filter(ehPequeno).length} pequenos · ${subindo} subindo${nosso != null ? ` · o nosso tem ${num(nosso)}` : ''}`)),
      c.atualizadoEm ? chip(haQuanto(c.atualizadoEm), { iconeNome: 'relogio' }) : null),
    filtrosChips([['pequenos', 'Pequenos', 'alvo'], ['parecidos', 'Parecidos com o nosso', 'escola'], ['referencia', 'Referência', 'trofeu'], ['todos', 'Todos']], filtro, v => { f.escolaFiltro = v; ctx.render(); }, 'Filtro de jogos'),
    filtro === 'pequenos' ? h('p', { class: 'dica-linha' }, icone('lampada', { tamanho: 16 }), 'Pequenos têm menos de 20 mil jogando: dá para comparar de perto com o nosso.') : null,
    lista.length ? h('div', { class: 'grade-escolas' }, lista.map(cardJogoEscola)) : h('div', { class: 'card vazio-card' }, miniaturaIcone('escola', 'cinza'), h('p', {}, 'Nenhum jogo com esse filtro.')));
}

// ------------------------------------------------------------------ tela
export function telaPesquisa() {
  const aba = ctx.estado.sub.pesquisa || 'alta';
  const n = (d().discord?.sugestoes || []).length;
  return h('div', { class: 'pagina-pesquisa' },
    segmentado([['alta', 'Em alta', 'grafico'], ['escolas', 'Jogos de escola', 'escola'], ['discord', `Discord${n ? ` (${n})` : ''}`, 'chat']], aba, v => { ctx.estado.sub.pesquisa = v; ctx.render(); }, { rotulo: 'Seções da pesquisa', classe: 'abas-topo' }),
    aba === 'discord' ? discord() : aba === 'escolas' ? jogosEscola() : emAlta());
}
