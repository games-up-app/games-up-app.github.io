// Guarda no aparelho (IndexedDB) o token do GitHub e a chave de autorização.
// A chave de autorização é NÃO exportável: o navegador usa, mas ninguém consegue copiá-la.
import { gerarChaveDispositivo, assinarObjeto } from './assinatura.js?v=20261025-etapas2';
import { criarPedidoCadastro, validarPedidoCadastro, impressaoDigitalDaChave, codigoDaImpressaoDigital, lerRegistroDeAparelhos } from './cadastro-aparelho.js?v=20261025-etapas2';

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

/** A leitura local não confirma confiança; confira com atualizarCadastroDoAparelho. */
export async function chaveDoAparelho() { return (await lerItem('chave-autorizacao')) || null; }

/**
 * Guarda a privada antes de qualquer rede e envia somente um pedido assinado.
 * A publicação da chave confiável exige conferência humana pelo PC.
 */
export async function criarChaveDoAparelho(repo, { usuarioId, fetchImpl } = {}) {
  if (typeof usuarioId !== 'string' || !usuarioId) throw new Error('Entre no Games Up antes de cadastrar este aparelho.');
  let item = await chaveDoAparelho();
  if (!item) {
    const par = await gerarChaveDispositivo();
    item = { ...par, criadaEm: new Date().toISOString(), estado: 'pendente' };
    await gravarItem('chave-autorizacao', item);
  }
  if (item.usuarioId && item.usuarioId.toLowerCase() !== usuarioId.toLowerCase()) throw new Error('Esta chave pertence a outro usuário neste aparelho.');
  item.usuarioId = usuarioId;
  item.impressaoDigital = await impressaoDigitalDaChave(item.publicaPem);
  item.codigo = codigoDaImpressaoDigital(item.impressaoDigital);
  item.estado = 'pendente';
  await gravarItem('chave-autorizacao', item);
  item = await atualizarCadastroDoAparelho({ fetchImpl });
  if (item.estado === 'registrada') return item;

  // Tentativas repetidas conservam chave, ID, nonce e prova de posse locais.
  if (!(await validarPedidoCadastro(item.pedido, usuarioId)).ok) item.pedido = await criarPedidoCadastro({ privada: item.privada, publicaPem: item.publicaPem, usuarioId });
  item.pedidoId = item.pedido.id;
  item.codigo = codigoDaImpressaoDigital(item.impressaoDigital);
  await gravarItem('chave-autorizacao', item);
  await repo.transacao(async tx => {
    const lista = (await tx.ler('aparelhos/pendentes.json')) || { itens: [] };
    if (!Array.isArray(lista.itens)) throw new Error('Lista de aparelhos pendentes inválida.');
    const restantes = lista.itens.filter(p => !(p.impressaoDigital === item.impressaoDigital && String(p.usuarioId).toLowerCase() === usuarioId.toLowerCase()));
    if (restantes.length >= 20) throw new Error('Há 20 aparelhos pendentes. Confira os pedidos no PC antes de adicionar outro.');
    tx.gravar('aparelhos/pendentes.json', { itens: [...restantes, item.pedido] });
  }, 'painel: pedido de cadastro de aparelho');
  return item;
}

export async function atualizarCadastroDoAparelho({ fetchImpl } = {}) {
  const item = await chaveDoAparelho();
  if (!item) return null;
  item.impressaoDigital = await impressaoDigitalDaChave(item.publicaPem);
  item.codigo = codigoDaImpressaoDigital(item.impressaoDigital);
  item.estado = 'pendente';
  await gravarItem('chave-autorizacao', item);
  const registro = await lerRegistroDeAparelhos({ fetchImpl });
  item.estado = registro.impressoesDigitais.includes(item.impressaoDigital) ? 'registrada' : 'pendente';
  await gravarItem('chave-autorizacao', item);
  return item;
}

export async function assinadorDoAparelho(opcoes) {
  let c;
  try { c = await atualizarCadastroDoAparelho(opcoes); } catch { return null; }
  return c?.estado === 'registrada' ? dados => assinarObjeto(c.privada, dados) : null;
}
