// Lê capa e textos do MESMO PNG identificado pelo hash do pacote. Não assina nem cria evento.
const assinatura = [137, 80, 78, 71, 13, 10, 26, 10];
const decoder = new TextDecoder('utf-8', { fatal: true });
function lerEventoPng(bytes) {
  if (bytes.length < 33 || !assinatura.every((b, i) => bytes[i] === b)) throw new Error('A capa do evento não é um PNG válido.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let evento = null, fim = false, primeiro = true;
  for (let pos = 8; pos < bytes.length;) {
    if (pos + 12 > bytes.length) throw new Error('Capa incompleta.');
    const tamanho = view.getUint32(pos), tipo = decoder.decode(bytes.subarray(pos + 4, pos + 8));
    if (tamanho > bytes.length - pos - 12) throw new Error('Capa corrompida.');
    if (primeiro && tipo !== 'IHDR') throw new Error('Cabeçalho da capa inválido.');
    primeiro = false;
    if (tipo === 'iTXt') {
      const d = bytes.subarray(pos + 8, pos + 8 + tamanho), separador = d.indexOf(0);
      if (separador >= 0 && decoder.decode(d.subarray(0, separador)) === 'games-up-evento') {
        if (evento || d[separador + 1] !== 0 || d[separador + 2] !== 0) throw new Error('Metadados do evento inválidos ou duplicados.');
        const idioma = d.indexOf(0, separador + 3), traduzida = d.indexOf(0, idioma + 1);
        if (idioma < 0 || traduzida < 0) throw new Error('Metadados incompletos.');
        evento = JSON.parse(decoder.decode(d.subarray(traduzida + 1)));
      }
    }
    pos += tamanho + 12;
    if (tipo === 'IEND') { fim = true; if (pos !== bytes.length) throw new Error('Dados adicionais na capa.'); break; }
  }
  if (!fim || !evento) throw new Error('O pacote não contém os textos do evento.');
  for (const [campo, limite] of [['titulo', 50], ['subtitulo', 50], ['descricao', 1000]]) {
    if (typeof evento[campo] !== 'string' || !evento[campo].trim() || evento[campo].length > limite) throw new Error(`Campo do evento inválido: ${campo}.`);
  }
  if (!['Novo conteúdo', 'Atualização', 'Evento especial', 'Competição', 'Outro'].includes(evento.categoria)) throw new Error('Categoria inválida.');
  for (const campo of ['inicio', 'fim']) if (typeof evento[campo] !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(evento[campo]) || !Number.isFinite(Date.parse(evento[campo]))) throw new Error('Datas inválidas no pacote.');
  if (Date.parse(evento.fim) <= Date.parse(evento.inicio)) throw new Error('Datas fora de ordem.');
  return evento;
}

export async function carregarKitEvento(lancamento, baixar) {
  if (lancamento?.tipo !== 'evento' || !/^builds\/[a-z0-9-]+\.png$/.test(lancamento.artefato?.caminho || '') || !/^[a-f0-9]{64}$/.test(lancamento.artefato?.sha256 || '')) throw new Error('Pacote do evento inválido.');
  const blob = await baixar(lancamento.artefato.caminho);
  if (!blob || blob.size > 4 * 1048576) throw new Error('Não consegui obter uma capa válida deste pacote.');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  if (hash !== lancamento.artefato.sha256) throw new Error('A capa mudou. Atualize o app antes de copiar ou baixar o kit.');
  return { evento: lerEventoPng(bytes), blob: new Blob([bytes], { type: 'image/png' }), arquivo: lancamento.artefato.caminho.split('/').pop(), sha256: hash };
}
