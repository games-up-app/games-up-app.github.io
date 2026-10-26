// Contrato compartilhado entre a linha do tempo no app e o registro feito no PC.
export const TIPOS_ANDAMENTO = ['cenario', 'script', 'interface', 'teste', 'toolbox', 'geral'];
export const MIDIA_ANDAMENTO = /^andamento\/midias\/[a-z0-9-]+\.(png|jpg|jpeg|webp|mp4|webm)$/;

export function semanaDe(iso = new Date().toISOString()) {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso));
  const p = Object.fromEntries(partes.map(x => [x.type, x.value]));
  const d = new Date(`${p.year}-${p.month}-${p.day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
  return d.toISOString().slice(0, 10);
}

export function validarRegistro(r) {
  if (!r || typeof r !== 'object') throw new Error('Registro inválido.');
  if (!/^P-\d{3,5}$/.test(r.propostaId || '')) throw new Error('Informe a proposta do registro.');
  if (!TIPOS_ANDAMENTO.includes(r.tipo)) throw new Error('Categoria de andamento inválida.');
  if (r.estadoEtapa != null && !['iniciada', 'em_producao', 'concluida', 'impedida'].includes(r.estadoEtapa)) throw new Error('Estado da etapa inválido.');
  for (const k of ['titulo', 'descricao']) if (typeof r[k] !== 'string' || !r[k].trim() || r[k].length > (k === 'titulo' ? 150 : 4000)) throw new Error(`Campo ${k} inválido.`);
  if (r.em && (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(r.em) || !Number.isFinite(Date.parse(r.em)) || Date.parse(r.em) > Date.now() + 300000)) throw new Error('Data do registro inválida ou futura.');
  if (!Array.isArray(r.alteracoes) || r.alteracoes.length > 30) throw new Error('Informe as alterações no Explorer.');
  for (const a of r.alteracoes) {
    if (!a.caminho || !a.funcao || typeof a.caminho !== 'string' || typeof a.funcao !== 'string' || a.caminho.length > 500 || a.funcao.length > 2000) throw new Error('Cada alteração precisa de caminho no Explorer e função.');
    if (a.tipo === 'script' && (typeof a.shared !== 'string' || !a.shared.trim())) throw new Error('Explique o uso de Shared em cada script (ou por que é exclusivo).');
  }
  if (r.midias && (!Array.isArray(r.midias) || r.midias.length > 12)) throw new Error('Máximo de 12 mídias por registro.');
  for (const m of r.midias || []) if (typeof m.arquivo !== 'string' || !m.legenda || m.legenda.length > 500) throw new Error('Cada mídia precisa de arquivo e legenda.');
  if (r.tipo === 'toolbox' && (!r.toolbox?.assetId || !/^\d+$/.test(String(r.toolbox.assetId)) || r.toolbox.inspecionado !== true || r.toolbox.semCodigo !== true || !r.toolbox.compatibilidade || !r.toolbox.verificacao)) throw new Error('Toolbox exige assetId, inspeção, confirmação sem código, compatibilidade e descrição da verificação.');
  return r;
}
