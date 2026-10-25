// O navegador recebe somente a chave PÚBLICA. O par é configurado pelo servidor;
// ativar notificações nunca cria chaves nem acessa variáveis do GitHub.
export function chaveParaBytes(publica) {
  if (typeof publica !== 'string' || !/^[A-Za-z0-9_-]{87}$/.test(publica)) throw new Error('Configuração das notificações inválida.');
  const binario = atob(publica.replace(/-/g, '+').replace(/_/g, '/') + '=');
  const bytes = Uint8Array.from(binario, c => c.charCodeAt(0));
  if (bytes.length !== 65 || bytes[0] !== 4) throw new Error('Configuração das notificações inválida.');
  return bytes;
}

export async function chavePublicaVapid({ fetchImpl = globalThis.fetch, url = new URL('../push-config.json', import.meta.url) } = {}) {
  let resposta;
  try { resposta = await fetchImpl(url, { cache: 'no-store', credentials: 'same-origin' }); }
  catch { throw new Error('Não consegui carregar a configuração das notificações. Tente novamente.'); }
  if (!resposta.ok) throw new Error('As notificações ainda não estão configuradas. Tente novamente mais tarde.');
  let config;
  try { config = await resposta.json(); } catch { throw new Error('Configuração das notificações inválida.'); }
  if (!config || config.versao !== 1 || Object.keys(config).some(c => !['versao', 'publicKey'].includes(c))) throw new Error('Configuração das notificações inválida.');
  const bytes = chaveParaBytes(config.publicKey);
  try { await crypto.subtle.importKey('raw', bytes, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']); }
  catch { throw new Error('Configuração das notificações inválida.'); }
  return config.publicKey;
}
