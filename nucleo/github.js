// Acesso ao repositório PRIVADO de dados pela API do GitHub, usando o token do proprietário.
// O token fica só no aparelho dele. Não existe servidor intermediário.
//
// Leitura: uma única consulta GraphQL busca vários arquivos de uma vez.
// Gravação: toda mudança vira UM commit na branch de dados (todos os arquivos juntos).
// Se outro processo gravou antes (a branch não avança em fast-forward), relê e tenta de novo.

const CAMINHO_VALIDO = /^[a-z0-9][a-z0-9\-_/]*\.json$/;
// Só imagens comuns (SVG pode carregar código; fica de fora).
const PREVIA_VALIDA = /^previas\/[a-z0-9][a-z0-9\-_/]*\.(png|jpg|jpeg|webp)$/;
const TIPOS_IMAGEM = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };

export class ErroGitHub extends Error {
  constructor(status, mensagem) { super(mensagem); this.status = status; }
}
export class ConflitoError extends Error {}

function validarCaminho(p) {
  if (!CAMINHO_VALIDO.test(p) || p.includes('..') || p.includes('//')) throw new Error(`Caminho de dados inválido: ${p}`);
}

function base64ParaTexto(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}

const esperar = ms => new Promise(r => setTimeout(r, ms));

export class RepoGitHub {
  constructor({ token, repo, branch = 'dados', dir = 'dados', apiBase = 'https://api.github.com', fetchImpl }) {
    this.token = token; this.repo = repo; this.branch = branch; this.dir = dir.replace(/\/$/, '');
    this.apiBase = apiBase.replace(/\/$/, '');
    this.fetch = fetchImpl || globalThis.fetch.bind(globalThis);
  }

