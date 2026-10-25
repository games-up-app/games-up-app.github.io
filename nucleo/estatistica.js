// Funções estatísticas simples para comparar taxas (qPTR, conversão).
// Sem dependências externas.

/** Intervalo de confiança de Wilson (95% por padrão) para uma proporção. */
export function wilson(sucessos, total, z = 1.96) {
  if (!total) return { p: null, inf: null, sup: null };
  const p = sucessos / total;
  const z2 = z * z;
  const den = 1 + z2 / total;
  const centro = (p + z2 / (2 * total)) / den;
  const margem = (z * Math.sqrt((p * (1 - p)) / total + z2 / (4 * total * total))) / den;
  return { p, inf: Math.max(0, centro - margem), sup: Math.min(1, centro + margem) };
}

/** Função de distribuição acumulada da normal padrão (aprox. Abramowitz-Stegun 7.1.26). */
export function normalCdf(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(x * x) / 2);
  return x >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/** Teste z para diferença entre duas proporções (bicaudal). */
export function testeDuasProporcoes(x1, n1, x2, n2) {
  const p1 = x1 / n1, p2 = x2 / n2;
  const p = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  if (!se) return { z: 0, pValor: 1, diferencaPp: 0 };
  const z = (p2 - p1) / se;
  return { z, pValor: 2 * (1 - normalCdf(Math.abs(z))), diferencaPp: (p2 - p1) * 100 };
}

/** Variação relativa (%) e em pontos percentuais para taxas. */
export function variacao(anterior, atual, ehTaxa = false) {
  if (anterior == null || atual == null) return { relativa: null, pp: null };
  const relativa = anterior === 0 ? null : ((atual - anterior) / anterior) * 100;
  return { relativa, pp: ehTaxa ? (atual - anterior) * 100 : null };
}

/**
 * Classifica uma thumbnail em relação à referência (a de maior volume).
 * Regras conservadoras: sem amostra suficiente não há veredito.
 */
export function classificarThumbnail(t, ref, { minImpressoes = 5000, minJogadas = 30 } = {}) {
  const jogadas = v => (Number.isFinite(v.jogadasQualificadas) ? v.jogadasQualificadas : Math.round(v.impressoes * v.qptr));
  const x = jogadas(t);
  const ic = wilson(x, t.impressoes);
  const base = { jogadasEstimadas: x, ic };
  if (t === ref) return { ...base, recomendacao: 'MANTER', confianca: 'referência', motivo: 'Maior volume e qPTR dentro da média do jogo.' };
  const xr = jogadas(ref);
  const teste = testeDuasProporcoes(xr, ref.impressoes, x, t.impressoes);
  const amostraOk = t.impressoes >= minImpressoes && x >= minJogadas;
  let recomendacao = 'OBSERVAR', confianca = 'baixa', motivo;
  if (teste.pValor < 0.05 && teste.z < 0) {
    recomendacao = 'SUBSTITUIR';
    confianca = amostraOk ? 'média' : 'baixa-média';
    motivo = `qPTR abaixo da referência com p≈${teste.pValor.toFixed(3)}; amostra ${amostraOk ? 'adequada' : 'pequena'}.`;
  } else if (teste.pValor < 0.05 && teste.z > 0) {
    recomendacao = 'MANTER'; confianca = amostraOk ? 'média' : 'baixa';
    motivo = 'qPTR acima da referência com diferença estatística.';
  } else {
    motivo = `Diferença não significativa (p≈${teste.pValor.toFixed(2)}); ${amostraOk ? 'amostra suficiente, mas sem diferença clara' : 'amostra insuficiente para veredito'}.`;
    if (!amostraOk && t.qptr < ref.qptr) motivo += ' Tendência abaixo da referência.';
  }
  return { ...base, teste, recomendacao, confianca, motivo };
}

/**
 * Thumbnails PROTEGIDAS: não podem ser propostas para troca.
 * Protege as 2 que mais trouxeram jogadores, a de maior taxa com amostra boa,
 * qualquer uma marcada como "segmento vencedor" e as que estão na média geral ou acima.
 */
export function thumbnailsProtegidas(itens, { qptrGeral = null, minImpressoes = 5000 } = {}) {
  const jogadas = v => (Number.isFinite(v.jogadasQualificadas) ? v.jogadasQualificadas : Math.round(v.impressoes * v.qptr));
  const motivos = new Map();
  const add = (t, m) => { if (!motivos.has(t.id)) motivos.set(t.id, []); motivos.get(t.id).push(m); };
  if (!itens.length) return motivos;
  // As 2 que mais trazem jogadores: trocar qualquer uma delas arrisca perder alcance.
  [...itens].sort((a, b) => jogadas(b) - jogadas(a)).slice(0, 2).forEach((t, i) => add(t, i === 0 ? 'a que mais trouxe jogadores' : '2ª que mais trouxe jogadores'));
  const comAmostra = itens.filter(t => t.impressoes >= minImpressoes);
  if (comAmostra.length) add(comAmostra.reduce((a, b) => (b.qptr > a.qptr ? b : a)), 'maior taxa de jogadas');
  for (const t of itens) {
    if (t.segmentoVencedor && t.segmentoVencedor !== 'N/A') add(t, `vence no segmento: ${t.segmentoVencedor}`);
    if (qptrGeral != null && t.impressoes >= minImpressoes && t.qptr >= qptrGeral - 1e-9) add(t, 'na média geral ou acima');
  }
  return motivos;
}
