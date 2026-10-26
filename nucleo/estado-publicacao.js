// Apresentação do fluxo de publicação no Games Up (fora do Explorer do Roblox).
// Usa apenas o lançamento e a configuração já carregados; não valida assinaturas,
// não autoriza nem dispara envios. As regras continuam em regras.js e na automação.
const FUSO = 'America/Sao_Paulo';
const PUBLICADA = 'PUBLICADA';
const AUTORIZADA = 'APROVADA PARA PUBLICAÇÃO';
const AGUARDANDO = 'AGUARDANDO AUTORIZAÇÃO FINAL';
const DEVOLVIDA = 'DEVOLVIDA PARA AJUSTES';

const instante = valor => typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(valor) && Number.isFinite(Date.parse(valor)) ? new Date(valor) : null;

export function horarioBrasilia(valor) {
  const d = instante(valor);
  return d ? `${new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d)} (Brasília)` : null;
}

function previsao(l, config, agora) {
  const hora = l.urgente ? l.horario : config.horarioPublicacao;
  const envio = /^\d{4}-\d{2}-\d{2}$/.test(l.dataAlvo || '') && /^([01]\d|2[0-3]):[0-5]\d$/.test(hora || '')
    ? `${l.dataAlvo}T${hora}:00-03:00` : null;
  const data = l.tipo === 'evento' ? l.evento?.inicio : envio;
  const d = instante(data);
  if (!d) return { texto: 'Sem horário confirmado. Acompanhe o Andamento.', passou: false };
  const passou = d.getTime() <= agora.getTime();
  const rotulo = l.tipo === 'evento' ? 'Início previsto do evento' : 'Horário previsto';
  return { texto: `${rotulo}${passou ? ' já passou' : ''}: ${horarioBrasilia(data)}.${passou ? ' Sem novo horário confirmado.' : ' O horário não confirma o envio.'}`, passou };
}

