// Saúde informativa do painel: deriva evidências e prazos, sem rede, jobs ou gravações.
// Cron de GitHub Actions é UTC; os compromissos abaixo usam Brasília (UTC−3).
import { avaliarPresenca } from './presenca.js?v=20261026-agenda2';

const HORA = 3600_000;
const REGRAS = {
  'noticias-diarias': { nome: 'Notícias do dia', cron: '30 10 * * *', periodo: 'dia', obrigatoria: true,
    escopo: 'Coleta de fontes oficiais, sem LLM; não é pesquisa completa em redes sociais.' },
  'pesquisa-semanal': { nome: 'Pesquisa e propostas novas', cron: '30 12 * * 1', periodo: 'semana', obrigatoria: true,
    escopo: 'Triagem de dados por regras, sem observação de interfaces ou cenários. Avaliação no Roblox/Studio e imagens ainda dependem dos especialistas disponíveis.' },
  'jogo-ao-vivo': { nome: 'Números do jogo', cron: '40 * * * *', idade: 2.5 * HORA, obrigatoria: true },
  'push-novidades': { nome: 'Avisos de novidades', cron: '15 11-23/3 * * *', idade: 4 * HORA, diurna: true, obrigatoria: true },
  'ideias-nuvem': { nome: 'Respostas às ideias', idade: 2.5 * HORA, obrigatoria: true, observadora: true,
    escopo: 'Verificação de respostas, não execução do Claude. Não comprova produção automática de propostas.' },
  'fila-imagens': { nome: 'Imagens das propostas', idade: 2.5 * HORA, observadora: true,
    escopo: 'Verificação dos anexos, não geração de imagens. A produção depende do Codex no PC disponível, sem prazo garantido.' },
  imagens: { nome: 'API paga de imagens', escopo: 'Serviço separado da fila de anexos das propostas e da produção por Codex no PC.' },
  'coleta-diaria': { nome: 'Coleta dos números', cron: '0 9 * * *' },
  'jogos-de-escola': { nome: 'Jogos de escola', cron: '0 9 * * *' },
  'numeros-completos': { nome: 'Números completos', cron: '0 9 * * *' },
  discord: { nome: 'Discord', cron: '0 9 * * *' },
  'relatorio-semanal': { nome: 'Relatório semanal', cron: '0 11 * * 6' },
  'relatorio-preliminar': { nome: 'Relatório preliminar', cron: '0 12 * * 0' },
  'diagnostico-segunda': { nome: 'Diagnóstico de segunda', cron: '0 12 * * 1' },
  'lembrete-sexta': { nome: 'Lembrete de sexta', cron: '0 15 * * 5' },
};
const ROTULOS = { ok: 'Em dia', atrasada: 'Atrasada', falhou: 'Falhou', parcial: 'Parcial', indisponivel: 'Indisponível',
  desligada: 'Desligada', nunca: 'Nunca executada', invalida: 'Registro inválido', sem_cadencia: 'Cadência não comprovada', sem_sinal: 'Sem sinal recente', pausa: 'Aguarda horário diurno' };
const diaBR = em => new Date(em - 3 * HORA).toISOString().slice(0, 10);

// Exige instante com fuso e data real (Date.parse aceita, por exemplo, 30 de fevereiro).
function instante(valor) {
  if (typeof valor !== 'string') return NaN;
  const m = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d{1,3})?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(valor);
  if (!m) return NaN;
  const dia = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return dia.getUTCFullYear() === +m[1] && dia.getUTCMonth() === +m[2] - 1 && dia.getUTCDate() === +m[3] ? Date.parse(valor) : NaN;
}

function campoCron(texto, max) {
  const valores = new Set();
  for (const parte of texto.split(',')) {
    const m = /^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/.exec(parte);
    if (!m) return null;
    const passo = m[2] ? +m[2] : 1;
    const [de, ate] = m[1] === '*' ? [0, max] : m[1].includes('-') ? m[1].split('-').map(Number) : [+m[1], m[2] ? max : +m[1]];
    if (!passo || de < 0 || ate > max || de > ate) return null;
    for (let n = de; n <= ate; n += passo) valores.add(n);
  }
  return [...valores];
}

