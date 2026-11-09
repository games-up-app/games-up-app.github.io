// Cadastro compartilhado pela interface e automações. IDs verificados na API pública Roblox.
export const JOGOS = Object.freeze([
  Object.freeze({ id: 'escola-brasileira', nome: 'Escola Brasileira', universeId: 9508201896, placeId: 91514145260129, diretorio: '', tema: 'escola e roleplay brasileiro' }),
  Object.freeze({ id: 'mandrake-catalogo', nome: 'Mandrake Catálogo', universeId: 4511892440, placeId: 12892130985, diretorio: 'jogos/mandrake-catalogo', tema: 'catálogo de avatares, moda e convivência' }),
]);
export function obterJogo(id = 'escola-brasileira') {
  const jogo = JOGOS.find(j => j.id === id);
  if (!jogo) throw new Error('Jogo desconhecido. Selecione um dos jogos cadastrados.');
  return jogo;
}
export function diretorioJogo(id, base = 'dados') {
  const j = obterJogo(id);
  return j.diretorio ? base.replace(/\/$/, '') + '/' + j.diretorio : base;
}
export function linkJogo(id) { return 'https://www.roblox.com/pt/games/' + obterJogo(id).placeId; }
