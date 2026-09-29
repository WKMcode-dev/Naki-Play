# Naki Play 0.5.4 — correção do extrator Android

O APK anterior incluía yt-dlp 2025.11.12 e dependia de uma atualização online para usar o motor atual. Se essa atualização falhasse, a análise podia funcionar e o download retornar HTTP 403.

Esta versão inclui yt-dlp 2026.08.19, verifica seu SHA-256 e substitui a cópia antiga ao iniciar o motor. Versões iguais ou mais novas já instaladas são preservadas. Os detalhes de suporte passam a mostrar a versão realmente executada.

Depois de instalar e conferir o motor incluído, a próxima consulta de atualização online fica para o dia seguinte. O primeiro uso dessa cópia não aguarda uma resposta do servidor de atualizações.

## Instalação

- Android ARM64, Android 7 ou superior: instale o APK por cima da versão anterior, sem desinstalar nem limpar dados.
- Windows x64: instalador atualizado para a mesma versão; a correção do extrator embarcado é específica do Android.

## Verificação

- Mesmo vídeo de referência: o motor 2025.11.12 analisou o link, mas falhou com HTTP 403 ao baixar; o motor 2026.08.19 concluiu o MP3.
- Downloads integrais aprovados no Windows usando as mesmas seleções do Android: MP3 em 128, 192, 256 e 320 kbps; MP4 em 144p, 240p, 360p, 480p, 720p, 1080p, 1440p e 2160p. Duração e streams foram conferidos com FFprobe.
- 19 testes Kotlin aprovados, incluindo atualização sem acesso ao servidor, preservação de motores mais novos e rejeição de bytes corrompidos.
- Teste em aparelho físico pendente. O emulador local encerrou antes do boot; os testes Windows não confirmam a execução dos binários Android.

Teste um link público de conteúdo próprio ou autorizado, mantendo o app aberto durante o download. Se houver falha, os detalhes de suporte devem informar o extrator 2026.08.19 ou mais novo.

A assinatura Android é de desenvolvimento e o instalador Windows não possui assinatura Authenticode. Esta é uma pré-versão para testes. Mudanças ou restrições da origem ainda podem impedir determinados links.
