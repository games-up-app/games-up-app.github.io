// Tela Início: boas-vindas, jogo ao vivo, semana, notícia do dia, o que precisa de você e resumo.
// Subpágina "noticias" (estado.sub.inicio === 'noticias'): todas as notícias com filtros.
import { h, icone, chip, iconeDoTipo, abrirFolha } from '../ui/componentes.js?v=20261025-comunicacao3';
import { ctx } from '../ui/contexto.js?v=20261025-comunicacao3';
import { resumoAtualizacao, listarAvisos, novosAvisos, lerAvisosLidos, marcarAvisoLido, dataHoraBrasilia } from '../nucleo/central-avisos.js?v=20261025-comunicacao3';
import { avaliarPresenca } from '../nucleo/presenca.js?v=20261025-comunicacao3';
import {
  FUSO, num, pct, compacto, dataBR, horaBR, haQuanto, textoCurto, urlSegura, botaoLink, imagemExterna, miniaturaIcone,
  cabecalhoSecao, botaoTexto, topoSubpagina, filtrosChips, campo, blocoNumero, miniGrafico, chipStatus, cardClicavel, cardBotao,
} from './comum.js?v=20261025-comunicacao3';

const d = () => ctx.estado.dados || {};

// ------------------------------------------------------------------ datas no fuso de Brasília
const NOMES_DIA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const CURTOS_DIA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
function hojeYMD(agora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
}
function horaAgora() {
  const [hh, mm] = new Intl.DateTimeFormat('en-GB', { timeZone: FUSO, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()).split(':').map(Number);
  return { hh: hh % 24, mm };
}
/** Meio-dia de Brasília do dia ymd (evita erro de fuso ao somar dias). */
const meioDia = ymd => new Date(`${ymd}T12:00:00-03:00`);
const ymdDe = data => hojeYMD(data);
const diaSemana = ymd => meioDia(ymd).getUTCDay();
function somarDias(ymd, n) { return ymdDe(new Date(meioDia(ymd).getTime() + n * 86400000)); }
const diaNum = ymd => Number(ymd.slice(8, 10));
const dataLonga = ymd => meioDia(ymd).toLocaleDateString('pt-BR', { timeZone: FUSO, day: 'numeric', month: 'long' });

// ------------------------------------------------------------------ categorias da agenda
const CATEGORIAS = {
  pesquisa: { nome: 'Pesquisa', icone: 'pesquisa', tom: 'azul' },
  propostas: { nome: 'Propostas', icone: 'decisoes', tom: 'roxo' },
  desenvolvimento: { nome: 'Desenvolvimento', icone: 'martelo', tom: 'laranja' },
  autorizacao: { nome: 'Autorização', icone: 'assinatura', tom: 'amarelo' },
  publicacao: { nome: 'Publicação', icone: 'foguete', tom: 'verde' },
  relatorio: { nome: 'Relatório', icone: 'numeros', tom: 'azul' },
  monitoramento: { nome: 'Monitoramento', icone: 'olho', tom: 'cinza' },
  noticias: { nome: 'Notícias', icone: 'noticia', tom: 'rosa' },
};
const QUEM = {
  'Você': 'jogadores', Claude: 'raio', Codex: 'martelo', GitHub: 'relogio', 'Automático': 'relogio',
};
function categoriaPorTexto(t) {
  const x = t.toLowerCase();
  if (/autoriza/.test(x)) return 'autorizacao';
  if (/propost/.test(x)) return 'propostas';
  if (/desenvolv/.test(x)) return 'desenvolvimento';
  if (/public/.test(x)) return 'publicacao';
  if (/relat/.test(x)) return 'relatorio';
  if (/pesquis/.test(x)) return 'pesquisa';
  if (/not[ií]cia/.test(x)) return 'noticias';
  return 'monitoramento';
}
function quemPorTexto(t) {
  if (/propriet/i.test(t)) return 'Você';
  if (/claude/i.test(t)) return 'Claude';
  if (/codex/i.test(t)) return 'Codex';
  if (/github/i.test(t)) return 'GitHub';
  return 'Automático';
}
const semAcento = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const DIAS_TEXTO = [['domingo', 0], ['segunda', 1], ['terca', 2], ['quarta', 3], ['quinta', 4], ['sexta', 5], ['sabado', 6]];
const diasDoTexto = t => DIAS_TEXTO.filter(([n]) => semAcento(t || '').includes(n)).map(([, i]) => i);

export function diaPublicacao() { return d().config?.diaPublicacao === 'domingo' ? 0 : 6; }
export function horarioPublicacao() { return d().config?.horarioPublicacao || '10:30'; }

/** Tudo o que acontece num dia (fixos + agenda + itens concretos). */
function atividadesDoDia(ymd) {
  const wd = diaSemana(ymd);
  const hoje = ymd === hojeYMD();
  const dados = d();
  const itens = [];
  const add = (hora, titulo, cat, quem, detalhe = null, acao = null, destaque = false) => itens.push({ hora, titulo, cat, quem, detalhe, acao, destaque });
  (dados.tarefas?.tarefas || []).filter(t => t.agendadaPara?.slice(0, 10) === ymd && t.status !== 'CONCLUÍDA').forEach(t =>
    add(t.agendadaPara.slice(11, 16), t.titulo, 'desenvolvimento', 'Equipe', t.descricao, () => ctx.irPara('tarefas'), true));

  // Itens concretos de hoje: o que espera por você e o que está sendo feito.
  if (hoje) {
    const pend = (dados.propostas?.propostas || []).filter(p => p.status === 'AGUARDANDO APROVAÇÃO');
    if (pend.length) add('Hoje', pend.length === 1 ? `Decidir a proposta ${pend[0].id}` : `Decidir ${pend.length} propostas`, 'propostas', 'Você',
      pend.map(p => p.titulo).join(' · '), () => ctx.irPara('decisoes', { tipo: 'proposta', id: pend[0].id }), true);
    (dados.lancamentos?.lancamentos || []).filter(l => l.status === 'AGUARDANDO AUTORIZAÇÃO FINAL').forEach(l =>
      add('Hoje', `Autorizar a atualização ${l.id}`, 'autorizacao', 'Você', (l.changelog || []).join(' · ') || null, () => ctx.irPara('decisoes', { tipo: 'lancamento', id: l.id }), true));
    const atual = dados.executor?.trabalhoAtual;
    if (atual) add('Agora', `Em desenvolvimento: ${atual.propostaId || 'trabalho aprovado'}`, 'desenvolvimento', 'Claude', atual.etapa || null);
  }
  // Atualizações marcadas para este dia.
  (dados.lancamentos?.lancamentos || []).filter(l => l.dataAlvo === ymd && l.status !== 'PUBLICADA').forEach(l =>
    add(horarioPublicacao(), `Atualização ${l.id} vai para o jogo`, 'publicacao', 'GitHub', l.status === 'APROVADA PARA PUBLICAÇÃO' ? 'Já autorizada por você.' : 'Só vai se você autorizar antes.', null, true));

  // Tarefas fixas de todo dia.
  add('07:30', 'Notícias do dia', 'noticias', 'Claude', 'Novidades de Roblox, YouTube, TikTok e Instagram, com ideias para o jogo.');
  add('De hora em hora', 'Números do jogo', 'monitoramento', 'GitHub', 'Jogadores online, visitas e jogos de escola parecidos.');

  // Semana fixa.
  if (wd === 1) {
    add('09:00', 'Diagnóstico da semana', 'monitoramento', 'GitHub', 'Confere se tudo funcionou na semana passada.');
    add('09:30', 'Pesquisa e propostas novas', 'pesquisa', 'Claude', 'Tendências da semana viram propostas com imagens para você decidir.');
  }
  if (wd === 6) add('08:00', 'Relatório semanal', 'relatorio', 'GitHub', 'Como o jogo foi na semana, o que deu certo e o que não deu.');
  if (wd === 0) add('09:00', 'Relatório preliminar', 'relatorio', 'GitHub', 'Primeira leitura depois da atualização. O resultado de verdade sai em 7 dias.');
  if (wd === diaPublicacao()) {
    const pausado = !!dados.config?.lancamentosPausados;
    add(horarioPublicacao(), pausado ? 'Publicação pausada' : 'Publicação no jogo', 'publicacao', 'GitHub',
      pausado ? 'Pausada em Ajustes: nada vai para o jogo.' : 'Só vai para o jogo o que você autorizou.', null, !pausado);
  }
  // Etapas do meio da semana vindas da agenda configurada.
  (dados.config?.cronograma || []).forEach(c => {
    const dias = diasDoTexto(c.dia);
    if (!dias.includes(wd) || [0, 1, 6].includes(wd)) return;
    const hora = /(\d{1,2})h(\d{2})?/.exec(c.automatico || '');
    add(hora ? `${hora[1].padStart(2, '0')}:${hora[2] || '00'}` : 'No dia', c.atividade, categoriaPorTexto(`${c.atividade} ${c.automatico}`), quemPorTexto(c.automatico || ''), c.automatico);
  });

  const peso = it => (it.hora === 'Hoje' ? -2 : it.hora === 'Agora' ? -1 : /^\d\d:\d\d$/.test(it.hora) ? Number(it.hora.replace(':', '')) : 9999);
  return itens.sort((a, b) => peso(a) - peso(b));
}

// ------------------------------------------------------------------ jogo ao vivo
// Lê o número ao vivo direto da Roblox (sem passar pelo nosso servidor). No máximo 1 vez a cada 2 minutos.
const aoVivo = { valor: null, tentativa: 0 };
function buscarAoVivo() {
  const jogo = d().jogo;
  const id = jogo?.universeId || 9508201896;
  if (Date.now() - aoVivo.tentativa < 120000) return;
  aoVivo.tentativa = Date.now();
  fetch(`https://games.roproxy.com/v1/games?universeIds=${encodeURIComponent(id)}`, { referrerPolicy: 'no-referrer', credentials: 'omit' })
    .then(r => (r.ok ? r.json() : null))
    .then(j => {
      const g = j?.data?.[0];
      if (!g || !Number.isFinite(g.playing)) return;
      aoVivo.valor = { jogando: g.playing, visitas: g.visits, favoritos: g.favoritedCount, em: new Date().toISOString() };
      const atual = document.querySelector('.card-jogo');
      if (atual && ctx.estado.aba === 'inicio') atual.replaceWith(cardJogo());
    })
    .catch(() => {});
}

function numerosDoJogo() {
  const jogo = d().jogo || {};
  const a = jogo.atual || {};
  const vivo = aoVivo.valor;
  return {
    jogo, a, vivo,
    jogando: vivo?.jogando ?? a.jogando,
    visitas: vivo?.visitas ?? a.visitas,
    favoritos: vivo?.favoritos ?? a.favoritos,
    em: vivo?.em || a.em,
  };
}

function iconeJogo(jogo, classe = 'jogo-icone') {
  return imagemExterna(jogo.icone, { alt: '', classe, reserva: h('img', { src: 'marca/jogo.png', alt: '', class: classe }) }) || h('img', { src: 'marca/jogo.png', alt: '', class: classe });
}

function cardJogo() {
  const n = numerosDoJogo();
  const { jogo, a } = n;
  if (!jogo.nome && n.jogando == null) {
    return h('section', { class: 'card card-jogo vazio-jogo' }, miniaturaIcone('gameplay', 'roxo'), h('div', {}, h('strong', {}, 'Números do jogo'), h('p', { class: 'sinc' }, 'A primeira leitura aparece aqui em até uma hora.')));
  }
  const hist = (jogo.historico || []).map(x => x.jogando);
  if (n.vivo) hist.push(n.vivo.jogando);
  const grafico = miniGrafico(hist, { rotulo: 'Jogadores online nos últimos 7 dias', classe: 'mg-claro' });
  return cardClicavel('card-jogo', () => folhaJogo(), 'Ver todos os números do jogo',
    h('div', { class: 'jogo-cabeca' },
      iconeJogo(jogo),
      h('div', { class: 'jogo-nome' }, h('strong', {}, jogo.nome || 'Escola Brasileira'), h('span', {}, 'Seu jogo na Roblox')),
      h('span', { class: `selo-vivo${n.vivo ? ' ligado' : ''}` }, h('i', {}), n.vivo ? 'Ao vivo' : 'Recente')),
    h('div', { class: 'jogo-numero' },
      h('strong', {}, num(n.jogando)),
      h('span', {}, icone('jogadores', { tamanho: 18 }), 'jogando agora')),
    h('p', { class: 'jogo-hora' }, n.vivo ? `Ao vivo · ${horaBR(n.vivo.em)}` : `Atualizado às ${horaBR(n.em)} · ${haQuanto(n.em)}`),
    grafico ? h('div', { class: 'jogo-grafico' }, grafico, h('div', { class: 'jogo-grafico-legenda' }, h('span', {}, jogo.historico?.[0]?.em ? dataBR(jogo.historico[0].em) : ''), h('span', {}, `Pico da semana: ${num(jogo.picoSemana)}`), h('span', {}, 'Agora')))
      : h('p', { class: 'jogo-grafico-vazio' }, icone('grafico', { tamanho: 16 }), 'O gráfico da semana aparece com mais leituras.'),
    h('div', { class: 'jogo-mini' },
      h('div', {}, icone('olho', { tamanho: 16 }), h('strong', {}, compacto(n.visitas)), h('span', {}, 'visitas')),
      h('div', {}, icone('estrela', { tamanho: 16 }), h('strong', {}, compacto(n.favoritos)), h('span', {}, 'favoritos')),
      h('div', {}, icone('like', { tamanho: 16 }), h('strong', {}, pct(a.aprovacao)), h('span', {}, 'aprovação'))),
    h('div', { class: 'jogo-acoes' },
      botaoLink(jogo.link, 'Ver na Roblox', { classe: 'btn amarelo', iconeNome: 'roblox' }),
      h('span', { class: 'jogo-dica' }, 'Toque para ver tudo', icone('direita', { tamanho: 16 }))));
}

function folhaJogo() {
  const n = numerosDoJogo();
  const { jogo, a } = n;
  const hist = jogo.historico || [];
  const grafico = miniGrafico(hist.map(x => x.jogando), { altura: 110, rotulo: 'Jogadores online na semana' });
  abrirFolha({
    titulo: jogo.nome || 'Escola Brasileira',
    conteudo: h('div', { class: 'folha-jogo' },
      h('div', { class: 'folha-jogo-topo' }, iconeJogo(jogo, 'jogo-icone grande'),
        h('div', {}, h('strong', { class: 'folha-grande' }, num(n.jogando)), h('span', { class: 'sinc' }, n.vivo ? `jogando agora · ao vivo às ${horaBR(n.vivo.em)}` : `jogando · leitura das ${horaBR(n.em)}`))),
      h('div', { class: 'grade-numeros' },
        blocoNumero('trofeu', num(jogo.picoSemana), 'pico da semana'),
        blocoNumero('olho', num(n.visitas), 'visitas'),
        blocoNumero('estrela', num(n.favoritos), 'favoritos'),
        blocoNumero('like', num(a.likes), 'gostei', 'ok'),
        blocoNumero('queda', num(a.dislikes), 'não gostei', 'bad'),
        blocoNumero('escudo', pct(a.aprovacao, 1), 'aprovação'),
        blocoNumero('jogadores', num(a.maxJogadores), 'por servidor'),
        blocoNumero('relogio', a.atualizadoNoRoblox ? dataBR(a.atualizadoNoRoblox) : '—', 'última atualização do jogo')),
      h('h3', { class: 'folha-subtitulo' }, icone('grafico', { tamanho: 18 }), 'Jogadores online na semana'),
      grafico ? h('div', { class: 'grafico-folha' }, grafico) : h('p', { class: 'sinc' }, 'Ainda há poucas leituras. O gráfico aparece com o passar das horas.'),
      hist.length ? h('div', { class: 'lista-mini' }, [...hist].reverse().slice(0, 8).map(x => h('div', { class: 'lista-mini-item' }, h('span', {}, dataBR(x.em)), h('strong', {}, `${num(x.jogando)} jogando`)))) : null,
      h('p', { class: 'sinc' }, `Fonte: ${jogo.fonte || 'APIs públicas da Roblox'}.`)),
    rodape: botaoLink(jogo.link, 'Ver na Roblox', { classe: 'btn primario grande', iconeNome: 'roblox' }),
  });
}

// ------------------------------------------------------------------ calendário da semana
function calendario() {
  const hoje = hojeYMD();
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(hoje, i));
  const atividadesHoje = atividadesDoDia(hoje);
  return h('section', { class: 'card card-semana' },
    cabecalhoSecao('calendario', 'Sua semana'),
    h('div', { class: 'semana-grade' }, dias.map((ymd, i) => {
      const wd = diaSemana(ymd);
      const its = atividadesDoDia(ymd).filter(x => !['07:30', 'De hora em hora'].includes(x.hora));
      const pub = wd === diaPublicacao() && !d().config?.lancamentosPausados;
      const cats = [...new Set(its.map(x => x.cat))].slice(0, 3);
      return h('button', { type: 'button', class: `dia${i === 0 ? ' hoje' : ''}${pub ? ' publica' : ''}`, onclick: () => folhaDia(ymd), 'aria-label': `${i === 0 ? 'Hoje' : NOMES_DIA[wd]}, dia ${diaNum(ymd)}: ${its.length} atividades` },
        h('span', { class: 'dia-nome' }, i === 0 ? 'Hoje' : CURTOS_DIA[wd]),
        h('span', { class: 'dia-num' }, String(diaNum(ymd))),
        h('span', { class: 'dia-marcas' }, pub ? icone('foguete', { tamanho: 13 }) : cats.map(c => h('i', { class: `ponto-dia tom-${CATEGORIAS[c].tom}` }))));
    })),
    h('div', { class: 'hoje-lista' },
      atividadesHoje.slice(0, 3).map(linhaAtividade),
      h('button', { type: 'button', class: 'btn discreto largo', onclick: () => folhaDia(hoje) }, icone('calendario', { tamanho: 18 }), `Ver tudo de hoje (${atividadesHoje.length})`)));
}

