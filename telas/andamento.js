// Histórico visual do desenvolvimento. Só exibe evidências registradas, sem simular capturas.
import { h, icone, chip, abrirModal, abrirFolha } from '../ui/componentes.js?v=20261026-agenda2';
import { ctx } from '../ui/contexto.js?v=20261026-agenda2';
import { semanaDe } from '../nucleo/andamento.js?v=20261026-agenda2';
import { revisaoDaEtapa, podeRevisarEntrega } from '../nucleo/revisao-etapas.js?v=20261026-agenda2';
import { dataHoraBrasilia, rotuloEtapa } from '../nucleo/central-avisos.js?v=20261026-agenda2';
import { dataBR } from './comum.js?v=20261026-agenda2';
import { agruparAndamento, estadoAndamento } from '../nucleo/andamento-propostas.js?v=20261025-propostas1';

const CATEGORIAS = { cenario: ['Cenário', 'imagem'], script: ['Scripts', 'tarefas'], interface: ['Interface', 'celular'], teste: ['Testes', 'qualidade'], toolbox: ['Toolbox', 'martelo'], geral: ['Geral', 'relogio'] };
const urls = new Map();
function semanaRotulo(s) {
  const fim = new Date(`${s}T12:00:00-03:00`); fim.setUTCDate(fim.getUTCDate() + 6);
  return `${dataBR(s)} a ${dataBR(fim.toISOString().slice(0, 10))}`;
}
function midia(m, miniatura = false) {
  const lugar = h('div', { class: 'and-midia-espera' }, icone(m.tipo === 'video' ? 'play' : 'imagem'), 'Carregando…');
  let player = null;
  const carregar = async () => {
    try {
      if (!urls.has(m.caminho)) urls.set(m.caminho, ctx.estado.repo.lerMidiaAndamento(m.caminho).then(b => { if (!b) throw Error(); return URL.createObjectURL(b); }).catch(e => { urls.delete(m.caminho); throw e; }));
      const url = await urls.get(m.caminho);
      if (m.tipo === 'video') {
        player = h('video', { src: url, controls: true, playsinline: true, preload: 'metadata', 'aria-label': m.legenda });
        lugar.replaceChildren(player);
      } else {
        const imagem = h('img', { src: url, alt: miniatura ? '' : m.legenda, loading: 'lazy' });
        lugar.replaceChildren(miniatura ? imagem : h('button', { class: 'and-ampliar', type: 'button', 'aria-label': `Ampliar: ${m.legenda}`, onclick: () => abrirModal({ titulo: m.legenda, conteudo: h('img', { class: 'and-imagem-ampliada', src: url, alt: m.legenda }) }) }, imagem));
      }
    } catch { lugar.replaceChildren(miniatura ? icone('imagem') : h('button', { class: 'btn', type: 'button', onclick: carregar }, 'Tentar carregar novamente')); }
  };
  if (m.tipo === 'video') lugar.replaceChildren(h('button', { class: 'btn', type: 'button', onclick: carregar }, icone('direita'), `Carregar vídeo (${(m.tamanho / 1048576).toFixed(1)} MB)`));
  else carregar();
  return h('figure', { class: 'and-midia' }, lugar, miniatura ? null : h('figcaption', {}, m.legenda));
}
const ROTULO_REVISAO = { sem_prazo: 'Entrega registrada', aguardando: 'Revisão da entrega aberta', aguardando_equipe: 'Prazo encerrado · agentes podem validar', validada_equipe: 'Entrega validada pela equipe', aprovada: 'Entrega aprovada por você', aprovada_automaticamente: 'Entrega aceita pela regra anterior', ajustes_solicitados: 'Alteração solicitada', negada: 'Entrega negada por você' };
function revisar(r, acao = 'ajustes') {
  const conversa = h('div', { class: 'and-conversa', 'aria-live': 'polite' });
  const atualizarConversa = () => {
    const lista = (ctx.estado.dados.comentarios?.itens || []).filter(c => c.alvoTipo === 'andamento' && c.alvoId === r.id);
    conversa.replaceChildren(...(lista.length ? lista.map(c => h('div', { class: 'comentario' }, h('strong', {}, c.por?.nome || 'Equipe'), h('small', {}, dataBR(c.em)), h('p', {}, c.texto))) : [h('p', { class: 'sinc' }, 'Ainda sem comentários.')]));
  };
  atualizarConversa();
  window.addEventListener('gamesup:dadosatualizados', atualizarConversa);
  const dono = ctx.estado.usuario?.papel === 'proprietario';
  const negar = acao === 'negar';
  const campo = h('textarea', { rows: 3, maxlength: 2000, placeholder: negar ? 'Justifique por que esta etapa não foi aceita…' : 'Ex.: melhore a urna, aumente o ícone ou mude esta cor…', 'aria-label': negar ? 'Justificativa obrigatória para negar' : `Comentário sobre ${r.titulo}`, required: true });
  const enviar = h('button', { class: 'btn primario', type: 'button', onclick: async () => {
    if (!campo.value.trim()) { campo.focus(); return; }
    const ok = await ctx.gravar(dono ? '/api/andamento/decisao' : '/api/comentarios', dono ? { registroId: r.id, acao, comentario: campo.value } : { alvoTipo: 'andamento', alvoId: r.id, texto: campo.value }, [enviar], dono ? negar ? 'Etapa negada com justificativa.' : 'Pedido de melhoria enviado. Etapa pendente de ajuste.' : 'Comentário enviado.');
    if (ok) campo.value = '';
  } }, icone(negar ? 'alerta' : 'chat'), dono ? negar ? 'Negar com justificativa' : 'Enviar e pedir melhoria' : 'Enviar comentário');
  abrirFolha({ titulo: `${negar ? 'Negar etapa' : 'Comentários'} · ${r.titulo}`, aoFechar: () => window.removeEventListener('gamesup:dadosatualizados', atualizarConversa), conteudo: h('div', { class: 'and-comentarios' },
    h('p', {}, dono ? negar ? 'A justificativa é obrigatória. A equipe precisará corrigir e registrar uma nova entrega.' : 'Seu pedido registra a alteração necessária. Depois do ajuste, a equipe enviará uma nova entrega com evidências.' : 'Envie sua observação para a equipe.'),
    conversa, campo, enviar) });
}
function revisao(r) {
  const status = h('strong');
  const prazo = h('p', { class: 'sinc' });
  const acoes = h('div', { class: 'acoes' });
  const box = h('section', { class: 'and-revisao' }, status, prazo, acoes);
  const dono = ctx.estado.usuario?.papel === 'proprietario';
  const btn = h('button', { class: 'btn primario', type: 'button', onclick: () => ctx.gravar('/api/andamento/decisao', { registroId: r.id, acao: 'aprovar' }, [btn], 'Entrega aprovada.') }, icone('ok'), 'Aprovar entrega');
  const negar = h('button', { class: 'btn perigo', type: 'button', onclick: () => revisar(r, 'negar') }, icone('alerta'), 'Negar entrega');
  const n = (ctx.estado.dados.comentarios?.itens || []).filter(c => c.alvoTipo === 'andamento' && c.alvoId === r.id).length;
  const comentar = h('button', { class: 'btn', type: 'button', onclick: () => revisar(r) }, icone('chat'), `Comentar / pedir alteração (${n})`);
  let anterior;
  const atualizar = () => {
    const dados = ctx.estado.dados.andamento;
    const atual = dados?.registros?.find(item => item.id === r.id) || r;
    const rev = revisaoDaEtapa(dados, atual);
    status.textContent = ROTULO_REVISAO[rev.status] || 'Entrega registrada';
    prazo.textContent = rev.status === 'aguardando' ? `Revisão aberta por mais ${Math.max(0, Math.ceil((Date.parse(rev.limiteEm) - Date.now()) / 1000))} s. Depois do prazo, os agentes podem validar. Você pode comentar ou pedir alteração a qualquer momento.`
      : rev.status === 'aguardando_equipe' ? 'Os agentes podem validar a entrega. Ainda não há validação da equipe confirmada. Você pode comentar ou pedir alteração.'
        : rev.status === 'validada_equipe' ? `Validação registrada por ${rev.por?.nome || 'Equipe'} em ${dataHoraBrasilia(rev.em)}. ${rev.parecer || rev.comentario || ''} Você pode comentar ou pedir alteração. A publicação tem autorização final separada.`
        : ['ajustes_solicitados', 'negada'].includes(rev.status) ? atual.revisao?.comentario || 'A equipe precisa revisar esta entrega.' : 'Revisão da entrega de desenvolvimento. A publicação tem autorização final separada.';
    const chave = `${rev.status}:${rev.prazoEncerrado === true}`;
    if (anterior !== chave) {
      acoes.replaceChildren(...(dono && podeRevisarEntrega(rev) ? [btn, negar] : []), comentar);
      anterior = chave;
    }
  };
  atualizar();
  const timer = setInterval(() => { if (!box.isConnected) clearInterval(timer); else atualizar(); }, 1000);
  return box;
}
function registroCompleto(r) {
  const [categoria, desenho] = CATEGORIAS[r.tipo] || CATEGORIAS.geral;
  const detalhes = h('button', { class: 'btn', type: 'button', onclick: () => abrirFolha({
    titulo: 'Explorer e testes', conteudo: h('div', {},
      r.alteracoes?.length ? h('section', { class: 'and-explorer' }, h('h3', {}, icone('tarefas'), 'Onde está e o que faz'), r.alteracoes.map(a => h('div', { class: 'and-alteracao' },
        h('code', {}, a.caminho), h('p', { class: 'and-detalhes-texto' }, a.funcao), a.tipo ? chip(a.tipo) : null, a.shared ? h('p', { class: 'sinc and-detalhes-texto' }, 'Shared: ', a.shared) : null)))
        : h('p', { class: 'sinc' }, 'Nenhuma alteração no Explorer registrada nesta etapa.'),
      h('div', { class: 'and-testes' }, h('strong', {}, 'Organização e testes'), h('p', { class: 'and-detalhes-texto' }, r.testes || 'Testes não informados neste registro.')),
      r.testesExecutados?.length ? h('section', { class: 'and-testes' }, h('h3', {}, 'Testes executados'), r.testesExecutados.map(t => h('div', { class: 'and-alteracao' },
        h('strong', {}, `${t.id || ''} · ${t.resultado || 'Resultado não informado'}`),
        ['ambiente', 'procedimento', 'esperado', 'obtido', 'descricao', 'detalhes'].filter(k => t[k]).map(k => h('p', { class: 'and-detalhes-texto' }, h('strong', {}, `${({ ambiente: 'Ambiente', procedimento: 'Procedimento', esperado: 'Esperado', obtido: 'Obtido', descricao: 'Descrição', detalhes: 'Detalhes' })[k]}: `), t[k])),
        t.executadoEm || t.em ? h('time', {}, dataHoraBrasilia(t.executadoEm || t.em)) : null,
        t.artefatoSha256 ? h('p', { class: 'sinc and-detalhes-texto' }, 'Artefato SHA-256: ', t.artefatoSha256) : null,
        ['requisitoIds', 'checklistIds', 'evidencias'].filter(k => t[k]?.length).map(k => h('p', { class: 'sinc and-detalhes-texto' }, `${({ requisitoIds: 'Requisitos', checklistIds: 'Checklist', evidencias: 'Evidências' })[k]}: `, t[k].join('\n')))))) : null,
      r.toolbox ? h('div', { class: 'and-testes' }, h('strong', {}, `Decoração Toolbox · asset ${r.toolbox.assetId}`), h('p', { class: 'and-detalhes-texto' }, r.toolbox.compatibilidade), h('p', { class: 'and-detalhes-texto' }, r.toolbox.verificacao),
        chip(r.toolbox.inspecionado === true && r.toolbox.semCodigo === true ? 'Inspecionado · sem código embarcado' : 'Verificação não confirmada', { iconeNome: 'qualidade' })) : null),
  }) }, icone('tarefas'), 'Ver Explorer e testes');
  return h('article', { class: 'card and-registro', 'data-registro-id': r.id },
    h('div', { class: 'chips-linha' }, chip(categoria, { iconeNome: desenho }), chip(r.propostaId), chip(rotuloEtapa(r))),
    h('time', { datetime: r.em }, dataHoraBrasilia(r.em)),
    h('h2', {}, r.titulo),
    r.midias?.length ? h('div', { class: 'and-midias' }, r.midias.map(m => midia(m))) : h('p', { class: 'sinc' }, 'Este registro ainda não tem print ou vídeo.'),
    revisao(r),
    h('div', { class: 'acoes' }, detalhes, h('button', { type: 'button', class: 'btn', onclick: () => ctx.irPara('decisoes', { tipo: 'proposta', id: r.propostaId }) }, icone('decisoes'), 'Ver em Decisões')),
    h('h3', {}, 'Relato completo'), h('p', { class: 'and-detalhes-texto' }, r.descricao),
    h('p', { class: 'sinc' }, `Registrado por ${typeof r.por === 'object' ? r.por?.nome || 'Equipe' : r.por || 'Equipe'} · ${r.id}`));
}

