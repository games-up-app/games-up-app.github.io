// Aba DECISÕES do Games Up.
// Duas áreas separadas, escolhidas por dois botões grandes no topo:
//   1) Ideias para aprovar (propostas)  -> cada uma é um card com miniatura; tocar abre um modal só com ela.
//   2) Publicações para autorizar (lançamentos) -> card "Sua autorização" com a imagem EXATA do pacote
//      e o código do pacote (8 primeiros caracteres do SHA-256), que precisa ser confirmado.
// Nada expande para baixo: detalhes abrem em folha (de baixo para cima) ou modal (fundo escuro).
import { h, icone, iconeDoTipo, abrirFolha, abrirModal, botaoCopiar, chip, vazio } from '../ui/componentes.js';
import { ctx } from '../ui/contexto.js';

// ------------------------------------------------------------------ status e grupos
const ST = {
  PROPOSTA: 'PROPOSTA', AGUARDANDO: 'AGUARDANDO APROVAÇÃO', ADIADA: 'ADIADA',
  APROVADA_DEV: 'APROVADA PARA DESENVOLVIMENTO', EM_DEV: 'EM DESENVOLVIMENTO', EM_TESTES: 'EM TESTES',
  AGUARDANDO_FINAL: 'AGUARDANDO AUTORIZAÇÃO FINAL', APROVADA_PUB: 'APROVADA PARA PUBLICAÇÃO',
  PUBLICADA: 'PUBLICADA', REJEITADA: 'REJEITADA', BLOQUEADA: 'BLOQUEADA', DEVOLVIDA: 'DEVOLVIDA PARA AJUSTES',
};
const DECIDIVEIS = [ST.PROPOSTA, ST.AGUARDANDO, ST.ADIADA];

// Rótulo curto e simples para o dono + tom da cor + ícone.
const ROTULOS = {
  [ST.PROPOSTA]: ['Rascunho', 'neutro', 'editar'],
  [ST.AGUARDANDO]: ['Esperando decisão', 'warn', 'relogio'],
  [ST.ADIADA]: ['Adiada', 'neutro', 'pausa'],
  [ST.APROVADA_DEV]: ['Aprovada · em preparo', 'ok', 'ok'],
  [ST.EM_DEV]: ['Em produção', 'relevante', 'martelo'],
  [ST.EM_TESTES]: ['Em testes', 'relevante', 'qualidade'],
  [ST.AGUARDANDO_FINAL]: ['Falta sua autorização', 'warn', 'assinatura'],
  [ST.APROVADA_PUB]: ['Autorizada', 'ok', 'escudo'],
  [ST.PUBLICADA]: ['Já está no jogo', 'ok', 'foguete'],
  [ST.REJEITADA]: ['Rejeitada', 'bad', 'fechar'],
  [ST.BLOQUEADA]: ['Bloqueada', 'bad', 'cadeado'],
  [ST.DEVOLVIDA]: ['Voltou para ajustes', 'warn', 'editar'],
};
function seloStatus(st) {
  const [texto, tom, ic] = ROTULOS[st] || [st || '—', 'neutro', 'estrela'];
  const el = chip(texto, { tom, iconeNome: ic });
  if (ROTULOS[st]) el.title = st;
  return el;
}

const SUBABAS = [
  ['aberto', 'Em aberto', 'Esperando a decisão do dono.'],
  ['autorizadas', 'Autorizadas', 'Você já autorizou; vão para o jogo na data marcada.'],
  ['concluidas', 'Concluídas', 'Já foram para o jogo ou foram recusadas.'],
  ['agendadas', 'Agendadas', 'Aprovadas e em preparo, com data prevista para ir ao jogo.'],
  ['todas', 'Todas', 'Tudo, do mais novo para o mais antigo.'],
];

const hoje = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const futura = d => !!d && String(d).slice(0, 10) >= hoje();

const GRUPOS_PROPOSTA = {
  aberto: p => DECIDIVEIS.includes(p.status),
  autorizadas: p => p.status === ST.APROVADA_PUB,
  concluidas: p => [ST.PUBLICADA, ST.REJEITADA, ST.BLOQUEADA].includes(p.status),
  agendadas: p => [ST.APROVADA_DEV, ST.EM_DEV, ST.EM_TESTES, ST.AGUARDANDO_FINAL, ST.DEVOLVIDA].includes(p.status),
  todas: () => true,
};
const GRUPOS_LANCAMENTO = {
  aberto: l => l.status === ST.AGUARDANDO_FINAL,
  autorizadas: l => l.status === ST.APROVADA_PUB,
  concluidas: l => [ST.PUBLICADA, ST.BLOQUEADA].includes(l.status),
  agendadas: l => ![ST.PUBLICADA, ST.BLOQUEADA, ST.AGUARDANDO_FINAL].includes(l.status) && futura(l.dataAlvo),
  todas: () => true,
};

