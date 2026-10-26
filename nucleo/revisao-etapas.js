// Aceite de etapas do desenvolvimento. Nunca altera propostas, pacotes ou assinaturas.
import { ErroRegra, limparTexto } from './regras.js?v=20261025-categorias4';

export function revisaoDaEtapa(andamento, registro, agora = Date.now()) {
  const politica = andamento?.politicaRevisao;
  const ativada = Date.parse(politica?.ativadaEm);
  const entregue = Date.parse(registro.registradoEm);
  const segundos = politica?.automaticaAposSegundos;
  if (registro.revisao?.status) {
    const encerrou = segundos === 300 && Number.isFinite(ativada) && Number.isFinite(entregue) && registro.midias?.length
      && agora >= Math.max(ativada, entregue) + 300_000;
    return encerrou ? { ...registro.revisao, prazoEncerrado: true } : registro.revisao;
  }
  if (![120, 300].includes(segundos) || !Number.isFinite(ativada) || !Number.isFinite(entregue) || !registro.midias?.length) return { status: 'sem_prazo' };
  const limite = Math.max(ativada, entregue) + segundos * 1000;
  const encerrada = agora >= limite;
  if (segundos === 300) return { status: encerrada ? 'aguardando_equipe' : 'aguardando', limiteEm: new Date(limite).toISOString() };
  // Compatibilidade com a política antiga. A nova regra não forja aprovação de agente.
  return { status: encerrada ? 'aprovada_automaticamente' : 'aguardando', limiteEm: new Date(limite).toISOString(), ...(encerrada ? { em: new Date(limite).toISOString(), por: { nome: 'Regra de 2 minutos definida por Tallyson' } } : {}) };
}

export const podeRevisarEntrega = revisao => revisao?.prazoEncerrado !== true && !['aprovada', 'aprovada_automaticamente', 'aguardando_equipe', 'validada_equipe'].includes(revisao?.status);

/** Validação realmente executada pela equipe, só após a janela de revisão do dono.
 * Registra o responsável e seu parecer; não toca propostas, pacotes nem publicação.
 */
export function validarEtapaPelaEquipe(andamento, { registroId, por, parecer } = {}, agora = new Date()) {
  const registro = andamento?.registros?.find(r => r.id === registroId);
  if (!registro) throw new ErroRegra(404, 'Entrega não encontrada. Atualize o Andamento.');
  const responsavel = typeof por === 'string' ? limparTexto(por, 200) : '';
  const texto = typeof parecer === 'string' ? limparTexto(parecer, 2000) : '';
  if (!responsavel) throw new ErroRegra(400, 'Informe o responsável da equipe que validou a entrega.');
  if (texto.length < 10) throw new ErroRegra(400, 'Informe um parecer de validação com pelo menos 10 caracteres.');
  const hora = agora instanceof Date ? agora : new Date(agora);
  if (!Number.isFinite(hora.getTime())) throw new ErroRegra(400, 'Data da validação inválida.');
  const antes = revisaoDaEtapa(andamento, registro, hora.getTime());
  if (antes.status !== 'aguardando_equipe') throw new ErroRegra(409, 'A entrega precisa estar aguardando a equipe após os 5 minutos, sem recusa ou alteração solicitada.');
  registro.revisao = { status: 'validada_equipe', em: hora.toISOString(), por: { nome: responsavel, papel: 'equipe' }, parecer: texto, comentario: texto };
  registro.historicoRevisao ||= [];
  registro.historicoRevisao.push({ ...registro.revisao, anterior: antes.status });
  return { registro, evento: { id: crypto.randomUUID(), acao: 'etapa.validar_equipe', alvo: { tipo: 'andamento', id: registroId }, em: hora.toISOString(), por: registro.revisao.por } };
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
  if (andamento?.politicaRevisao?.automaticaAposSegundos === 300 && ['aprovar', 'negar'].includes(acao) && !podeRevisarEntrega(antes)) {
    throw new ErroRegra(409, 'A revisão da entrega já foi encerrada. Você pode comentar ou pedir alteração a qualquer momento.');
  }
  registro.revisao = { status: ({ aprovar: 'aprovada', ajustes: 'ajustes_solicitados', negar: 'negada' })[acao], em: agora.toISOString(), por, comentario: texto || null };
  registro.historicoRevisao ||= [];
  registro.historicoRevisao.push({ ...registro.revisao, anterior: antes.status });
  return { registro, evento: { id: crypto.randomUUID(), acao: `etapa.${acao}`, alvo: { tipo: 'andamento', id: registroId }, em: agora.toISOString(), por } };
}
