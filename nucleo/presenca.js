// Presença informativa no painel, alimentada pela automação. Não deduz disponibilidade.
const ESTADOS = new Set(['trabalhando', 'concluido', 'aguardando', 'indisponivel']);
const instante = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v) ? Date.parse(v) : NaN;

export function avaliarPresenca(item, agora = Date.now()) {
  const hora = agora instanceof Date ? agora.getTime() : agora;
  const atualizado = instante(item?.atualizadoEm), expira = instante(item?.expiraEm);
  const recente = Number.isFinite(hora) && Number.isFinite(atualizado) && Number.isFinite(expira)
    && atualizado <= hora && hora - atualizado < 15 * 60_000 && expira > hora && ESTADOS.has(item?.estado);
  if (!recente) return { estado: 'sem_sinal', texto: 'Sem sinal recente', atividade: '', atualizadoEm: null };
  return { estado: item.estado, texto: ({ trabalhando: 'está trabalhando', concluido: 'concluiu a atividade', aguardando: 'está aguardando', indisponivel: 'está indisponível' })[item.estado], atividade: typeof item.atividade === 'string' ? item.atividade : '', atualizadoEm: item.atualizadoEm };
}
