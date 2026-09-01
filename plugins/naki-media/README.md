# Plugin Tauri `naki-media`

Plugin interno que oferece o mesmo contrato de análise, download e cancelamento no Android e no Windows.

## Comandos

- `analyze`: consulta metadados e devolve opções MP3/MP4;
- `download`: executa o processamento e envia eventos por `Channel`;
- `cancel`: encerra o processo identificado pelo `jobId`.

## Implementações

- **Android:** Kotlin, `youtubedl-android`, Python e FFmpeg embarcados.
- **Windows:** Rust controlando sidecars verificados de yt-dlp, Deno, FFmpeg e FFprobe, sem janela de terminal.
- **Outros desktops:** devolvem `UnsupportedPlatform` nesta versão.

O frontend não chama o plugin diretamente. Os comandos Rust do aplicativo validam autorização, controlam o destino, verificam o caminho final e só persistem resultados aprovados.