let folhaRegistro = null;
export function abrirRegistro(r) {
  if (folhaRegistro?.caixa.isConnected && folhaRegistro.id === r.id) return folhaRegistro;
  folhaRegistro = { ...abrirFolha({ titulo: 'Imagens, vídeos e revisão', classe: 'and-folha-registro', conteudo: registroCompleto(r),
    aoFechar: () => {
      folhaRegistro = null;
      if (ctx.estado.aba === 'andamento' && ctx.estado.sub.andamento?.id === r.id) {
        const { id, ...resto } = ctx.estado.sub.andamento;
        ctx.estado.sub.andamento = resto;
        ctx.render();
      }
    } }), id: r.id };
  return folhaRegistro;
}

function registro(r) {
  const rev = revisaoDaEtapa(ctx.estado.dados.andamento, r);
  return h('article', { class: 'card and-registro and-registro-compacto', 'data-registro-id': r.id },
    h('div', { class: 'and-registro-miniatura', 'aria-hidden': 'true' }, icone(r.midias?.some(m => m.tipo === 'video') ? 'play' : 'tarefas')),
    h('div', { class: 'and-registro-chamada' }, h('h2', {}, r.titulo), h('time', { datetime: r.em }, dataHoraBrasilia(r.em)),
      h('span', { class: 'sinc' }, `${rotuloEtapa(r)} · ${r.midias?.length || 0} evidência(s) · ${ROTULO_REVISAO[rev.status] || 'Entrega registrada'}`)),
    h('button', { type: 'button', class: 'btn', 'aria-label': `Abrir: ${r.titulo}`, onclick: () => ctx.irPara('andamento', { ...ctx.estado.sub.andamento, id: r.id }) }, 'Abrir'));
}

