# Área de vídeos

A navegação inclui **Vídeos** no desktop e no celular. A página reúne arquivos MP4, WEBM e MOV e oferece uma área de exibição em 16:9, seleção por cartões e estados de biblioteca vazia e busca sem resultados.

Importar um vídeo abre essa página. Ao sair dela, a reprodução continua no player flutuante. O mesmo elemento de vídeo permanece montado, preservando a posição e evitando reprodução duplicada. O player mantém pausa, posição, volume e tela cheia; a barra inferior oferece um atalho de volta à área de vídeos.

## Verificação da interface

Validação com Edge/Playwright e um vídeo WEBM gerado com canvas e MediaRecorder:

- Importação real de arquivo pelo seletor e abertura automática da página.
- Decodificação e reprodução do vídeo no elemento HTML.
- Pausa, avanço pela barra de posição e silenciamento.
- Entrada e saída de tela cheia.
- Navegação Biblioteca → Vídeos preservando a identidade do elemento e a posição da reprodução.
- Layout em 1366 × 900 e 390 × 844, sem transbordamento horizontal da página.
- Busca sem resultados e biblioteca vazia.
- Ausência de erros de execução do React.

Compilação TypeScript/Vite e análise com oxlint também verificadas. Os instaladores Windows x64 e Android ARM64 0.5.5 foram gerados no GitHub Actions, com 19 testes Kotlin aprovados. Após receber os pacotes, o responsável pelo projeto confirmou o funcionamento da versão e autorizou sua publicação. Essa confirmação não discrimina quais aparelhos ou sistemas foram usados no teste. A compatibilidade de codecs permanece a do player existente.
