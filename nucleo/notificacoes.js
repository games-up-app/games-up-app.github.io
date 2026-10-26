import { chaveParaBytes } from './vapid.js?v=20261026-agenda2';

function mesmaChave(inscricao, publica) {
  const valor = inscricao?.options?.applicationServerKey;
  if (!valor) return false;
  const existente = ArrayBuffer.isView(valor) ? new Uint8Array(valor.buffer, valor.byteOffset, valor.byteLength) : new Uint8Array(valor);
  const esperada = chaveParaBytes(publica);
  return existente.length === esperada.length && existente.every((b, i) => b === esperada[i]);
}

function vigente(inscricao, agora) {
  return !!inscricao && (inscricao.expirationTime == null || (typeof inscricao.expirationTime === 'number' && inscricao.expirationTime > agora));
}

/** Diagnóstico do aparelho: cadastro e aceite pelo serviço não provam exibição no celular. */
export async function diagnosticarNotificacoes({ registration, permission, publicKey, inscricoes, confirmacoes,
  usuarioId, suportado = true, ios = false, instalado = true, agora = Date.now() }) {
  const resposta = (estado, titulo, texto, acao = null, ativo = false, confirmadoEm = null) =>
    ({ estado, titulo, texto, acao, ativo, confirmadoEm });
  if (ios && !instalado) return resposta('instalar', 'Abra pelo ícone do app', 'No Safari, use Compartilhar → Adicionar à Tela de Início. Depois abra pelo ícone para ativar os avisos.');
  if (!suportado) return resposta('incompativel', 'Este navegador não oferece notificações', 'O histórico e os avisos continuam disponíveis dentro do app. Use um navegador compatível para receber push.');
  if (permission === 'denied') return resposta('bloqueado', 'O navegador bloqueou os avisos', 'Libere as notificações do Games Up nas configurações do navegador ou do celular. Depois toque em Verificar novamente.');
  if (permission !== 'granted') return resposta('permissao', 'Falta sua permissão', 'Toque em Ativar notificações e permita os avisos neste aparelho.', 'ativar');
  const reg = await registration;
  const sub = await reg?.pushManager?.getSubscription();
  if (!vigente(sub, agora) || !mesmaChave(sub, publicKey)) return resposta('renovar', 'Reconecte os avisos deste aparelho', 'A inscrição está ausente, vencida ou usa uma chave antiga. O botão abaixo refaz o cadastro.', 'ativar');
  const json = sub.toJSON();
  const cadastro = (inscricoes?.itens || []).find(i => i.usuarioId?.toLowerCase() === usuarioId?.toLowerCase() &&
    i.endpoint === json.endpoint && i.keys?.p256dh === json.keys?.p256dh && i.keys?.auth === json.keys?.auth);
  if (!cadastro) return resposta('cadastrar', 'Cadastro ainda não confirmado', 'O navegador permitiu os avisos, mas este aparelho ainda não está cadastrado na automação.', 'ativar');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([
    cadastro.endpoint, cadastro.keys?.p256dh, cadastro.keys?.auth, cadastro.criadaEm || '',
  ])));
  const marca = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  const em = confirmacoes?.entregues?.[marca];
  if (em && Number.isFinite(Date.parse(em))) return resposta('envio_confirmado', 'Cadastro e primeiro envio confirmados', 'O serviço de push aceitou um envio para este aparelho. A exibição depende das permissões, do modo Foco e da conexão do celular.', null, true, em);
  return resposta('cadastrado', 'Aparelho cadastrado; envio ainda sem confirmação', 'A automação ainda não registrou a confirmação do primeiro envio. Isso não garante que um aviso já apareceu no celular. Consulte também Avisos no app.', null, true);
}

/** A inscrição local sozinha não prova que a automação conhece este aparelho. */
export async function notificacoesAtivas({ registration, permission, publicKey, inscricoes, usuarioId, agora = Date.now() }) {
  if (permission !== 'granted' || !usuarioId) return false;
  const reg = await registration;
  if (!reg?.pushManager) return false;
  const sub = await reg.pushManager.getSubscription();
  if (!vigente(sub, agora) || !mesmaChave(sub, publicKey)) return false;
  const json = sub.toJSON();
  return (inscricoes?.itens || []).some(i =>
    i.usuarioId?.toLowerCase() === usuarioId.toLowerCase() && i.endpoint === json.endpoint &&
    i.keys?.p256dh === json.keys?.p256dh && i.keys?.auth === json.keys?.auth);
}

/** Pede permissão no próprio clique; cadastro só termina após confirmação remota. */
export async function ativarNoAparelho({ registration, notification, carregarChave, cadastrar, agora = Date.now() }) {
  let permissao = notification.permission;
  if (permissao === 'default') permissao = await notification.requestPermission();
  if (permissao !== 'granted') throw new Error('Permissão negada. Libere nas configurações do navegador.');
  const publica = await carregarChave();
  const reg = await registration;
  if (!reg?.pushManager) throw new Error('Não consegui preparar as notificações neste navegador.');
  let sub = await reg.pushManager.getSubscription();
  if (sub && (!vigente(sub, agora) || !mesmaChave(sub, publica))) {
    // Renovação por chave trocada ou expiração. Erros de rede nunca removem a inscrição.
    if (!await sub.unsubscribe()) throw new Error('Não consegui renovar as notificações. Tente novamente.');
    sub = null;
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(publica) });
  const cadastro = await cadastrar(sub.toJSON());
  if (cadastro?.ok !== true) throw new Error('O cadastro deste aparelho não foi confirmado. Tente novamente.');
  return { inscricao: sub, cadastro };
}