function estadoDaProposta(p, detalhado = false) {
  const box = h('div', { class: 'and-estado', 'aria-live': 'polite' });
  const atualizar = () => {
    const dados = ctx.estado.dados;
    const atual = (dados.propostas?.propostas || []).find(item => item.id === p.id) || p;
    const estado = estadoAndamento(atual, dados);
    box.replaceChildren(chip(estado.texto, { tom: estado.tom }), ...(detalhado ? [h('p', { class: 'sinc' }, estado.detalhe)] : []));
  };
  atualizar();
  const timer = setInterval(() => { if (!box.isConnected) clearInterval(timer); else atualizar(); }, 1000);
  return box;
}

function abrirProposta(grupo) {
  const { proposta: p } = grupo;
  const registros = (agruparAndamento(ctx.estado.dados).find(g => g.proposta.id === p.id) || grupo).registros;
  abrirFolha({ titulo: p.titulo, classe: 'and-folha-proposta', conteudo: h('div', { class: 'and-proposta-detalhes' },
    estadoDaProposta(p, true),
    h('p', {}, `${registros.length} registro(s) · histórico completo desta proposta, de todas as semanas.`),
    h('p', { class: 'sinc' }, 'Abra um registro para ver evidências, comentários, revisão e testes.'),
    registros.length ? h('div', { class: 'and-registros-proposta' }, registros.map(registro)) : h('p', {}, 'Ainda não há registros de desenvolvimento.'),
    p.historica ? null : h('button', { type: 'button', class: 'btn', onclick: () => ctx.irPara('decisoes', { tipo: 'proposta', id: p.id }) }, icone('decisoes'), 'Ver proposta em Decisões')) });
}

