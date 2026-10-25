// Ponte entre a casca do app (app.js) e as telas (painel/telas/*.js).
// app.js preenche estes campos ao iniciar; as telas só usam o que está aqui.
export const ctx = {
  estado: null,          // { usuario, dados, aba, sub, filtros, repo, cliente, chave, ... }
  api: null,             // async (caminho, opcoes) => resposta da "API" local (ver painel/nucleo/api.js)
  gravar: null,          // async (caminho, corpo, botoes[], mensagemOk) => grava, avisa e recarrega
  recarregar: null,      // async () => relê os dados e redesenha
  render: null,          // () => redesenha a tela atual
  avisar: null,          // (mensagem, erro=false) => aviso rápido
  irPara: null,          // (aba, sub?) => troca de aba
  imagemPrivada: null,   // (caminhoEmDados, { alt, classe }) => <img> carregada do repositório privado
};
