// Tela Ajustes: conta, publicações (pausa, dia e horário), chave de autorização, celular e atalhos.
import { h, icone, chip, interruptor, botaoCopiar, abrirFolha } from '../ui/componentes.js?v=20261025-comunicacao3';
import { ctx } from '../ui/contexto.js?v=20261025-comunicacao3';
import { dataBR, haQuanto, cabecalhoSecao, segmentado, campo, chipStatus, cardBotao, rotuloStatus } from './comum.js?v=20261025-comunicacao3';

const d = () => ctx.estado.dados || {};

// Rascunho das escolhas de publicação (só grava ao tocar em Salvar).
let rascunho = null;

function cartaoConta() {
  const u = ctx.estado.usuario || {};
  const escuro = ctx.temaAtual() === 'dark';
  const inicial = String(u.nome || u.id || '?').trim().charAt(0).toUpperCase();
  return h('section', { class: 'card card-conta' },
    h('span', { class: 'avatar' }, inicial),
    h('div', { class: 'conta-texto' }, h('strong', {}, u.nome || u.id), h('span', {}, `@${u.id || ''} · ${u.papel === 'proprietario' ? 'dono' : 'equipe'}`)),
    h('div', { class: 'conta-acoes' },
      h('button', { type: 'button', class: 'btn-icone', 'aria-label': escuro ? 'Usar tema claro' : 'Usar tema escuro', onclick: () => { ctx.alternarTema(); ctx.render(); } }, icone(escuro ? 'sol' : 'estrela', { tamanho: 20 }))));
}

function cartaoPublicacoes() {
  const c = d().config || {};
  const salvo = { pausado: !!c.lancamentosPausados, dia: c.diaPublicacao === 'domingo' ? 'domingo' : 'sabado', hora: c.horarioPublicacao || '10:30' };
  if (!rascunho) rascunho = { ...salvo };
  const mudou = () => rascunho.pausado !== salvo.pausado || rascunho.dia !== salvo.dia || rascunho.hora !== salvo.hora;
  const estadoSalvar = h('p', { class: 'nao-salvo', hidden: !mudou() }, icone('editar', { tamanho: 16 }), 'Alterações ainda não salvas');
  const salvar = h('button', { type: 'button', class: 'btn primario grande', disabled: !mudou(), onclick: async () => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(rascunho.hora)) { ctx.avisar('Escolha um horário válido.', true); return; }
    const ok = await ctx.gravar('/api/config', { diaPublicacao: rascunho.dia, horarioPublicacao: rascunho.hora, lancamentosPausados: rascunho.pausado }, [salvar], 'Publicações atualizadas.');
    if (ok) rascunho = null;
  } }, icone('ok', { tamanho: 18 }), 'Salvar publicações');
  const atualizar = () => { salvar.disabled = !mudou(); estadoSalvar.hidden = !mudou(); };

  const hora = h('input', { type: 'time', class: 'campo-hora', value: rascunho.hora, step: 300, 'aria-label': 'Horário de publicação (Brasília)',
    oninput: e => { rascunho.hora = e.target.value; atualizar(); }, onchange: e => { rascunho.hora = e.target.value; atualizar(); } });

  const dias = segmentado([['sabado', 'Sábado', 'calendario'], ['domingo', 'Domingo', 'calendario']], rascunho.dia, v => { rascunho.dia = v; ctx.render(); }, { rotulo: 'Dia de publicação', classe: 'grande' });

  return h('section', { class: 'card card-publicacoes' },
    cabecalhoSecao('foguete', 'Publicações no jogo'),
    h('div', { class: `faixa ${rascunho.pausado ? 'warn' : 'ok'}` }, icone(rascunho.pausado ? 'pausa' : 'foguete', { tamanho: 20 }),
      h('span', {}, rascunho.pausado ? 'Nada vai para o jogo enquanto estiver pausado, mesmo o que já foi autorizado.' : `O que você autorizar vai para o jogo no ${rascunho.dia === 'domingo' ? 'domingo' : 'sábado'} às ${rascunho.hora || '—'}.`)),
    h('div', { class: 'ajuste-bloco' },
      interruptor({ ligado: rascunho.pausado, rotulo: 'Pausar todas as publicações', descricao: 'Use em caso de dúvida ou viagem.', aoMudar: v => { rascunho.pausado = v; ctx.render(); } })),
    h('div', { class: 'ajuste-bloco' },
      h('div', { class: 'ajuste-rotulo' }, icone('calendario', { tamanho: 18 }), 'Dia da publicação'),
      dias),
    h('div', { class: 'ajuste-bloco ajuste-hora' },
      h('div', { class: 'ajuste-rotulo' }, icone('relogio', { tamanho: 18 }), h('span', {}, 'Horário', h('small', {}, 'Horário de Brasília'))),
      h('label', { class: 'hora-caixa' }, hora)),
    estadoSalvar,
    salvar);
}

