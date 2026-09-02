# Naki Play

Um player pessoal e carinhoso para Android e Windows, feito com React, Rust, Kotlin e Tauri. O Naki Play transforma links compatíveis em MP3 ou MP4, guarda os arquivos na biblioteca privada do aplicativo e permite ouvi-los offline — sem enviar a mídia para um servidor do projeto.

> Use o recurso de download somente em conteúdo próprio, em domínio público, com licença compatível ou que você tenha autorização para salvar. O Naki Play não remove DRM, não acessa contas e não contorna paywalls ou conteúdo privado.

## Baixar

- [Windows x64 — instalador `.exe`](https://github.com/WKMcode-dev/Naki-Play/releases/download/v0.2.0/Naki-Play-0.2.0-windows-x64-setup.exe)
- [Android ARM64 — aplicativo `.apk`](https://github.com/WKMcode-dev/Naki-Play/releases/download/v0.2.0/Naki-Play-0.2.0-android-arm64-debug.apk)

Os pacotes também ficam reunidos na página da [versão mais recente](https://github.com/WKMcode-dev/Naki-Play/releases/latest), junto dos hashes SHA-256 e das instruções de instalação.

## O que já funciona

- análise de links com título, criador, duração, miniatura e formatos disponíveis;
- MP3 em 128, 192, 256 e 320 kbps;
- MP4 de 144p até 2160p, limitado pela resolução disponível;
- progresso, tempo estimado, conversão e cancelamento;
- processamento local no Android e no Windows;
- `yt-dlp`, Deno, FFmpeg e FFprobe incluídos no instalador Windows;
- `yt-dlp`, Python e FFmpeg incluídos no APK Android;
- armazenamento privado, SQLite e reprodução offline;
- importação de MP3, WAV, M4A, AAC, FLAC, OGG, OPUS, MP4, WEBM e MOV;
- reprodução contínua da fila, ordem aleatória e repetição da fila ou de uma faixa;
- músicas gostadas, favoritas, playlists reordenáveis por arrastar ou por título e preferências de tema;
- interface responsiva e personalizada para celular e computador.

A versão no navegador serve para visualizar a interface. A biblioteca persistente e o conversor funcionam nos aplicativos instalados.

## Preparar o projeto

Instale Node.js, `pnpm`, Rust e os pré-requisitos do Tauri. Depois, na raiz:

```powershell
pnpm install
```

### Windows

O comando abaixo baixa uma única vez os componentes oficiais para Windows x64 e verifica os checksums publicados antes de usá-los:

```powershell
pnpm desktop:prepare
```

Para desenvolver ou compilar:

```powershell
pnpm dev:desktop
pnpm build:desktop
```

O instalador NSIS fica em `backend/target/release/bundle/nsis/`. Ele já contém tudo o que a usuária precisa; Python, Node, Deno e FFmpeg não precisam estar instalados no computador de destino.

A build local não recebe assinatura Authenticode automaticamente. Para distribuição pública sem alertas de reputação do Windows, é necessário um certificado de assinatura de código. Veja [docs/WINDOWS_TESTING.md](docs/WINDOWS_TESTING.md).

### Android

O Android exige Android Studio, SDK/NDK, Java e os alvos móveis do Rust. No Windows, ative também o **Modo de Desenvolvedor** para o Tauri criar os links simbólicos usados no build.

```powershell
pnpm android:init
pnpm dev:android
pnpm build:android:debug
```

Para uma build separada por arquitetura:

```powershell
pnpm build:android
```

Os APKs ficam em `backend/gen/android/app/build/outputs/apk/`. O tamanho do APK ARM64 de desenvolvimento varia conforme a build e atualmente fica em torno de 108 MB. Veja [docs/ANDROID_TESTING.md](docs/ANDROID_TESTING.md).

## Interface no navegador

```powershell
pnpm dev
```

Esse modo não executa os motores nativos e mantém arquivos somente durante a sessão.

## Verificações

```powershell
pnpm lint
pnpm build
pnpm check:rust
cargo test --manifest-path backend/Cargo.toml
cargo test --manifest-path plugins/naki-media/Cargo.toml
```

## Estrutura

```text
Naki-Play/
├── frontend/                 # React, interface, hooks e serviços tipados
├── backend/                  # comandos Rust, SQLite e armazenamento privado
├── plugins/naki-media/       # Kotlin no Android e processos nativos no Windows
├── scripts/                  # preparação reproduzível dos motores nativos
└── docs/                     # arquitetura, escopo e roteiros de teste
```

## Limites atuais

- um link por vez; playlists inteiras não são processadas;
- o aplicativo deve permanecer aberto durante o download;
- login, cookies, conteúdo privado, assinatura e DRM não são suportados;
- mudanças nas fontes podem exigir atualização do motor ou do aplicativo;
- o instalador Windows atual é x64;
- reprodução depende dos codecs disponíveis no sistema.

## Licenciamento

O Naki Play é distribuído sob a [GNU General Public License v3.0](LICENSE). As versões Android e Windows incorporam componentes com licenças próprias, incluindo uma build GPLv3 do FFmpeg e o `youtubedl-android` sob GPL-3.0. Consulte [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) antes de redistribuir os pacotes.

Detalhes funcionais: [docs/PRODUCT_SCOPE.md](docs/PRODUCT_SCOPE.md) · arquitetura: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
