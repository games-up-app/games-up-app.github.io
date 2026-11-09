// Regra comum à galeria, às decisões e ao executor.
export const minimoImagens = p => p?.tipo === 'thumbnail' ? 5 : 1;
export const contarImagens = p => new Set((Array.isArray(p?.previas) ? p.previas : [])
  .filter(x => typeof x === 'string' && /\.(png|jpe?g|webp)$/i.test(x))).size;
export const faltamImagens = p => contarImagens(p) < minimoImagens(p);
export const thumbnailIncompleta = p => p?.tipo === 'thumbnail' && faltamImagens(p);
export const propostaIncompleta = p => thumbnailIncompleta(p) || p?.mudaDesign === true && faltamImagens(p);
export const propostaAguardaDecisao = p => p?.status === 'AGUARDANDO APROVAÇÃO' && !propostaIncompleta(p) && !p.bloqueio;
