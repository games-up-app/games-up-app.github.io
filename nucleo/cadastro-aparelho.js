// Pedido não é autorização. A confiança só vem do registro público publicado pelo PC.
import { assinarObjeto } from './assinatura.js?v=20261026-agenda2';
import { canonico } from './canonico.js?v=20261026-agenda2';

export const REPO_CADASTRO = 'games-up-app/Automatizar-Escola-Brasileira';
// Pedidos feitos antes da mudança para a organização continuam válidos.
const REPOS_ACEITOS = [REPO_CADASTRO, '0SrGood/Automatizar-Escola-Brasileira'];
const CAMPOS_ASSINADOS = ['tipo', 'repo', 'id', 'usuarioId', 'publicaPem', 'impressaoDigital', 'criadaEm', 'nonce'];
const CAMPOS_PEDIDO = [...CAMPOS_ASSINADOS, 'codigo', 'assinatura'];
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const USUARIO = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

async function lerPublica(publicaPem) {
  if (typeof publicaPem !== 'string' || publicaPem.length > 1000) throw new Error('Chave pública inválida.');
  const m = publicaPem.match(/^-----BEGIN PUBLIC KEY-----\r?\n([A-Za-z0-9+/=\r\n]+)\r?\n-----END PUBLIC KEY-----\s*$/);
  if (!m) throw new Error('Chave pública inválida.');
  let spki;
  try { spki = Uint8Array.from(atob(m[1].replace(/\s/g, '')), c => c.charCodeAt(0)); }
  catch { throw new Error('Chave pública inválida.'); }
  let chave;
  try { chave = await crypto.subtle.importKey('spki', spki, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']); }
  catch { throw new Error('A chave pública precisa ser ECDSA P-256.'); }
  const hash = await crypto.subtle.digest('SHA-256', spki);
  const impressaoDigital = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
  return { chave, impressaoDigital };
}

export async function impressaoDigitalDaChave(publicaPem) {
  return (await lerPublica(publicaPem)).impressaoDigital;
}

export function codigoDaImpressaoDigital(impressaoDigital) {
  if (!/^[a-f0-9]{64}$/.test(impressaoDigital || '')) throw new Error('Impressão digital inválida.');
  return impressaoDigital.slice(0, 20).match(/.{4}/g).join('-');
}

function corpoAssinado(pedido) {
  return Object.fromEntries(CAMPOS_ASSINADOS.map(campo => [campo, pedido[campo]]));
}

export async function criarPedidoCadastro({ privada, publicaPem, usuarioId }) {
  if (!USUARIO.test(usuarioId || '')) throw new Error('Usuário do GitHub inválido.');
  if (privada?.type !== 'private' || privada.extractable !== false || privada.algorithm?.name !== 'ECDSA' || privada.algorithm?.namedCurve !== 'P-256' || !privada.usages?.includes('sign')) throw new Error('A chave privada precisa ficar protegida neste aparelho.');
  const impressaoDigital = await impressaoDigitalDaChave(publicaPem);
  const pedido = { tipo: 'cadastro-aparelho', repo: REPO_CADASTRO, id: crypto.randomUUID(), usuarioId,
    publicaPem, impressaoDigital, criadaEm: new Date().toISOString(), nonce: crypto.randomUUID() };
  pedido.codigo = codigoDaImpressaoDigital(impressaoDigital);
  pedido.assinatura = await assinarObjeto(privada, corpoAssinado(pedido));
  const validacao = await validarPedidoCadastro(pedido, usuarioId);
  if (!validacao.ok) throw new Error(validacao.motivo);
  return pedido;
}

/** Retorna {ok:true} ou {ok:false,motivo}. Prova de posse não é aprovação humana. */
export async function validarPedidoCadastro(pedido, ownerLogin) {
  const nao = motivo => ({ ok: false, motivo });
  if (!pedido || typeof pedido !== 'object' || Array.isArray(pedido) || Object.keys(pedido).length !== CAMPOS_PEDIDO.length || Object.keys(pedido).some(c => !CAMPOS_PEDIDO.includes(c))) return nao('Formato do pedido inválido.');
  if (pedido.tipo !== 'cadastro-aparelho' || !REPOS_ACEITOS.includes(pedido.repo)) return nao('Finalidade ou repositório do pedido inválido.');
  if (!USUARIO.test(ownerLogin || '') || !USUARIO.test(pedido.usuarioId || '') || pedido.usuarioId.toLowerCase() !== ownerLogin.toLowerCase()) return nao('O pedido não pertence ao proprietário.');
  if (!UUID.test(pedido.id || '') || !UUID.test(pedido.nonce || '')) return nao('Identificador ou nonce inválido.');
  const data = new Date(pedido.criadaEm);
  if (typeof pedido.criadaEm !== 'string' || !Number.isFinite(data.getTime()) || data.toISOString() !== pedido.criadaEm) return nao('Data do pedido inválida.');
  if (data.getTime() > Date.now() + 5 * 60_000 || data.getTime() < Date.now() - 7 * 86400_000) return nao('O pedido está vencido ou tem data no futuro.');
  let publica;
  try { publica = await lerPublica(pedido.publicaPem); } catch (e) { return nao(e.message); }
  if (pedido.impressaoDigital !== publica.impressaoDigital) return nao('A impressão digital não corresponde à chave pública.');
  if (pedido.codigo !== codigoDaImpressaoDigital(publica.impressaoDigital)) return nao('O código não corresponde à chave pública.');
  if (typeof pedido.assinatura !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(pedido.assinatura)) return nao('Prova de posse inválida.');
  try {
    const assinatura = Uint8Array.from(atob(pedido.assinatura), c => c.charCodeAt(0));
    const dados = new TextEncoder().encode(canonico(corpoAssinado(pedido)));
    if (assinatura.length !== 64 || !await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publica.chave, assinatura, dados)) return nao('Prova de posse inválida.');
  } catch { return nao('Prova de posse inválida.'); }
  return { ok: true };
}

export async function lerRegistroDeAparelhos({ fetchImpl = globalThis.fetch, url = new URL('../aparelhos-autorizados.json', import.meta.url) } = {}) {
  let resposta;
  try { resposta = await fetchImpl(url, { cache: 'no-store', credentials: 'same-origin' }); }
  catch { throw new Error('Não consegui conferir o cadastro deste aparelho. Tente novamente.'); }
  if (!resposta.ok) throw new Error('O registro de aparelhos ainda não está disponível. Tente novamente.');
  let registro;
  try { registro = await resposta.json(); } catch { throw new Error('Registro de aparelhos inválido.'); }
  if (!registro || registro.versao !== 1 || Object.keys(registro).some(c => !['versao', 'impressoesDigitais'].includes(c)) || !Array.isArray(registro.impressoesDigitais) || registro.impressoesDigitais.some(i => typeof i !== 'string' || !/^[a-f0-9]{64}$/.test(i))) throw new Error('Registro de aparelhos inválido.');
  return registro;
}
