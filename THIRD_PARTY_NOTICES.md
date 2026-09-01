# Componentes de terceiros

O Naki Play utiliza os componentes abaixo nos fluxos Android e Windows. Os executáveis não são versionados no Git; o script de preparação os obtém das fontes indicadas e confere os checksums oficiais.

## youtubedl-android — Android

- projeto: <https://github.com/yausername/youtubedl-android>
- versão: 0.18.1
- licença declarada: GNU General Public License v3.0
- função: executar yt-dlp, Python e FFmpeg no Android

## yt-dlp — Android e Windows

- projeto: <https://github.com/yt-dlp/yt-dlp>
- build Windows: 2026.08.19
- função: extrair metadados e localizar formatos de páginas compatíveis
- o executável oficial contém componentes adicionais e respectivos avisos de licença

## Deno — Windows

- projeto: <https://github.com/denoland/deno>
- versão: 2.9.5
- licença principal: MIT
- função: runtime JavaScript recomendado pelo yt-dlp para resolver desafios atuais do YouTube

## FFmpeg/FFprobe — Android e Windows

- projeto: <https://ffmpeg.org/>
- build Windows: <https://github.com/yt-dlp/FFmpeg-Builds>
- configuração Windows: GPL, version 3 ou posterior
- função: extrair áudio, converter MP3, consultar mídia e combinar áudio/vídeo

## Distribuição do Naki Play

A distribuição desses componentes exige preservar licenças e avisos aplicáveis. A combinação inclui software GPL, especialmente `youtubedl-android` e a build Windows do FFmpeg. Por isso, o Naki Play é disponibilizado sob GNU GPL v3.0, com o código-fonte correspondente no mesmo repositório da Release. Este arquivo registra dependências, mas não substitui os textos integrais das licenças nem aconselhamento jurídico.
