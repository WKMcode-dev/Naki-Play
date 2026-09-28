# Changelog

Todas as mudanças relevantes do Naki Play serão registradas neste arquivo.

## 0.5.3 — Player de áudio nativo Android (candidata de teste)

- Corrige a saída MP4 no Android quando a origem fornece um fluxo combinado WebM; o arquivo passa pela conversão necessária antes de entrar na biblioteca.
- Diagnósticos distinguem problemas de JavaScript do extrator, formato indisponível, acesso restrito e inicialização do motor, incluindo causas internas sem expor links assinados.
- Músicas no Android passam a usar Media3/ExoPlayer lendo a cópia privada diretamente, sem o transporte de arquivos do WebView.
- Serviço de mídia com fila, repetição da faixa atual, aleatório, foco de áudio, pausa ao desconectar fones e controles do sistema; projetado para continuar com a tela apagada.
- Inspeção das faixas reais separa áudio de vídeo, inclusive WebM apenas de áudio e arquivos da biblioteca antiga. Vídeos mantêm o player visual; playlists mistas aguardam a interface no limite entre música e vídeo.
- Retorno ao aplicativo recupera a sessão em andamento. Alterar volume, metadados ou ordem não deve reiniciar a música; exclusão aguarda a liberação do arquivo pelo serviço.
- Downloads Android e Windows abortam quando um fragmento está indisponível, em vez de aceitar esse caso como um arquivo completo.
- Mesma identificação do aplicativo e mesmo banco: não há limpeza nem migração destrutiva da biblioteca.
- **Validação em dispositivo ainda pendente.** Testes de lógica/integração simulada passaram e testes instrumentados compilam. O emulador local encerrou antes do boot; não foi confirmada ainda a reprodução integral no Android afetado. Detalhes em `docs/PLAYBACK_AUDIT.md`.

## 0.5.2 — Importação Android e diagnóstico de links (teste)

- Reconhecimento do formato real, inclusive arquivos com extensão incorreta; aliases M4A corrigidos.
- Android copia arquivos de provedores pelo fluxo nativo e prepara áudio Opus/Vorbis sem vídeo em AAC/M4A, offline, preservando a origem.
- Importação em lote relata falhas por arquivo e mantém os sucessos visíveis; limpeza de temporários e proteção contra importação duplicada por arrastar.
- Normalização de links compartilhados, YouTube Music, Shorts e links curtos; diagnóstico específico para DNS/conexão e detalhes técnicos recolhidos.
- Erros de reprodução distinguem autoplay, leitura e codec. Download direto valida bytes e limita o recebimento sem carregar todo o arquivo na memória.
- Matriz de testes e limitações em `docs/IMPORT_COMPATIBILITY.md`. A execução nativa e as redes de aparelhos reais ainda precisam de confirmação; nenhum link tem sucesso universal garantido.

## [0.5.1] - 2026-09-05 — Teste Android

- corrige a verificação de atualização do extrator, que antes só acontecia na inicialização;
- verifica a versão estável diariamente, com intervalo mínimo de 15 minutos após falhas;
- serializa as operações do motor para não atualizá-lo durante outro processamento;
- limita tentativas e tempo de espera da conexão de mídia;
- mantém diagnóstico visível, informa a versão do extrator e explica erros 403/429, conexão e espaço;
- esclarece que Premium não é requisito do Naki e que restrições da origem continuam sendo respeitadas.

Esta versão é de teste. A causa do HTTP 403 relatado ainda não foi confirmada no aparelho afetado; estas mudanças não garantem que todo link possa ser baixado.

## [0.5.0] - 2026-09-05

### Adicionado

- renomeação e exclusão de playlists com confirmação, preservando mídias e outras coleções;
- edição de título, artista e álbum sem alterar o arquivo original;
- acesso às playlists pela biblioteca, inclusive em telas móveis;
- formulários próprios para criar e gerenciar playlists, substituindo o prompt do navegador;
- restauração das preferências padrão no formulário de configurações;
- testes de preservação de mídias e validação das operações de catálogo.

### Corrigido

- operações de playlist só atualizam a interface após sucesso na persistência.

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
[0.5.0]: https://github.com/WKMcode-dev/Naki-Play/releases/tag/v0.5.0
[0.5.1]: https://github.com/WKMcode-dev/Naki-Play/releases/tag/v0.5.1
[0.4.0]: https://github.com/WKMcode-dev/Naki-Play/releases/tag/v0.4.0
[0.3.1]: https://github.com/WKMcode-dev/Naki-Play/releases/tag/v0.3.1
[0.3.0]: https://github.com/WKMcode-dev/Naki-Play/releases/tag/v0.3.0
[0.2.0]: https://github.com/WKMcode-dev/Naki-Play/releases/tag/v0.2.0
[0.1.1]: https://github.com/WKMcode-dev/Naki-Play/releases/tag/v0.1.1
[0.1.0]: https://github.com/WKMcode-dev/Naki-Play/releases/tag/v0.1.0
