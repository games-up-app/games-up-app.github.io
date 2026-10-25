// Regras de negócio: quem pode fazer o quê e quais transições de status são válidas.
// Roda igual no navegador (painel) e no Node (scripts e testes).
// A garantia final não depende do navegador: o workflow de publicação confere a
// assinatura feita pela chave guardada só no aparelho do proprietário (lib/trava.mjs).
const randomUUID = () => globalThis.crypto.randomUUID();

export const STATUS = Object.freeze({
  PROPOSTA: 'PROPOSTA',
  AGUARDANDO: 'AGUARDANDO APROVAÇÃO',
  APROVADA_DEV: 'APROVADA PARA DESENVOLVIMENTO',
  REJEITADA: 'REJEITADA',
  ADIADA: 'ADIADA',
  EM_DEV: 'EM DESENVOLVIMENTO',
  EM_TESTES: 'EM TESTES',
  AGUARDANDO_FINAL: 'AGUARDANDO AUTORIZAÇÃO FINAL',
  APROVADA_PUB: 'APROVADA PARA PUBLICAÇÃO',
  PUBLICADA: 'PUBLICADA',
  BLOQUEADA: 'BLOQUEADA',
  DEVOLVIDA: 'DEVOLVIDA PARA AJUSTES',
});

export class ErroRegra extends Error {
  constructor(status, mensagem) { super(mensagem); this.status = status; }
}

const DECISOES = {
  aprovar: STATUS.APROVADA_DEV,
  rejeitar: STATUS.REJEITADA,
  pedir_alteracoes: STATUS.DEVOLVIDA,
  adiar: STATUS.ADIADA,
};
const PODE_DECIDIR_EM = [STATUS.PROPOSTA, STATUS.AGUARDANDO, STATUS.ADIADA];
// Uma proposta só pode compor um lançamento se o proprietário a aprovou para desenvolvimento.
const APROVADAS_PARA_DEV = [STATUS.APROVADA_DEV, STATUS.EM_DEV, STATUS.EM_TESTES, STATUS.AGUARDANDO_FINAL, STATUS.APROVADA_PUB];
const VALIDADE_AUTORIZACAO_DIAS = 7;

export function limparTexto(t, max = 2000) {
  if (typeof t !== 'string') return '';
  // Remove caracteres de controle (exceto quebra de linha) e limita tamanho.
  return t.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').trim().slice(0, max);
}

function exigirProprietario(usuario) {
  if (usuario?.papel !== 'proprietario') throw new ErroRegra(403, 'Somente o proprietário pode fazer esta ação.');
}

function autor(u) { return { id: u.id, nome: u.nome, papel: u.papel }; }

export function evento(usuario, acao, alvo, extra = {}) {
  return { id: randomUUID(), acao, alvo, por: autor(usuario), em: new Date().toISOString(), ...extra };
}

/** Decisão do proprietário sobre uma proposta (etapa A). */
export function decidirProposta(dados, usuario, { propostaId, acao, comentario, versao }) {
  exigirProprietario(usuario);
  if (!Object.hasOwn(DECISOES, acao)) throw new ErroRegra(400, 'Ação inválida.');
  const p = dados.propostas.find(x => x.id === propostaId);
  if (!p) throw new ErroRegra(404, 'Proposta não encontrada.');
  if (versao !== p.versao) throw new ErroRegra(409, 'A proposta mudou desde que você abriu. Recarregue e revise antes de decidir.');
  if (!PODE_DECIDIR_EM.includes(p.status)) throw new ErroRegra(409, `Não é possível decidir uma proposta com status "${p.status}".`);
  const texto = limparTexto(comentario);
  if (acao === 'pedir_alteracoes' && !texto) throw new ErroRegra(400, 'Pedir alterações exige um comentário.');
  const anterior = p.status;
  p.status = DECISOES[acao];
  p.decisoes = p.decisoes || [];
  p.decisoes.push({ acao, por: autor(usuario), em: new Date().toISOString(), versao: p.versao, comentario: texto || null });
  return evento(usuario, `proposta.${acao}`, { tipo: 'proposta', id: p.id, versao: p.versao }, {
    comentario: texto || null, resultado: { de: anterior, para: p.status },
  });
}