function cartaoChave() {
  const ch = ctx.estado.chave;
  if (ch?.estado === 'registrada') {
    return cardBotao('card-status ok', () => abrirFolha({ titulo: 'Chave de autorização', conteudo: h('div', {},
      campo('escudo', 'Situação', 'Este aparelho pode autorizar publicações.'),
      campo('calendario', 'Criada em', dataBR(ch.criadaEm)),
      campo('lampada', 'Importante', 'A chave fica só neste aparelho. Se trocar de celular ou limpar o navegador, crie outra.')) }),
    h('span', { class: 'resumo-icone tom-verde' }, icone('escudo', { tamanho: 22 })),
    h('span', { class: 'atalho-texto' }, h('strong', {}, 'Chave de autorização'), h('span', {}, 'Este aparelho pode autorizar publicações')),
    chip('Ativa', { tom: 'ok', iconeNome: 'ok' }));
  }
  if (ch) {
    const verificar = h('button', { type: 'button', class: 'btn primario', onclick: async () => {
      verificar.disabled = true;
      try { const pronto = await ctx.conferirCadastro(); ctx.avisar(pronto ? 'Aparelho confirmado. Você já pode autorizar publicações.' : 'Aguardando a confirmação do código pelo Codex.'); ctx.render(); }
      catch (e) { ctx.avisar(e.message, true); verificar.disabled = false; }
    } }, icone('ok', { tamanho: 18 }), 'Verificar confirmação');
    const reenviar = h('button', { type: 'button', class: 'btn discreto', onclick: async () => {
      reenviar.disabled = true;
      try { await ctx.criarChave(); ctx.avisar('Pedido enviado. O código deste aparelho continua igual.'); ctx.render(); }
      catch (e) { ctx.avisar(e.message, true); reenviar.disabled = false; }
    } }, icone('raio', { tamanho: 18 }), 'Reenviar pedido');
    return h('section', { class: 'card card-destaque' },
      cabecalhoSecao('cadeado', 'Confirme este aparelho'),
      h('p', {}, 'Envie este código na conversa com o Codex. Depois, toque em Verificar confirmação.'),
      h('div', { class: 'codigo-aparelho' }, ch.codigo || '—'),
      h('div', { class: 'acoes' }, botaoCopiar(ch.codigo || '', 'Copiar código'), verificar),
      h('div', { class: 'acoes' }, reenviar));
  }
  const b = h('button', { type: 'button', class: 'btn primario grande', onclick: async () => {
    b.disabled = true; b.replaceChildren(icone('relogio', { tamanho: 18 }), 'Criando…');
    try {
      const nova = await ctx.criarChave();
      ctx.avisar(nova.estado === 'registrada' ? 'Aparelho confirmado.' : 'Chave criada. Envie o código para confirmar este aparelho.');
      ctx.render();
    } catch (e) { ctx.avisar(`Não criada: ${e.message}`, true); b.disabled = false; b.replaceChildren(icone('cadeado', { tamanho: 18 }), 'Criar chave neste aparelho'); }
  } }, icone('cadeado', { tamanho: 18 }), 'Criar chave neste aparelho');
  return h('section', { class: 'card card-destaque' },
    cabecalhoSecao('cadeado', 'Autorizar por este aparelho'),
    h('p', {}, 'Crie a chave para assinar suas autorizações. Ela fica só neste aparelho.'),
    b);
}