/** Estado informativo, sem inferir sucesso a partir de autorização, horário ou disparo. */
export function estadoPublicacao(l = {}, config = {}, agora = new Date()) {
  const publicada = l.status === PUBLICADA;
  const autorizada = l.status === AUTORIZADA;
  const devolvida = l.status === DEVOLVIDA;
  const bloqueada = l.status === 'BLOQUEADA';
  const esperando = l.status === AGUARDANDO;
  const testesOk = l.testes?.resultado === 'aprovado';
  const q = previsao(l, config, agora);
  const manual = ['evento', 'thumbnail'].includes(l.tipo);
  const modo = l.tipo === 'evento'
    ? 'Evento: a equipe cria a capa e os textos manualmente no Creator Hub e registra a confirmação. Isso anuncia a atualização; não envia o arquivo do jogo.'
    : l.tipo === 'thumbnail'
      ? 'Thumbnail: a equipe aplica a imagem manualmente no Creator Hub, a partir da data e do horário previstos, e registra a confirmação.'
      : 'Jogo: após sua autorização, a automação ainda precisa conferir as condições e enviar o arquivo ao Roblox. A confirmação vem depois do envio.';
  let titulo, proximaAcao, etapa = 0, tom = 'relevante', icone = 'martelo';
  if (publicada) {
    titulo = 'Publicado confirmado'; tom = 'ok'; icone = 'ok'; etapa = 3;
    proximaAcao = 'Veja no Andamento os testes e o registro da entrega.';
  } else if (devolvida) {
    titulo = 'Devolvida para ajustes'; tom = 'warn'; icone = 'editar';
    proximaAcao = 'A equipe precisa corrigir e entregar novamente. Não será publicado enquanto não entregar e você autorizar. Ela precisa testar e reentregar como pronto. Só então o botão Autorizar volta a aparecer.';
  } else if (bloqueada) {
    titulo = 'Publicação bloqueada'; tom = 'bad'; icone = 'cadeado'; etapa = testesOk ? 1 : 0;
    proximaAcao = 'A equipe precisa tratar o bloqueio com você antes de retomar a entrega. Veja o motivo e os próximos passos no Andamento.';
  } else if (autorizada) {
    etapa = 2; tom = 'warn'; icone = 'relogio';
    titulo = manual ? 'Autorizada · aguarda aplicação manual' : l.disparoPublicacao?.em ? 'Envio solicitado · aguarda confirmação' : 'Autorizada · aguarda horário/envio';
    proximaAcao = l.tipo === 'evento' && q.passou
      ? 'A equipe precisa revisar o início previsto, que já passou, antes de criar o evento. A criação no Roblox ainda não foi confirmada. Acompanhe no Andamento.'
      : manual
        ? `A equipe precisa ${l.tipo === 'evento' ? 'criar o evento' : 'aplicar a thumbnail no horário permitido'} e registrar a confirmação. Acompanhe no Andamento.`
        : 'Acompanhe o envio e a confirmação no Andamento. Sua autorização foi registrada; ainda falta a publicação ser confirmada.';
    if (config.lancamentosPausados) {
      titulo = 'Autorizada · publicações pausadas';
      proximaAcao = 'Confira a pausa em Ajustes com o proprietário. O envio depende da retomada e das demais verificações; acompanhe no Andamento.';
    } else if (instante(l.autorizacao?.dados?.expiraEm)?.getTime() <= agora.getTime()) {
      titulo = 'Autorização vencida · envio pendente';
      proximaAcao = 'A equipe precisa preparar a retomada para você revisar e autorizar novamente. Acompanhe no Andamento.';
    }
  } else if (esperando && testesOk) {
    titulo = 'Pronto · falta sua autorização'; tom = 'warn'; icone = 'assinatura'; etapa = 1;
    proximaAcao = 'Confira as evidências no Andamento. Depois, digite ou cole o código, toque em Autorizar publicação e confirme em Sim, autorizar no seu aparelho.';
  } else {
    titulo = testesOk ? 'Preparação da entrega' : 'Preparação e testes pendentes';
    proximaAcao = 'A equipe precisa concluir a preparação, aprovar os testes e entregar o pacote pronto para sua autorização.';
  }
  const nomes = ['Preparação / testes', 'Sua autorização', 'Aguarda horário / envio', 'Publicado confirmado'];
  const passos = nomes.map((nome, i) => ({ nome, estado: (bloqueada || devolvida) && i === etapa ? 'impedida' : i < etapa ? 'concluida' : i === etapa ? (publicada ? 'concluida' : 'atual') : 'pendente' }));
  const marcos = [
    testesOk && l.testes?.em ? { nome: 'Testes registrados', em: horarioBrasilia(l.testes.em) } : null,
    (autorizada || publicada) && l.autorizacao?.dados?.em ? { nome: 'Autorização registrada', em: horarioBrasilia(l.autorizacao.dados.em) } : null,
    (autorizada || publicada) && l.disparoPublicacao?.em ? { nome: 'Envio solicitado (não é confirmação)', em: horarioBrasilia(l.disparoPublicacao.em) } : null,
    publicada ? { nome: 'Publicação confirmada', em: horarioBrasilia(l.publicadoEm) || 'Horário não registrado' } : null,
  ].filter(m => m?.em);
  const devolucao = [...(l.historico || [])].reverse().find(e => e.acao === 'devolver');
  return {
    titulo, tom, icone, passos, etapa, proximaAcao, modo, marcos,
    horario: publicada ? `Publicação confirmada: ${horarioBrasilia(l.publicadoEm) || 'horário não registrado'}.` : q.texto,
    codigo: 'Copiar ou digitar o código apenas identifica a versão. Isso sozinho não autoriza nem publica.',
    revisao: devolucao ? `Houve devolução para ajustes${horarioBrasilia(devolucao.em) ? ` em ${horarioBrasilia(devolucao.em)}` : ''}. Versão atual: ${l.versao ?? 'não informada'}. Autorizações anteriores não substituem a desta versão.` : null,
  };
}

/** Reconcilia a proposta com a conferência da SUA versão, nunca com a versão do pacote.
 * Evento de divulgação não comprova entrega do jogo (mesmo quando a ideia é tipo evento).
 * Pacotes legados sem versão explícita continuam acessíveis para revisão, com aviso.
 */
