// Caixa de ideias do proprietário: enviar pelo celular e acompanhar análise e propostas vinculadas.
import { h, icone, chip, abrirFolha } from '../ui/componentes.js?v=20261026-agenda2';
import { ctx } from '../ui/contexto.js?v=20261026-agenda2';
import { ASSUNTOS_IDEIA, STATUS_IDEIA, validarIdeia } from '../nucleo/ideias.js?v=20261026-agenda2';
import { dataBR } from './comum.js?v=20261026-agenda2';

function abrirIdeia(i) {
  abrirFolha({ titulo: i.titulo, conteudo: h('div', { class: 'ideia-detalhe' },
    h('div', { class: 'chips-linha' }, chip(ASSUNTOS_IDEIA[i.assunto] || 'Ideia'), chip(STATUS_IDEIA[i.status] || i.status)),
    h('p', { class: 'sinc' }, `Enviada em ${dataBR(i.criadaEm)} por ${i.por?.nome || 'você'}`),
    h('p', { class: 'ideia-texto' }, i.texto),
    h('h3', {}, 'Retorno da equipe'),
    i.respostas?.length ? i.respostas.map(r => h('article', { class: 'ideia-resposta' }, h('strong', {}, r.por || 'Equipe'), h('p', { class: 'sinc' }, dataBR(r.em)), h('p', { class: 'ideia-texto' }, r.texto))) : h('p', {}, 'Sua ideia está na fila de análise. O retorno aparecerá aqui.'),
    (i.propostaIds || []).map(id => h('button', { type: 'button', class: 'btn', onclick: () => ctx.irPara('decisoes', { tipo: 'proposta', id }) }, icone('decisoes'), `Ver proposta ${id}`)),
    h('p', { class: 'sinc' }, 'Enviar uma ideia não autoriza mudanças. Quando virar proposta, você decide se ela segue.')) });
}

export function telaIdeias() {
  const dono = ctx.estado.usuario?.papel === 'proprietario';
  const itens = [...(ctx.estado.dados.ideias?.itens || [])].sort((a, b) => b.criadaEm.localeCompare(a.criadaEm));
  const rascunho = ctx.estado.rascunhoIdeia || (ctx.estado.rascunhoIdeia = { id: `I-${crypto.randomUUID()}`, assunto: 'melhoria', titulo: '', texto: '' });
  const erro = h('p', { class: 'ideia-erro', role: 'alert', hidden: true });
  const assunto = h('select', { id: 'ideia-assunto', onchange: e => { rascunho.assunto = e.target.value; } }, Object.entries(ASSUNTOS_IDEIA).map(([id, nome]) => h('option', { value: id, selected: id === rascunho.assunto }, nome)));
  const titulo = h('input', { id: 'ideia-titulo', value: rascunho.titulo, type: 'text', maxlength: 120, placeholder: 'Ex.: uma thumbnail do recreio', oninput: e => { rascunho.titulo = e.target.value; } });
  const texto = h('textarea', { id: 'ideia-texto', rows: 5, maxlength: 4000, placeholder: 'Conte o que você imaginou, o que quer melhorar e suas referências.', oninput: e => { rascunho.texto = e.target.value; contador.textContent = `${rascunho.texto.length}/4.000`; } }, rascunho.texto);
  const contador = h('small', { class: 'sinc' }, `${rascunho.texto.length}/4.000`);
  let enviando = false;
  const botao = h('button', { type: 'submit', class: 'btn primario grande' }, icone('lampada'), 'Enviar minha ideia');
  const enviar = async e => {
    e.preventDefault(); if (enviando) return;
    try { validarIdeia(rascunho); } catch (e) { erro.hidden = false; erro.textContent = e.message; return; }
    enviando = true; botao.disabled = true; botao.textContent = 'Enviando…'; erro.hidden = true;
    try {
      await ctx.api('/api/ideias', { method: 'POST', body: JSON.stringify(rascunho) });
      ctx.estado.rascunhoIdeia = null;
      ctx.avisar('Ideia recebida! Você pode acompanhar o retorno abaixo.');
      await ctx.recarregar();
    } catch (e) {
      erro.hidden = false; erro.textContent = `Não foi possível concluir: ${e.message}. Seu texto continua aqui; confira o histórico antes de tentar novamente.`;
      botao.disabled = false; botao.replaceChildren(icone('lampada'), 'Enviar minha ideia');
    } finally { enviando = false; }
  };
  return h('div', { class: 'pagina-ideias' },
    h('section', { class: 'card ideias-intro' }, h('h2', {}, icone('lampada'), 'Teve uma ideia? Conte para a gente.'), h('p', {}, 'Thumbnail, descrição, nome, evento ou uma melhoria: envie daqui mesmo e acompanhe o que a equipe respondeu.'), h('p', { class: 'sinc' }, 'O Claude analisa a sugestão e chama o Codex para as artes quando necessário. Você aprova as propostas antes de qualquer alteração.')),
    dono ? h('form', { class: 'card ideias-form', onsubmit: enviar },
      h('label', { for: 'ideia-assunto' }, 'Sobre o que é a ideia?'), assunto,
      h('label', { for: 'ideia-titulo' }, 'Dê um título'), titulo,
      h('label', { for: 'ideia-texto' }, 'Sua ideia'), texto, contador, erro, botao)
      : h('p', { class: 'card' }, 'Aqui você acompanha as ideias enviadas pelo proprietário.'),
    h('section', {}, h('h2', {}, 'Ideias enviadas'), itens.length ? h('div', { class: 'ideias-lista' }, itens.map(i => h('button', { type: 'button', class: 'card ideia-card', onclick: () => abrirIdeia(i) }, h('div', { class: 'chips-linha' }, chip(ASSUNTOS_IDEIA[i.assunto] || 'Ideia'), chip(STATUS_IDEIA[i.status] || i.status)), h('strong', {}, i.titulo), h('span', { class: 'sinc' }, dataBR(i.criadaEm)), h('span', {}, i.respostas?.length ? 'Ver retorno e detalhes' : 'Acompanhar análise'), icone('direita')))) : h('p', { class: 'card' }, 'Suas sugestões aparecerão aqui depois do primeiro envio.')));
}