function linhaAtividade(it) {
  const cat = CATEGORIAS[it.cat] || CATEGORIAS.monitoramento;
  const corpo = [
    h('span', { class: `atv-icone tom-${cat.tom}` }, icone(cat.icone, { tamanho: 20 })),
    h('span', { class: 'atv-texto' },
      h('strong', {}, it.titulo),
      h('span', { class: 'atv-meta' }, h('span', { class: 'atv-hora' }, icone('relogio', { tamanho: 13 }), it.hora), h('span', { class: `atv-quem quem-${semAcento(it.quem)}` }, icone(QUEM[it.quem] || 'relogio', { tamanho: 13 }), it.quem))),
    it.acao ? icone('direita', { tamanho: 18, classe: 'atv-seta' }) : null,
  ];
  return it.acao
    ? h('button', { type: 'button', class: `atividade${it.destaque ? ' destaque' : ''}`, onclick: it.acao }, corpo)
    : h('div', { class: `atividade${it.destaque ? ' destaque' : ''}` }, corpo);
}

function folhaDia(ymd) {
  const wd = diaSemana(ymd);
  const hoje = ymd === hojeYMD();
  const its = atividadesDoDia(ymd);
  abrirFolha({
    titulo: `${hoje ? 'Hoje' : NOMES_DIA[wd]}, ${dataLonga(ymd)}`,
    conteudo: h('div', { class: 'folha-dia' },
      wd === diaPublicacao() ? h('div', { class: `faixa ${d().config?.lancamentosPausados ? 'warn' : 'ok'}` }, icone(d().config?.lancamentosPausados ? 'pausa' : 'foguete', { tamanho: 20 }),
        h('span', {}, d().config?.lancamentosPausados ? 'Dia de publicação, mas as publicações estão pausadas.' : `Dia de publicação às ${horarioPublicacao()}.`)) : null,
      its.map(it => {
        const cat = CATEGORIAS[it.cat] || CATEGORIAS.monitoramento;
        const linha = h('div', { class: 'atividade-grande' },
          h('span', { class: `atv-icone grande tom-${cat.tom}` }, icone(cat.icone, { tamanho: 22 })),
          h('div', { class: 'atv-texto' },
            h('div', { class: 'atv-linha' }, h('strong', {}, it.titulo)),
            h('div', { class: 'atv-meta' }, chip(it.hora, { iconeNome: 'relogio' }), chip(it.quem, { iconeNome: QUEM[it.quem] || 'relogio', tom: it.quem === 'Você' ? 'curiosidade' : 'neutro' }), chip(cat.nome, { iconeNome: cat.icone })),
            it.detalhe ? h('p', { class: 'atv-detalhe' }, textoCurto(it.detalhe, 220)) : null,
            it.acao ? h('button', { type: 'button', class: 'btn primario', onclick: it.acao }, 'Abrir agora', icone('direita', { tamanho: 18 })) : null));
        return linha;
      })),
  });
}

