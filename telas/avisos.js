// Histórico de avisos dentro do app: funciona também sem permissão de push.
import { h, icone, chip } from '../ui/componentes.js?v=20261026-agenda2';
import { ctx } from '../ui/contexto.js?v=20261026-agenda2';
import { listarAvisos, novosAvisos, lerAvisosLidos, marcarAvisoLido, dataHoraBrasilia } from '../nucleo/central-avisos.js?v=20261026-agenda2';

export function telaAvisos() {
  const avisos = listarAvisos(ctx.estado.dados);
  const lidos = lerAvisosLidos(ctx.estado.usuario);
  const novos = new Set(novosAvisos(avisos, lidos).map(a => a.id));
  const abrir = (aviso, destino) => {
    marcarAvisoLido(ctx.estado.usuario, aviso);
    ctx.irPara(destino.aba, destino.sub);
  };
  return h('div', { class: 'pagina-avisos' },
    h('header', { class: 'avisos-cabecalho' }, h('h1', { tabindex: '-1' }, icone('sino'), 'Avisos'),
      h('p', {}, `${novos.size} ${novos.size === 1 ? 'aviso novo' : 'avisos novos'}. Registros, entregas e publicações ficam aqui, mesmo sem push.`),
      h('p', { class: 'sinc' }, 'Abrir ou marcar como lido apenas confirma a leitura neste aparelho. Para decidir uma etapa ou autorizar uma publicação, use os botões próprios.'),
      h('button', { type: 'button', class: 'btn', onclick: () => ctx.recarregar().catch(e => ctx.avisar(e.message, true)) }, icone('relogio'), 'Atualizar avisos')),
    avisos.length ? h('ol', { class: 'avisos-lista' }, avisos.map(aviso => h('li', { class: `aviso-item${novos.has(aviso.id) ? ' novo' : ''}`, 'data-aviso-id': aviso.id },
      h('div', { class: 'chips-linha' }, chip(({ andamento: 'Andamento', entrega: 'Entrega', publicacao: 'Publicação' })[aviso.tipo]), chip(novos.has(aviso.id) ? 'Novo' : 'Lido', { tom: novos.has(aviso.id) ? 'roxo' : 'neutro' })),
      h('h2', {}, aviso.titulo), h('time', { datetime: aviso.em || null }, dataHoraBrasilia(aviso.em)),
      h('p', {}, aviso.texto), aviso.propostaId ? h('p', { class: 'sinc' }, aviso.propostaId) : null,
      h('p', { class: 'aviso-evidencias' }, `${aviso.imagens} ${aviso.imagens === 1 ? 'imagem' : 'imagens'} · ${aviso.videos} ${aviso.videos === 1 ? 'vídeo' : 'vídeos'}`),
      h('div', { class: 'avisos-acoes' },
        h('button', { type: 'button', class: 'btn primario', onclick: () => abrir(aviso, aviso.destino) }, icone(aviso.tipo === 'andamento' ? 'imagem' : 'decisoes'), aviso.tipo === 'andamento' ? 'Ver registro' : 'Ver em Decisões'),
        aviso.andamento ? h('button', { type: 'button', class: 'btn', onclick: () => abrir(aviso, aviso.andamento) }, icone('play'), 'Ver imagens e vídeos') : null,
        aviso.decisao ? h('button', { type: 'button', class: 'btn', onclick: () => abrir(aviso, aviso.decisao) }, 'Decisões') : null,
        novos.has(aviso.id) ? h('button', { type: 'button', class: 'btn discreto', onclick: () => { marcarAvisoLido(ctx.estado.usuario, aviso); ctx.render(); } }, 'Marcar como lido') : null))))
      : h('section', { class: 'vazio-card' }, icone('sino', { tamanho: 32 }), h('h2', {}, 'Nenhum aviso registrado'), h('p', {}, 'As próximas etapas, entregas e publicações aparecerão aqui.')));
}
