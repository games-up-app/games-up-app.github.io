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
  const plano = l.tipo === 'thumbnail' && l.thumbnailApi?.versao === 1 ? l.thumbnailApi : null;
  const hora = plano ? plano.horario : l.urgente ? l.horario : config.horarioPublicacao;
  const dataAlvo = plano ? plano.dataAlvo : l.dataAlvo;
  const envio = /^\d{4}-\d{2}-\d{2}$/.test(dataAlvo || '') && /^([01]\d|2[0-3]):[0-5]\d$/.test(hora || '')
    ? `${dataAlvo}T${hora}:00-03:00` : null;
  const data = l.tipo === 'evento' ? l.evento?.inicio : envio;
  const d = instante(data);
  if (!d) return { texto: 'Sem horário confirmado. Acompanhe o Andamento.', passou: false };
  const passou = d.getTime() <= agora.getTime();
  const rotulo = l.tipo === 'evento' ? 'Início previsto do evento' : 'Horário previsto';
  return { texto: `${rotulo}${passou ? ' já passou' : ''}: ${horarioBrasilia(data)}.${passou ? ' Sem novo horário confirmado.' : ' O horário não confirma o envio.'}`, passou, futuro: !passou };
}

// O estado declarado precisa de um registro da entrega. Autorização e disparo
// não são comprovantes; no evento exigimos o ID e o link do próprio evento.
function publicacaoConfirmada(l) {
  if (l.status !== PUBLICADA || !instante(l.publicadoEm)) return false;
  if (l.tipo === 'evento') {
    const id = String(l.eventoRoblox?.id || '');
    const link = String(l.eventoRoblox?.link || '');
    return /^[1-9]\d*$/.test(id) && /^https:\/\/(?:www\.roblox\.com|create\.roblox\.com)\//.test(link)
      && new RegExp(`/events?/${id}(?:[/?#]|$)`).test(link);
  }
  return (l.tipo === 'jogo' && Number.isInteger(l.versaoRoblox) && l.versaoRoblox > 0)
    || (l.historico || []).some(e => e.acao === 'publicado' && instante(e.em)?.getTime() === instante(l.publicadoEm).getTime()
      && (e.versao == null || e.versao === l.versao)
      && (e.artefatoSha256 == null || e.artefatoSha256 === l.artefato?.sha256));
}

function tarefaIntegracao(l, config) {
  return l.tipo === 'evento' && (config.tarefas || []).find(t =>
    (t.id === 'T-008' || t.agendamentoId === 'integrar-game-events-api')
    && t.status !== 'CONCLUÍDA' && (!t.propostaId || l.propostaIds?.includes(t.propostaId)));
}

// O backend só registra agendada após conferir conexão e plano. O manifesto
// sozinho não atesta integração ativa; estes textos não validam nem executam a API.
function estadoThumbnail(l, q) {
  const estado = l.automacaoThumbnail?.estado;
  const plano = l.thumbnailApi?.versao === 1 && l.thumbnailApi.configuracaoId && l.thumbnailApi.substituirId;
  const conferir = estado === 'aguardando_conferencia' || estado === 'publicada'
    || l.disparoPublicacao?.em && !['reservada', 'enviando'].includes(estado);
  if (estado === 'falha' || conferir) return {
    titulo: estado === 'falha' ? 'Troca da thumbnail falhou · equipe vai conferir' : 'Troca da thumbnail aguarda conferência',
    proximaAcao: 'A equipe precisa conferir o resultado no Roblox e registrar a confirmação antes de concluir ou repetir a troca. Use o botão Ver Andamento para acompanhar a conferência da equipe.',
    acaoCurta: 'Equipe: conferir a troca no Roblox', requerAtencao: true,
  };
  if (plano && ['reservada', 'enviando'].includes(estado)) return {
    titulo: estado === 'reservada' ? 'Troca da thumbnail reservada' : 'Thumbnail em envio · aguarda confirmação',
    proximaAcao: 'A automação registrou o início da troca. A equipe acompanha o resultado e ainda precisa confirmar a aplicação da imagem no Roblox. Acompanhe no Andamento.',
    acaoCurta: 'Equipe: acompanhar e confirmar a troca', requerAtencao: false,
  };
  if (plano && estado === 'agendada' && (q.futuro || q.passou)) return {
    titulo: q.futuro ? 'Troca automática agendada · aguarda horário' : 'Troca automática pendente · aguarda confirmação',
    proximaAcao: q.futuro
      ? 'A conexão e o plano de troca foram confirmados. A automação aguarda o horário permitido; a equipe acompanha e confirma o resultado no Roblox.'
      : 'O horário permitido chegou, mas a troca ainda não foi confirmada. A equipe precisa acompanhar o envio e conferir o resultado no Roblox. Acompanhe no Andamento.',
    acaoCurta: q.futuro ? 'Aguardar horário; a equipe acompanha' : 'Equipe: conferir o envio e a troca', requerAtencao: q.passou,
  };
  return {
    titulo: 'A equipe está preparando a troca automática',
    proximaAcao: !plano || estado === 'aguardando_plano'
      ? 'A equipe precisa identificar a imagem que será substituída pela API e concluir o plano de troca, preservando as imagens protegidas. Acompanhe no Andamento.'
      : estado === 'aguardando_chave'
        ? 'A equipe precisa concluir a configuração da conexão antes de confirmar o agendamento da troca. Acompanhe no Andamento.'
        : 'A equipe precisa confirmar a conexão, o plano de troca e o horário permitido antes de confirmar o agendamento. Acompanhe no Andamento.',
    acaoCurta: 'Equipe: preparar e conferir a troca automática', requerAtencao: true,
  };
}