// ------------------------------------------------------------------ notícias
const CAT_NOTICIA = {
  Quente: { tom: 'quente', icone: 'fogo' },
  Relevante: { tom: 'relevante', icone: 'alvo' },
  Curiosidade: { tom: 'curiosidade', icone: 'lampada' },
};
const PLATAFORMAS = { Roblox: 'roblox', YouTube: 'play', TikTok: 'musica', Instagram: 'camera', Outros: 'globo' };
function noticiasValidas() {
  const agora = Date.now();
  return (d().noticias?.itens || [])
    .filter(n => n && n.titulo && (!n.expiraEm || new Date(n.expiraEm).getTime() > agora))
    .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
}
const chipCategoria = n => (CAT_NOTICIA[n.categoria] ? chip(n.categoria, { tom: CAT_NOTICIA[n.categoria].tom, iconeNome: CAT_NOTICIA[n.categoria].icone }) : null);
const chipPlataforma = n => chip(n.plataforma || 'Outros', { iconeNome: PLATAFORMAS[n.plataforma] || 'globo' });
const reservaNoticia = (n, classe) => miniaturaIcone(PLATAFORMAS[n.plataforma] || 'noticia', n.categoria === 'Quente' ? 'laranja' : n.categoria === 'Curiosidade' ? 'amarelo' : 'roxo', classe);
const imagemNoticia = (n, classe) => imagemExterna(n.imagem, { alt: '', classe, reserva: reservaNoticia(n, classe) }) || reservaNoticia(n, classe);

