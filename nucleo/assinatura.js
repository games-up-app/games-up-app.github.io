// Assinatura das autorizações finais com WebCrypto (ECDSA P-256 + SHA-256).
// A chave privada é criada no aparelho do proprietário como NÃO exportável:
// nem o painel, nem a automação, nem quem tem acesso ao repositório consegue copiá-la.
// O workflow de publicação confere a assinatura com a chave pública (lib/trava.mjs).
import { canonico } from './canonico.js';

const sutil = () => globalThis.crypto.subtle;
const ALG = { name: 'ECDSA', namedCurve: 'P-256' };

function paraBase64(bytes) {
  let bin = '';
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b);
  return btoa(bin);
}

export async function gerarChaveDispositivo() {
  const par = await sutil().generateKey(ALG, false, ['sign', 'verify']);
  const spki = await sutil().exportKey('spki', par.publicKey);
  const linhas = paraBase64(spki).match(/.{1,64}/g).join('\n');
  return { privada: par.privateKey, publicaPem: `-----BEGIN PUBLIC KEY-----\n${linhas}\n-----END PUBLIC KEY-----\n` };
}

/** Assina o objeto (JSON canônico). Devolve base64 no formato r||s (64 bytes). */
export async function assinarObjeto(chavePrivada, objeto) {
  const dados = new TextEncoder().encode(canonico(objeto));
  const sig = await sutil().sign({ name: 'ECDSA', hash: 'SHA-256' }, chavePrivada, dados);
  return paraBase64(sig);
}