function proposta(grupo) {
  const p = grupo.proposta;
  const previa = (p.previas || []).find(c => /\.(png|jpe?g|webp)$/i.test(c));
  const rotuloImagem = /previas\/capas\//.test(previa || '') ? 'Capa sugerida do evento' : p.tipo === 'thumbnail' || /previas\/thumbnails\//.test(previa || '') ? 'Thumbnail proposta' : 'Imagem de referência';
  const imagem = previa && typeof ctx.imagemPrivada === 'function' ? ctx.imagemPrivada(previa, { alt: `${rotuloImagem}: ${p.titulo}`, classe: 'and-proposta-imagem' }) : null;
  return h('article', { class: 'and-proposta-card', 'data-proposta-id': p.id },
    h('div', { class: 'and-proposta-miniatura' }, imagem || icone('imagem')),
    h('div', { class: 'and-proposta-chamada' }, h('h2', {}, p.titulo),
      h('span', { class: 'sinc' }, `${p.id} · ${rotuloImagem}`),
      estadoDaProposta(p), h('span', { class: 'and-contador' }, `${grupo.registros.length} registro(s)`)),
    h('button', { type: 'button', class: 'btn', 'aria-label': `Ver registros: ${p.titulo}`, onclick: () => abrirProposta(grupo) }, 'Abrir'));
}