function folhaNoticia(n) {
  abrirFolha({
    titulo: 'Notícia',
    conteudo: h('div', { class: 'folha-noticia' },
      imagemNoticia(n, 'noticia-img-folha'),
      h('div', { class: 'chips-linha' }, chipCategoria(n), chipPlataforma(n), n.data ? chip(dataBR(n.data), { iconeNome: 'calendario' }) : null),
      h('h3', { class: 'noticia-titulo-folha' }, n.titulo),
      n.resumo ? h('p', { class: 'noticia-resumo' }, n.resumo) : null,
      n.ideiaParaOJogo ? h('div', { class: 'ideia' }, h('span', { class: 'ideia-icone' }, icone('lampada', { tamanho: 22 })), h('div', {}, h('strong', {}, 'Ideia para o nosso jogo'), h('p', {}, n.ideiaParaOJogo))) : null,
      n.fonte?.nome ? campo('globo', 'Fonte', n.fonte.nome) : null),
    rodape: botaoLink(n.fonte?.url, 'Abrir fonte', { classe: 'btn primario grande' }),
  });
}

function noticiaDoDia() {
  const lista = noticiasValidas();
  if (!lista.length) {
    return h('section', { class: 'card card-noticia-vazia' }, miniaturaIcone('noticia', 'rosa'),
      h('div', {}, h('strong', {}, 'Notícia do dia'), h('p', { class: 'sinc' }, 'As novidades de Roblox, YouTube, TikTok e Instagram chegam todo dia às 07:30.')));
  }
  const ultimoDia = String(lista[0].data || '').slice(0, 10);
  const doDia = lista.filter(n => String(n.data || '').slice(0, 10) === ultimoDia);
  const n = doDia.find(x => x.categoria === 'Quente') || doDia[0];
  return h('section', { class: 'bloco-noticia' },
    cabecalhoSecao('noticia', 'Notícia do dia', botaoTexto(`Ver mais (${lista.length})`, () => ctx.irPara('inicio', 'noticias'))),
    cardClicavel('card-noticia', () => folhaNoticia(n), `Abrir notícia: ${n.titulo}`,
      h('div', { class: 'noticia-capa' }, imagemNoticia(n, 'noticia-img'), h('div', { class: 'noticia-selos' }, chipCategoria(n), chipPlataforma(n))),
      h('div', { class: 'noticia-corpo' },
        h('h3', {}, n.titulo),
        n.resumo ? h('p', {}, textoCurto(n.resumo, 130)) : null,
        n.ideiaParaOJogo ? h('p', { class: 'noticia-ideia' }, icone('lampada', { tamanho: 16 }), textoCurto(n.ideiaParaOJogo, 90)) : null,
        h('div', { class: 'noticia-acoes' },
          h('button', { type: 'button', class: 'btn primario', onclick: () => ctx.irPara('inicio', 'noticias') }, icone('noticia', { tamanho: 18 }), 'Ver mais notícias'),
          h('span', { class: 'jogo-dica' }, 'Toque para ler', icone('direita', { tamanho: 16 }))))));
}

