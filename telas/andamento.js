// Histórico visual do desenvolvimento. Só exibe evidências registradas, sem simular capturas.
import { h, icone, chip, abrirModal } from '../ui/componentes.js';
import { ctx } from '../ui/contexto.js';
import { semanaDe } from '../nucleo/andamento.js';
import { dataBR, chipStatus } from './comum.js';

const CATEGORIAS = { cenario: ['Cenário', 'imagem'], script: ['Scripts', 'tarefas'], interface: ['Interface', 'celular'], teste: ['Testes', 'qualidade'], toolbox: ['Toolbox', 'martelo'], geral: ['Geral', 'relogio'] };
const urls = new Map();
const dd = d => new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit' });
function semanaRotulo(s) {
  const fim = new Date(`${s}T12:00:00-03:00`); fim.setUTCDate(fim.getUTCDate() + 6);
  return `${dataBR(s)} a ${dataBR(fim.toISOString().slice(0, 10))}`;
}
function midia(m) {
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
        const imagem = h('img', { src: url, alt: m.legenda, loading: 'lazy' });
        lugar.replaceChildren(h('button', { class: 'and-ampliar', type: 'button', 'aria-label': `Ampliar: ${m.legenda}`, onclick: () => abrirModal({ titulo: m.legenda, conteudo: h('img', { class: 'and-imagem-ampliada', src: url, alt: m.legenda }) }) }, imagem));
      }
    } catch { lugar.replaceChildren(h('button', { class: 'btn', type: 'button', onclick: carregar }, 'Tentar carregar novamente')); }
  };
  if (m.tipo === 'video') lugar.replaceChildren(h('button', { class: 'btn', type: 'button', onclick: carregar }, icone('direita'), `Carregar vídeo (${(m.tamanho / 1048576).toFixed(1)} MB)`));
  else carregar();
  return h('figure', { class: 'and-midia' }, lugar, h('figcaption', {}, m.legenda));
}
function registro(r) {
  const [categoria, desenho] = CATEGORIAS[r.tipo] || CATEGORIAS.geral;
  const hora = new Date(r.em).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
  return h('article', { class: 'card and-registro' },
    h('div', { class: 'chips-linha' }, chip(categoria, { iconeNome: desenho }), chip(r.propostaId)),
    h('time', { datetime: r.em }, `Às ${hora} de ${dd(r.em)}`),
    h('h2', {}, r.titulo), h('p', {}, r.descricao), h('p', { class: 'sinc' }, `Registrado por ${r.por}`),
    r.midias?.length ? h('div', { class: 'and-midias' }, r.midias.map(midia)) : h('p', { class: 'sinc' }, 'Este registro ainda não tem print ou vídeo.'),
    r.alteracoes?.length ? h('section', { class: 'and-explorer' }, h('h3', {}, icone('tarefas'), 'Onde está e o que faz'), r.alteracoes.map(a => h('div', { class: 'and-alteracao' }, h('code', {}, a.caminho), h('p', {}, a.funcao), a.shared ? h('p', { class: 'sinc' }, 'Shared: ', a.shared) : null))) : null,
    h('div', { class: 'and-testes' }, h('strong', {}, 'Organização e testes'), h('p', {}, r.testes)),
    r.toolbox ? h('div', { class: 'and-testes' }, h('strong', {}, `Decoração Toolbox · asset ${r.toolbox.assetId}`), h('p', {}, r.toolbox.compatibilidade), h('p', {}, r.toolbox.verificacao), chip('Inspecionado · sem código embarcado', { iconeNome: 'qualidade' })) : null);
}
export function telaAndamento() {
  const dados = ctx.estado.dados;
  const lista = [...(dados.andamento?.registros || [])].sort((a, b) => b.em.localeCompare(a.em));
  const semanas = [...new Set([semanaDe(), ...lista.map(r => r.semana)])].sort().reverse();
  const selecao = ctx.estado.sub.andamento || {};
  const semana = semanas.includes(selecao.semana) ? selecao.semana : semanas[0];
  const filtro = selecao.proposta || '';
  const select = h('select', { 'aria-label': 'Semana do desenvolvimento', onchange: e => { ctx.estado.sub.andamento = { ...selecao, semana: e.target.value }; ctx.render(); } }, semanas.map(s => h('option', { value: s, selected: s === semana }, `Semana ${semanaRotulo(s)}`)));
  const propostas = dados.propostas?.propostas || [];
  const filtroProposta = h('select', { 'aria-label': 'Filtrar por proposta', onchange: e => { ctx.estado.sub.andamento = { ...selecao, semana, proposta: e.target.value }; ctx.render(); } }, h('option', { value: '' }, 'Todas as propostas'), propostas.map(p => h('option', { value: p.id, selected: p.id === filtro }, `${p.id} · ${p.titulo}`)));
  const visiveis = lista.filter(r => r.semana === semana && (!filtro || r.propostaId === filtro));
  const atual = dados.executor?.trabalhoAtual;
  return h('div', { class: 'pagina-andamento' },
    h('section', { class: 'card and-resumo' }, h('h2', {}, icone('martelo'), 'A atualização por dentro'), h('p', {}, 'Acompanhe o que foi criado, onde entrou no jogo e como foi testado.'),
      atual ? [chip('Em desenvolvimento', { iconeNome: 'martelo' }), h('p', {}, `${atual.propostaId || ''} · ${atual.etapa || 'Trabalho em andamento'}`)] : h('p', { class: 'sinc' }, 'Nenhuma etapa em execução informada pela automação.'),
      h('button', { type: 'button', class: 'btn', onclick: () => ctx.recarregar().catch(e => ctx.avisar(e.message, true)) }, icone('relogio'), 'Atualizar andamento')),
    h('div', { class: 'and-filtros' }, h('label', {}, 'Semana', select), h('label', {}, 'Proposta', filtroProposta)),
    h('div', { class: 'and-propostas' }, propostas.filter(p => ['EM DESENVOLVIMENTO', 'EM TESTES', 'AGUARDANDO AUTORIZAÇÃO FINAL', 'APROVADA PARA PUBLICAÇÃO'].includes(p.status) && (!filtro || p.id === filtro)).map(p => h('button', { class: 'card and-proposta', type: 'button', onclick: () => ctx.irPara('decisoes', { tipo: 'proposta', id: p.id }) }, h('strong', {}, `${p.id} · ${p.titulo}`), chipStatus(p.status)))),
    visiveis.length ? h('div', { class: 'and-linha-tempo' }, visiveis.map(registro)) : h('section', { class: 'card vazio-card' }, icone('imagem', { tamanho: 36 }), h('h2', {}, 'Os bastidores aparecerão aqui'), h('p', {}, 'Nesta semana ainda não foram registrados prints, vídeos ou alterações desta seleção. Cada etapa realizada será anexada com horário, caminho no Explorer e testes.')));
}
