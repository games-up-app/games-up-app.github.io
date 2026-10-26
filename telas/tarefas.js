// Tela Tarefas: cards com progresso. Detalhes e atualização abrem numa folha (nada expande para baixo).
import { h, icone, chip, abrirFolha } from '../ui/componentes.js?v=20261026-automacao1';
import { ctx } from '../ui/contexto.js?v=20261026-automacao1';
import { dataBR, haQuanto, segmentado, campo, chipStatus, cardBotao, blocoComentarios, miniaturaIcone } from './comum.js?v=20261026-automacao1';

const STATUS = ['A FAZER', 'EM DESENVOLVIMENTO', 'EM TESTES', 'CONCLUÍDA', 'IMPEDIDA'];
const ROTULO = { 'A FAZER': 'A fazer', 'EM DESENVOLVIMENTO': 'Fazendo', 'EM TESTES': 'Testando', 'CONCLUÍDA': 'Concluída', 'IMPEDIDA': 'Travada' };
const ICONE_STATUS = { 'A FAZER': 'relogio', 'EM DESENVOLVIMENTO': 'martelo', 'EM TESTES': 'qualidade', 'CONCLUÍDA': 'ok', 'IMPEDIDA': 'alerta' };
const comVoce = t => /propriet/i.test(t.responsavelNome || '');

function anel(p) {
  const v = Math.max(0, Math.min(100, Number(p) || 0));
  return h('span', { class: 'anel', style: { '--p': String(v) }, role: 'img', 'aria-label': `${v}% pronto` }, h('span', {}, `${v}%`));
}

function folhaTarefa(t) {
  const checks = (t.checklist || []).map(c => !!c.feito);
  const rasc = { progresso: Number(t.progresso) || 0, status: t.status };
  const valorPct = h('strong', { class: 'progresso-valor' }, `${rasc.progresso}%`);
  const barra = h('input', { type: 'range', min: 0, max: 100, step: 5, value: String(rasc.progresso), class: 'progresso-range', 'aria-label': 'Progresso (%)',
    oninput: e => { rasc.progresso = Number(e.target.value); valorPct.textContent = `${rasc.progresso}%`; } });
  const nota = h('input', { type: 'text', placeholder: 'Nota (opcional)', maxlength: 500, 'aria-label': 'Nota' });
  const listaChecks = h('div', { class: 'checklist' }, (t.checklist || []).map((c, i) => {
    const b = h('button', { type: 'button', class: `check${checks[i] ? ' feito' : ''}`, 'aria-pressed': String(checks[i]), onclick: () => {
      checks[i] = !checks[i]; b.classList.toggle('feito', checks[i]); b.setAttribute('aria-pressed', String(checks[i]));
    } }, h('span', { class: 'check-caixa' }, icone('ok', { tamanho: 16 })), h('span', {}, c.texto));
    return b;
  }));
  const statusSeg = h('div', { class: 'status-opcoes', role: 'radiogroup', 'aria-label': 'Situação' }, STATUS.map(st => {
    const b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(rasc.status === st), class: `status-opcao${rasc.status === st ? ' ativo' : ''}`, onclick: () => {
      rasc.status = st;
      statusSeg.querySelectorAll('.status-opcao').forEach(x => { const on = x === b; x.classList.toggle('ativo', on); x.setAttribute('aria-checked', String(on)); });
    } }, icone(ICONE_STATUS[st], { tamanho: 16 }), ROTULO[st]);
    return b;
  }));
  const salvar = h('button', { type: 'button', class: 'btn primario grande', onclick: () => {
    const v = rasc.progresso;
    if (!Number.isInteger(v) || v < 0 || v > 100) { ctx.avisar('Progresso deve ser de 0 a 100.', true); return; }
    ctx.gravar('/api/tarefas/progresso', { tarefaId: t.id, progresso: v, status: rasc.status, checklist: checks, nota: nota.value }, [salvar], 'Progresso atualizado.');
  } }, icone('ok', { tamanho: 18 }), 'Salvar progresso');

  abrirFolha({
    titulo: t.id,
    conteudo: h('div', { class: 'folha-tarefa' },
      h('div', { class: 'tarefa-cabeca' }, anel(t.progresso), h('div', {}, h('h3', {}, t.titulo), h('div', { class: 'chips-linha' }, chipStatus(t.status), chip(t.responsavelNome || '—', { iconeNome: 'jogadores' })))),
      (t.impedimentos || []).length ? h('div', { class: 'faixa bad' }, icone('alerta', { tamanho: 20 }), h('span', {}, h('strong', {}, 'Está travando: '), t.impedimentos.join('; '))) : null,
      campo('decisoes', 'Origem', t.propostaId ? `Da proposta ${t.propostaId}` : 'Preparação do sistema'),
      (t.checklist || []).length ? [h('h3', { class: 'folha-subtitulo' }, icone('tarefas', { tamanho: 18 }), 'Passos'), listaChecks] : null,
      // Só o dono atualiza o progresso; a equipe acompanha e comenta.
      ctx.estado.usuario?.papel === 'proprietario' ? [
        h('h3', { class: 'folha-subtitulo' }, icone('grafico', { tamanho: 18 }), 'Quanto já foi feito'),
        h('div', { class: 'progresso-linha' }, barra, valorPct),
        h('h3', { class: 'folha-subtitulo' }, icone('relogio', { tamanho: 18 }), 'Situação'),
        statusSeg,
        nota,
        salvar,
      ] : campo('grafico', 'Andamento', `${Number(t.progresso) || 0}% feito · ${ROTULO[t.status] || t.status}`),
      (t.historico || []).length ? [h('h3', { class: 'folha-subtitulo' }, icone('relogio', { tamanho: 18 }), `Histórico (${t.historico.length})`),
        h('div', { class: 'lista-mini' }, [...t.historico].reverse().slice(0, 10).map(x => h('div', { class: 'lista-mini-item coluna' },
          h('span', {}, `${dataBR(x.em)} · ${x.por?.nome || 'automação'}`),
          h('strong', {}, x.texto || (x.para ? `${x.de?.progresso ?? '—'}% → ${x.para?.progresso ?? '—'}%` : x.acao || ''), x.nota ? ` — ${x.nota}` : ''))))] : null,
      blocoComentarios('tarefa', t.id)),
  });
}