function paginaNoticias() {
  const f = ctx.estado.filtros;
  const cat = f.noticiaCat || 'todas';
  const plat = f.noticiaPlat || 'todas';
  const todas = noticiasValidas();
  const lista = todas.filter(n => (cat === 'todas' || n.categoria === cat) && (plat === 'todas' || (n.plataforma || 'Outros') === plat));
  return h('div', { class: 'pagina-noticias' },
    topoSubpagina('Notícias', () => ctx.irPara('inicio', null), 'Novidades do dia e ideias para o jogo'),
    h('div', { class: 'card filtros-card' },
      h('div', { class: 'filtro-rotulo' }, icone('filtro', { tamanho: 16 }), 'Tipo'),
      filtrosChips([['todas', 'Todas'], ['Quente', 'Quente', 'fogo'], ['Relevante', 'Relevante', 'alvo'], ['Curiosidade', 'Curiosidade', 'lampada']], cat, v => { f.noticiaCat = v; ctx.render(); }, 'Tipo de notícia'),
      h('div', { class: 'filtro-rotulo' }, icone('globo', { tamanho: 16 }), 'Onde'),
      filtrosChips([['todas', 'Todas'], ...Object.entries(PLATAFORMAS).map(([nome, ic]) => [nome, nome, ic])], plat, v => { f.noticiaPlat = v; ctx.render(); }, 'Plataforma')),
    lista.length
      ? h('div', { class: 'lista-cards' }, lista.map(n => cardClicavel('card-noticia-linha', () => folhaNoticia(n), `Abrir notícia: ${n.titulo}`,
        imagemNoticia(n, 'noticia-mini'),
        h('div', { class: 'noticia-linha-texto' },
          h('div', { class: 'chips-linha' }, chipCategoria(n), chipPlataforma(n)),
          h('strong', {}, n.titulo),
          n.resumo ? h('span', { class: 'sinc' }, textoCurto(n.resumo, 90)) : null))))
      : h('div', { class: 'card vazio-card' }, miniaturaIcone('noticia', 'rosa'), h('p', {}, todas.length ? 'Nenhuma notícia com esses filtros.' : 'Ainda não há notícias. Elas chegam todo dia às 07:30.')));
}

