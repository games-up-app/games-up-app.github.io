// Central informativa do Games Up. Não aprova etapas, não assina e não publica.
// listarAvisos/novosAvisos/resumoAtualizacao são puros; leitura local só nos helpers explícitos.
const FUSO = 'America/Sao_Paulo';
const estados = { iniciada: 'Etapa iniciada', em_producao: 'Em produção', concluida: 'Etapa concluída', impedida: 'Etapa impedida' };
const revisoes = { negada: 'Etapa negada', ajustes_solicitados: 'Ajustes solicitados' };
const lista = v => Array.isArray(v) ? v.filter(x => x && typeof x === 'object') : [];
const tempo = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v)) ? Date.parse(v) : 0;
const recentes = itens => [...itens].sort((a, b) => tempo(b.em) - tempo(a.em) || String(a.id).localeCompare(String(b.id)));
const registrosDe = dados => recentes(lista(dados?.andamento?.registros || dados?.andamento?.itens).filter(r => r.id));
const releasesDe = dados => lista(dados?.lancamentos?.lancamentos).filter(l => l.id);
const recusada = r => Boolean(revisoes[r?.revisao?.status]);
export const rotuloEtapa = r => revisoes[r?.revisao?.status] || estados[r?.estadoEtapa] || 'Etapa registrada';

export function dataHoraBrasilia(em) {
  return tempo(em) ? `${new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(em))} (Brasília)` : 'Horário não informado';
}

export function contarEvidencias(registros) {
  const midias = lista(registros).flatMap(r => lista(r.midias));
  return { registros: lista(registros).length, etapasConcluidas: lista(registros).filter(r => r.estadoEtapa === 'concluida' && !recusada(r)).length,
    imagens: midias.filter(m => m.tipo === 'imagem').length, videos: midias.filter(m => m.tipo === 'video').length };
}

/** Destinos usam o mesmo contrato de ctx.irPara(aba, sub), sem depender de push. */
export function listarAvisos(dados = {}) {
  const registros = registrosDe(dados);
  const avisos = registros.map(r => ({
    id: `andamento:${r.id}:${r.estadoEtapa || 'registrada'}:${r.revisao?.status || ''}:${r.revisao?.em || ''}`,
    tipo: 'andamento', em: r.registradoEm || r.em, titulo: rotuloEtapa(r), texto: r.titulo || 'Registro de desenvolvimento',
    propostaId: r.propostaId, registroId: r.id, ...contarEvidencias([r]),
    destino: { aba: 'andamento', sub: { id: r.id } },
    decisao: r.propostaId ? { aba: 'decisoes', sub: { tipo: 'proposta', id: r.propostaId } } : null,
  }));
  for (const l of releasesDe(dados)) {
    const publicada = l.status === 'PUBLICADA';
    const disponivel = ['AGUARDANDO AUTORIZAÇÃO FINAL', 'APROVADA PARA PUBLICAÇÃO', 'PUBLICADA'].includes(l.status);
    const relacionados = registros.filter(r => l.propostaIds?.includes(r.propostaId));
    const evidencia = relacionados.find(r => lista(r.midias).length);
    const comum = { propostaId: l.propostaIds?.join(', '), lancamentoId: l.id, ...contarEvidencias(relacionados),
      destino: { aba: 'decisoes', sub: { tipo: 'lancamento', id: l.id } },
      andamento: evidencia ? { aba: 'andamento', sub: { id: evidencia.id } } : null };
    // Uma entrega retirada não continua aparecendo como disponível. A versão identifica reentregas.
    if (disponivel && l.testes?.resultado === 'aprovado') avisos.push({ ...comum,
      id: `entrega:${l.id}:${l.versao || 0}:${l.artefato?.sha256 || ''}`, tipo: 'entrega', em: l.conferencia?.conferidaEm || l.testes?.em,
      titulo: publicada ? 'Entrega registrada' : recusada(relacionados[0]) || recusada(evidencia) ? 'Entrega com ajuste pendente' : 'Entrega disponível', texto: `${l.id} · ${l.status}` });
    if (publicada) avisos.push({ ...comum, id: `publicacao:${l.id}:${l.versao || 0}:${l.publicadoEm || ''}`,
      tipo: 'publicacao', em: l.publicadoEm, titulo: 'Publicação confirmada', texto: `${l.id} · ${l.tipo === 'evento' ? 'Evento anunciado no Roblox' : l.tipo === 'thumbnail' ? 'Thumbnail aplicada' : 'Atualização publicada no jogo'}` });
  }
  return recentes(avisos);
}

/** Retorna a lista (use .length no sino). IDs de leitura não dependem da ordem dos registros. */
export function novosAvisos(avisos, lidos = []) {
  const ids = lidos instanceof Set ? lidos : new Set(Array.isArray(lidos) ? lidos : []);
  return lista(avisos).filter(a => !ids.has(a.id));
}