function cartaoCelular() {
  const cel = ctx.celular;
  const e = ctx.estado;
  const itens = [];
  if (!cel.instalado()) {
    if (cel.podeInstalar()) {
      itens.push(h('button', { type: 'button', class: 'btn primario', onclick: () => cel.instalar() }, icone('interface', { tamanho: 18 }), 'Adicionar à tela de início'));
    } else {
      itens.push(h('div', { class: 'faixa info' }, icone('interface', { tamanho: 20 }), h('span', {}, cel.ehIOS()
        ? ['No Safari: toque em ', h('strong', {}, 'Compartilhar'), ' e depois em ', h('strong', {}, 'Adicionar à Tela de Início'), '. Abra pelo ícone para ligar as notificações.']
        : ['No Chrome: menu de três pontinhos e ', h('strong', {}, 'Adicionar à tela inicial'), '.'])));
    }
  }
  const diag = e.pushDiagnostico;
  const ativar = h('button', { type: 'button', class: 'btn primario', onclick: () => cel.ativar(ativar) }, icone('sino', { tamanho: 18 }), 'Ativar / reconectar avisos');
  const conferir = h('button', { type: 'button', class: 'btn', onclick: async () => {
    conferir.disabled = true;
    try { await cel.conferir(); } catch (err) { ctx.avisar(err.message, true); conferir.disabled = false; }
  } }, icone('atualizar', { tamanho: 18 }), 'Verificar novamente');
  const off = h('button', { type: 'button', class: 'btn discreto', onclick: () => cel.desativar(off) }, icone('fechar', { tamanho: 18 }), 'Desativar neste aparelho');
  return h('section', { class: 'card', id: 'notificacoes-aparelho' }, cabecalhoSecao('sino', 'Notificações neste aparelho'), itens,
    h('div', { class: `faixa ${diag?.estado === 'envio_confirmado' ? 'ok' : 'warn'}`, role: 'status' }, icone('sino', { tamanho: 22 }),
      h('div', {}, h('strong', {}, diag?.titulo || 'Conferindo notificações…'), h('p', {}, diag?.texto || 'Aguarde a conferência deste aparelho.'))),
    diag?.confirmadoEm ? h('p', { class: 'sinc' }, `Primeiro envio aceito pelo serviço: ${dataBR(diag.confirmadoEm)}.`) : null,
    h('div', { class: 'acoes' }, diag?.acao === 'ativar' ? ativar : null, conferir,
      diag?.ativo ? h('button', { type: 'button', class: 'btn', onclick: () => cel.exemplo().catch(err => ctx.avisar(err.message, true)) }, icone('sino', { tamanho: 18 }), 'Testar aviso só neste celular') : null,
      diag?.ativo ? off : null),
    h('p', { class: 'sinc' }, 'O teste local não verifica o envio da automação. Não é necessário manter o app aberto para receber push.'),
    h('div', { class: 'ajuste-bloco' }, h('strong', {}, 'Menos interrupções'),
      h('p', {}, 'No desenvolvimento, só etapas concluídas geram push. Você também recebe os pedidos de decisão e o resultado da publicação. Os bastidores ficam no Andamento.'),
      h('p', { class: 'sinc' }, 'Entre 23h e 7h (Brasília), os avisos de novidades aguardam a manhã. No modo Foco ou com notificações silenciadas, o celular pode não mostrar o alerta.'),
      h('button', { type: 'button', class: 'btn', onclick: () => ctx.irPara('avisos') }, icone('olho', { tamanho: 18 }), 'Ver avisos dentro do app')));
}

