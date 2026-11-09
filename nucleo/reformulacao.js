/** Localiza uma recusa do administrador que ainda corresponde à versão atual. */
export function recusaParaReformular(proposta) {
  if (proposta?.status !== 'REJEITADA' || proposta.publicadoEm) return null;
  const decisao = (proposta.decisoes || []).findLast(d => d.versao === proposta.versao);
  if (decisao?.acao !== 'rejeitar' || decisao.por?.papel && decisao.por.papel !== 'proprietario') return null;
  return typeof decisao.comentario === 'string' && decisao.comentario.trim() ? decisao : null;
}
