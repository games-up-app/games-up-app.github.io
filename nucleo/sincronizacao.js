/** Confere a revisão mesmo com detalhes abertos; só confirma o SHA depois de ler os dados. */
export function criarSincronizacao({ lerSha, lerPainel, aplicar, atualizado, falhou, adiarTela }) {
  let ultimoSha = null, emCurso = null;
  async function executar(forcar) {
    try {
      const sha = await lerSha();
      if (forcar || !ultimoSha || !sha || sha !== ultimoSha) {
        const painel = await lerPainel();
        await aplicar(painel, { adiar: !!adiarTela(), mudou: !!ultimoSha });
        ultimoSha = sha;
      }
      atualizado?.(new Date().toISOString());
      return true;
    } catch (e) { falhou?.(e); return false; }
  }
  return { conferir({ forcar = false } = {}) {
    // Uma gravação pode terminar durante o polling. Atualizar manualmente deve
    // reler depois dele, e não reaproveitar dados obtidos antes da gravação.
    if (emCurso) return forcar ? emCurso.then(() => this.conferir({ forcar: true })) : emCurso;
    emCurso = executar(forcar).finally(() => { emCurso = null; });
    return emCurso;
  } };
}
