export function playbackErrorMessage(code?: number, name?: string): string | undefined {
  if (name === 'AbortError' || code === 1) return undefined
  if (name === 'NotAllowedError') return 'O dispositivo bloqueou a reprodução automática. Toque em Tocar para iniciar.'
  if (code === 2) return 'Não foi possível ler a mídia. Se foi importada de outro app, salve o original em Downloads e importe novamente.'
  if (code === 3) return 'O dispositivo não conseguiu decodificar a mídia. O arquivo pode estar incompleto ou usar um codec incompatível.'
  return 'Este dispositivo não conseguiu abrir o formato real do arquivo. Importe o original novamente na versão atual do Naki; mudar apenas o nome para .mp3 não converte o áudio.'
}