// ------------------------------------------------------------------ atalhos que abrem folhas
function folhaAgenda() {
  const c = d().config || {};
  abrirFolha({ titulo: 'Agenda da semana', conteudo: h('div', { class: 'lista-cards' }, (c.cronograma || []).map(x => h('div', { class: 'card linha-agenda' },
    h('span', { class: 'agenda-dia' }, x.dia),
    h('div', { class: 'atv-texto' }, h('strong', {}, x.atividade), h('span', { class: 'sinc' }, x.automatico)))) ) });
}
const nomeAutomacao = n => ({ 'coleta-diaria': 'Coleta dos números', 'relatorio-semanal': 'Relatório semanal', 'relatorio-preliminar': 'Relatório preliminar', 'diagnostico-segunda': 'Diagnóstico de segunda' }[n] || n.replace(/-/g, ' '));
function folhaAutomacoes() {
  const s = d()['saude-agendamentos'] || {};
  abrirFolha({ titulo: 'Automações', conteudo: h('div', {},
    s.observacao ? h('div', { class: 'faixa info' }, icone('lampada', { tamanho: 20 }), h('span', {}, s.observacao)) : null,
    h('div', { class: 'lista-cards' }, Object.entries(s.tarefas || {}).map(([n, v]) => h('div', { class: 'card linha-saude' },
      h('span', { class: `atv-icone tom-${v.status === 'ok' ? 'verde' : v.status === 'falhou' ? 'vermelho' : 'cinza'}` }, icone(v.status === 'ok' ? 'ok' : v.status === 'falhou' ? 'alerta' : 'relogio', { tamanho: 20 })),
      h('div', { class: 'atv-texto' }, h('strong', {}, nomeAutomacao(n)), h('span', { class: 'sinc' }, v.ultimaExecucao ? `Última vez ${haQuanto(v.ultimaExecucao)}` : 'Ainda não rodou'), v.cron ? h('span', { class: 'sinc' }, v.cron) : null),
      chipStatus(v.status))))) });
}
function folhaHistorico() {
  const eventos = [...(d().auditoria || [])].reverse();
  const lancs = (d().lancamentos?.lancamentos || []).filter(l => ['PUBLICADA', 'BLOQUEADA'].includes(l.status) || l.revertidoEm);
  abrirFolha({ titulo: 'Histórico', conteudo: h('div', {},
    h('h3', { class: 'folha-subtitulo' }, icone('foguete', { tamanho: 18 }), 'Atualizações que foram para o jogo'),
    lancs.length ? h('div', { class: 'lista-cards' }, lancs.map(l => h('div', { class: 'card linha-saude' },
      h('span', { class: 'atv-icone tom-verde' }, icone('foguete', { tamanho: 20 })),
      h('div', { class: 'atv-texto' }, h('strong', {}, `${l.id} ${l.versao || ''}`), h('span', { class: 'sinc' }, l.publicadoEm ? `Publicada em ${dataBR(l.publicadoEm)}` : '', l.revertidoEm ? ` · desfeita em ${dataBR(l.revertidoEm)}` : '')),
      chipStatus(l.status)))) : h('p', { class: 'sinc' }, 'Nenhuma atualização publicada por aqui ainda.'),
    h('h3', { class: 'folha-subtitulo' }, icone('decisoes', { tamanho: 18 }), 'Tudo o que foi decidido'),
    eventos.length ? h('div', { class: 'lista-cards' }, eventos.slice(0, 60).map(e => h('div', { class: 'card linha-evento' },
      h('div', { class: 'evento-topo' }, h('strong', {}, `${e.alvo?.tipo || ''} ${e.alvo?.id || ''}`.trim() || 'Evento'), h('span', { class: 'sinc' }, dataBR(e.em))),
      h('span', {}, e.acao),
      e.resultado?.para ? h('span', { class: 'sinc' }, `${rotuloStatus(e.resultado.de)} → ${rotuloStatus(e.resultado.para)}`) : null,
      h('span', { class: 'sinc' }, `Por ${e.por?.nome || '—'}`),
      e.comentario ? h('span', { class: 'evento-comentario' }, `“${e.comentario}”`) : null))) : h('p', { class: 'sinc' }, 'Nenhuma decisão registrada ainda.')) });
}
function folhaCustos() {
  const c = d().config?.custos || {};
  const nomes = { githubActions: 'GitHub Actions', roblox: 'Roblox', upgradeAutomatico: 'Upgrade automático', hospedagem: 'Hospedagem' };
  abrirFolha({ titulo: 'Custos e limites', conteudo: h('div', {}, Object.entries(c).map(([k, v]) => campo('escudo', nomes[k] || k, typeof v === 'boolean' ? (v ? 'Sim' : 'Não') : v))) });
}
function folhaAcesso() {
  const u = ctx.estado.usuario || {};
  abrirFolha({ titulo: 'Seu acesso', conteudo: h('div', {},
    campo('jogadores', 'Você entrou como', `${u.nome} (${u.id})`),
    campo('cadeado', 'Onde fica o token', 'Só neste aparelho.'),
    campo('lampada', 'Para trocar o token', 'Quando ele vencer, toque em Sair deste aparelho e entre de novo.')),
  rodape: h('button', { type: 'button', class: 'btn perigo grande', onclick: () => ctx.sair() }, icone('fechar', { tamanho: 18 }), 'Sair deste aparelho') });
}

