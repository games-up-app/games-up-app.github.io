/** O prazo só libera o botão; não encerra a sessão automaticamente. */
export function estadoConfirmacaoSaida(inicio, agora = Date.now()) {
  const faltam = Math.max(0, Math.ceil((inicio + 5000 - agora) / 1000));
  return { faltam, liberado: faltam === 0, rotulo: faltam ? `Confirmar (${faltam})` : 'Confirmar saída' };
}
