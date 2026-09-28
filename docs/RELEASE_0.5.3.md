# Naki Play 0.5.3 — teste Android e Windows

## Downloads
- **Android ARM64:** instale o arquivo `Naki-Play-0.5.3-android-arm64-debug.apk` em um aparelho Android 7 ou superior.
- **Windows x64:** execute `Naki-Play-0.5.3-windows-x64-setup.exe`.

## O que mudou
- Player nativo de áudio no Android, com fila, repetição, aleatório e controles do sistema.
- Melhorias de importação e reconhecimento do formato real dos arquivos.
- Correção da geração de MP4 quando a origem oferece WebM combinado.
- Diagnósticos mais claros de rede, extrator, formato e acesso restrito.
- Downloads incompletos por fragmentos ausentes são rejeitados.

## Como testar no Android
1. Instale por cima da versão anterior, sem desinstalar nem limpar os dados.
2. Abra um link público de conteúdo próprio ou autorizado e teste análise e download em MP3.
3. Reproduza a música inteira; depois teste com a tela apagada e os controles da notificação.
4. Se falhar, envie a mensagem em “Detalhes para suporte”, a versão do Android e informe se falhou na análise, download ou reprodução.

Esta é uma **pré-versão para testes**. Ainda não foi validada em aparelho físico; a correção MP4 não confirma a resolução de todos os relatos de falha no YouTube. Mantenha o app aberto durante o download. Mudanças e restrições da origem podem impedir alguns links.

O APK usa assinatura de desenvolvimento. O instalador Windows não possui assinatura Authenticode. Os hashes SHA-256 acompanham os arquivos em `SHA256SUMS.txt`.

## Verificações desta versão
- 26 testes Rust de biblioteca, arquivos, links e reprodução.
- 15 testes Kotlin de importação, diagnósticos e política de áudio.
- 15 testes JavaScript de integração do player, mensagens e downloads locais.
- Compilação TypeScript e produção web.

Os 56 testes automatizados passaram. Testes locais e simulados não substituem o teste de download/reprodução em um aparelho físico.
