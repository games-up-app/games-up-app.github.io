// Aceite de etapas do desenvolvimento. Nunca altera propostas, pacotes ou assinaturas.
import { ErroRegra, limparTexto } from './regras.js?v=20261025-etapas2';

export function revisaoDaEtapa(andamento, registro, agora = Date.now()) {
  if (registro.revisao?.status) return registro.revisao;
  const politica = andamento?.politicaRevisao;
  const ativada = Date.parse(politica?.ativadaEm);
  const entregue = Date.parse(registro.registradoEm);
  if (politica?.automaticaAposSegundos !== 120 || !Number.isFinite(ativada) || !Number.isFinite(entregue) || !registro.midias?.length) return { status: 'sem_prazo' };
  const limite = Math.max(ativada, entregue) + 120_000;
  return { status: agora >= limite ? 'aprovada_automaticamente' : 'aguardando', limiteEm: new Date(limite).toISOString(), ...(agora >= limite ? { em: new Date(limite).toISOString(), por: { nome: 'Regra de 2 minutos definida por Tallyson' } } : {}) };
}

export function decidirEtapa(andamento, usuario, { registroId, acao, comentario }, agora = new Date()) {
  if (usuario?.papel !== 'proprietario') throw new ErroRegra(403, 'Somente o proprietário aprova etapas ou pede ajustes.');
  const registro = andamento?.registros?.find(r => r.id === registroId);
  if (!registro) throw new ErroRegra(404, 'Etapa não encontrada. Atualize o andamento.');
  if (!['aprovar', 'ajustes', 'negar'].includes(acao)) throw new ErroRegra(400, 'Decisão de etapa inválida.');
  const texto = limparTexto(comentario);
  if (acao === 'ajustes' && !texto) throw new ErroRegra(400, 'Diga o que precisa melhorar.');
  if (acao === 'negar' && !texto) throw new ErroRegra(400, 'Para negar, escreva a justificativa.');
  const por = { id: usuario.id, nome: usuario.nome, papel: usuario.papel };
  const antes = revisaoDaEtapa(andamento, registro, agora.getTime());
  registro.revisao = { status: ({ aprovar: 'aprovada', ajustes: 'ajustes_solicitados', negar: 'negada' })[acao], em: agora.toISOString(), por, comentario: texto || null };
  registro.historicoRevisao ||= [];
  registro.historicoRevisao.push({ ...registro.revisao, anterior: antes.status });
  return { registro, evento: { id: crypto.randomUUID(), acao: `etapa.${acao}`, alvo: { tipo: 'andamento', id: registroId }, em: agora.toISOString(), por } };
}
