// Regra comum à galeria, às decisões e ao executor.
export const minimoImagens = p => p?.tipo === 'thumbnail' ? 5 : 1;
const imagens = p => (Array.isArray(p?.previas) ? p.previas : [])
  .filter(x => typeof x === 'string' && /\.(png|jpe?g|webp)$/i.test(x));
export const eCapaDivulgacao = caminho => /^previas\/capas\//.test(caminho);
export const contarImagens = p => new Set(imagens(p).filter(c => !eCapaDivulgacao(c))).size;
export const capaDivulgacaoFaltando = p => p?.divulgarAtualizacao === true && !imagens(p).some(eCapaDivulgacao);
export const faltamImagens = p => contarImagens(p) < minimoImagens(p) || capaDivulgacaoFaltando(p);
export const thumbnailIncompleta = p => p?.tipo === 'thumbnail' && faltamImagens(p);
export const propostaIncompleta = p => thumbnailIncompleta(p) || (p?.mudaDesign === true || p?.divulgarAtualizacao === true) && faltamImagens(p);
export const propostaAguardaDecisao = p => p?.status === 'AGUARDANDO APROVAÇÃO' && !propostaIncompleta(p) && !p.bloqueio;

export function divulgarNovidade(p) {
  if (p?.tipo === 'thumbnail') return false;
  if (p?.tipo === 'evento' || p?.anunciarEmEvento === true) return true;
  if (typeof p?.divulgarAtualizacao === 'boolean') return p.divulgarAtualizacao;
  return ['entretenimento', 'crescimento'].includes(p?.categoria) && !['dados', 'qualidade'].includes(p?.tipo);
}