  async req(metodo, rota, corpo, { aceitar = 'application/vnd.github+json', bruto = false } = {}) {
    const r = await this.fetch(`${this.apiBase}${rota}`, {
      method: metodo,
      headers: {
        authorization: `Bearer ${this.token}`,
        accept: aceitar,
        'x-github-api-version': '2022-11-28',
        ...(corpo ? { 'content-type': 'application/json' } : {}),
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
      cache: 'no-store',
    });
    if (r.status === 401) throw new ErroGitHub(401, 'Token inválido ou expirado. Entre de novo com um token novo.');
    if (r.status === 403) {
      const resto = r.headers.get('x-ratelimit-remaining');
      throw new ErroGitHub(403, resto === '0' ? 'Limite de uso do GitHub atingido. Tente de novo em alguns minutos.' : 'O token não tem permissão para isto. Confira as permissões do token.');
    }
    if (r.status === 404) return null;
    // Conflito real = a branch andou (PATCH no ref). Outros 409/422 são erros de verdade.
    if ((r.status === 409 || r.status === 422) && metodo === 'PATCH' && rota.includes('/git/refs/')) throw new ConflitoError(`GitHub ${r.status} em ${rota}`);
    if (r.status === 409 || r.status === 422) throw new ErroGitHub(r.status, 'O GitHub recusou a gravação. Nada foi alterado.');
    if (!r.ok) throw new ErroGitHub(r.status, `GitHub respondeu ${r.status}.`);
    if (bruto) return r;
    // Algumas rotas (ex.: criar variável) respondem sem corpo.
    const texto = await r.text();
    return texto ? JSON.parse(texto) : {};
  }

  async usuario() {
    const u = await this.req('GET', '/user');
    if (!u) throw new ErroGitHub(401, 'Token inválido.');
    return { login: u.login, nome: u.name || u.login };
  }

  /** Confere se o token enxerga o repositório de dados e pode gravar nele. */
  async conferirAcesso() {
    const r = await this.req('GET', `/repos/${this.repo}`);
    if (!r) throw new ErroGitHub(404, `O token não enxerga o repositório ${this.repo}. Ao criar o token, escolha esse repositório.`);
    if (r.permissions && !r.permissions.push) throw new ErroGitHub(403, 'O token só tem leitura. Ele precisa de "Contents: Read and write".');
    return r;
  }

  /** Lê vários JSON de uma vez (GraphQL). Arquivo ausente => null. */
  async lerVarios(rels, ref = this.branch) {
    rels.forEach(validarCaminho);
    if (!rels.length) return {};
    const [dono, nome] = this.repo.split('/');
    const campos = rels.map((rel, i) => `f${i}: object(expression: ${JSON.stringify(`${ref}:${this.dir}/${rel}`)}) { ... on Blob { text isTruncated } }`).join('\n');
    const r = await this.req('POST', '/graphql', { query: `query($o:String!,$n:String!){ repository(owner:$o, name:$n){ ${campos} } }`, variables: { o: dono, n: nome } });
    if (!r || r.errors?.length) throw new ErroGitHub(500, `Falha ao ler os dados (${r?.errors?.[0]?.message || 'sem resposta'}).`);
    const repo = r.data?.repository;
    if (!repo) throw new ErroGitHub(404, `Repositório ${this.repo} não encontrado para este token.`);
    const saida = {};
    for (let i = 0; i < rels.length; i++) {
      const obj = repo[`f${i}`];
      if (!obj) { saida[rels[i]] = null; continue; }
      saida[rels[i]] = JSON.parse(obj.isTruncated ? await this.lerTextoRest(rels[i], ref) : obj.text);
    }
    return saida;
  }

  async lerTextoRest(rel, ref) {
    const j = await this.req('GET', `/repos/${this.repo}/contents/${this.dir}/${rel}?ref=${encodeURIComponent(ref)}`);
    if (!j) return 'null';
    if (j.content && j.encoding === 'base64') return base64ParaTexto(j.content);
    const blob = await this.req('GET', `/repos/${this.repo}/git/blobs/${j.sha}`);
    return base64ParaTexto(blob.content);
  }

  async ler(rel, ref = this.branch) { return (await this.lerVarios([rel], ref))[rel]; }

  /** Imagem de prévia (repositório privado) como Blob, para exibir sem expor link público. */
  async lerImagem(rel) {
    if (!PREVIA_VALIDA.test(rel) || rel.includes('..')) throw new Error(`Prévia inválida: ${rel}`);
    const r = await this.req('GET', `/repos/${this.repo}/contents/${this.dir}/${rel}?ref=${encodeURIComponent(this.branch)}`, null, { aceitar: 'application/vnd.github.raw', bruto: true });
    if (!r) return null;
    return new Blob([await r.arrayBuffer()], { type: TIPOS_IMAGEM[rel.split('.').pop()] });
  }

  /** Grava todas as mudanças de `fn` num único commit. `fn` recebe { ler, gravar }. */
  async transacao(fn, mensagem, tentativas = 5) {
    let ultimo;
    for (let i = 0; i < tentativas; i++) {
      try {
        const ref = await this.req('GET', `/repos/${this.repo}/git/ref/heads/${encodeURIComponent(this.branch)}`);
        if (!ref) throw new ErroGitHub(404, `A branch de dados "${this.branch}" não existe.`);
        const base = ref.object.sha;
        const escritas = new Map();
        const tx = {
          ler: async rel => (escritas.has(rel) ? structuredClone(escritas.get(rel)) : this.ler(rel, base)),
          lerVarios: async rels => {
            const faltam = rels.filter(r => !escritas.has(r));
            const lidos = await this.lerVarios(faltam, base);
            return Object.fromEntries(rels.map(r => [r, escritas.has(r) ? structuredClone(escritas.get(r)) : lidos[r]]));
          },
          gravar: (rel, dados) => { validarCaminho(rel); escritas.set(rel, dados); },
        };
        const resultado = await fn(tx);
        if (!escritas.size) return resultado;
        const commitBase = await this.req('GET', `/repos/${this.repo}/git/commits/${base}`);
        const arvore = await this.req('POST', `/repos/${this.repo}/git/trees`, {
          base_tree: commitBase.tree.sha,
          tree: [...escritas].map(([rel, dados]) => ({ path: `${this.dir}/${rel}`, mode: '100644', type: 'blob', content: JSON.stringify(dados, null, 2) + '\n' })),
        });
        const commit = await this.req('POST', `/repos/${this.repo}/git/commits`, { message: mensagem, tree: arvore.sha, parents: [base] });
        // force:false => falha (422) se alguém gravou depois de "base"; tenta de novo.
        await this.req('PATCH', `/repos/${this.repo}/git/refs/heads/${encodeURIComponent(this.branch)}`, { sha: commit.sha, force: false });
        return resultado;
      } catch (e) {
        if (!(e instanceof ConflitoError)) throw e;
        ultimo = e;
        await esperar(150 * 2 ** i + Math.random() * 100);
      }
    }
    throw new ErroGitHub(409, `Não foi possível gravar: os dados mudaram várias vezes seguidas. Tente de novo. (${ultimo?.message})`);
  }

  // ---- variáveis do GitHub Actions (chaves públicas lidas pelos workflows)
  async lerVariavel(nome) {
    const r = await this.req('GET', `/repos/${this.repo}/actions/variables/${encodeURIComponent(nome)}`);
    return r ? r.value : null;
  }

  async gravarVariavel(nome, valor) {
    const atual = await this.req('GET', `/repos/${this.repo}/actions/variables/${encodeURIComponent(nome)}`);
    if (atual) await this.req('PATCH', `/repos/${this.repo}/actions/variables/${encodeURIComponent(nome)}`, { name: nome, value: valor });
    else await this.req('POST', `/repos/${this.repo}/actions/variables`, { name: nome, value: valor });
  }
}