/** Data de hoje em Brasília (AAAA-MM-DD). */
export function hojeEmBrasilia(agora = new Date()) {
  return new Date(agora.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
}

/**
 * "Fazer hoje": o dono adianta uma proposta APROVADA para sair hoje, fora do dia normal de publicação.
 * Não aprova nada sozinho e não publica: a equipe prioriza, entrega um pacote só dela, o dono autoriza
 * (assinatura) e ela vai para o jogo assim que autorizada. `horario` é a meta do dia (ex.: evento às 19h).
 * `desfazer: true` volta para a data normal.
 */
export function fazerHoje(dados, usuario, { propostaId, horario, desfazer = false }, agora = new Date()) {
  exigirProprietario(usuario);
  const p = dados.propostas.find(x => x.id === propostaId);
  if (!p) throw new ErroRegra(404, 'Proposta não encontrada.');
  if (desfazer) {
    if (!p.fazerHoje) throw new ErroRegra(409, 'Esta proposta não estava marcada para hoje.');
    const antes = p.fazerHoje;
    delete p.fazerHoje;
    return evento(usuario, 'proposta.fazer_hoje_desfeito', { tipo: 'proposta', id: p.id, versao: p.versao }, { resultado: { de: antes, para: null } });
  }
  if (![STATUS.APROVADA_DEV, STATUS.EM_DEV, STATUS.EM_TESTES].includes(p.status)) throw new ErroRegra(409, 'Só dá para adiantar uma proposta aprovada que ainda não foi entregue.');
  if (!p.decisoes?.some(d => d.acao === 'aprovar' && d.versao === p.versao)) throw new ErroRegra(409, 'Aprove esta versão da proposta antes de adiantar.');
  if (p.tipo === 'thumbnail') throw new ErroRegra(409, 'Thumbnail já é trocada no dia marcado; use a data da publicação.');
  const hora = String(horario || '').trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) throw new ErroRegra(400, 'Informe o horário no formato HH:MM.');
  p.fazerHoje = { data: hojeEmBrasilia(agora), horario: hora, por: autor(usuario), em: agora.toISOString() };
  return evento(usuario, 'proposta.fazer_hoje', { tipo: 'proposta', id: p.id, versao: p.versao }, { resultado: { para: p.fazerHoje } });
}

/** Comentários: proprietário e equipe. */
export function comentar(dados, usuario, { alvoTipo, alvoId, texto }) {
  if (!['proprietario', 'equipe'].includes(usuario?.papel)) throw new ErroRegra(403, 'Sem permissão.');
  if (!['proposta', 'tarefa', 'lancamento', 'thumbnail', 'andamento'].includes(alvoTipo)) throw new ErroRegra(400, 'Alvo inválido.');
  if (typeof alvoId !== 'string' || !/^[A-Za-z0-9\-_.]{1,64}$/.test(alvoId)) throw new ErroRegra(400, 'Identificador inválido.');
  const t = limparTexto(texto);
  if (!t) throw new ErroRegra(400, 'Comentário vazio.');
  const c = { id: randomUUID(), alvoTipo, alvoId, texto: t, por: autor(usuario), em: new Date().toISOString() };
  dados.itens.push(c);
  return { comentario: c, evento: evento(usuario, 'comentario.criar', { tipo: alvoTipo, id: alvoId }) };
}