function cardTarefa(t) {
  const feitos = (t.checklist || []).filter(c => c.feito).length;
  const total = (t.checklist || []).length;
  return cardBotao(`card-tarefa${t.status === 'IMPEDIDA' ? ' travada' : ''}`, () => folhaTarefa(t),
    anel(t.progresso),
    h('span', { class: 'tarefa-texto' },
      h('span', { class: 'tarefa-id' }, t.id),
      h('strong', {}, t.titulo),
      t.agendadaPara ? h('span', { class: 'sinc' }, `Agendada: ${dataBR(t.agendadaPara)} · Brasília`) : null,
      h('span', { class: 'chips-linha' }, chipStatus(t.status), total ? chip(`${feitos}/${total} passos`, { iconeNome: 'tarefas' }) : null),
      h('span', { class: 'barra' }, h('span', { style: { width: `${Math.max(0, Math.min(100, t.progresso || 0))}%` } }))),
    icone('direita', { tamanho: 20 }));
}

export function telaTarefas() {
  const todas = ctx.estado.dados.tarefas?.tarefas || [];
  if (!todas.length) return h('div', { class: 'card vazio-card' }, miniaturaIcone('tarefas', 'roxo'), h('p', {}, 'Nenhuma tarefa por enquanto.'));
  const voce = todas.filter(comVoce);
  const auto = todas.filter(t => !comVoce(t));
  const aba = ctx.estado.sub.tarefas || (voce.some(t => t.status !== 'CONCLUÍDA') ? 'voce' : 'auto');
  const lista = aba === 'voce' ? voce : auto;
  const abertas = lista.filter(t => t.status !== 'CONCLUÍDA');
  const feitas = lista.filter(t => t.status === 'CONCLUÍDA');
  const media = todas.length ? Math.round(todas.reduce((a, t) => a + (t.progresso || 0), 0) / todas.length) : 0;
  return h('div', { class: 'pagina-tarefas' },
    h('section', { class: 'card card-tarefas-topo' },
      anel(media),
      h('div', { class: 'atalho-texto' }, h('strong', {}, `${todas.filter(t => t.status !== 'CONCLUÍDA').length} tarefas em aberto`), h('span', {}, `${todas.filter(t => t.status === 'CONCLUÍDA').length} concluídas · ${todas.filter(t => t.status === 'IMPEDIDA').length} travadas`))),
    segmentado([['voce', `Com você (${voce.filter(t => t.status !== 'CONCLUÍDA').length})`, 'jogadores'], ['auto', `Automação (${auto.filter(t => t.status !== 'CONCLUÍDA').length})`, 'raio']], aba, v => { ctx.estado.sub.tarefas = v; ctx.render(); }, { rotulo: 'Quem faz' }),
    abertas.length ? h('div', { class: 'lista-cards' }, abertas.map(cardTarefa))
      : h('div', { class: 'card card-em-dia' }, h('span', { class: 'em-dia-icone' }, icone('ok', { tamanho: 24 })), h('div', {}, h('strong', {}, 'Nada pendente aqui'), h('span', {}, 'Tudo o que estava aqui foi concluído.'))),
    feitas.length ? h('button', { type: 'button', class: 'btn discreto largo', onclick: () => abrirFolha({ titulo: `Concluídas (${feitas.length})`, conteudo: h('div', { class: 'lista-cards' }, feitas.map(cardTarefa)) }) },
      icone('ok', { tamanho: 18 }), `Ver concluídas (${feitas.length})`) : null,
    h('p', { class: 'sinc centro' }, `Atualizado ${haQuanto(ctx.estado.dados.meta?.ultimaSincronizacao)}`));
}