export function estadoPropostaPublicacao(p = {}, lancamentos = [], config = {}, agora = new Date()) {
  const relacionados = lancamentos.filter(l => l.propostaIds?.includes(p.id) && (p.tipo === 'thumbnail' ? l.tipo === 'thumbnail' : l.tipo === 'jogo'));
  const versaoDe = l => l.conferencia?.propostas?.find(c => c.propostaId === p.id)?.versaoProposta;
  const atuais = relacionados.filter(l => versaoDe(l) == null || versaoDe(l) === p.versao);
  const ultimaData = l => Math.max(0, ...[l.testes?.em, l.publicadoEm, l.autorizacao?.dados?.em, ...(l.historico || []).map(e => e.em)].map(d => instante(d)?.getTime() || 0));
  const l = [...atuais].reverse().sort((a, b) => ultimaData(b) - ultimaData(a))[0];
  const vinculoConfirmado = !!l && versaoDe(l) === p.versao && p.versao != null;
  const decidivel = ['PROPOSTA', 'AGUARDANDO APROVAÇÃO', 'ADIADA'].includes(p.status);
  if (l && vinculoConfirmado && !decidivel && p.status !== 'REJEITADA' && !p.bloqueio) {
    const f = estadoPublicacao(l, config, agora);
    const podeAutorizar = l.status === AGUARDANDO && l.testes?.resultado === 'aprovado';
    return { ...f, status: l.status, lancamento: l, vinculoConfirmado, podeAutorizar,
      quemAge: l.status === PUBLICADA ? 'Você, se quiser revisar a entrega' : podeAutorizar ? 'Você, proprietário' : l.status === AUTORIZADA && l.tipo === 'jogo' ? 'Automação; a equipe acompanha' : 'Equipe',
      aviso: null };
  }
  let titulo = 'Aguarda entrega do pacote', status = 'EM DESENVOLVIMENTO', tom = 'relevante', icone = 'martelo', quemAge = 'Equipe';
  let proximaAcao = 'A equipe precisa preparar e testar o pacote desta versão. O botão de autorização aparece depois da entrega pronta.';
  if (p.status === DEVOLVIDA || l?.status === DEVOLVIDA) {
    titulo = 'Devolvida para ajustes'; status = DEVOLVIDA; tom = 'warn'; icone = 'editar';
    proximaAcao = 'A equipe precisa corrigir e entregar novamente. Não será publicado enquanto não entregar e você autorizar.';
  } else if (p.bloqueio || p.status === 'BLOQUEADA' || l?.status === 'BLOQUEADA') {
    titulo = 'Proposta bloqueada'; status = 'BLOQUEADA'; tom = 'bad'; icone = 'cadeado';
    proximaAcao = `A equipe precisa tratar o bloqueio antes de entregar para autorização.${p.bloqueio ? ` Motivo: ${p.bloqueio}` : ''}`;
  } else if (decidivel) {
    status = p.status; titulo = p.status === 'ADIADA' ? 'Ideia adiada' : 'Ideia para decidir'; quemAge = 'Você, proprietário';
    proximaAcao = 'Abra a proposta para aprovar a ideia, pedir alterações, adiar ou rejeitar. Aprovar a ideia permite preparar; a publicação terá autorização separada.';
  } else if (p.status === 'REJEITADA') {
    status = p.status; titulo = 'Ideia rejeitada'; quemAge = 'Nenhuma ação pendente';
    proximaAcao = 'A ideia foi recusada e não tem envio previsto.';
  } else if (l) {
    titulo = 'Pacote relacionado · confira a versão'; tom = 'warn'; icone = 'alerta';
    proximaAcao = 'Há um pacote relacionado, mas o registro não informa a versão desta proposta. Confira o pacote e as evidências; a equipe precisa confirmar esse vínculo.';
  } else if (p.status === 'EM TESTES') {
    titulo = 'Equipe está testando'; status = p.status;
  } else if (p.status === PUBLICADA) {
    titulo = 'Publicação sem confirmação vinculada'; tom = 'warn'; icone = 'alerta';
    proximaAcao = 'A proposta está marcada como publicada. A equipe precisa vincular a confirmação do pacote desta versão para conferir a entrega.';
  }
  const f = estadoPublicacao({ status, testes: { resultado: 'pendente' } }, config, agora);
  return { ...f, titulo, status, tom, icone, proximaAcao, quemAge, lancamento: decidivel ? null : l, vinculoConfirmado,
    podeAutorizar: !decidivel && !p.bloqueio && !!l && l.status === AGUARDANDO && l.testes?.resultado === 'aprovado',
    horario: l ? estadoPublicacao(l, config, agora).horario : `${previsao({ dataAlvo: p.fazerHoje?.data || p.semanaAlvo, urgente: !!p.fazerHoje, horario: p.fazerHoje?.horario }, config, agora).texto} Sem pacote autorizado, não há publicação garantida no dia.`,
    aviso: !l && relacionados.length ? 'Os pacotes encontrados são de outra versão da proposta. A equipe precisa entregar a versão atual.' : null,
  };
}
