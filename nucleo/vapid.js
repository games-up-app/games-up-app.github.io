// Chaves das notificações (VAPID). Na primeira ativação o painel cria o par de chaves
// e guarda nas variáveis do repositório privado; os agendamentos do GitHub usam essas
// variáveis para enviar as notificações ao celular.
const b64u = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function chavePublicaVapid(repo) {
  const existente = await repo.lerVariavel('VAPID_PUBLIC_KEY');
  if (existente) return existente;
  const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', par.privateKey);
  const publica = b64u(await crypto.subtle.exportKey('raw', par.publicKey));
  const privada = JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d });
  await repo.gravarVariavel('VAPID_PRIVATE_KEY', privada);
  await repo.gravarVariavel('VAPID_PUBLIC_KEY', publica);
  return publica;
}
