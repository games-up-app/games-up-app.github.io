import { chaveParaBytes } from './vapid.js?v=20261025-etapas2';

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