export function telaAndamento() {
  const dados = ctx.estado.dados;
  const lista = [...(dados.andamento?.registros || [])].sort((a, b) => b.em.localeCompare(a.em));
  const semanas = [...new Set([semanaDe(), ...lista.map(r => r.semana)])].sort().reverse();
  const selecao = ctx.estado.sub.andamento || {};
  // Um link de aviso abre só o registro solicitado, inclusive de semanas antigas.
  // Não monta todos os players, revisões e descrições do histórico para abrir uma entrega.
  if (selecao.id) {
    const alvo = lista.find(r => r.id === selecao.id);
    const pagina = h('div', { class: 'pagina-andamento' }, h('section', { class: 'card and-resumo' },
      h('h1', { tabindex: '-1' }, alvo ? 'Registro selecionado' : 'Registro não encontrado'),
      h('p', {}, alvo ? alvo.titulo : 'Atualize o Andamento para procurar este registro novamente.'),
      alvo ? h('button', { type: 'button', class: 'btn primario', onclick: () => abrirRegistro(alvo) }, 'Abrir imagens, vídeos e revisão') : null,
      h('button', { type: 'button', class: 'btn', onclick: () => ctx.irPara('andamento') }, 'Ver histórico')));
    if (alvo) queueMicrotask(() => {
      if (!pagina.isConnected || ctx.estado.sub.andamento?.id !== alvo.id) return;
      const comentar = ctx.estado.sub.andamento.comentar === true;
      delete ctx.estado.sub.andamento.comentar;
      abrirRegistro(alvo);
      if (comentar) revisar(alvo);
    });
    return pagina;
  }
  const semana = semanas.includes(selecao.semana) ? selecao.semana : '';
  const filtro = selecao.proposta || '';
  const select = h('select', { 'aria-label': 'Semana do desenvolvimento', onchange: e => { ctx.estado.sub.andamento = { ...selecao, semana: e.target.value }; ctx.render(); } }, h('option', { value: '', selected: !semana }, 'Todas as semanas'), semanas.map(s => h('option', { value: s, selected: s === semana }, `Semana ${semanaRotulo(s)}`)));
  const grupos = agruparAndamento(dados);
  const propostas = grupos.map(g => g.proposta);
  const filtroProposta = h('select', { 'aria-label': 'Filtrar por proposta', onchange: e => { ctx.estado.sub.andamento = { ...selecao, semana, proposta: e.target.value }; ctx.render(); } }, h('option', { value: '' }, 'Todas as propostas'), propostas.map(p => h('option', { value: p.id, selected: p.id === filtro }, `${p.id} · ${p.titulo}`)));
  const visiveis = grupos.filter(g => (!filtro || g.proposta.id === filtro) && (!semana || g.registros.some(r => r.semana === semana)));
  return h('div', { class: 'pagina-andamento' },
    h('section', { class: 'card and-resumo' }, h('h2', {}, icone('imagem'), 'Andamento por proposta'), h('p', {}, 'Cada proposta reúne seu histórico. Abra para ver os registros, evidências, comentários e revisão.'),
      h('button', { type: 'button', class: 'btn', onclick: () => ctx.recarregar().catch(e => ctx.avisar(e.message, true)) }, icone('relogio'), 'Atualizar andamento')),
    h('div', { class: 'and-filtros' }, h('label', {}, 'Semana', select), h('label', {}, 'Proposta', filtroProposta)),
    h('p', { class: 'sinc' }, `${visiveis.length} proposta(s) nesta seleção`),
    visiveis.length ? h('div', { class: 'and-propostas' }, visiveis.map(proposta))
      : h('section', { class: 'card vazio-card' }, icone('imagem', { tamanho: 36 }), h('h2', {}, 'Nenhuma proposta nesta seleção'), h('p', {}, 'Propostas aprovadas e históricos de desenvolvimento aparecerão aqui.')));
}
