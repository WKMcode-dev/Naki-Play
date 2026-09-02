# Escopo do produto

## Proposta

O Naki Play é uma biblioteca pessoal para Android e Windows. Ele recebe um link compatível, mostra os dados da mídia, permite escolher MP3 ou MP4 e salva o resultado no armazenamento privado do aplicativo para reprodução offline. Também aceita arquivos que já estejam no dispositivo.

O player mantém uma fila baseada na tela atual, avança automaticamente, oferece ordem aleatória e repetição da fila ou de uma faixa. Dentro de playlists, as músicas podem ser reordenadas por arrastar, pelo teclado ou alfabeticamente, e a ordem fica salva no dispositivo.

A interface usa por padrão uma estética neutra inspirada no Notion, com modos claro, escuro e do sistema. A pessoa pode personalizar as cores; o aplicativo calcula automaticamente texto claro ou escuro para manter o contraste nos controles principais.

O objetivo é oferecer uma experiência parecida com conversores web, mas privada, sem upload para um servidor do projeto e integrada ao player pessoal.

## Conversão de links

O motor local usa `yt-dlp` para interpretar páginas suportadas e FFmpeg para extrair áudio ou combinar vídeo e áudio. A interface oferece:

- metadados antes do download;
- MP3 em 128, 192, 256 ou 320 kbps;
- MP4 entre 144p e 2160p, conforme a origem;
- progresso, estimativa, etapa de conversão e cancelamento;
- inclusão automática na biblioteca após a validação do arquivo final.

No Android, o motor roda por uma implementação Kotlin. No Windows, o plugin Rust controla executáveis auxiliares invisíveis e encerra toda a árvore do processo ao cancelar.

O backend restringe os arquivos gerados à pasta privada de mídia, aceita apenas MP3/MP4 nesse fluxo e registra a origem no SQLite.

## Uso autorizado

O recurso é destinado a:

- conteúdo criado pela própria usuária;
- conteúdo em domínio público;
- conteúdo Creative Commons ou com outra licença que permita cópia;
- conteúdo para o qual a usuária recebeu autorização;
- downloads que a própria origem disponibiliza legitimamente.

Antes de iniciar, a interface exige uma confirmação de autorização. Essa confirmação não substitui os termos do site nem a legislação aplicável.

## Fora do escopo

O Naki Play não foi projetado para:

- remover DRM ou contornar paywalls, anúncios ou assinatura;
- acessar conteúdo privado, pago ou restrito por login;
- armazenar senhas, cookies ou tokens de contas;
- baixar catálogos protegidos do Spotify ou serviços equivalentes;
- ocultar a origem dos arquivos;
- processar playlists ou vários links em lote nesta versão.

## Plataformas

- **Android 7+:** análise, conversão, biblioteca e player; APK ARM64 de desenvolvimento disponível.
- **Windows x64:** análise, conversão, biblioteca e player; instalador autossuficiente.
- **Navegador:** demonstração da interface e arquivos temporários da sessão.
