// Leitura do Andamento por proposta, fora do Explorer. Não altera registros ou aprovações.
import { avaliarPresenca } from './presenca.js?v=20261025-categorias4';
import { estadoPropostaPublicacao } from './estado-publicacao.js?v=20261025-categorias4';

const APROVADAS = new Set(['APROVADA PARA DESENVOLVIMENTO', 'EM DESENVOLVIMENTO', 'EM TESTES', 'AGUARDANDO AUTORIZAÇÃO FINAL', 'APROVADA PARA PUBLICAÇÃO', 'PUBLICADA']);
const ACOMPANHAVEIS = new Set([...APROVADAS, 'BLOQUEADA', 'DEVOLVIDA PARA AJUSTES']);
const instante = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v) ? Date.parse(v) : NaN;

export function agruparAndamento(dados) {
  const grupos = new Map();
  for (const p of dados.propostas?.propostas || []) {
    if (ACOMPANHAVEIS.has(p.status) || p.bloqueio) grupos.set(p.id, { proposta: p, registros: [] });
  }
  for (const r of dados.andamento?.registros || []) {
    const id = r.propostaId || 'sem-proposta';
    if (!grupos.has(id)) grupos.set(id, { proposta: (dados.propostas?.propostas || []).find(p => p.id === id)
      || { id, titulo: id === 'sem-proposta' ? 'Histórico sem proposta identificada' : `Proposta ${id}`, historica: true }, registros: [] });
    grupos.get(id).registros.push(r);
  }
  return [...grupos.values()].map(g => ({ ...g, registros: [...g.registros].sort((a, b) => (Date.parse(b.em) || 0) - (Date.parse(a.em) || 0)) }))
    .sort((a, b) => (Date.parse(b.registros[0]?.em) || 0) - (Date.parse(a.registros[0]?.em) || 0) || a.proposta.id.localeCompare(b.proposta.id));
}

function agendaFutura(p, dados, agora) {
  // Tarefas são agenda de trabalho; fazerHoje/semanaAlvo são metas, nunca confirmação de execução.
  const tarefas = (dados.tarefas?.tarefas || []).filter(t => t.propostaId === p.id && !['CONCLUÍDA', 'CANCELADA'].includes(t.status))
    .map(t => t.agendadaPara).filter(v => instante(v) > agora).sort((a, b) => instante(a) - instante(b));
  if (tarefas.length) return tarefas[0];
  const data = p.fazerHoje?.data || p.semanaAlvo;
  const hora = p.fazerHoje ? p.fazerHoje.horario : dados.config?.horarioPublicacao;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data || '')) return null;
  // Sem hora, só um dia estritamente futuro permite dizer que está esperando o dia.
  const comHora = /^([01]\d|2[0-3]):[0-5]\d$/.test(hora || '');
  const alvo = `${data}T${comHora ? hora : '00:00'}:00-03:00`;
  const quando = instante(alvo);
  return Number.isFinite(quando) && new Date(quando - 3 * 3600000).toISOString().slice(0, 10) === data && quando > agora ? alvo : null;
}

export function estadoAndamento(p, dados, agora = Date.now()) {
  const fluxo = estadoPropostaPublicacao(p, dados.lancamentos?.lancamentos || [], dados.config || {}, new Date(agora));
  if (fluxo.status === 'PUBLICADA') return { texto: 'Publicada', detalhe: fluxo.horario, tom: 'ok' };
  if (fluxo.status === 'CONFIRMAÇÃO PENDENTE') return { texto: fluxo.titulo, detalhe: fluxo.proximaAcao, tom: 'warn' };
  if (p.bloqueio || ['BLOQUEADA', 'DEVOLVIDA PARA AJUSTES', 'REJEITADA'].includes(fluxo.status)) return { texto: fluxo.titulo, detalhe: fluxo.proximaAcao, tom: 'warn' };
  if (p.historica) return { texto: 'Histórico preservado', detalhe: 'Os dados desta proposta não estão disponíveis. Todos os registros continuam acessíveis.' };
  if (p.status === 'PUBLICADA') return { texto: fluxo.titulo, detalhe: fluxo.proximaAcao, tom: fluxo.tom };
  if (fluxo.status === 'AGUARDANDO AUTORIZAÇÃO FINAL') return { texto: 'Falta sua autorização', detalhe: fluxo.proximaAcao, tom: 'warn' };
  const agenda = APROVADAS.has(p.status) && agendaFutura(p, dados, agora);
  if (fluxo.status === 'APROVADA PARA PUBLICAÇÃO') return { texto: fluxo.titulo,
    detalhe: `${fluxo.titulo}. ${fluxo.proximaAcao}${agenda ? ` ${rotuloAgenda(agenda)}` : ''}`, tom: fluxo.tom };
  // O produtor precisa registrar propostaId + ambiente: studio; sinais legados não bastam.
  const sinal = Object.values(dados.presenca?.itens || {}).find(item => item.propostaId === p.id
    && ['studio', 'roblox-studio', 'roblox studio'].includes(String(item.ambiente || '').trim().toLowerCase())
    && item.escopo !== 'appdev' && avaliarPresenca(item, agora).estado === 'trabalhando');
  if (APROVADAS.has(p.status) && sinal) return { texto: 'Fazendo agora ao vivo', detalhe: `${sinal.id || 'Equipe'} · Roblox Studio · ${sinal.atividade || 'Trabalho na proposta'}`, tom: 'relevante' };
  if (agenda) return { texto: 'Esperando o dia', detalhe: rotuloAgenda(agenda), tom: 'neutro' };
  return { texto: APROVADAS.has(p.status) ? 'Sem sinal recente no Studio' : 'Histórico disponível', detalhe: 'Abra os registros para ver as etapas, evidências e comentários.' };
}

function rotuloAgenda(agenda) {
  return `Previsto para ${new Date(agenda).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })} (Brasília).`;
}