// ------------------------------------------------------------------ o que precisa de você
function precisaDeVoce() {
  const dados = d();
  const pend = (dados.propostas?.propostas || []).filter(p => p.status === 'AGUARDANDO APROVAÇÃO');
  const finais = (dados.lancamentos?.lancamentos || []).filter(l => l.status === 'AGUARDANDO AUTORIZAÇÃO FINAL');
  const total = pend.length + finais.length;
  if (!total) {
    return h('section', { class: 'card card-em-dia' }, h('span', { class: 'em-dia-icone' }, icone('ok', { tamanho: 24 })),
      h('div', {}, h('strong', {}, 'Tudo em dia'), h('span', {}, 'Nenhuma decisão esperando você. Você recebe um aviso quando chegar algo.')));
  }
  const linha = (iconeNome, titulo, sub, acao, tom) => h('button', { type: 'button', class: 'pedido', onclick: acao },
    h('span', { class: `pedido-icone tom-${tom}` }, icone(iconeNome, { tamanho: 22 })),
    h('span', { class: 'pedido-texto' }, h('strong', {}, titulo), h('span', {}, sub)),
    icone('direita', { tamanho: 20 }));
  return h('section', { class: 'card card-precisa' },
    h('div', { class: 'precisa-topo' },
      h('span', { class: 'precisa-numero' }, String(total)),
      ctx.estado.usuario?.papel === 'proprietario'
        ? h('div', {}, h('strong', {}, total === 1 ? 'coisa precisa de você' : 'coisas precisam de você'), h('span', {}, 'Toque para decidir'))
        : h('div', {}, h('strong', {}, total === 1 ? 'decisão esperando o dono' : 'decisões esperando o dono'), h('span', {}, 'Toque para ver e comentar'))),
    h('div', { class: 'pedidos' },
      finais.map(l => linha('assinatura', `Autorizar a atualização ${l.id}`, 'Pronta para ir ao jogo', () => ctx.irPara('decisoes', { tipo: 'lancamento', id: l.id }), 'amarelo')),
      pend.slice(0, Math.max(0, 2 - finais.length)).map(p => linha(iconeDoTipo(p.tipo), p.titulo, `Proposta ${p.id} · ${ctx.estado.usuario?.papel === 'proprietario' ? 'esperando sua decisão' : 'esperando o dono'}`, () => ctx.irPara('decisoes', { tipo: 'proposta', id: p.id }), 'roxo'))),
    total > 2 ? h('button', { type: 'button', class: 'btn largo', onclick: () => ctx.irPara('decisoes') }, `Ver todas as ${total}`, icone('direita', { tamanho: 18 })) : null);
}

// ------------------------------------------------------------------ resumo
function proximaPublicacao() {
  const alvo = diaPublicacao();
  const [hh, mm] = horarioPublicacao().split(':').map(Number);
  const agora = horaAgora();
  let ymd = hojeYMD();
  for (let i = 0; i < 8; i++) {
    const dia = somarDias(ymd, i);
    if (diaSemana(dia) === alvo && (i > 0 || agora.hh * 60 + agora.mm < hh * 60 + mm)) return dia;
  }
  return somarDias(ymd, 7);
}

function folhaAutomacoes() {
  const s = d()['saude-agendamentos'] || {};
  const itens = Object.entries(s.tarefas || {});
  abrirFolha({
    titulo: 'Saúde das automações',
    conteudo: h('div', {},
      s.observacao ? h('div', { class: 'faixa info' }, icone('lampada', { tamanho: 20 }), h('span', {}, s.observacao)) : null,
      itens.length ? h('div', { class: 'lista-cards' }, itens.map(([nome, v]) => h('div', { class: 'card linha-saude' },
        h('span', { class: `atv-icone tom-${v.status === 'ok' ? 'verde' : v.status === 'falhou' ? 'vermelho' : 'cinza'}` }, icone(v.status === 'ok' ? 'ok' : v.status === 'falhou' ? 'alerta' : 'relogio', { tamanho: 20 })),
        h('div', { class: 'atv-texto' }, h('strong', {}, nomeAutomacao(nome)), h('span', { class: 'sinc' }, v.ultimaExecucao ? `Última vez ${haQuanto(v.ultimaExecucao)}` : 'Ainda não rodou'), v.cron ? h('span', { class: 'sinc' }, `Agenda: ${v.cron}`) : null),
        chipStatus(v.status)))) : h('p', { class: 'sinc' }, 'Sem registros.')),
  });
}
const nomeAutomacao = n => ({ 'coleta-diaria': 'Coleta dos números', 'relatorio-semanal': 'Relatório semanal', 'relatorio-preliminar': 'Relatório preliminar', 'diagnostico-segunda': 'Diagnóstico de segunda' }[n] || n.replace(/-/g, ' '));

function folhaAndamento() {
  const ex = d().executor || {};
  const aprovadas = (d().propostas?.propostas || []).filter(p => p.status === 'APROVADA PARA DESENVOLVIMENTO');
  abrirFolha({
    titulo: 'Em andamento',
    conteudo: h('div', {},
      ex.trabalhoAtual ? campo('martelo', 'Sendo feito agora', `${ex.trabalhoAtual.propostaId || ''} ${ex.trabalhoAtual.etapa || ''}`.trim()) : campo('martelo', 'Sendo feito agora', 'Nada no momento.'),
      aprovadas.length ? campo('decisoes', 'Aprovadas esperando a automação', aprovadas.map(p => `${p.id} · ${p.titulo}`).join('\n')) : null,
      campo('relogio', 'Última verificação', ex.ultimaVerificacao ? `${dataBR(ex.ultimaVerificacao)} (${haQuanto(ex.ultimaVerificacao)})` : 'Ainda sem registro'),
      (ex.historico || []).length ? [h('h3', { class: 'folha-subtitulo' }, icone('relogio', { tamanho: 18 }), 'Atividade recente'),
        h('div', { class: 'lista-mini' }, ex.historico.slice(-10).reverse().map(x => h('div', { class: 'lista-mini-item' }, h('span', {}, dataBR(x.em)), h('strong', {}, `${x.propostaId || ''} ${x.texto || ''}`.trim()))))] : null),
  });
}