// Apenas cadências diárias/semanais comprováveis. Expressões desconhecidas não viram promessa.
function agendaCron(texto, agora, graca = 0) {
  if (typeof texto !== 'string') return null;
  const partes = texto.trim().replace(/\s*\(.*\)\s*$/, '').split(/\s+/);
  if (partes.length !== 5 || partes[2] !== '*' || partes[3] !== '*') return null;
  const minutos = campoCron(partes[0], 59), horas = campoCron(partes[1], 23), dias = campoCron(partes[4], 7);
  if (!minutos || !horas || !dias) return null;
  const base = Math.floor(agora / 86400_000) * 86400_000;
  let anterior = null, proxima = null;
  for (let i = -8; i <= 8; i++) {
    const data = base + i * 86400_000;
    const wd = new Date(data).getUTCDay();
    if (!dias.some(d => d % 7 === wd)) continue;
    for (const h of horas) for (const m of minutos) {
      const em = data + h * HORA + m * 60_000;
      if (em <= agora - graca && (anterior == null || em > anterior)) anterior = em;
      if (em > agora && (proxima == null || em < proxima)) proxima = em;
    }
  }
  return { anterior, proxima };
}

function avaliarRotina(id, fonte, agora) {
  const regra = REGRAS[id] || {};
  const v = fonte && typeof fonte === 'object' ? fonte : {};
  const ultimo = instante(v.ultimaExecucao);
  const valido = Number.isFinite(ultimo) && ultimo <= agora;
  const desligada = v.enabled === false || v.ativo === false || v.ativa === false || /^(desligad[ao]|desativad[ao]|disabled|pausad[ao])$/i.test(v.status || '')
    || /^Desligad[ao]:/i.test(v.detalhe || '');
  const agenda = agendaCron(v.cron, agora);
  // Compromissos obrigatórios não podem ser afrouxados por um cron incorreto na fonte.
  const prazo = agendaCron(regra.cron || v.cron, agora, 2 * HORA);
  // No produtor com catchup, uma tentativa nova não substitui o período efetivamente entregue.
  const temPeriodo = !!regra.periodo && Object.hasOwn(v, 'periodoConcluido');
  const periodo = typeof v.periodoConcluido === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.periodoConcluido)
    ? instante(`${v.periodoConcluido}T00:00:00-03:00`) : NaN;
  const periodoInvalido = temPeriodo && v.periodoConcluido != null && (!Number.isFinite(periodo)
    || v.periodoConcluido > diaBR(agora) || (regra.periodo === 'semana' && new Date(periodo).getUTCDay() !== 1));
  const periodoPendente = temPeriodo && prazo?.anterior != null && (!Number.isFinite(periodo) || v.periodoConcluido < diaBR(prazo.anterior));
  const horaBR = new Date(agora - 3 * HORA).getUTCHours();
  const diurna = horaBR >= 7 && horaBR < 23;
  const vencida = valido && (regra.idade ? (regra.diurna ? diurna && agora - ultimo > regra.idade : agora - ultimo > regra.idade)
    : periodoPendente || (prazo?.anterior != null && ultimo < prazo.anterior));
  let status, motivo;
  if (desligada) { status = 'desligada'; motivo = 'A rotina está desligada; o registro anterior não comprova funcionamento atual.'; }
  else if (v.status === 'falhou') { status = 'falhou'; motivo = 'A última tentativa registrou falha.'; }
  else if (v.ultimaExecucao != null && !valido) { status = 'invalida'; motivo = Number.isFinite(ultimo) && ultimo > agora ? 'A última execução está no futuro; confira o relógio da fonte.' : 'A última execução não tem data e fuso válidos.'; }
  else if (periodoInvalido) { status = 'invalida'; motivo = 'O período concluído é inválido ou futuro; não comprova a entrega da rotina.'; }
  else if (!valido) { status = 'nunca'; motivo = 'Nenhuma execução comprovada. Planejamento e rotina ativa não comprovam conclusão.'; }
  else if (vencida) { status = 'atrasada'; motivo = regra.idade ? `Sem execução recente dentro do limite de ${regra.idade / HORA} h.` : 'Falta concluir o período previsto, mesmo após 2 h de tolerância. A próxima execução da nuvem pode recuperar a pendência; o horário não é garantido.'; }
  else if (v.status === 'parcial') { status = 'parcial'; motivo = regra.observadora ? 'A verificação encontrou pendências.' : 'A execução foi parcial; há pendências na fonte.'; }
  else if (v.status === 'indisponível' || v.status === 'indisponivel') { status = 'indisponivel'; motivo = 'A fonte registrou indisponibilidade.'; }
  else if (v.status !== 'ok') { status = 'indisponivel'; motivo = 'Não há conclusão bem-sucedida comprovada para esta tentativa.'; }
  else if (!regra.idade && !prazo) { status = 'sem_cadencia'; motivo = 'Há registro de execução, mas falta uma cadência verificável para avaliar a atualidade.'; }
  else if (regra.diurna && !diurna) { status = 'pausa'; motivo = 'Entre 23h e 7h de Brasília, o envio de novidades aguarda a manhã.'; }
  else { status = 'ok'; motivo = regra.observadora ? 'Verificação recente concluída sem pendências registradas; não comprova produção automática.' : 'Execução concluída dentro do prazo. Nenhum item novo também é um resultado válido.'; }
  const pendentes = Array.isArray(v.pendentes) ? v.pendentes.filter(id => typeof id === 'string') : [];
  return { id, nome: regra.nome || id.replace(/-/g, ' '), motor: v.motor === 'PC' ? 'PC' : 'Nuvem', status, rotulo: ROTULOS[status],
    atencao: !['ok', 'pausa'].includes(status), atrasada: vencida === true && !desligada,
    ultimaExecucao: valido ? v.ultimaExecucao : null,
    proximaExecucao: !desligada && agenda?.proxima != null ? new Date(agenda.proxima).toISOString() : null,
    agenda: typeof v.cron === 'string' ? v.cron : null,
    detalhe: [motivo, regra.escopo, pendentes.length ? `Pendentes: ${pendentes.join(', ')}.` : null,
      typeof v.detalhe === 'string' ? v.detalhe.trim() : v.detalhe?.erro].filter(Boolean).join(' ') };
}