/** Progresso de tarefa: proprietário sempre; equipe só nas próprias e se habilitado. */
export function atualizarTarefa(tarefas, config, usuario, { tarefaId, progresso, status, checklist, nota }) {
  const t = tarefas.tarefas.find(x => x.id === tarefaId);
  if (!t) throw new ErroRegra(404, 'Tarefa não encontrada.');
  if (usuario.papel !== 'proprietario') {
    if (usuario.papel !== 'equipe' || !config.equipePodeAtualizarTarefas) throw new ErroRegra(403, 'A equipe não tem permissão para atualizar tarefas.');
    if (t.responsavelId !== usuario.id) throw new ErroRegra(403, 'Você só pode atualizar suas próprias tarefas.');
  }
  const permitidos = ['A FAZER', STATUS.EM_DEV, STATUS.EM_TESTES, 'CONCLUÍDA', 'IMPEDIDA'];
  const antes = { progresso: t.progresso, status: t.status };
  if (progresso != null) {
    if (!Number.isInteger(progresso) || progresso < 0 || progresso > 100) throw new ErroRegra(400, 'Progresso deve ser inteiro de 0 a 100.');
    t.progresso = progresso;
  }
  if (status != null) {
    if (!permitidos.includes(status)) throw new ErroRegra(400, 'Status de tarefa inválido.');
    t.status = status;
  }
  if (Array.isArray(checklist)) {
    checklist.forEach((feito, i) => { if (t.checklist?.[i] && typeof feito === 'boolean') t.checklist[i].feito = feito; });
  }
  t.historico = t.historico || [];
  t.historico.push({ em: new Date().toISOString(), por: autor(usuario), nota: limparTexto(nota, 500) || null, de: antes, para: { progresso: t.progresso, status: t.status } });
  return evento(usuario, 'tarefa.atualizar', { tipo: 'tarefa', id: t.id }, { resultado: { de: antes, para: { progresso: t.progresso, status: t.status } } });
}

/**
 * Etapa B: autorização final de publicação, vinculada ao hash exato do artefato.
 * Em "autorizar", grava l.autorizacao = { dados } e devolve esses dados em
 * `paraAssinar`; quem chama assina e completa l.autorizacao.assinatura antes de gravar.
 */
export function decidirLancamento(lancs, propostas, usuario, { lancamentoId, acao, artefatoSha256, comentario }) {
  exigirProprietario(usuario);
  const l = lancs.lancamentos.find(x => x.id === lancamentoId);
  if (!l) throw new ErroRegra(404, 'Lançamento não encontrado.');
  const texto = limparTexto(comentario);
  const anterior = l.status;
  l.historico = l.historico || [];
  let paraAssinar = null;
  const propostasRetomadas = [];

  if (acao === 'autorizar') {
    if (l.status !== STATUS.AGUARDANDO_FINAL) throw new ErroRegra(409, `Só é possível autorizar lançamentos com status "${STATUS.AGUARDANDO_FINAL}".`);
    if (l.testes?.resultado !== 'aprovado') throw new ErroRegra(409, 'Os testes deste lançamento não foram aprovados.');
    if (!/^[a-f0-9]{64}$/.test(l.artefato?.sha256 || '')) throw new ErroRegra(409, 'Lançamento sem artefato identificado por hash.');
    if (artefatoSha256 !== l.artefato.sha256) throw new ErroRegra(409, 'O artefato mudou desde que você revisou. Recarregue e revise a nova versão.');
    for (const id of l.propostaIds || []) {
      const p = propostas.propostas.find(x => x.id === id);
      if (!p || !APROVADAS_PARA_DEV.includes(p.status)) throw new ErroRegra(409, `A proposta ${id} não foi aprovada para desenvolvimento.`);
    }
    const agora = new Date();
    const dadosAut = {
      lancamentoId: l.id, versao: l.versao, artefatoSha256: l.artefato.sha256, propostaIds: [...(l.propostaIds || [])],
      por: usuario.id, em: agora.toISOString(),
      expiraEm: new Date(agora.getTime() + VALIDADE_AUTORIZACAO_DIAS * 86400_000).toISOString(),
      nonce: randomUUID(),
    };
    l.autorizacao = { dados: dadosAut, assinatura: null };
    paraAssinar = dadosAut;
    l.status = STATUS.APROVADA_PUB;
  } else if (acao === 'devolver') {
    if (!texto) throw new ErroRegra(400, 'Devolver para ajustes exige um comentário.');
    if ([STATUS.PUBLICADA].includes(l.status)) throw new ErroRegra(409, 'Lançamento já publicado.');
    l.autorizacao = null;
    l.status = STATUS.DEVOLVIDA;
    // Mesmo sem trocar o arquivo, a assinatura anterior não pode voltar a valer.
    l.versao = (l.versao || 0) + 1;
    // Evento só anuncia a atualização: devolver refaz capa/textos, não reabre as propostas.
    for (const id of l.tipo === 'evento' ? [] : l.propostaIds || []) {
      const p = propostas.propostas.find(x => x.id === id);
      if (!p || !APROVADAS_PARA_DEV.includes(p.status) || !p.decisoes?.some(d => d.acao === 'aprovar' && d.versao === p.versao)) continue;
      const de = p.status;
      p.status = STATUS.EM_DEV;
      p.historico = [...(p.historico || []), {
        acao: 'retomar', por: autor(usuario), em: new Date().toISOString(),
        lancamentoId: l.id, comentario: texto, de, para: p.status,
      }];
      propostasRetomadas.push(p.id);
    }
  } else if (acao === 'bloquear') {
    if ([STATUS.PUBLICADA].includes(l.status)) throw new ErroRegra(409, 'Lançamento já publicado.');
    l.autorizacao = null;
    l.status = STATUS.BLOQUEADA;
  } else {
    throw new ErroRegra(400, 'Ação inválida.');
  }
  l.historico.push({ acao, por: autor(usuario), em: new Date().toISOString(), comentario: texto || null, artefatoSha256: l.artefato?.sha256 || null });
  const ev = evento(usuario, `lancamento.${acao}`, { tipo: 'lancamento', id: l.id, versao: l.versao }, {
    comentario: texto || null, resultado: { de: anterior, para: l.status }, lancamento: { id: l.id, artefatoSha256: l.artefato?.sha256 || null },
  });
  return { evento: ev, paraAssinar, propostasRetomadas };
}