function resumo() {
  const dados = d();
  const ex = dados.executor || {};
  const aprovadas = (dados.propostas?.propostas || []).filter(p => p.status === 'APROVADA PARA DESENVOLVIMENTO');
  const andamento = ex.trabalhoAtual ? (ex.trabalhoAtual.propostaId || 'Trabalho aprovado') : aprovadas.length ? `${aprovadas.length} na fila` : 'Fila vazia';
  const pausado = !!dados.config?.lancamentosPausados;
  const prox = proximaPublicacao();
  const rel = dados.relatorios_indice?.relatorios?.at(-1);
  const saude = Object.values(dados['saude-agendamentos']?.tarefas || {});
  const falhas = saude.filter(t => t.status === 'falhou').length;
  const oks = saude.filter(t => t.status === 'ok').length;
  const cartao = (iconeNome, tom, rotulo, valor, sub, acao) => cardBotao('card-resumo', acao,
    h('span', { class: `resumo-icone tom-${tom}` }, icone(iconeNome, { tamanho: 22 })),
    h('span', { class: 'resumo-rotulo' }, rotulo),
    h('strong', { class: 'resumo-valor' }, valor),
    h('span', { class: 'resumo-sub' }, sub));
  return h('section', { class: 'bloco-resumo' },
    cabecalhoSecao('raio', 'Resumo de tudo'),
    h('div', { class: 'grade-resumo' },
      cartao('martelo', 'laranja', 'Em andamento', andamento, ex.trabalhoAtual?.etapa || (aprovadas.length ? 'Esperando a automação' : 'Nada sendo feito'), folhaAndamento),
      cartao(pausado ? 'pausa' : 'foguete', pausado ? 'vermelho' : 'verde', 'Próxima publicação', pausado ? 'Pausada' : `${NOMES_DIA[diaSemana(prox)]} ${diaNum(prox)}`, pausado ? 'Ligue em Ajustes' : `às ${horarioPublicacao()}`, () => ctx.irPara('ajustes')),
      cartao('numeros', 'azul', 'Último relatório', rel ? dataBR(rel.data) : 'Nenhum', rel ? (rel.completo ? 'Completo' : 'Incompleto') : 'Sai no sábado 08:00', () => ctx.irPara('numeros')),
      cartao(falhas ? 'alerta' : 'escudo', falhas ? 'vermelho' : oks ? 'verde' : 'cinza', 'Automações', falhas ? `${falhas} com falha` : oks ? 'Funcionando' : 'Aguardando', `${saude.length} agendadas`, folhaAutomacoes)));
}

function atalhoTarefas() {
  const t = d().tarefas?.tarefas || [];
  if (!t.length) return null;
  const abertas = t.filter(x => x.status !== 'CONCLUÍDA');
  const comVoce = abertas.filter(x => /propriet/i.test(x.responsavelNome || '')).length;
  const media = Math.round(t.reduce((a, x) => a + (x.progresso || 0), 0) / t.length);
  return cardBotao('card-atalho', () => ctx.irPara('tarefas'),
    h('span', { class: 'resumo-icone tom-roxo' }, icone('tarefas', { tamanho: 22 })),
    h('span', { class: 'atalho-texto' },
      h('strong', {}, 'Tarefas'),
      h('span', {}, `${abertas.length} abertas${comVoce ? ` · ${comVoce} com você` : ''}`),
      h('span', { class: 'barra' }, h('span', { style: { width: `${media}%` } }))),
    h('span', { class: 'atalho-pct' }, `${media}%`),
    icone('direita', { tamanho: 20 }));
}

function prepararAparelho() {
  const e = ctx.estado;
  if (e.usuario?.papel !== 'proprietario') return null; // equipe não assina nem grava notificações
  if (e.chave?.estado === 'registrada' && e.pushAtivo !== false) return null;
  return cardBotao('card-atalho alerta-suave', () => ctx.irPara('ajustes'),
    h('span', { class: 'resumo-icone tom-amarelo' }, icone('sino', { tamanho: 22 })),
    h('span', { class: 'atalho-texto' }, h('strong', {}, 'Preparar este aparelho'), h('span', {}, 'Notificações e chave para autorizar publicações')),
    icone('direita', { tamanho: 20 }));
}

// ------------------------------------------------------------------ boas-vindas
function saudacao() {
  const { hh } = horaAgora();
  const oi = hh >= 5 && hh < 12 ? 'Bom dia' : hh >= 12 && hh < 18 ? 'Boa tarde' : 'Boa noite';
  const nome = String(ctx.estado.usuario?.nome || '').trim().split(/\s+/)[0] || 'Tallyson';
  const hoje = hojeYMD();
  const wd = diaSemana(hoje);
  const its = atividadesDoDia(hoje);
  const pub = wd === diaPublicacao();
  const voce = (d().propostas?.propostas || []).filter(p => p.status === 'AGUARDANDO APROVAÇÃO').length + (d().lancamentos?.lancamentos || []).filter(l => l.status === 'AGUARDANDO AUTORIZAÇÃO FINAL').length;
  const frase = pub ? (d().config?.lancamentosPausados ? 'Hoje seria dia de publicação, mas está pausada.' : `Hoje é dia de publicação às ${horarioPublicacao()}.`)
    : voce ? (ctx.estado.usuario?.papel === 'proprietario' ? `Hoje tem ${voce === 1 ? 'uma decisão sua' : `${voce} decisões suas`} esperando.` : `${voce === 1 ? 'Uma decisão' : `${voce} decisões`} esperando o dono. Você pode ver e comentar.`)
      : `Hoje: ${its.map(x => CATEGORIAS[x.cat]?.nome).filter((v, i, a) => v && a.indexOf(v) === i).slice(0, 3).join(', ').toLowerCase()}.`;
  const sol = hh >= 6 && hh < 18;
  return h('header', { class: 'boas-vindas' },
    h('div', { class: 'bv-topo' },
      h('img', { class: 'bv-jogo', src: 'marca/jogo.png', alt: '', width: 44, height: 44, onerror: e => e.target.remove() }),
      h('span', { class: 'bv-data' }, `${NOMES_DIA[wd]}, ${dataLonga(hoje)}`),
      h('span', { class: 'bv-sol', 'aria-hidden': 'true' }, icone(sol ? 'sol' : 'estrela', { tamanho: 22 }))),
    h('h1', { tabindex: '-1' }, `${oi}, ${nome}`),
    h('p', { class: 'bv-frase' }, frase));
}