/** Recebe o snapshot /api/painel e um instante injetável. Não infere sucesso de notícias/propostas ou contagens. */
export function derivarSaudeAutomacao(dados = {}, agora = Date.now()) {
  const hora = agora instanceof Date ? agora.getTime() : typeof agora === 'string' ? instante(agora) : agora;
  if (!Number.isFinite(hora)) throw new TypeError('Informe um instante válido para avaliar as automações.');
  const fontes = { ...(dados?.['saude-agendamentos']?.tarefas || {}) };
  // Compatibilidade: o job de ideias pode publicar o nome antigo; nunca duplica a rotina.
  if (!fontes['ideias-nuvem'] && fontes['ideias-soltas']) fontes['ideias-nuvem'] = fontes['ideias-soltas'];
  delete fontes['ideias-soltas'];
  const ids = new Set([...Object.keys(REGRAS).filter(id => REGRAS[id].obrigatoria), ...Object.keys(fontes)]);
  const rotinas = [...ids].filter(id => id !== 'executor-pc').map(id => avaliarRotina(id, fontes[id], hora));
  const sinais = ['codex', 'claude'].map(id => dados?.presenca?.itens?.[id])
    .filter(v => Number.isFinite(instante(v?.atualizadoEm)) && Number.isFinite(instante(v?.expiraEm)))
    .map(v => ({ v, p: avaliarPresenca(v, hora) }))
    .filter(({ p }) => p.estado !== 'sem_sinal').sort((a, b) => instante(b.v.atualizadoEm) - instante(a.v.atualizadoEm));
  const sinal = sinais.find(({ p }) => p.estado !== 'indisponivel') || sinais[0];
  const pcOk = !!sinal && sinal.p.estado !== 'indisponivel';
  const verificacao = instante(dados?.executor?.ultimaVerificacao);
  rotinas.push({ id: 'executor-pc', nome: 'Executor no PC', motor: 'PC', status: pcOk ? 'ok' : 'sem_sinal',
    rotulo: pcOk ? 'Sinal recente' : 'Sem sinal recente', atencao: !pcOk, atrasada: false,
    trabalhando: pcOk && sinal.p.estado === 'trabalhando',
    trabalhoAtualConfirmado: sinais.some(({ v, p }) => p.estado === 'trabalhando' && !!v.propostaId && v.propostaId === dados?.executor?.trabalhoAtual?.propostaId),
    ultimaExecucao: Number.isFinite(verificacao) && verificacao <= hora ? dados.executor.ultimaVerificacao : null,
    proximaExecucao: null, agenda: null,
    detalhe: (pcOk ? `Presença recente: ${sinal.v.id || 'equipe'} ${sinal.p.texto}. O sinal expira; não garante execução.`
      : 'Sem presença disponível e recente (menos de 15 min, com expiração futura). Um trabalho antigo no executor não comprova atividade agora.')
      + ' Imagens futuras por Codex e testes no Roblox Studio dependem do PC disponível, sem prazo garantido. Não executam com o PC desligado; a API paga de imagens está desligada.' });
  const atencao = rotinas.filter(r => r.atencao).length;
  const atrasadas = rotinas.filter(r => r.atrasada).length;
  return { rotinas, atencao, atrasadas, titulo: atencao ? 'Precisa de atenção' : 'Em dia',
    resumo: atencao ? `${atrasadas} ${atrasadas === 1 ? 'rotina atrasada' : 'rotinas atrasadas'} · ${atencao} ${atencao === 1 ? 'pendência' : 'pendências'}` : `${rotinas.length} rotinas verificadas` };
}