// ------------------------------------------------------------------ utilidades
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
function partesData(iso) {
  if (!iso) return null;
  const s = String(iso);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { const [a, m, d] = s.split('-').map(Number); return new Date(a, m - 1, d, 12); }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  // Converte para o horário de Brasília.
  return new Date(d.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
}
const dataCurta = iso => { const d = partesData(iso); return d ? `${d.getDate()} ${MESES[d.getMonth()]}` : '—'; };
const dataHora = iso => { const d = partesData(iso); return d ? `${d.getDate()} ${MESES[d.getMonth()]}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '—'; };
const diaSemana = iso => { const d = partesData(iso); return d ? DIAS[d.getDay()] : ''; };
function curto(texto, limite = 140) {
  const t = String(texto || '').trim();
  if (t.length <= limite) return t;
  return `${t.slice(0, limite).replace(/\s+\S*$/, '')}…`;
}
const ehDono = () => ctx.estado?.usuario?.papel === 'proprietario';
const dados = () => ctx.estado?.dados || {};
const propostas = () => dados().propostas?.propostas || [];
const lancamentos = () => dados().lancamentos?.lancamentos || [];
const ehImagem = c => /\.(png|jpe?g|webp)$/i.test(String(c || ''));
const linkSeguro = (url, texto) => (/^https:\/\//.test(url || '') ? h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, texto, icone('externo', { tamanho: 14 })) : h('span', {}, texto));

// ------------------------------------------------------------------ imagens (cada arquivo é baixado uma vez só)
const cachePrevia = new Map();
const cachePacote = new Map();

/** Moldura com ícone de reserva; a imagem cobre o ícone quando carrega. */
function moldura(classe, iconeReserva, img) {
  const caixa = h('div', { class: `dc-midia ${classe}` }, h('div', { class: 'dc-midia-reserva' }, icone(iconeReserva, { tamanho: 40 })));
  if (img) {
    img.addEventListener('error', () => img.remove());
    img.addEventListener('load', () => caixa.classList.add('carregou'));
    caixa.append(img);
  }
  return caixa;
}

function imagemDados(caminho, alt) {
  if (typeof ctx.imagemPrivada === 'function') return ctx.imagemPrivada(caminho, { alt, classe: 'dc-img' });
  // Reserva caso a casca ainda não ofereça imagemPrivada.
  const rel = String(caminho).replace(/^dados\//, '');
  const img = h('img', { alt, class: 'dc-img', loading: 'lazy', decoding: 'async' });
  if (!cachePrevia.has(rel)) cachePrevia.set(rel, ctx.estado.repo.lerImagem(rel).then(b => (b ? URL.createObjectURL(b) : null)).catch(() => null));
  cachePrevia.get(rel).then(u => { if (u) img.src = u; else img.remove(); });
  return img;
}

/** Imagem EXATA do pacote autorizado (builds/*.png). Guardada por caminho + hash. */
function imagemPacote(l) {
  const caminho = l.artefato?.caminho;
  const chave = `${caminho}#${l.artefato?.sha256}`;
  const img = h('img', { alt: 'Imagem exata que vai para o Roblox', class: 'dc-img', decoding: 'async' });
  if (!cachePacote.has(chave)) {
    cachePacote.set(chave, Promise.resolve().then(() => ctx.estado.repo.lerImagemDoPacote(caminho)).then(b => (b ? URL.createObjectURL(b) : null)).catch(() => null));
  }
  cachePacote.get(chave).then(u => { if (u) img.src = u; else img.remove(); });
  return img;
}
const ehEvento = l => l.tipo === 'evento';
function tituloLanc(l, longo = false) {
  if (ehEvento(l)) return longo ? 'Evento na página do jogo' : 'Evento no Roblox';
  if (l.tipo === 'thumbnail') return longo ? 'Nova thumbnail para o jogo' : 'Thumbnail';
  return 'Atualização do jogo';
}
function chipTipoLanc(l) {
  if (ehEvento(l)) return chip('Evento', { iconeNome: 'evento', tom: 'relevante' });
  return chip(l.tipo === 'thumbnail' ? 'Thumbnail' : 'Jogo', { iconeNome: l.tipo === 'thumbnail' ? 'thumbnail' : 'roblox' });
}

/** Evento: mostra como ele aparece na página do jogo no Roblox (capa, título, subtítulo, datas, descrição). */
function previaEvento(l, grande = true) {
  const ev = l.evento || {};
  const data = iso => (iso ? `${diaSemana(iso.slice(0, 10)).slice(0, 3).toLowerCase()}, ${dataCurta(iso.slice(0, 10))}, ${iso.slice(11, 16)}` : '—');
  const desc = String(ev.descricao || '');
  return h('div', { class: 'dc-heroi-bloco' },
    h('div', { class: 'dc-evento' },
      h('div', { class: 'dc-evento-capa' }, moldura(grande ? 'dc-midia-heroi' : 'dc-midia-card', 'evento', imagemPacote(l)),
        h('span', { class: 'dc-evento-data' }, data(ev.inicio))),
      h('div', { class: 'dc-evento-corpo' },
        ev.categoria ? h('div', { class: 'dc-evento-cat' }, ev.categoria) : null,
        h('strong', { class: 'dc-evento-titulo' }, ev.titulo || '—'),
        h('div', { class: 'dc-evento-sub' }, ev.subtitulo || ''),
        h('div', { class: 'dc-evento-periodo' }, icone('calendario', { tamanho: 16 }), `${data(ev.inicio)} até ${data(ev.fim)}`),
        desc ? h('p', { class: 'dc-evento-desc' }, curto(desc, 220)) : null,
        desc.length > 220 ? h('button', { type: 'button', class: 'dc-link', onclick: () => abrirFolha({ titulo: 'Descrição do evento', conteudo: h('p', { class: 'dc-texto-folha' }, desc) }) }, 'Ler a descrição inteira') : null)),
    h('div', { class: 'dc-etiqueta exata' }, icone('escudo', { tamanho: 16 }), 'Capa e textos exatos — é assim que vai aparecer no Roblox'),
    l.eventoRoblox?.link ? h('a', { class: 'dc-link', href: l.eventoRoblox.link, target: '_blank', rel: 'noopener' }, icone('roblox', { tamanho: 16 }), 'Ver o evento no Roblox') : null);
}
const pacoteEhImagem = l => /^builds\/[a-z0-9-]+\.(png|jpe?g)$/i.test(l.artefato?.caminho || '');

// Categoria da proposta (regra da semana: 3 entretenimento, 2 crescimento, 1 otimização, 1 correção).
const CATEGORIAS = { entretenimento: ['Entretenimento', 'evento', 'relevante'], crescimento: ['Crescimento', 'grafico', 'ok'], otimizacao: ['Otimização', 'raio', 'curiosidade'], correcao: ['Correção', 'martelo', 'warn'], thumbnail: ['Thumbnail', 'thumbnail', ''] };
function chipCategoria(p) {
  const c = CATEGORIAS[p.categoria];
  return c ? chip(c[0], { tom: c[2], iconeNome: c[1] }) : null;
}

function primeiraPrevia(p) { return (p.previas || []).find(ehImagem) || null; }
function rotuloImagem(p, caminho) {
  if (/previas\/capas\//.test(caminho || '')) return { texto: 'Capa sugerida — evento da Roblox e aviso do grupo', icone: 'evento', tom: 'quente' };
  const ehThumb = p.tipo === 'thumbnail' || /previas\/thumbnails\//.test(caminho || '');
  return ehThumb
    ? { texto: 'Thumbnail candidata — vitrine do Roblox', icone: 'thumbnail', tom: 'relevante' }
    : { texto: 'Imagem de referência — só explica a ideia', icone: 'lampada', tom: 'curiosidade' };
}

function miniaturaProposta(p, classe = 'dc-midia-card') {
  const c = primeiraPrevia(p);
  return moldura(classe, iconeDoTipo(p.tipo), c ? imagemDados(c, `Imagem da proposta ${p.id}`) : null);
}

// ------------------------------------------------------------------ peças visuais
function botaoDc(texto, { classe = '', iconeNome = null, onclick, tipo = 'button', desativado = false } = {}) {
  return h('button', { class: `dc-btn ${classe}`.trim(), type: tipo, onclick, disabled: desativado }, iconeNome ? icone(iconeNome, { tamanho: 20 }) : null, h('span', {}, texto));
}

/** Card curto com ícone; se o texto for longo, toca para ler tudo numa folha. */
function cardInfo(iconeNome, titulo, texto, tom = '') {
  const t = String(texto || '').trim() || '—';
  const longo = t.length > 110;
  const corpo = [h('div', { class: 'dc-info-icone' }, icone(iconeNome, { tamanho: 20 })),
    h('div', { class: 'dc-info-txt' }, h('div', { class: 'dc-info-titulo' }, titulo), h('div', { class: 'dc-info-valor' }, curto(t, 110)),
      longo ? h('div', { class: 'dc-info-mais' }, 'Ler tudo', icone('direita', { tamanho: 14 })) : null)];
  if (!longo) return h('div', { class: `dc-info ${tom}` }, corpo);
  return h('button', { type: 'button', class: `dc-info dc-info-botao ${tom}`, onclick: () => abrirFolha({ titulo, conteudo: h('p', { class: 'dc-texto-folha' }, t) }) }, corpo);
}

function blocoChaveFaltando() {
  // Modo Equipe: a equipe acompanha, mas só o dono autoriza (não existe chave para a equipe).
  if (!ehDono()) {
    return h('div', { class: 'dc-aviso-chave' },
      h('div', { class: 'dc-aviso-icone' }, icone('escudo', { tamanho: 26 })),
      h('div', {}, h('strong', {}, 'Só o dono autoriza publicações'),
        h('p', {}, 'Você acompanha tudo e pode comentar. Quando o dono autorizar, a publicação aparece em "Autorizadas".')));
  }
  return h('div', { class: 'dc-aviso-chave' },
    h('div', { class: 'dc-aviso-icone' }, icone('cadeado', { tamanho: 26 })),
    h('div', {}, h('strong', {}, 'Confirme este aparelho para autorizar'),
      h('p', {}, 'A autorização é assinada por uma chave guardada só neste celular. Crie ou confirme a chave em Ajustes.')),
    botaoDc('Abrir Ajustes', { classe: 'dc-btn-roxo', iconeNome: 'ajustes', onclick: () => ctx.irPara?.('ajustes') }));
}

// ------------------------------------------------------------------ comentários (dentro do modal)
function blocoComentarios(alvoTipo, alvoId) {
  const caixa = h('section', { class: 'dc-comentarios' });
  const desenhar = () => {
    const itens = (dados().comentarios?.itens || []).filter(c => c.alvoTipo === alvoTipo && c.alvoId === alvoId);
    const campo = h('textarea', { class: 'dc-campo', rows: 2, maxlength: 2000, placeholder: 'Escreva um comentário…', 'aria-label': 'Novo comentário' });
    const btn = botaoDc('Comentar', { classe: 'dc-btn-claro', iconeNome: 'chat' });
    btn.addEventListener('click', async () => {
      if (!campo.value.trim()) { campo.focus(); return; }
      const antes = itens.length;
      await ctx.gravar('/api/comentarios', { alvoTipo, alvoId, texto: campo.value }, [btn], 'Comentário publicado.');
      const depois = (dados().comentarios?.itens || []).filter(c => c.alvoTipo === alvoTipo && c.alvoId === alvoId).length;
      if (depois > antes) desenhar();
    });
    caixa.replaceChildren(
      h('h3', { class: 'dc-sub' }, icone('chat', { tamanho: 18 }), `Comentários (${itens.length})`),
      itens.length ? h('ul', { class: 'dc-lista-coment' }, itens.map(c => h('li', {},
        h('div', { class: 'dc-coment-quem' }, h('span', { class: 'dc-avatar' }, (c.por?.nome || '?').slice(0, 1).toUpperCase()), h('strong', {}, c.por?.nome || '—'), h('span', {}, dataHora(c.em))),
        h('p', {}, c.texto)))) : h('p', { class: 'dc-fraco' }, 'Ninguém comentou ainda.'),
      h('div', { class: 'dc-coment-novo' }, campo, btn));
  };
  desenhar();
  return caixa;
}

// ------------------------------------------------------------------ propostas
function cardProposta(p) {
  const decidivel = DECIDIVEIS.includes(p.status) && !p.bloqueio;
  return h('button', { type: 'button', class: `dc-card-proposta${decidivel ? ' pede-voce' : ''}`, onclick: () => abrirProposta(p.id), 'aria-label': `Abrir proposta ${p.id}: ${p.titulo}` },
    miniaturaProposta(p),
    h('div', { class: 'dc-card-corpo' },
      h('div', { class: 'dc-card-chips' }, seloStatus(p.status), chip(p.id, { iconeNome: iconeDoTipo(p.tipo) }), p.ideiaId ? chip('Sua ideia', { tom: 'relevante', iconeNome: 'lampada' }) : null, ehHoje(p) ? chip(`Hoje ${p.fazerHoje.horario}`, { tom: 'quente', iconeNome: 'raio' }) : null, chipCategoria(p), p.mudaDesign ? chip('Muda o visual', { tom: 'quente', iconeNome: 'pincel' }) : null),
      h('h3', { class: 'dc-card-titulo' }, p.titulo),
      h('p', { class: 'dc-card-resumo' }, curto(p.resumo || p.descricao, 110)),
      h('div', { class: 'dc-card-pe' },
        p.semanaAlvo ? h('span', { class: 'dc-pe-data' }, icone('calendario', { tamanho: 16 }), `Previsto ${dataCurta(p.semanaAlvo)}`) : h('span'),
        h('span', { class: 'dc-pe-abrir' }, decidivel && ehDono() ? 'Decidir' : 'Ver', icone('direita', { tamanho: 18 })))));
}

/** Resumo roxo da proposta: se for longo, um toque mostra o texto inteiro (e outro volta). */
function resumoDestaque(texto) {
  const t = String(texto || '').trim();
  const LIMITE = 260;
  if (t.length <= LIMITE) return h('div', { class: 'dc-resumo-destaque' }, icone('lampada', { tamanho: 22 }), h('p', {}, t));
  const par = h('p', {}, curto(t, LIMITE));
  const mais = h('span', { class: 'dc-info-mais' }, 'Ler tudo', icone('direita', { tamanho: 14 }));
  const caixa = h('button', { type: 'button', class: 'dc-resumo-destaque dc-resumo-botao', 'aria-expanded': 'false' },
    icone('lampada', { tamanho: 22 }), h('div', {}, par, mais));
  caixa.addEventListener('click', () => {
    const aberto = caixa.getAttribute('aria-expanded') === 'true';
    par.textContent = aberto ? curto(t, LIMITE) : t;
    mais.replaceChildren(aberto ? 'Ler tudo' : 'Mostrar menos', icone('direita', { tamanho: 14 }));
    caixa.setAttribute('aria-expanded', String(!aberto));
  });
  return caixa;
}

/** Ideia que o dono mandou pelo celular e a equipe ainda está transformando em proposta. */
function cardIdeiaPreparando(i) {
  const respostas = i.respostas || [];
  return h('button', { type: 'button', class: 'dc-card-proposta dc-card-ideia', 'aria-label': `Sua ideia: ${i.titulo}`,
    onclick: () => abrirFolha({ titulo: i.titulo, conteudo: h('div', { class: 'dc-folha-det' },
      h('p', { class: 'dc-texto-folha' }, i.texto),
      h('div', { class: 'dc-alerta' }, icone('relogio', { tamanho: 20 }), h('div', {}, 'A equipe está transformando sua ideia em proposta: imagem, o que muda e o porquê. Quando ficar pronta, ela aparece aqui para você decidir.')),
      respostas.length ? h('p', { class: 'dc-fraco' }, `Último retorno: ${respostas.at(-1).texto}`) : null) }) },
    moldura('dc-midia-card', 'lampada', null),
    h('div', { class: 'dc-card-corpo' },
      h('div', { class: 'dc-card-chips' }, chip('Sua ideia', { tom: 'relevante', iconeNome: 'lampada' }), chip(i.status === 'analise' ? 'Em análise' : 'Sendo preparada', { iconeNome: 'relogio' })),
      h('h3', { class: 'dc-card-titulo' }, curto(i.titulo, 80)),
      h('p', { class: 'dc-card-resumo' }, curto(i.texto, 110)),
      h('div', { class: 'dc-card-pe' }, h('span', { class: 'dc-pe-data' }, icone('calendario', { tamanho: 16 }), `Enviada ${dataCurta(i.criadaEm)}`), h('span', { class: 'dc-pe-abrir' }, 'Ver', icone('direita', { tamanho: 18 })))));
}

function abrirProposta(id) {
  const p = propostas().find(x => x.id === id);
  if (!p) return;
  const imagens = (p.previas || []).filter(ehImagem);
  const comentarios = (dados().comentarios?.itens || []).filter(c => c.alvoTipo === 'proposta' && c.alvoId === p.id);
  const podeDecidir = ehDono() && DECIDIVEIS.includes(p.status);

  abrirModal({
    titulo: `Proposta ${p.id}`,
    classe: 'dc-modal',
    conteudo: fechar => {
      // Imagem grande no topo + rótulo deixando claro o que ela é.
      let heroi;
      if (imagens.length) {
        const rot = rotuloImagem(p, imagens[0]);
        const palco = h('div', { class: 'dc-heroi' }, moldura('dc-midia-heroi', iconeDoTipo(p.tipo), imagemDados(imagens[0], rot.texto)));
        const etiqueta = h('div', { class: `dc-etiqueta ${rot.tom}` }, icone(rot.icone, { tamanho: 16 }), rot.texto);
        const tiras = imagens.length > 1 ? h('div', { class: 'dc-tiras' }, imagens.map((c, i) => {
          const b = h('button', { type: 'button', class: `dc-tira${i === 0 ? ' ativa' : ''}`, 'aria-label': `Imagem ${i + 1} de ${imagens.length}` },
            moldura('dc-midia-tira', 'imagem', imagemDados(c, `Imagem ${i + 1}`)));
          b.addEventListener('click', () => {
            const r = rotuloImagem(p, c);
            palco.replaceChildren(moldura('dc-midia-heroi', iconeDoTipo(p.tipo), imagemDados(c, r.texto)));
            etiqueta.replaceChildren(icone(r.icone, { tamanho: 16 }), r.texto);
            etiqueta.className = `dc-etiqueta ${r.tom}`;
            b.parentElement.querySelectorAll('.dc-tira').forEach(x => x.classList.toggle('ativa', x === b));
          });
          return b;
        })) : null;
        heroi = h('div', { class: 'dc-heroi-bloco' }, palco, etiqueta, tiras);
      } else {
        heroi = h('div', { class: 'dc-heroi-bloco' }, h('div', { class: 'dc-heroi dc-heroi-vazio' }, icone(iconeDoTipo(p.tipo), { tamanho: 56 }),
          h('span', {}, p.tipo === 'thumbnail' ? 'A thumbnail candidata ainda está sendo preparada' : 'Esta ideia não precisa de imagem')));
      }
      const plano = p.hipotese ? `${p.hipotese.metrica}: ${p.hipotese.esperado}` : null;
      return h('div', { class: 'dc-detalhe' },
        heroi,
        h('div', { class: 'dc-card-chips' }, seloStatus(p.status), chipCategoria(p) || chip(p.tipo || 'ideia', { iconeNome: iconeDoTipo(p.tipo) }), p.mudaDesign ? chip('Muda o visual do jogo', { tom: 'quente', iconeNome: 'pincel' }) : null,
          p.semanaAlvo ? chip(`Previsto ${dataCurta(p.semanaAlvo)}`, { iconeNome: 'calendario' }) : null),
        h('h2', { class: 'dc-detalhe-titulo' }, p.titulo),
        p.bloqueio ? h('div', { class: 'dc-alerta warn' }, icone('alerta', { tamanho: 20 }), h('div', {}, h('strong', {}, 'Ainda não dá para decidir. '), p.bloqueio)) : null,
        resumoDestaque(p.resumo || p.descricao),
        h('div', { class: 'dc-grade-info' },
          cardInfo('alvo', 'Por quê', p.motivacao),
          cardInfo('jogadores', 'Para o jogador', p.beneficio, 'positivo'),
          cardInfo('martelo', 'Trabalho', p.esforco),
          cardInfo('alerta', 'Risco', p.risco, 'cuidado')),
        plano ? h('div', { class: 'dc-medida' }, icone('grafico', { tamanho: 18 }), h('div', {}, h('strong', {}, 'Como vamos medir: '), plano)) : null,
        botaoDc('Mais detalhes', { classe: 'dc-btn-claro dc-largo', iconeNome: 'noticia', onclick: () => folhaDetalhesProposta(p) }),
        podeDecidir ? null : h('p', { class: 'dc-fraco dc-centro' }, ehDono() ? 'Esta proposta já foi decidida.' : 'Só o proprietário decide propostas.'),
        blocoComentarios('proposta', p.id, comentarios));
    },
    rodape: podeDecidir ? fechar => {
      const aprovar = botaoDc('Aprovar ideia', { classe: 'dc-btn-roxo dc-btn-grande', iconeNome: 'ok', onclick: () => confirmarDecisao(p, 'aprovar', fechar) });
      const hoje = p.tipo === 'thumbnail' ? null : botaoDc('Aprovar e fazer hoje', { classe: 'dc-btn-amarelo dc-btn-grande', iconeNome: 'raio', onclick: () => folhaFazerHoje(p, { aprovarAntes: true, fecharModal: fechar }) });
      return h('div', { class: 'dc-rodape-decisao' }, aprovar, hoje,
        h('div', { class: 'dc-rodape-linha' },
          botaoDc('Pedir alterações', { classe: 'dc-btn-claro', iconeNome: 'editar', onclick: () => confirmarDecisao(p, 'pedir_alteracoes', fechar) }),
          botaoDc('Adiar', { classe: 'dc-btn-claro', iconeNome: 'relogio', onclick: () => confirmarDecisao(p, 'adiar', fechar) }),
          botaoDc('Rejeitar', { classe: 'dc-btn-perigo', iconeNome: 'fechar', onclick: () => confirmarDecisao(p, 'rejeitar', fechar) })));
    } : podeAdiantar(p) ? fechar => {
      if (ehHoje(p)) {
        return h('div', { class: 'dc-rodape-decisao' },
          h('div', { class: 'dc-alerta' }, icone('raio', { tamanho: 20 }), h('div', {}, h('strong', {}, `Marcada para hoje às ${p.fazerHoje.horario}. `), 'A equipe faz esta primeiro; você autoriza o pacote e ele vai para o jogo sozinho nesse horário.')),
          botaoDc('Voltar para a data normal', { classe: 'dc-btn-claro', iconeNome: 'calendario', onclick: () => desfazerHoje(p, fechar) }));
      }
      return h('div', { class: 'dc-rodape-decisao' }, botaoDc('Fazer hoje', { classe: 'dc-btn-amarelo dc-btn-grande', iconeNome: 'raio', onclick: () => folhaFazerHoje(p, { fecharModal: fechar }) }));
    } : null,
  });
}

// ------------------------------------------------------------------ "Fazer hoje" (adiantar a atualização)
const hojeBR = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const ehHoje = p => p.fazerHoje?.data === hojeBR();
const podeAdiantar = p => ehDono() && p.tipo !== 'thumbnail' && [ST.APROVADA_DEV, ST.EM_DEV, ST.EM_TESTES].includes(p.status)
  && (p.decisoes || []).some(d => d.acao === 'aprovar' && d.versao === p.versao);

function folhaFazerHoje(p, { aprovarAntes = false, fecharModal } = {}) {
  abrirFolha({
    titulo: aprovarAntes ? 'Aprovar e fazer hoje?' : 'Fazer hoje?',
    conteudo: fechar => {
      const agora = new Date(Date.now() - 3 * 3600_000);
      const sugestao = `${String(Math.min(23, agora.getUTCHours() + 3)).padStart(2, '0')}:00`;
      const hora = h('input', { type: 'time', class: 'campo-hora', value: sugestao, step: 300, id: `dc-hoje-${p.id}`, 'aria-label': 'Meta de horário para hoje (Brasília)' });
      const erro = h('p', { class: 'dc-erro', role: 'alert', hidden: true }, 'Escolha um horário.');
      const voltar = botaoDc('Voltar', { classe: 'dc-btn-claro', onclick: fechar });
      const ok = botaoDc(aprovarAntes ? 'Sim, aprovar e fazer hoje' : 'Sim, fazer hoje', { classe: 'dc-btn-amarelo dc-btn-grande', iconeNome: 'raio' });
      ok.addEventListener('click', async () => {
        if (!/^\d{2}:\d{2}$/.test(hora.value)) { erro.hidden = false; hora.focus(); return; }
        if (aprovarAntes) {
          const antes = p.status;
          await ctx.gravar('/api/propostas/decisao', { propostaId: p.id, acao: 'aprovar', comentario: `Fazer hoje, meta ${hora.value}.`, versao: p.versao }, [ok, voltar], 'Ideia aprovada.');
          if (propostas().find(x => x.id === p.id)?.status === antes) return;
        }
        await ctx.gravar('/api/propostas/fazer-hoje', { propostaId: p.id, horario: hora.value }, [ok, voltar], `Marcada para hoje, meta ${hora.value}.`);
        if (ehHoje(propostas().find(x => x.id === p.id) || {})) { fechar(); fecharModal?.(); }
      });
      return h('div', { class: 'dc-confirma' },
        h('div', { class: 'dc-confirma-icone amarelo' }, icone('raio', { tamanho: 30 })),
        h('p', { class: 'dc-confirma-texto' }, 'A equipe passa esta na frente de tudo e entrega um pacote só dela. Quando ficar pronto, você recebe o aviso e autoriza com o código; ela vai para o jogo sozinha no horário escolhido (se autorizar depois, sai na hora) — sem esperar o dia normal de publicação.'),
        h('div', { class: 'dc-confirma-alvo' }, miniaturaProposta(p, 'dc-midia-mini'), h('div', {}, h('strong', {}, p.titulo), h('div', { class: 'dc-fraco' }, `${p.id} · versão ${p.versao}`))),
        h('label', { class: 'dc-rotulo', for: `dc-hoje-${p.id}` }, 'Horário de publicação (Brasília)'), hora, erro,
        h('p', { class: 'dc-fraco' }, 'Depois da sua autorização, o jogo atualiza sozinho neste horário. Se não der tempo com qualidade, a equipe avisa no app em vez de entregar com pressa.'),
        h('div', { class: 'dc-confirma-botoes' }, ok, voltar));
    },
  });
}

async function desfazerHoje(p, fecharModal) {
  await ctx.gravar('/api/propostas/fazer-hoje', { propostaId: p.id, desfazer: true }, [], 'Voltou para a data normal.');
  if (!propostas().find(x => x.id === p.id)?.fazerHoje) fecharModal?.();
}

function folhaDetalhesProposta(p) {
  const fontes = p.origem?.fontes || [];
  const linha = (ic, titulo, conteudo) => h('div', { class: 'dc-linha-det' }, h('div', { class: 'dc-info-icone' }, icone(ic, { tamanho: 18 })), h('div', {}, h('div', { class: 'dc-info-titulo' }, titulo), h('div', { class: 'dc-linha-valor' }, conteudo || '—')));
  abrirFolha({
    titulo: 'Plano completo',
    conteudo: h('div', { class: 'dc-folha-det' },
      linha('noticia', 'O que muda', p.descricao),
      linha('alvo', 'Por que fazer', p.motivacao),
      linha('jogadores', 'O que o jogador ganha', p.beneficio),
      linha('martelo', 'Trabalho previsto', p.esforco),
      linha('alerta', 'Riscos', p.risco),
      linha('grafico', 'Como vamos medir', p.hipotese ? [chip(p.hipotese.classificacao, { tom: 'relevante' }), ` ${p.hipotese.metrica}: ${p.hipotese.esperado}`] : null),
      linha('pesquisa', 'Evidências', (p.evidencias || []).length ? h('ul', { class: 'dc-ul' }, p.evidencias.map(e => h('li', {}, e))) : null),
      linha('globo', 'Fontes', fontes.length ? h('ul', { class: 'dc-ul' }, fontes.map(f => h('li', {}, f.url ? linkSeguro(f.url, f.titulo) : f.titulo, f.data ? h('span', { class: 'dc-fraco' }, ` (${f.data})`) : null))) : null),
      linha('esquerda', 'Se der errado', p.recuperacao),
      linha('jogadores', 'Responsável', p.responsavel),
      linha('calendario', 'Versão e data', `Versão ${p.versao} · previsto para ${diaSemana(p.semanaAlvo).toLowerCase()} ${dataCurta(p.semanaAlvo)}`),
      (p.decisoes || []).length ? linha('decisoes', `Decisões anteriores (${p.decisoes.length})`, h('ul', { class: 'dc-ul' }, p.decisoes.map(d => h('li', {}, `${({ aprovar: 'Aprovou', rejeitar: 'Rejeitou', pedir_alteracoes: 'Pediu alterações', adiar: 'Adiou' })[d.acao] || d.acao} — ${d.por?.nome || ''}, ${dataHora(d.em)}${d.comentario ? `: “${d.comentario}”` : ''}`)))) : null),
  });
}

const INFO_DECISAO = {
  aprovar: { titulo: 'Aprovar esta ideia?', icone: 'ok', tom: 'roxo', texto: 'A equipe começa a preparar. Nada vai para o jogo agora: a publicação pede a sua autorização final depois, em outra etapa.', botao: 'Sim, aprovar', classe: 'dc-btn-roxo', comentario: 'Comentário (opcional)', msg: 'Ideia aprovada. A equipe já pode preparar.' },
  pedir_alteracoes: { titulo: 'Pedir alterações', icone: 'editar', tom: 'amarelo', texto: 'A proposta volta para a equipe ajustar e depois aparece de novo para você.', botao: 'Enviar pedido', classe: 'dc-btn-roxo', comentario: 'O que precisa mudar? (obrigatório)', obrigatorio: true, msg: 'Pedido de alterações enviado.' },
  adiar: { titulo: 'Adiar esta ideia?', icone: 'relogio', tom: 'neutro', texto: 'A ideia fica guardada e você pode decidir em outro momento.', botao: 'Sim, adiar', classe: 'dc-btn-roxo', comentario: 'Comentário (opcional)', msg: 'Ideia adiada.' },
  rejeitar: { titulo: 'Rejeitar esta ideia?', icone: 'fechar', tom: 'vermelho', texto: 'A ideia é arquivada. Ela só volta se aparecer um motivo novo e você permitir.', botao: 'Sim, rejeitar', classe: 'dc-btn-perigo-cheio', comentario: 'Motivo (opcional)', msg: 'Ideia rejeitada.' },
};

function confirmarDecisao(p, acao, fecharModal) {
  const info = INFO_DECISAO[acao];
  abrirFolha({
    titulo: info.titulo,
    conteudo: fechar => {
      const campo = h('textarea', { class: 'dc-campo', rows: 3, maxlength: 2000, placeholder: info.obrigatorio ? 'Ex.: trocar a cor do fundo, mostrar a sala de aula…' : 'Se quiser, deixe um recado para a equipe.', id: `dc-com-${acao}` });
      const erro = h('p', { class: 'dc-erro', role: 'alert', hidden: true }, 'Escreva o que precisa mudar.');
      const voltar = botaoDc('Voltar', { classe: 'dc-btn-claro', onclick: fechar });
      const ok = botaoDc(info.botao, { classe: `${info.classe} dc-btn-grande`, iconeNome: info.icone });
      ok.addEventListener('click', async () => {
        if (info.obrigatorio && !campo.value.trim()) { erro.hidden = false; campo.focus(); return; }
        const antes = p.status;
        await ctx.gravar('/api/propostas/decisao', { propostaId: p.id, acao, comentario: campo.value, versao: p.versao }, [ok, voltar], info.msg);
        const agora = propostas().find(x => x.id === p.id);
        if (agora && agora.status !== antes) { fechar(); fecharModal?.(); }
      });
      return h('div', { class: 'dc-confirma' },
        h('div', { class: `dc-confirma-icone ${info.tom}` }, icone(info.icone, { tamanho: 30 })),
        h('p', { class: 'dc-confirma-texto' }, info.texto),
        h('div', { class: 'dc-confirma-alvo' }, miniaturaProposta(p, 'dc-midia-mini'), h('div', {}, h('strong', {}, p.titulo), h('div', { class: 'dc-fraco' }, `${p.id} · versão ${p.versao}`))),
        h('label', { class: 'dc-rotulo', for: `dc-com-${acao}` }, info.comentario), campo, erro,
        h('div', { class: 'dc-confirma-botoes' }, ok, voltar));
    },
  });
}

// ------------------------------------------------------------------ lançamentos (autorização final)
function quandoPublica(l) {
  const cfg = dados().config || {};
  // "Fazer hoje": vai para o jogo sozinho no horário escolhido (se autorizar depois, sai na hora).
  if (l.urgente) return { dia: 'Hoje', hora: l.horario || null, texto: l.horario ? `Hoje às ${l.horario}` : 'Hoje, ao autorizar' };
  if (ehEvento(l) && l.evento?.inicio) {
    const i = l.evento.inicio;
    const dia = `${diaSemana(i.slice(0, 10))}, ${dataCurta(i.slice(0, 10))}`;
    return { dia, hora: i.slice(11, 16), texto: `Começa ${dia} às ${i.slice(11, 16)}` };
  }
  const hora = cfg.horarioPublicacao || null;
  const dia = l.dataAlvo ? `${diaSemana(l.dataAlvo)}, ${dataCurta(l.dataAlvo)}` : (cfg.diaPublicacao === 'domingo' ? 'Próximo domingo' : 'Próximo sábado');
  return { dia, hora, texto: `${dia}${hora ? ` às ${hora}` : ''}` };
}
const codigoPacote = l => (l.artefato?.sha256 || '').slice(0, 8);
const nomeArquivo = l => (l.artefato?.caminho || '').split('/').pop() || '—';
const tamanhoMB = b => (Number.isFinite(b) ? `${(b / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB` : null);

/** Mostra o que será publicado: a imagem exata (thumbnail) ou o arquivo do jogo + imagens das ideias incluídas. */
function midiaDoLancamento(l, grande = true) {
  if (ehEvento(l)) return previaEvento(l, grande);
  if (pacoteEhImagem(l)) {
    return h('div', { class: 'dc-heroi-bloco' },
      h('div', { class: 'dc-heroi' }, moldura(grande ? 'dc-midia-heroi' : 'dc-midia-card', 'thumbnail', imagemPacote(l))),
      h('div', { class: 'dc-etiqueta exata' }, icone('escudo', { tamanho: 16 }), 'Imagem exata do pacote — é esta que vai para o Roblox'));
  }
  const incluidas = (l.propostaIds || []).map(id => propostas().find(p => p.id === id)).filter(Boolean);
  return h('div', { class: 'dc-heroi-bloco' },
    h('div', { class: 'dc-arquivo-jogo' }, h('div', { class: 'dc-arquivo-icone' }, icone('roblox', { tamanho: 34 })),
      h('div', {}, h('strong', {}, 'Arquivo do jogo'), h('div', { class: 'dc-fraco' }, [nomeArquivo(l), tamanhoMB(l.artefato?.tamanho)].filter(Boolean).join(' · ')))),
    incluidas.length ? h('div', { class: 'dc-incluidas' }, incluidas.map(p => h('figure', {}, miniaturaProposta(p, 'dc-midia-tira'), h('figcaption', {}, `${p.id} · ${curto(p.titulo, 40)}`)))) : null,
    incluidas.some(primeiraPrevia) ? h('div', { class: 'dc-etiqueta curiosidade' }, icone('lampada', { tamanho: 16 }), 'Imagens de referência — só explicam as ideias incluídas') : null);
}

function blocoCodigo(l) {
  const cod = codigoPacote(l);
  return h('div', { class: 'dc-codigo' },
    h('div', { class: 'dc-codigo-topo' }, icone('assinatura', { tamanho: 18 }), 'Código do pacote'),
    h('div', { class: 'dc-codigo-linha' }, h('span', { class: 'dc-codigo-valor', 'aria-label': `Código ${cod.split('').join(' ')}` }, cod || '—'), cod ? botaoCopiar(cod, 'Copiar') : null),
    h('p', { class: 'dc-codigo-explica' }, 'É a “impressão digital” desta versão. Se o arquivo mudar, o código muda e você autoriza de novo.'));
}

function cardAutorizacao(l) {
  const q = quandoPublica(l);
  const testesOk = l.testes?.resultado === 'aprovado';
  const semChave = ctx.estado?.chave?.estado !== 'registrada';
  const cod = codigoPacote(l);
  const card = h('article', { class: 'dc-autorizacao', id: `lanc-${l.id}` });

  const conf = h('input', { class: 'dc-campo dc-campo-codigo', type: 'text', id: `dc-conf-${l.id}`, maxlength: 8, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', inputmode: 'text', placeholder: '8 caracteres', 'aria-describedby': `dc-conf-dica-${l.id}` });
  const marca = h('span', { class: 'dc-conf-marca', 'aria-live': 'polite' });
  const coment = h('textarea', { class: 'dc-campo', rows: 2, maxlength: 2000, placeholder: 'Opcional. Obrigatório se for devolver.', 'aria-label': 'Comentário' });
  const autorizar = botaoDc('Autorizar publicação', { classe: 'dc-btn-amarelo dc-btn-grande', iconeNome: 'foguete', desativado: true });
  const confere = () => conf.value.trim().toLowerCase() === cod && !!cod;
  conf.addEventListener('input', () => {
    const ok = confere();
    autorizar.disabled = !ok || semChave || !testesOk;
    conf.classList.toggle('confere', ok);
    conf.classList.toggle('errado', conf.value.trim().length >= 8 && !ok);
    marca.replaceChildren(...(ok ? [icone('ok', { tamanho: 16 }), 'Código confere'] : conf.value.trim().length >= 8 ? [icone('alerta', { tamanho: 16 }), 'Não confere'] : []));
    marca.className = `dc-conf-marca ${ok ? 'ok' : 'bad'}`;
  });
  const colar = botaoDc('Colar', { classe: 'dc-btn-claro', iconeNome: 'copiar', onclick: async () => {
    try { conf.value = (await navigator.clipboard.readText()).trim().slice(0, 8); } catch { conf.value = cod; }
    conf.dispatchEvent(new Event('input'));
  } });
  autorizar.addEventListener('click', () => confirmarAutorizacao(l, coment));
  const devolver = botaoDc('Devolver para ajustes', { classe: 'dc-btn-claro', iconeNome: 'editar', onclick: () => confirmarLancamento(l, 'devolver', coment) });
  const bloquear = botaoDc('Bloquear', { classe: 'dc-btn-perigo', iconeNome: 'cadeado', onclick: () => confirmarLancamento(l, 'bloquear', coment) });

  card.append(...[
    h('header', { class: 'dc-aut-topo' },
      h('div', { class: 'dc-aut-selo' }, icone('assinatura', { tamanho: 22 })),
      h('div', {}, h('div', { class: 'dc-aut-sobre' }, 'Sua autorização'), h('h3', {}, tituloLanc(l, true))),
      seloStatus(l.status)),
    midiaDoLancamento(l),
    h('div', { class: 'dc-aut-fatos' },
      h('div', { class: 'dc-fato' }, icone('calendario', { tamanho: 22 }), h('div', {}, h('div', { class: 'dc-fato-rot' }, ehEvento(l) ? 'Começa' : 'Vai para o jogo'), h('strong', {}, q.dia), q.hora ? h('div', { class: 'dc-fato-sub' }, `às ${q.hora} (Brasília)${ehEvento(l) ? ' · fica 7 dias' : ''}`) : null)),
      h('div', { class: `dc-fato ${testesOk ? 'ok' : 'bad'}` }, icone(testesOk ? 'qualidade' : 'alerta', { tamanho: 22 }), h('div', {}, h('div', { class: 'dc-fato-rot' }, 'Testes'), h('strong', {}, testesOk ? 'Aprovados' : 'Não aprovados'),
        l.testes?.detalhes ? h('button', { type: 'button', class: 'dc-link', onclick: () => abrirFolha({ titulo: 'Testes feitos', conteudo: h('p', { class: 'dc-texto-folha' }, l.testes.detalhes) }) }, 'Ver testes') : null))),
    h('section', { class: 'dc-muda' }, h('h4', { class: 'dc-sub' }, icone('raio', { tamanho: 18 }), 'O que vai mudar'),
      (l.changelog || []).length ? h('ul', { class: 'dc-checks' }, l.changelog.slice(0, 5).map(c => h('li', {}, icone('ok', { tamanho: 16 }), h('span', {}, c)))) : h('p', { class: 'dc-fraco' }, '—'),
      (l.changelog || []).length > 5 ? h('button', { type: 'button', class: 'dc-link', onclick: () => folhaLancamento(l) }, `Ver mais ${l.changelog.length - 5}`) : null),
    blocoCodigo(l),
    semChave ? blocoChaveFaltando() : !testesOk ? h('div', { class: 'dc-alerta bad' }, icone('alerta', { tamanho: 20 }), h('div', {}, 'Os testes não foram aprovados; não dá para autorizar.')) : null,
    semChave || !ehDono() ? null : h('div', { class: 'dc-aut-passos' },
      h('label', { class: 'dc-rotulo', for: `dc-conf-${l.id}` }, h('span', { class: 'dc-num' }, '1'), 'Digite ou cole o código do pacote'),
      h('div', { class: 'dc-conf-linha' }, conf, colar),
      h('div', { class: 'dc-conf-dica', id: `dc-conf-dica-${l.id}` }, marca, h('span', { class: 'dc-fraco' }, 'Isto confirma que você conferiu esta versão.')),
      h('label', { class: 'dc-rotulo' }, h('span', { class: 'dc-num' }, '2'), 'Comentário (opcional)'), coment,
      h('div', { class: 'dc-rotulo' }, h('span', { class: 'dc-num' }, '3'), 'Autorize'),
      autorizar,
      h('div', { class: 'dc-rodape-linha' }, devolver, bloquear)),
    h('button', { type: 'button', class: 'dc-link dc-centro', onclick: () => folhaLancamento(l) }, icone('noticia', { tamanho: 16 }), 'Riscos, como desfazer e detalhes técnicos')].filter(Boolean));
  return card;
}

function confirmarAutorizacao(l, coment) {
  const q = quandoPublica(l);
  abrirFolha({
    titulo: 'Autorizar a publicação?',
    conteudo: fechar => {
      const voltar = botaoDc('Voltar', { classe: 'dc-btn-claro', onclick: fechar });
      const ok = botaoDc('Sim, autorizar', { classe: 'dc-btn-amarelo dc-btn-grande', iconeNome: 'foguete' });
      ok.addEventListener('click', async () => {
        const antes = l.status;
        await ctx.gravar('/api/lancamentos/decisao', { lancamentoId: l.id, acao: 'autorizar', artefatoSha256: l.artefato?.sha256, comentario: coment.value }, [ok, voltar], 'Autorização gravada e assinada por este aparelho.');
        const agora = lancamentos().find(x => x.id === l.id);
        if (agora && agora.status !== antes) fechar();
      });
      return h('div', { class: 'dc-confirma' },
        h('div', { class: 'dc-confirma-icone amarelo' }, icone('foguete', { tamanho: 30 })),
        h('p', { class: 'dc-confirma-texto' }, ehEvento(l) ? `O evento é criado na página do jogo logo depois desta autorização e começa ${q.dia.toLowerCase()}${q.hora ? ` às ${q.hora}` : ''}.` : `Esta versão vai para o jogo ${q.dia.toLowerCase()}${q.hora ? ` às ${q.hora}` : ''}, sozinha.${l.urgente && q.hora ? ' Se você autorizar depois desse horário, ela sai na hora.' : ''}`),
        h('div', { class: 'dc-confirma-codigo' }, 'Vale só para o código ', h('strong', {}, codigoPacote(l)), '. Se o arquivo mudar, esta autorização deixa de valer sozinha.'),
        h('div', { class: 'dc-confirma-botoes' }, ok, voltar));
    },
  });
}

function confirmarLancamento(l, acao, comentOrigem) {
  const ehDevolver = acao === 'devolver';
  abrirFolha({
    titulo: ehDevolver ? 'Devolver para ajustes' : 'Bloquear esta publicação?',
    conteudo: fechar => {
      const campo = h('textarea', { class: 'dc-campo', rows: 3, maxlength: 2000, placeholder: ehDevolver ? 'O que precisa ser ajustado?' : 'Motivo (opcional)', 'aria-label': 'Comentário' }, comentOrigem?.value || '');
      const erro = h('p', { class: 'dc-erro', role: 'alert', hidden: true }, 'Explique o que precisa ser ajustado.');
      const voltar = botaoDc('Voltar', { classe: 'dc-btn-claro', onclick: fechar });
      const ok = botaoDc(ehDevolver ? 'Devolver' : 'Sim, bloquear', { classe: `${ehDevolver ? 'dc-btn-roxo' : 'dc-btn-perigo-cheio'} dc-btn-grande`, iconeNome: ehDevolver ? 'editar' : 'cadeado' });
      ok.addEventListener('click', async () => {
        if (ehDevolver && !campo.value.trim()) { erro.hidden = false; campo.focus(); return; }
        const antes = l.status;
        await ctx.gravar('/api/lancamentos/decisao', { lancamentoId: l.id, acao, artefatoSha256: l.artefato?.sha256, comentario: campo.value }, [ok, voltar], ehDevolver ? 'Devolvido para ajustes.' : 'Publicação bloqueada.');
        const agora = lancamentos().find(x => x.id === l.id);
        if (agora && agora.status !== antes) fechar();
      });
      return h('div', { class: 'dc-confirma' },
        h('div', { class: `dc-confirma-icone ${ehDevolver ? 'amarelo' : 'vermelho'}` }, icone(ehDevolver ? 'editar' : 'cadeado', { tamanho: 30 })),
        h('p', { class: 'dc-confirma-texto' }, ehDevolver ? 'A equipe ajusta e prepara um pacote novo. Você autoriza de novo depois.' : 'Nada é publicado. A equipe precisa de uma nova decisão sua para continuar.'),
        h('label', { class: 'dc-rotulo' }, ehDevolver ? 'O que ajustar (obrigatório)' : 'Motivo (opcional)'), campo, erro,
        h('div', { class: 'dc-confirma-botoes' }, ok, voltar));
    },
  });
}

function folhaLancamento(l) {
  const linha = (ic, titulo, conteudo) => h('div', { class: 'dc-linha-det' }, h('div', { class: 'dc-info-icone' }, icone(ic, { tamanho: 18 })), h('div', {}, h('div', { class: 'dc-info-titulo' }, titulo), h('div', { class: 'dc-linha-valor' }, conteudo || '—')));
  const a = l.autorizacao?.dados;
  abrirFolha({
    titulo: `Detalhes de ${l.id}`,
    conteudo: h('div', { class: 'dc-folha-det' },
      linha('raio', 'O que muda', (l.changelog || []).length ? h('ul', { class: 'dc-ul' }, l.changelog.map(c => h('li', {}, c))) : null),
      linha('qualidade', 'Testes', l.testes ? `${l.testes.resultado === 'aprovado' ? 'Aprovados' : 'Não aprovados'}${l.testes.detalhes ? ` — ${l.testes.detalhes}` : ''}` : null),
      linha('alerta', 'O que pode dar errado', l.riscos),
      linha('esquerda', 'Como desfazer', l.planoReversao),
      linha('decisoes', 'Propostas incluídas', (l.propostaIds || []).join(', ')),
      linha('assinatura', 'Sua autorização', a ? `Assinada por ${a.por} em ${dataHora(a.em)}; vale até ${dataHora(a.expiraEm)}.` : 'Ainda não autorizada.'),
      linha('roblox', 'Arquivo', [nomeArquivo(l), tamanhoMB(l.artefato?.tamanho)].filter(Boolean).join(' · ')),
      linha('cadeado', 'Código completo (SHA-256)', h('code', { class: 'dc-hash' }, l.artefato?.sha256 || '—'))),
  });
}

function cardLancamentoCompacto(l) {
  const q = quandoPublica(l);
  const incl = (l.propostaIds || []).map(id => propostas().find(p => p.id === id)).filter(Boolean);
  const mini = pacoteEhImagem(l) ? moldura('dc-midia-card', ehEvento(l) ? 'evento' : 'thumbnail', imagemPacote(l)) : incl[0] ? miniaturaProposta(incl[0]) : moldura('dc-midia-card', 'roblox', null);
  return h('button', { type: 'button', class: 'dc-card-proposta', onclick: () => abrirLancamento(l.id), 'aria-label': `Abrir publicação ${l.id}` },
    mini,
    h('div', { class: 'dc-card-corpo' },
      h('div', { class: 'dc-card-chips' }, seloStatus(l.status), chipTipoLanc(l)),
      h('h3', { class: 'dc-card-titulo' }, curto((l.changelog || [])[0] || l.id, 80)),
      h('p', { class: 'dc-card-resumo' }, `${l.id} · código ${codigoPacote(l) || '—'}`),
      h('div', { class: 'dc-card-pe' }, h('span', { class: 'dc-pe-data' }, icone('calendario', { tamanho: 16 }), l.publicadoEm ? `Publicada ${dataCurta(l.publicadoEm)}` : q.texto), h('span', { class: 'dc-pe-abrir' }, 'Ver', icone('direita', { tamanho: 18 })))));
}

function abrirLancamento(id) {
  const l = lancamentos().find(x => x.id === id);
  if (!l) return;
  const q = quandoPublica(l);
  const a = l.autorizacao?.dados;
  abrirModal({
    titulo: tituloLanc(l),
    classe: 'dc-modal',
    conteudo: h('div', { class: 'dc-detalhe' },
      midiaDoLancamento(l),
      h('div', { class: 'dc-card-chips' }, seloStatus(l.status), chip(l.id, { iconeNome: 'foguete' })),
      h('div', { class: 'dc-aut-fatos' },
        h('div', { class: 'dc-fato' }, icone('calendario', { tamanho: 22 }), h('div', {}, h('div', { class: 'dc-fato-rot' }, l.publicadoEm ? 'Publicada em' : ehEvento(l) ? 'Começa' : 'Vai para o jogo'), h('strong', {}, l.publicadoEm ? dataHora(l.publicadoEm) : q.dia), !l.publicadoEm && q.hora ? h('div', { class: 'dc-fato-sub' }, `às ${q.hora}`) : null)),
        h('div', { class: `dc-fato ${a ? 'ok' : ''}` }, icone('assinatura', { tamanho: 22 }), h('div', {}, h('div', { class: 'dc-fato-rot' }, 'Sua autorização'), h('strong', {}, a ? 'Assinada' : 'Ainda não'), a ? h('div', { class: 'dc-fato-sub' }, `vale até ${dataCurta(a.expiraEm)}`) : null))),
      h('section', { class: 'dc-muda' }, h('h4', { class: 'dc-sub' }, icone('raio', { tamanho: 18 }), 'O que muda'),
        (l.changelog || []).length ? h('ul', { class: 'dc-checks' }, l.changelog.map(c => h('li', {}, icone('ok', { tamanho: 16 }), h('span', {}, c)))) : h('p', { class: 'dc-fraco' }, '—')),
      blocoCodigo(l),
      botaoDc('Riscos, como desfazer e detalhes', { classe: 'dc-btn-claro dc-largo', iconeNome: 'noticia', onclick: () => folhaLancamento(l) }),
      blocoComentarios('lancamento', l.id)),
  });
}

// ------------------------------------------------------------------ tela
export function telaDecisoes() {
  if (!ctx.estado?.dados) return vazio('Carregando…', 'relogio');
  const sub = ctx.estado.sub || (ctx.estado.sub = {});
  const todasP = [...propostas()].reverse();
  const todasL = [...lancamentos()].reverse();
  const ideiasPendentes = todasP.filter(p => DECIDIVEIS.includes(p.status) && !p.bloqueio).length;
  const pubPendentes = todasL.filter(l => l.status === ST.AGUARDANDO_FINAL).length;

  // Área padrão: se há publicação esperando, ela vem primeiro (é a etapa mais importante).
  const area = sub.decisoesArea || (pubPendentes ? 'publicacoes' : 'ideias');
  const filtro = sub.decisoes && SUBABAS.some(s => s[0] === sub.decisoes) ? sub.decisoes : 'aberto';
  const escolher = (chave, valor) => { sub[chave] = valor; ctx.render?.(); };

  const botaoArea = (id, iconeNome, n, rotulo, explica) => h('button', {
    type: 'button', class: `dc-area${area === id ? ' ativa' : ''}${n ? ' tem' : ''}`, 'aria-pressed': String(area === id),
    onclick: () => { sub.decisoesArea = id; sub.decisoes = n ? 'aberto' : sub.decisoes; ctx.render?.(); },
  },
  h('span', { class: 'dc-area-icone' }, icone(iconeNome, { tamanho: 26 })),
  h('span', { class: 'dc-area-num' }, String(n)),
  h('span', { class: 'dc-area-rotulo' }, rotulo),
  h('span', { class: 'dc-area-explica' }, explica),
  h('span', { class: 'dc-area-ir' }, n ? 'Abrir' : 'Ver', icone('direita', { tamanho: 16 })));

  const grupos = area === 'ideias' ? GRUPOS_PROPOSTA : GRUPOS_LANCAMENTO;
  const base = area === 'ideias' ? todasP : todasL;
  const contagem = Object.fromEntries(SUBABAS.map(([id]) => [id, base.filter(grupos[id]).length]));
  const lista = base.filter(grupos[filtro]);
  const explicacao = SUBABAS.find(s => s[0] === filtro)[2];

  // Ideias do dono ainda sem proposta aparecem já em "Em aberto", antes das propostas.
  const preparando = area === 'ideias' && filtro === 'aberto' ? (dados().ideias?.itens || []).filter(i => ['nova', 'analise'].includes(i.status)).reverse() : [];
  let conteudo;
  if (preparando.length) {
    conteudo = h('div', { class: 'dc-grade-cards' }, preparando.map(cardIdeiaPreparando), lista.map(cardProposta));
  } else if (!lista.length) {
    const msgs = {
      ideias: { aberto: 'Nenhuma ideia esperando você. Novas propostas chegam toda terça.' },
      publicacoes: { aberto: 'Nada para autorizar agora. Quando um pacote ficar pronto, ele aparece aqui.' },
    };
    conteudo = vazio(msgs[area][filtro] || 'Nada por aqui.', filtro === 'aberto' ? 'ok' : 'calendario');
  } else if (area === 'ideias') {
    conteudo = h('div', { class: 'dc-grade-cards' }, lista.map(cardProposta));
  } else {
    const aguardando = lista.filter(l => l.status === ST.AGUARDANDO_FINAL);
    const outros = lista.filter(l => l.status !== ST.AGUARDANDO_FINAL);
    conteudo = h('div', { class: 'dc-pilha' },
      aguardando.map(cardAutorizacao),
      outros.length ? h('div', { class: 'dc-grade-cards' }, outros.map(cardLancamentoCompacto)) : null);
  }

  // Meta da semana: no mínimo 7 propostas (3 entretenimento, 2 crescimento, 1 otimização, 1 correção).
  const META = { entretenimento: 3, crescimento: 2, otimizacao: 1, correcao: 1 };
  const limite = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
  const daSemana = todasP.filter(p => String(p.criadaEm || '') >= limite);
  const feitas = Object.fromEntries(Object.keys(META).map(c => [c, daSemana.filter(p => p.categoria === c).length]));
  const totalFeitas = Object.keys(META).reduce((n, c) => n + Math.min(META[c], feitas[c]), 0);
  const blocoSemana = area !== 'ideias' ? null : h('div', { class: 'dc-meta-semana' },
    h('div', { class: 'dc-meta-topo' }, icone('calendario', { tamanho: 18 }), h('strong', {}, `Propostas da semana: ${totalFeitas} de 7`),
      h('span', { class: 'dc-fraco' }, totalFeitas >= 7 ? 'semana completa' : 'chegam toda segunda e terça')),
    h('div', { class: 'dc-card-chips' }, Object.entries(META).map(([c, meta]) => {
      const [nome, ic] = CATEGORIAS[c];
      return chip(`${nome} ${Math.min(meta, feitas[c])}/${meta}`, { tom: feitas[c] >= meta ? 'ok' : '', iconeNome: ic });
    })));

  return h('div', { class: 'tela-decisoes' },
    h('div', { class: 'dc-areas' },
      botaoArea('ideias', 'lampada', ideiasPendentes, 'Ideias para aprovar', 'Libere a equipe para preparar'),
      botaoArea('publicacoes', 'foguete', pubPendentes, 'Publicações para autorizar', 'Libere o que vai para o jogo')),
    blocoSemana,
    h('div', { class: 'dc-filtros', role: 'tablist', 'aria-label': 'Filtrar por situação' },
      SUBABAS.map(([id, nome]) => h('button', { type: 'button', role: 'tab', class: 'dc-filtro', 'aria-selected': String(filtro === id), onclick: () => escolher('decisoes', id) },
        nome, h('span', { class: 'dc-filtro-n' }, String(contagem[id]))))),
    h('p', { class: 'dc-explica-filtro' }, icone('filtro', { tamanho: 16 }), explicacao),
    conteudo);
}