export function resumoAtualizacao(dados = {}) {
  const registros = registrosDe(dados);
  const releases = releasesDe(dados).map(l => ({ ...l, em: l.publicadoEm || l.conferencia?.conferidaEm || l.testes?.em }));
  // O jogo tem prioridade sobre anúncios do evento/thumbnail da mesma produção.
  const ordenados = recentes(releases);
  const lancamento = ordenados.find(l => l.tipo === 'jogo') || ordenados[0] || null;
  const relacionados = lancamento ? registros.filter(r => lancamento.propostaIds?.includes(r.propostaId)) : registros.filter(r => r.propostaId === registros[0]?.propostaId);
  const ultimo = relacionados[0] || null;
  const evidencia = relacionados.find(r => lista(r.midias).length) || null;
  const publicada = lancamento?.status === 'PUBLICADA';
  const entregue = ['AGUARDANDO AUTORIZAÇÃO FINAL', 'APROVADA PARA PUBLICAÇÃO'].includes(lancamento?.status) && lancamento?.testes?.resultado === 'aprovado';
  const ajuste = !publicada && (recusada(ultimo) || recusada(evidencia) || ['DEVOLVIDA PARA AJUSTES', 'BLOQUEADA'].includes(lancamento?.status));
  const titulo = publicada ? 'Publicação confirmada' : ajuste ? 'Ajustes pendentes' : entregue ? 'Entrega disponível' : ultimo ? rotuloEtapa(ultimo) : 'Aguardando atualização';
  const proximoPasso = ajuste ? 'A equipe precisa corrigir e registrar novas evidências. Confira o motivo em Decisões e no Andamento.'
    : publicada ? 'Veja as imagens, os vídeos e os testes da atualização publicada. Envie sua observação se algo precisar melhorar.'
      : lancamento?.status === 'APROVADA PARA PUBLICAÇÃO' ? 'Sua autorização foi registrada. Acompanhe a confirmação da publicação no Andamento.'
        : entregue ? 'Veja as imagens e os vídeos. Depois, abra Decisões para revisar e autorizar a publicação no seu aparelho.'
          : ultimo?.estadoEtapa === 'concluida' && !recusada(ultimo) ? 'Confira as evidências desta etapa. A entrega completa e a autorização de publicação são acompanhadas em Decisões.'
            : 'Acompanhe os registros. A equipe precisa concluir a etapa e mostrar as evidências.';
  return { titulo, proximoPasso, lancamento, ultimo, evidencia, ...contarEvidencias(relacionados),
    em: publicada ? lancamento.publicadoEm : lancamento?.testes?.em || ultimo?.em,
    decisao: lancamento ? { aba: 'decisoes', sub: { tipo: 'lancamento', id: lancamento.id } }
      : ultimo?.propostaId ? { aba: 'decisoes', sub: { tipo: 'proposta', id: ultimo.propostaId } } : { aba: 'decisoes', sub: {} } };
}

const memoria = new Map();
const chaveUsuario = usuario => {
  const id = typeof usuario === 'string' ? usuario : usuario?.id;
  return typeof id === 'string' && id.trim() ? `games-up:avisos-lidos:v1:${encodeURIComponent(id.trim())}` : null;
};
const idsValidos = v => Array.isArray(v) ? [...new Set(v.filter(x => typeof x === 'string' && x.length > 0 && x.length <= 1000))].slice(-2000) : [];

/** O armazenamento do navegador é por aparelho e usuário. Sem token, texto privado ou decisões. */
export function lerAvisosLidos(usuario, storage) {
  const chave = chaveUsuario(usuario);
  if (!chave) return [];
  try {
    const local = storage === undefined ? globalThis.localStorage : storage;
    const valor = local?.getItem(chave);
    const ids = idsValidos([...(valor ? idsValidos(JSON.parse(valor)) : []), ...(memoria.get(chave) || [])]);
    memoria.set(chave, ids);
    return [...ids];
  } catch { return [...(memoria.get(chave) || [])]; }
}

/** Chamar somente em clique/toque explícito. Ler jamais significa aprovar. */
export function marcarAvisoLido(usuario, aviso, storage) {
  const chave = chaveUsuario(usuario), id = typeof aviso === 'string' ? aviso : aviso?.id;
  if (!chave || !idsValidos([id]).length) return lerAvisosLidos(usuario, storage);
  const ids = idsValidos([...lerAvisosLidos(usuario, storage), id]);
  memoria.set(chave, ids);
  try { (storage === undefined ? globalThis.localStorage : storage)?.setItem(chave, JSON.stringify(ids)); } catch { /* Mantém leitura nesta sessão quando storage está bloqueado. */ }
  return [...ids];
}
