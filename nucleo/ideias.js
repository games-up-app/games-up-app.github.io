// Regras compartilhadas para sugestões do dono. Uma ideia nunca é uma aprovação.
import { limparTexto, ErroRegra } from './regras.js?v=20261026-automacao1';
export const ASSUNTOS_IDEIA = { thumbnail: 'Thumbnail', descricao: 'Descrição do jogo', nome: 'Nome do jogo', melhoria: 'Melhoria no jogo', interface: 'Interface', evento: 'Evento', outro: 'Outra ideia' };
export const STATUS_IDEIA = { nova: 'Recebida', analise: 'Em análise', respondida: 'Respondida', proposta: 'Virou proposta' };
export function validarIdeia(c) {
  if (!/^I-[a-f0-9-]{36}$/.test(c?.id || '')) throw new ErroRegra(400, 'Identificador da ideia inválido.');
  if (!Object.hasOwn(ASSUNTOS_IDEIA, c.assunto)) throw new ErroRegra(400, 'Escolha o assunto.');
  if (typeof c.titulo !== 'string' || !c.titulo.trim() || c.titulo.length > 120) throw new ErroRegra(400, 'Dê um título de até 120 caracteres.');
  if (typeof c.texto !== 'string' || c.texto.trim().length < 10 || c.texto.length > 4000) throw new ErroRegra(400, 'Conte sua ideia em 10 a 4.000 caracteres.');
  return { id: c.id, assunto: c.assunto, titulo: limparTexto(c.titulo, 120), texto: limparTexto(c.texto, 4000) };
}