/** Estado informativo, sem inferir sucesso a partir de autorização, horário ou disparo. */
export function estadoPublicacao(l = {}, config = {}, agora = new Date()) {
  const publicada = publicacaoConfirmada(l);
  const autorizada = l.status === AUTORIZADA;
  const devolvida = l.status === DEVOLVIDA;
  const bloqueada = l.status === 'BLOQUEADA';
  const esperando = l.status === AGUARDANDO;
  const testesOk = l.testes?.resultado === 'aprovado';
  const q = previsao(l, config, agora);
  const integracao = tarefaIntegracao(l, config);
  const thumbnail = l.tipo === 'thumbnail' ? estadoThumbnail(l, q) : null;
  const modo = l.tipo === 'evento'
    ? `Evento: anuncia a atualização na página do Roblox; não envia o arquivo do jogo. ${integracao ? 'A API experimental foi verificada, mas a integração de criação ainda não está ativa (T-008). ' : ''}Enquanto a API estiver indisponível, a criação manual está liberada no Creator Hub, pelo kit do evento. É preciso registrar o ID e o link reais para confirmar a criação.`
    : l.tipo === 'thumbnail'
      ? 'Thumbnail: a aplicação da imagem depende do fluxo confirmado pela equipe, a partir da data e do horário permitidos. O plano de troca, sozinho, não comprova conexão ativa nem aplicação da imagem.'
      : 'Jogo: após sua autorização, a automação ainda precisa conferir as condições e enviar o arquivo ao Roblox. A confirmação vem depois do envio.';
  let titulo, proximaAcao, acaoCurta, etapa = 0, tom = 'relevante', icone = 'martelo';
  if (publicada) {
    titulo = 'Publicado confirmado'; tom = 'ok'; icone = 'ok'; etapa = 3;
    proximaAcao = 'Veja no Andamento os testes e o registro da entrega.';
    acaoCurta = 'Ver o registro da entrega';
  } else if (l.status === PUBLICADA) {
    titulo = 'Confirmação de publicação pendente'; tom = 'warn'; icone = 'alerta'; etapa = 2;
    proximaAcao = l.tipo === 'evento' ? 'A equipe precisa conferir e registrar o ID, o link e o horário reais do evento no Roblox. O status isolado não comprova sua criação.' : 'A equipe precisa vincular o registro e o horário reais da publicação. O status isolado não comprova a entrega.';
    acaoCurta = 'Equipe: conferir o registro no Roblox';
  } else if (devolvida) {
    titulo = 'Devolvida para ajustes'; tom = 'warn'; icone = 'editar';
    proximaAcao = 'A equipe precisa corrigir e entregar novamente. Não será publicado enquanto não entregar e você autorizar. Ela precisa testar e reentregar como pronto. Só então o botão Autorizar volta a aparecer.';
    acaoCurta = 'Equipe: corrigir, testar e reentregar';
  } else if (bloqueada) {
    titulo = 'Publicação bloqueada'; tom = 'bad'; icone = 'cadeado'; etapa = testesOk ? 1 : 0;
    proximaAcao = 'A equipe precisa tratar o bloqueio com você antes de retomar a entrega. Veja o motivo e os próximos passos no Andamento.';
    acaoCurta = 'Equipe: resolver o bloqueio';
  } else if (autorizada) {
    etapa = 2; tom = 'warn'; icone = 'relogio';
    titulo = l.tipo === 'evento' ? (integracao ? 'Integração do evento pendente' : 'Criação do evento pendente')
      : thumbnail ? thumbnail.titulo : l.disparoPublicacao?.em ? 'Envio solicitado · aguarda confirmação' : 'Autorizada · aguarda horário/envio';
    acaoCurta = l.tipo === 'evento' ? q.passou ? 'Revisar início e abrir kit manual' : 'Você: abrir kit para criação manual'
      : thumbnail ? thumbnail.acaoCurta : 'Acompanhar envio e confirmação';
    proximaAcao = l.tipo === 'evento'
      ? `${q.passou ? 'A equipe precisa revisar o início previsto, que já passou, antes de criar o evento. As datas originais foram mantidas no kit; não há novo horário confirmado. ' : 'É preciso criar o evento e registrar seu ID e link reais. '}${integracao ? 'A integração pela API ainda não está ativa (T-008). ' : ''}A criação manual está liberada: abra o Kit para criar evento e copie o conteúdo conferido. A criação no Roblox ainda não foi confirmada.`
      : thumbnail
        ? thumbnail.proximaAcao
        : 'Acompanhe o envio e a confirmação no Andamento. Sua autorização foi registrada; ainda falta a publicação ser confirmada.';
    if (config.lancamentosPausados) {
      titulo = 'Autorizada · publicações pausadas';
      proximaAcao = 'Confira a pausa em Ajustes com o proprietário. O envio depende da retomada e das demais verificações; acompanhe no Andamento.';
      acaoCurta = 'Proprietário: revisar a pausa';
    } else if (instante(l.autorizacao?.dados?.expiraEm)?.getTime() <= agora.getTime()) {
      titulo = 'Autorização vencida · envio pendente';
      proximaAcao = 'A equipe precisa preparar a retomada para você revisar e autorizar novamente. Acompanhe no Andamento.';
      acaoCurta = 'Equipe: preparar nova autorização';
    }
  } else if (esperando && testesOk) {
    titulo = 'Pronto · falta sua autorização'; tom = 'warn'; icone = 'assinatura'; etapa = 1;
    proximaAcao = 'Confira as evidências no Andamento. Depois, digite ou cole o código, toque em Autorizar publicação e confirme em Sim, autorizar no seu aparelho.';
    acaoCurta = 'Você: revisar e autorizar o pacote';
  } else {
    titulo = testesOk ? 'Preparação da entrega' : 'Preparação e testes pendentes';
    proximaAcao = 'A equipe precisa concluir a preparação, aprovar os testes e entregar o pacote pronto para sua autorização.';
    acaoCurta = 'Equipe: preparar e testar o pacote';
  }
  const nomes = ['Preparação / testes', 'Sua autorização', l.tipo === 'evento' ? (integracao ? 'Integração / criação pendentes' : 'Criação do evento') : l.tipo === 'thumbnail' ? 'Aplicação da thumbnail' : 'Aguarda horário / envio', 'Publicado confirmado'];
  const passos = nomes.map((nome, i) => ({ nome, estado: (bloqueada || devolvida) && i === etapa ? 'impedida' : i < etapa ? 'concluida' : i === etapa ? (publicada ? 'concluida' : 'atual') : 'pendente' }));
  const marcos = [
    testesOk && l.testes?.em ? { nome: 'Testes registrados', em: horarioBrasilia(l.testes.em) } : null,
    (autorizada || publicada) && l.autorizacao?.dados?.em ? { nome: 'Autorização registrada', em: horarioBrasilia(l.autorizacao.dados.em) } : null,
    (autorizada || publicada) && l.disparoPublicacao?.em ? { nome: 'Envio solicitado (não é confirmação)', em: horarioBrasilia(l.disparoPublicacao.em) } : null,
    publicada ? { nome: 'Publicação confirmada', em: horarioBrasilia(l.publicadoEm) || 'Horário não registrado' } : null,
  ].filter(m => m?.em);
  const devolucao = [...(l.historico || [])].reverse().find(e => e.acao === 'devolver');
  return {
    requerAtencao: !publicada && (bloqueada || devolvida || l.status === PUBLICADA ||
      autorizada && (q.passou || !!integracao || !!thumbnail?.requerAtencao || !!config.lancamentosPausados || instante(l.autorizacao?.dados?.expiraEm)?.getTime() <= agora.getTime())),
    titulo, tom, icone, passos, etapa, proximaAcao, acaoCurta, modo, marcos, confirmada: publicada,
    status: l.status === PUBLICADA && !publicada ? 'CONFIRMAÇÃO PENDENTE' : l.status,
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
    return { ...f, lancamento: l, vinculoConfirmado, podeAutorizar,
      quemAge: f.confirmada ? 'Você, se quiser revisar a entrega' : podeAutorizar ? 'Você, proprietário' : l.status === AUTORIZADA && l.tipo === 'jogo' ? 'Automação; a equipe acompanha' : 'Equipe',
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
  return { ...f, titulo, status, tom, icone, proximaAcao, acaoCurta: decidivel ? 'Você: abrir e decidir a ideia' : status === 'REJEITADA' ? 'Nenhuma ação pendente' : status === DEVOLVIDA ? 'Equipe: corrigir, testar e reentregar' : status === 'BLOQUEADA' ? 'Equipe: resolver o bloqueio' : 'Equipe: preparar e conferir o pacote', quemAge, lancamento: decidivel ? null : l, vinculoConfirmado,
    podeAutorizar: !decidivel && !p.bloqueio && !!l && l.status === AGUARDANDO && l.testes?.resultado === 'aprovado',
    horario: l ? estadoPublicacao(l, config, agora).horario : `${previsao({ dataAlvo: (p.agendamentoPublicacao || p.fazerHoje)?.data || p.semanaAlvo, urgente: !!(p.agendamentoPublicacao || p.fazerHoje), horario: (p.agendamentoPublicacao || p.fazerHoje)?.horario }, config, agora).texto} Sem pacote autorizado, não há publicação garantida no dia.`,
    aviso: !l && relacionados.length ? 'Os pacotes encontrados são de outra versão da proposta. A equipe precisa entregar a versão atual.' : null,
  };
}
