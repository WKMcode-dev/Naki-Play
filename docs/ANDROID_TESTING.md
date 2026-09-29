# Roteiro de teste Android

## Instalação

1. Use um aparelho ARM64 com Android 7 ou superior.
2. Copie o APK de teste para o celular.
3. Autorize temporariamente a instalação de apps desconhecidos para o gerenciador de arquivos usado.
4. Instale o APK e abra o Naki Play.
5. Depois da instalação, você pode retirar essa autorização do gerenciador de arquivos.

O primeiro uso do conversor pode levar mais tempo porque Python e FFmpeg são preparados e o app tenta verificar uma atualização estável do extrator.

A partir da 0.5.4, `android:prepare` também prepara o extrator fixado em `plugins/naki-media/android/src/main/res/raw/naki_engine.json`, verificando seu SHA-256. O APK instala essa cópia antes de tentar a atualização online, quando a versão existente é antiga ou está ausente; uma versão mais nova é preservada. Os detalhes de suporte exibem a versão executada, não apenas a última versão registrada pelo atualizador.

## Teste essencial

Use um vídeo curto que seja seu, de domínio público ou autorizado.

- cole o link e toque em **Analisar link**;
- confira título, criador, duração e miniatura;
- escolha **MP3 · 192 kbps**, confirme a autorização e baixe;
- espere a conclusão, reproduza a faixa e feche o aplicativo;
- abra novamente e confirme que a faixa continua na biblioteca;
- repita com uma opção MP4 disponível;
- confirme que o vídeo aparece no display, pode ser pausado e abre em tela cheia;
- arraste a barra com o título do vídeo e confira que a janela continua dentro da tela ao girar o aparelho;
- entre e saia da tela cheia pelo botão inferior e por **Sair da tela cheia**, sem reiniciar a reprodução;
- toque no alto-falante para silenciar e restaurar o volume;
- em um aparelho com navegação por três botões, confirme que a barra inferior não cobre o player nem o menu;
- inicie outro download e teste **Cancelar** depois que o progresso começar;
- desligue a internet e confirme que um arquivo já salvo continua tocando;
- teste gostar, favoritar e adicionar a uma playlist.
- exclua uma faixa, confirme que ela desaparece das playlists e reinicie o aplicativo;
- instale a atualização por cima de uma versão anterior e confirme que as demais músicas continuam salvas.

## O que observar

- deixe o app aberto durante download e conversão;
- vídeos longos ou 4K consomem bastante espaço, bateria e memória;
- algumas fontes podem não oferecer todas as resoluções;
- se um site mudar e a análise parar de funcionar, conecte o aparelho à internet e tente novamente; o extrator verifica atualizações diariamente, com intervalo mínimo de 15 minutos após falhas;
- guarde o link e a mensagem exibida ao registrar um problema, mas nunca publique links privados ou credenciais.

## HTTP 403 e versão 0.5.1 de teste

Um 403 significa que a origem recusou uma solicitação; não identifica sozinho a causa nem comprova necessidade de Premium. O fluxo do Naki não usa login/Premium. Conteúdo privado, DRM, autenticação e bloqueios da origem não são contornados.

A versão 0.5.1 corrige a periodicidade da atualização estável do extrator e exibe a versão utilizada no diagnóstico. Não é uma correção confirmada para todos os 403. Para validar, instalar por cima, manter o app aberto, repetir o link autorizado que falhou e registrar a mensagem completa, versão Android/Naki e se a falha ocorre na análise ou no download. Não enviar cookies, senhas ou endereços assinados de mídia.

Referência do motor: https://github.com/yausername/youtubedl-android/tree/0.18.1

## Regressões de download

- `node --test scripts/download-output.test.mjs scripts/download-fragments.test.mjs` usa mídia sintética local no Windows: reproduz o fallback WebM que não gerava MP4, verifica a conversão corrigida, a extração MP3 e a rejeição de fragmentos ausentes. Exige os motores preparados com `pnpm desktop:prepare`. Não valida acesso ao YouTube nem a execução dos binários Android.
- `DownloadSupportTest` cobre diagnósticos de rede, atualização, JavaScript, formato indisponível, acesso restrito e inicialização. Execute `gradlew.bat :tauri-plugin-naki-media:testDebugUnitTest` no projeto Android gerado.
- No aparelho, repetir uma fonte autorizada cujo formato combinado seja WebM, selecionar MP4 e confirmar conclusão, áudio e vídeo. A conversão pode consumir mais tempo e bateria.
- Para os relatos de música que não baixa, registrar versão do APK, versão do Android, etapa da falha e os detalhes de suporte. A correção do fallback MP4 não comprova a resolução desses relatos.

## Antes de entregar ou publicar

- testar em pelo menos um aparelho físico, pois o build automatizado não valida codecs, bateria ou comportamento do fabricante;
- trocar o ícone provisório, se necessário;
- gerar uma build release assinada para distribuição duradoura;
- definir a licença compatível com as dependências GPL e publicar o código-fonte correspondente;
- conferir nome, versão e identificador do pacote.
