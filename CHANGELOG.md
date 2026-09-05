# Changelog

Todas as mudanças relevantes do Naki Play serão registradas neste arquivo.

## [0.4.1] - 2026-09-05

### Adicionado

- barra superior para arrastar o player de vídeo com mouse ou toque;
- movimentação da janela de vídeo com as setas do teclado;
- limite de posição para manter a janela visível e acima dos controles, inclusive ao redimensionar a tela.

### Corrigido

- o botão de tela cheia agora também volta ao player flutuante, preservando sua posição;
- a tela cheia exibe um botão explícito **Sair da tela cheia**.

## [0.4.0] - 2026-09-05

### Adicionado

- reprodução visual de MP4, WEBM e MOV, com controles próprios e tela cheia;
- exclusão segura da cópia privada de uma música ou vídeo, incluindo referências em playlists;
- testes de consistência entre arquivo, banco SQLite e exclusão em cascata.

### Corrigido

- o ícone de alto-falante agora silencia e restaura o volume no desktop e no celular;
- o volume permanece correto ao alternar entre elementos de áudio e vídeo;
- os controles móveis respeitam barras do sistema, recortes de tela e navegação Android com três botões;
- o teclado do Android continua redimensionando a interface mesmo com o tratamento de áreas seguras.

## [0.3.1] - 2026-09-02

### Corrigido

- o botão de repetição agora alterna somente o loop da música atual;
- a fila continua avançando automaticamente quando o loop está desligado;
- o modo aleatório continua usando uma sequência embaralhada sem ordem previsível.

## [0.3.0] - 2026-09-01

### Adicionado

- contraste automático de texto para cores principais e de destaque personalizadas;
- paletas neutras Notion, Oceano, Floresta e Âmbar;
- testes de migração que garantem a preservação de músicas e playlists.

### Alterado

- o visual padrão agora é neutro e inspirado no Notion;
- textos, ilustrações, ícones e mensagens deixam de usar o tema romântico;
- instalações com a antiga paleta padrão recebem o novo tema sem substituir personalizações próprias.

## [0.2.0] - 2026-09-01

### Adicionado

- reprodução automática da próxima música da fila;
- ordem aleatória persistente e repetição da fila ou de uma única faixa;
- reordenação de músicas da playlist por arrastar, pelo teclado ou em ordem alfabética;
- controles completos do player no layout para celular.

### Alterado

- a reprodução contínua passa a vir ativada e é migrada para instalações existentes;
- a fila respeita a ordem da tela e a ordem personalizada de cada playlist.

## [0.1.1] - 2026-09-01

### Corrigido

- o aplicativo Windows agora usa o subsistema gráfico e não abre uma janela de CMD junto da interface.

## [0.1.0] - 2026-08-31

### Adicionado

- aplicativo nativo para Android ARM64 e Windows x64;
- análise de links compatíveis com metadados e formatos disponíveis;
- conversão para MP3 em 128, 192, 256 e 320 kbps;
- download de MP4 entre 144p e 2160p, conforme a fonte;
- progresso, estimativa, conversão e cancelamento;
- biblioteca local persistente, curtidas, favoritos e playlists;
- importação de arquivos locais e reprodução offline;
- yt-dlp, Deno, FFmpeg e FFprobe empacotados no Windows;
- yt-dlp, Python e FFmpeg empacotados no Android;
- documentação de arquitetura, escopo e testes por plataforma.

[0.4.1]: https://github.com/WKMcode-dev/Naki-Play/releases/tag/v0.4.1
[0.4.0]: https://github.com/WKMcode-dev/Naki-Play/releases/tag/v0.4.0
[0.3.1]: https://github.com/WKMcode-dev/Naki-Play/releases/tag/v0.3.1
[0.3.0]: https://github.com/WKMcode-dev/Naki-Play/releases/tag/v0.3.0
[0.2.0]: https://github.com/WKMcode-dev/Naki-Play/releases/tag/v0.2.0
[0.1.1]: https://github.com/WKMcode-dev/Naki-Play/releases/tag/v0.1.1
[0.1.0]: https://github.com/WKMcode-dev/Naki-Play/releases/tag/v0.1.0