function atalhos() {
  const saude = Object.values(d()['saude-agendamentos']?.tarefas || {});
  const falhas = saude.filter(t => t.status === 'falhou').length;
  const tarefas = (d().tarefas?.tarefas || []).filter(t => t.status !== 'CONCLUÍDA').length;
  const item = (ic, tom, titulo, sub, acao) => h('button', { type: 'button', class: 'item-menu', onclick: acao },
    h('span', { class: `resumo-icone tom-${tom}` }, icone(ic, { tamanho: 20 })),
    h('span', { class: 'atalho-texto' }, h('strong', {}, titulo), h('span', {}, sub)),
    icone('direita', { tamanho: 20 }));
  return h('section', { class: 'card card-menu' },
    item('tarefas', 'roxo', 'Tarefas', `${tarefas} em aberto`, () => ctx.irPara('tarefas')),
    item('calendario', 'azul', 'Agenda da semana', 'O que acontece em cada dia', folhaAgenda),
    item(falhas ? 'alerta' : 'escudo', falhas ? 'vermelho' : 'verde', 'Automações', falhas ? `${falhas} com falha` : `${saude.length} agendadas`, folhaAutomacoes),
    item('decisoes', 'laranja', 'Histórico', 'Publicações e decisões registradas', folhaHistorico),
    item('qualidade', 'cinza', 'Custos e limites', 'Sem cobrança automática', folhaCustos),
    item('jogadores', 'amarelo', 'Seu acesso', 'Token e saída deste aparelho', folhaAcesso));
}

/** Modo Equipe: explica o que a pessoa pode fazer (ver e comentar) e quem decide. */
function cartaoEquipe() {
  return h('section', { class: 'card' },
    h('div', { class: 'card-cabeca' }, h('span', { class: 'resumo-icone tom-roxo' }, icone('jogadores', { tamanho: 20 })), h('h2', {}, 'Você está no modo Equipe')),
    h('div', { class: 'lista-mini' },
      h('div', { class: 'lista-mini-item' }, icone('olho', { tamanho: 18 }), h('span', {}, 'Ver tudo: propostas, números, notícias e pesquisas.')),
      h('div', { class: 'lista-mini-item' }, icone('chat', { tamanho: 18 }), h('span', {}, 'Comentar nas propostas e tarefas. O dono vê na hora.')),
      h('div', { class: 'lista-mini-item' }, icone('cadeado', { tamanho: 18 }), h('span', {}, 'Aprovar ideias, autorizar publicações e mudar ajustes é só com o dono.'))));
}

export function telaAjustes() {
  if (ctx.estado.usuario?.papel !== 'proprietario') {
    return h('div', { class: 'pagina-ajustes' },
      cartaoConta(),
      cartaoEquipe(),
      h('button', { type: 'button', class: 'btn perigo largo', onclick: () => ctx.sair() }, icone('fechar', { tamanho: 18 }), 'Sair deste aparelho'));
  }
  return h('div', { class: 'pagina-ajustes' },
    cartaoConta(),
    cartaoPublicacoes(),
    cartaoChave(),
    cartaoCelular(),
    atalhos(),
    h('button', { type: 'button', class: 'btn perigo largo', onclick: () => ctx.sair() }, icone('fechar', { tamanho: 18 }), 'Sair deste aparelho'));
}
