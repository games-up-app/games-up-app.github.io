// Guarda no aparelho (IndexedDB) o token do GitHub e a chave de autorização.
// A chave de autorização é NÃO exportável: o navegador usa, mas ninguém consegue copiá-la.
import { gerarChaveDispositivo, assinarObjeto } from './assinatura.js';

const BANCO = 'central-eb';
const LOJA = 'aparelho';

function abrir() {
  return new Promise((ok, erro) => {
    const r = indexedDB.open(BANCO, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(LOJA);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  });
}

async function op(modo, fn) {
  const db = await abrir();
  try {
    return await new Promise((ok, erro) => {
      const tx = db.transaction(LOJA, modo);
      const req = fn(tx.objectStore(LOJA));
      tx.oncomplete = () => ok(req?.result);
      tx.onerror = () => erro(tx.error);
    });
  } finally { db.close(); }
}

export const lerItem = chave => op('readonly', s => s.get(chave));
export const gravarItem = (chave, valor) => op('readwrite', s => s.put(valor, chave));
export const apagarItem = chave => op('readwrite', s => s.delete(chave));

export async function lerToken() { return (await lerItem('token')) || null; }
export async function gravarToken(t) { await gravarItem('token', t); }
export async function esquecerToken() { await apagarItem('token'); }

/** { privada: CryptoKey, publicaPem, criadaEm } ou null */
export async function chaveDoAparelho() { return (await lerItem('chave-autorizacao')) || null; }

/**
 * Cria a chave deste aparelho e registra a parte PÚBLICA na variável
 * APPROVAL_SIGNING_PUBLIC_KEYS do repositório (o workflow de publicação confere por ela).
 */
export async function criarChaveDoAparelho(repo) {
  const { privada, publicaPem } = await gerarChaveDispositivo();
  const atuais = (await repo.lerVariavel('APPROVAL_SIGNING_PUBLIC_KEYS')) || '';
  const todas = `${atuais.trim()}\n${publicaPem}`.trim() + '\n';
  if (todas.length > 40_000) throw new Error('Muitas chaves registradas. Apague as antigas na variável APPROVAL_SIGNING_PUBLIC_KEYS.');
  await repo.gravarVariavel('APPROVAL_SIGNING_PUBLIC_KEYS', todas);
  const item = { privada, publicaPem, criadaEm: new Date().toISOString() };
  await gravarItem('chave-autorizacao', item);
  return item;
}

export async function assinadorDoAparelho() {
  const c = await chaveDoAparelho();
  return c ? dados => assinarObjeto(c.privada, dados) : null;
}