/**
 * Registro de novo artefato para um lançamento (usado pela automação).
 * Se o hash mudar, qualquer autorização anterior deixa de valer.
 */
export function registrarArtefato(lancs, { lancamentoId, sha256, caminho, tamanho }) {
  const l = lancs.lancamentos.find(x => x.id === lancamentoId);
  if (!l) throw new ErroRegra(404, 'Lançamento não encontrado.');
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new ErroRegra(400, 'Hash inválido.');
  const mudou = l.artefato?.sha256 !== sha256;
  l.artefato = { caminho, sha256, tamanho };
  if (mudou) {
    l.versao = (l.versao || 0) + 1;
    if (l.autorizacao || l.status === STATUS.APROVADA_PUB) {
      l.autorizacao = null;
      l.status = STATUS.AGUARDANDO_FINAL;
      l.historico = l.historico || [];
      l.historico.push({ acao: 'autorizacao_invalidada', em: new Date().toISOString(), motivo: 'Artefato alterado após autorização.' });
    }
  }
  return mudou;
}

/** Configurações: somente o proprietário. */
export function alterarConfig(config, usuario, mudancas) {
  exigirProprietario(usuario);
  const antes = {};
  if ('equipePodeAtualizarTarefas' in mudancas) {
    if (typeof mudancas.equipePodeAtualizarTarefas !== 'boolean') throw new ErroRegra(400, 'Valor inválido.');
    antes.equipePodeAtualizarTarefas = config.equipePodeAtualizarTarefas;
    config.equipePodeAtualizarTarefas = mudancas.equipePodeAtualizarTarefas;
  }
  if ('lancamentosPausados' in mudancas) {
    if (typeof mudancas.lancamentosPausados !== 'boolean') throw new ErroRegra(400, 'Valor inválido.');
    antes.lancamentosPausados = config.lancamentosPausados;
    config.lancamentosPausados = mudancas.lancamentosPausados;
  }
  if ('horarioPublicacao' in mudancas) {
    const h = mudancas.horarioPublicacao;
    if (h !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(h)) throw new ErroRegra(400, 'Horário deve estar no formato HH:MM.');
    antes.horarioPublicacao = config.horarioPublicacao;
    config.horarioPublicacao = h;
  }
  if ('diaPublicacao' in mudancas) {
    // Dia das publicações autorizadas: sábado (padrão) ou domingo.
    if (!['sabado', 'domingo'].includes(mudancas.diaPublicacao)) throw new ErroRegra(400, 'Dia de publicação deve ser sábado ou domingo.');
    antes.diaPublicacao = config.diaPublicacao || 'sabado';
    config.diaPublicacao = mudancas.diaPublicacao;
  }
  return evento(usuario, 'config.alterar', { tipo: 'config', id: 'config' }, { resultado: { antes, mudancas } });
}