// ------------------------------------------------------------------ tela
export function cardSuaAtualizacao() {
  const r = resumoAtualizacao(d());
  const avisos = listarAvisos(d());
  const novos = novosAvisos(avisos, lerAvisosLidos(ctx.estado.usuario)).length;
  const abrirEvidencias = () => {
    if (!r.evidencia) return;
    const aviso = avisos.find(a => a.registroId === r.evidencia.id);
    if (aviso) marcarAvisoLido(ctx.estado.usuario, aviso);
    ctx.irPara('andamento', { id: r.evidencia.id });
  };
  return h('section', { class: 'card sua-atualizacao', 'aria-label': 'Sua atualização' },
    h('p', { class: 'atualizacao-rotulo' }, icone('sino'), 'Sua atualização'),
    h('h2', {}, `${r.lancamento?.propostaIds?.join(', ') || r.ultimo?.propostaId || ''}${r.lancamento || r.ultimo ? ' · ' : ''}${r.titulo}`),
    h('p', { class: 'sinc' }, dataHoraBrasilia(r.em)),
    h('div', { class: 'atualizacao-proximo' }, h('strong', {}, 'Próximo passo'), h('p', {}, r.proximoPasso)),
    h('p', { class: 'atualizacao-evidencias' }, `${r.imagens} ${r.imagens === 1 ? 'imagem' : 'imagens'} · ${r.videos} ${r.videos === 1 ? 'vídeo' : 'vídeos'} · ${r.etapasConcluidas} ${r.etapasConcluidas === 1 ? 'etapa concluída' : 'etapas concluídas'}`),
    r.evidencia ? h('button', { class: 'btn primario atualizacao-ver', type: 'button', onclick: abrirEvidencias }, icone('play'), 'VER IMAGENS E VÍDEOS')
      : h('p', { class: 'sinc' }, 'Ainda não há imagens ou vídeos registrados para esta atualização.'),
    h('div', { class: 'atualizacao-acoes' },
      r.ultimo ? h('button', { type: 'button', class: 'btn', onclick: () => ctx.irPara('andamento', { id: r.ultimo.id, comentar: true }) }, icone('chat'), 'Comentar esta atualização') : null,
      h('button', { type: 'button', class: 'btn', onclick: () => ctx.irPara(r.decisao.aba, r.decisao.sub) }, icone('decisoes'), 'Decisões'),
      h('button', { type: 'button', class: 'btn', onclick: () => ctx.irPara('avisos') }, icone('sino'), `Avisos${novos ? ` (${novos} novos)` : ''}`)));
}

export function presencaEquipe() {
  const lista = h('div', { class: 'presenca-lista', 'aria-live': 'polite' });
  const atualizar = () => lista.replaceChildren(...['codex', 'claude'].map(id => {
      const nome = id === 'codex' ? 'Codex' : 'Claude';
      const p = avaliarPresenca(d().presenca?.itens?.[id]);
      return h('div', { class: `presenca-item ${p.estado}` },
        h('span', { class: 'presenca-avatar', 'aria-hidden': 'true' }, nome[0], h('img', { src: id === 'claude' ? 'marca/claude.ico' : 'marca/codex.svg', alt: '', onerror: e => { e.target.hidden = true; } })),
        h('div', {}, h('strong', {}, p.estado === 'sem_sinal' ? nome : `${nome} ${p.texto}`),
          p.estado === 'sem_sinal' ? h('p', { class: 'sinc' }, p.texto) : null,
          p.atividade ? h('p', {}, p.atividade) : null,
          p.atualizadoEm ? h('p', { class: 'sinc' }, `Sinal: ${dataHoraBrasilia(p.atualizadoEm)}`) : null));
    }));
  atualizar();
  const secao = h('section', { class: 'presenca-equipe', 'aria-label': 'Atividade da equipe' }, h('h2', {}, 'Equipe agora'), lista,
    h('button', { type: 'button', class: 'btn', onclick: () => ctx.irPara('ideias') }, icone('lampada'), 'Enviar sugestão'));
  const timer = setInterval(() => { if (!secao.isConnected) clearInterval(timer); else atualizar(); }, 30_000);
  return secao;
}

export function telaInicio() {
  if (ctx.estado.sub.inicio === 'noticias') return paginaNoticias();
  buscarAoVivo();
  return h('div', { class: 'pagina-inicio' },
    saudacao(),
    cardSuaAtualizacao(),
    presencaEquipe(),
    cardBotao('card-atalho atalho-ideia', () => ctx.irPara('ideias'), h('span', { class: 'resumo-icone tom-amarelo' }, icone('lampada', { tamanho: 24 })), h('span', { class: 'atalho-texto' }, h('strong', {}, 'Enviar ideia ou sugestão'), h('span', {}, 'Thumbnail, descrição, nome ou melhoria do jogo')), icone('direita')),
    precisaDeVoce(),
    cardJogo(),
    calendario(),
    noticiaDoDia(),
    resumo(),
    atalhoTarefas(),
    prepararAparelho());
}
