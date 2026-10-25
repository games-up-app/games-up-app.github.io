// "API" do painel rodando no próprio navegador.
// Mantém as mesmas rotas da versão com servidor, mas lê e grava direto no repositório
// privado (RepoGitHub) com o token do proprietário. Quem tem o token é o proprietário.
import { ErroRegra, STATUS, decidirProposta, fazerHoje, comentar, atualizarTarefa, decidirLancamento, alterarConfig } from './regras.js';
import { validarIdeia } from './ideias.js';
import { decidirEtapa } from './revisao-etapas.js';

const ARQUIVOS = ['meta', 'metricas', 'ideias', 'andamento', 'analytics', 'jogo', 'concorrentes', 'noticias', 'thumbnails', 'propostas', 'tarefas', 'tendencias', 'discord', 'lancamentos', 'comentarios', 'config', 'saude-agendamentos', 'relatorios/indice', 'executor', 'push/inscricoes'];

function mes(d) { return d.toISOString().slice(0, 7); }

async function sha256Hex(texto) {
  const h = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function validarInscricao(i) {
  if (!i || typeof i.endpoint !== 'string' || !/^https:\/\/[^\s]{10,800}$/.test(i.endpoint)) return false;
  const k = i.keys || {};
  return typeof k.p256dh === 'string' && /^[A-Za-z0-9_-]{80,100}$/.test(k.p256dh) && typeof k.auth === 'string' && /^[A-Za-z0-9_-]{16,30}$/.test(k.auth);
}

/**
 * @param store   RepoGitHub (ou equivalente com ler/lerVarios/transacao)
 * @param usuario { id, nome } — login do GitHub do dono do token
 * @param assinar async (dados) => assinatura base64, ou null se este aparelho ainda não tem chave
 * @param papel   'proprietario' (aprova e autoriza) ou 'equipe' (só vê e comenta)
 * @param topicoEquipe número do tópico de Issues onde ficam os comentários da equipe
 */
export function criarApi({ store, usuario, assinar = null, papel = 'proprietario', topicoEquipe = null, dono = null }) {
  const eu = { id: usuario.id, nome: usuario.nome, papel: papel === 'equipe' ? 'equipe' : 'proprietario' };
  // No modo Equipe só estas ações existem. O GitHub também impede: a equipe só tem leitura nos dados.
  const PERMITIDAS_EQUIPE = new Set(['GET /api/painel', 'GET /api/relatorio', 'POST /api/comentarios']);
  const MARCA = /^\[(proposta|tarefa|lancamento|thumbnail|andamento):([A-Za-z0-9\-_.]{1,64})\]\s*([\s\S]*)$/;

  /** Comentários da equipe guardados no tópico de Issues, no mesmo formato de comentarios.json. */
  async function comentariosDaEquipe() {
    if (!topicoEquipe || typeof store.lerComentariosEquipe !== 'function') return [];
    try {
      return (await store.lerComentariosEquipe(topicoEquipe)).map(c => {
        const m = c.texto.match(MARCA);
        if (!m) return null;
        const ehDono = dono && c.login.toLowerCase() === dono.toLowerCase();
        return { id: `gh-${c.id}`, alvoTipo: m[1], alvoId: m[2], texto: m[3].trim().slice(0, 2000), por: { id: c.login, nome: c.login, papel: ehDono ? 'proprietario' : 'equipe' }, em: c.em };
      }).filter(Boolean);
    } catch { return []; }
  }

  async function auditar(tx, ev) {
    const caminho = `auditoria/${mes(new Date())}.json`;
    const a = (await tx.ler(caminho)) || { eventos: [] };
    a.eventos.push(ev);
    tx.gravar(caminho, a);
  }

  function texto(corpo, max = 20_000) {
    if (JSON.stringify(corpo || {}).length > max) throw new ErroRegra(413, 'Conteúdo muito grande.');
    return corpo || {};
  }

  const rotas = {
    'POST /api/ideias': async corpo => {
      if (eu.papel !== 'proprietario') throw new ErroRegra(403, 'Somente o dono envia ideias por este formulário.');
      const c = validarIdeia(texto(corpo));
      const ideia = await store.transacao(async tx => {
        const d = (await tx.ler('ideias.json')) || { itens: [] };
        const existente = d.itens.find(x => x.id === c.id);
        if (existente) {
          if (existente.titulo !== c.titulo || existente.texto !== c.texto || existente.assunto !== c.assunto) throw new ErroRegra(409, 'Este envio já existe com outro conteúdo. Atualize a página e confira seu histórico.');
          return existente;
        }
        const i = { ...c, status: 'nova', criadaEm: new Date().toISOString(), por: { id: eu.id, nome: eu.nome }, respostas: [], propostaIds: [] };
        d.itens.push(i); tx.gravar('ideias.json', d);
        await auditar(tx, { id: crypto.randomUUID(), acao: 'ideia.enviar', em: i.criadaEm, por: eu, alvo: { tipo: 'ideia', id: i.id } });
        return i;
      }, 'painel: nova ideia do proprietário');
      return { ok: true, ideia };
    },
    'GET /api/painel': async () => {
      const d = new Date();
      const anterior = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
      const caminhos = [...ARQUIVOS.map(a => `${a}.json`), `auditoria/${mes(anterior)}.json`, `auditoria/${mes(d)}.json`];
      const lidos = await store.lerVarios(caminhos);
      const dados = Object.fromEntries(ARQUIVOS.map(a => [a.replaceAll('/', '_'), lidos[`${a}.json`]]));
      dados.auditoria = [...(lidos[caminhos.at(-2)]?.eventos || []), ...(lidos[caminhos.at(-1)]?.eventos || [])];
      const ult = dados.relatorios_indice?.relatorios?.at(-1);
      if (ult) dados.relatorioAtual = await store.ler(`relatorios/${ult.arquivo}`);
      const daEquipe = await comentariosDaEquipe();
      if (daEquipe.length) {
        dados.comentarios = { ...(dados.comentarios || {}), itens: [...(dados.comentarios?.itens || []), ...daEquipe].sort((a, b) => String(a.em).localeCompare(String(b.em))) };
      }
      return { usuario: eu, dados };
    },

    'GET /api/relatorio': async ({ arquivo }) => {
      if (!/^\d{4}-\d{2}-\d{2}(-preliminar)?\.json$/.test(arquivo || '')) throw new ErroRegra(400, 'Arquivo inválido.');
      const r = await store.ler(`relatorios/${arquivo}`);
      if (!r) throw new ErroRegra(404, 'Relatório não encontrado.');
      return r;
    },

    'POST /api/propostas/decisao': async corpo => {
      const c = texto(corpo);
      const r = await store.transacao(async tx => {
        const propostas = await tx.ler('propostas.json');
        const ev = decidirProposta(propostas, eu, c);
        tx.gravar('propostas.json', propostas);
        await auditar(tx, ev);
        return { proposta: propostas.propostas.find(p => p.id === c.propostaId), evento: ev };
      }, `painel: ${c.acao} ${c.propostaId} (proprietário)`);
      return { ok: true, ...r };
    },

    'POST /api/propostas/fazer-hoje': async corpo => {
      const c = texto(corpo);
      const r = await store.transacao(async tx => {
        const propostas = await tx.ler('propostas.json');
        const ev = fazerHoje(propostas, eu, c);
        tx.gravar('propostas.json', propostas);
        await auditar(tx, ev);
        return { proposta: propostas.propostas.find(p => p.id === c.propostaId), evento: ev };
      }, `painel: ${c.desfazer ? 'desfazer fazer hoje' : 'fazer hoje'} ${c.propostaId} (proprietário)`);
      return { ok: true, ...r };
    },

    'POST /api/andamento/decisao': async corpo => {
      const c = texto(corpo);
      const r = await store.transacao(async tx => {
        const andamento = await tx.ler('andamento.json');
        const { registro, evento } = decidirEtapa(andamento, eu, c);
        if (c.acao === 'ajustes' || c.acao === 'negar') {
          const lista = (await tx.ler('comentarios.json')) || { itens: [] };
          const ret = comentar(lista, eu, { alvoTipo: 'andamento', alvoId: c.registroId, texto: c.comentario });
          tx.gravar('comentarios.json', lista);
          await auditar(tx, ret.evento);
        }
        tx.gravar('andamento.json', andamento);
        await auditar(tx, evento);
        return registro;
      }, `painel: ${c.acao} etapa ${c.registroId}`);
      return { ok: true, registro: r };
    },

    'POST /api/comentarios': async corpo => {
      const c = texto(corpo);
      if (eu.papel === 'equipe') {
        // Valida igual ao do dono e grava no tópico da equipe.
        const { comentario } = comentar({ itens: [] }, eu, c);
        if (!topicoEquipe) throw new ErroRegra(503, 'Comentários da equipe ainda não configurados.');
        await store.comentarEquipe(topicoEquipe, `[${comentario.alvoTipo}:${comentario.alvoId}] ${comentario.texto}`);
        return { ok: true, comentario };
      }
      const r = await store.transacao(async tx => {
        if (c.alvoTipo === 'andamento' && !(await tx.ler('andamento.json'))?.registros?.some(r => r.id === c.alvoId)) throw new ErroRegra(404, 'Etapa não encontrada.');
        const lista = (await tx.ler('comentarios.json')) || { itens: [] };
        const { comentario, evento } = comentar(lista, eu, c);
        tx.gravar('comentarios.json', lista);
        await auditar(tx, evento);
        return comentario;
      }, `painel: comentário em ${c.alvoTipo} ${c.alvoId}`);
      return { ok: true, comentario: r };
    },

    'POST /api/tarefas/progresso': async corpo => {
      const c = texto(corpo);
      const r = await store.transacao(async tx => {
        const tarefas = await tx.ler('tarefas.json');
        const conf = (await tx.ler('config.json')) || {};
        const ev = atualizarTarefa(tarefas, conf, eu, c);
        tx.gravar('tarefas.json', tarefas);
        await auditar(tx, ev);
        return tarefas.tarefas.find(t => t.id === c.tarefaId);
      }, `painel: progresso ${c.tarefaId}`);
      return { ok: true, tarefa: r };
    },

    'POST /api/lancamentos/decisao': async corpo => {
      const c = texto(corpo);
      if (c.acao === 'autorizar' && !assinar) throw new ErroRegra(409, 'Este aparelho ainda não tem a chave de autorização. Crie em Ajustes → Chave de autorização.');
      const r = await store.transacao(async tx => {
        const lancs = await tx.ler('lancamentos.json');
        const propostas = await tx.ler('propostas.json');
        const { evento, paraAssinar, propostasRetomadas } = decidirLancamento(lancs, propostas, eu, c);
        const l = lancs.lancamentos.find(x => x.id === c.lancamentoId);
        if (paraAssinar) l.autorizacao.assinatura = await assinar(paraAssinar);
        tx.gravar('lancamentos.json', lancs);
        if (propostasRetomadas.length) {
          tx.gravar('propostas.json', propostas);
          const tarefas = await tx.ler('tarefas.json');
          if (tarefas) {
            for (const t of tarefas.tarefas.filter(t => propostasRetomadas.includes(t.propostaId))) {
              atualizarTarefa(tarefas, {}, eu, {
                tarefaId: t.id, status: STATUS.EM_DEV, progresso: 0,
                nota: `Retrabalho de ${l.id}: ${c.comentario}`,
              });
            }
            tx.gravar('tarefas.json', tarefas);
          }
        }
        await auditar(tx, evento);
        return l;
      }, `painel: ${c.acao} lançamento ${c.lancamentoId} (proprietário)`);
      return { ok: true, lancamento: r };
    },

    'POST /api/config': async corpo => {
      const c = texto(corpo);
      const r = await store.transacao(async tx => {
        const conf = (await tx.ler('config.json')) || {};
        const ev = alterarConfig(conf, eu, c);
        tx.gravar('config.json', conf);
        await auditar(tx, ev);
        return conf;
      }, 'painel: configurações (proprietário)');
      return { ok: true, config: r };
    },

    'POST /api/push/inscrever': async ({ inscricao } = {}) => {
      if (!validarInscricao(inscricao)) throw new ErroRegra(400, 'Inscrição inválida.');
      const id = (await sha256Hex(inscricao.endpoint)).slice(0, 16);
      await store.transacao(async tx => {
        const d = (await tx.ler('push/inscricoes.json')) || { itens: [] };
        d.itens = d.itens.filter(i => i.id !== id);
        d.itens.push({ id, usuarioId: eu.id, papel: eu.papel, endpoint: inscricao.endpoint, keys: { p256dh: inscricao.keys.p256dh, auth: inscricao.keys.auth }, criadaEm: new Date().toISOString() });
        if (d.itens.length > 20) d.itens = d.itens.slice(-20);
        tx.gravar('push/inscricoes.json', d);
      }, 'painel: notificações ativadas');
      return { ok: true, id };
    },

    'POST /api/push/cancelar': async ({ endpoint } = {}) => {
      if (typeof endpoint !== 'string') throw new ErroRegra(400, 'Endpoint inválido.');
      const id = (await sha256Hex(endpoint)).slice(0, 16);
      await store.transacao(async tx => {
        const d = (await tx.ler('push/inscricoes.json')) || { itens: [] };
        d.itens = d.itens.filter(i => i.id !== id);
        tx.gravar('push/inscricoes.json', d);
      }, 'painel: notificações desativadas');
      return { ok: true };
    },
  };

  return {
    usuario: eu,
    /** Executa uma rota. Erros de regra viram ErroRegra com mensagem para o usuário. */
    async chamar(metodo, caminho, corpo) {
      const rota = rotas[`${metodo} ${caminho}`];
      if (eu.papel === 'equipe' && !PERMITIDAS_EQUIPE.has(`${metodo} ${caminho}`)) throw new ErroRegra(403, 'Só o dono pode fazer isso. No modo Equipe você vê tudo e comenta.');
      if (!rota) throw new ErroRegra(404, 'Ação desconhecida.');
      return rota(corpo || {});
    },
  };
}
