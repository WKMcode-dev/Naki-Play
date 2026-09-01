# Roteiro de teste Android

## Instalação

1. Use um aparelho ARM64 com Android 7 ou superior.
2. Copie o APK de teste para o celular.
3. Autorize temporariamente a instalação de apps desconhecidos para o gerenciador de arquivos usado.
4. Instale o APK e abra o Naki Play.
5. Depois da instalação, você pode retirar essa autorização do gerenciador de arquivos.

O primeiro uso do conversor pode levar mais tempo porque Python e FFmpeg são preparados e o app tenta verificar uma atualização estável do extrator.

## Teste essencial

Use um vídeo curto que seja seu, de domínio público ou autorizado.

- cole o link e toque em **Analisar link**;
- confira título, criador, duração e miniatura;
- escolha **MP3 · 192 kbps**, confirme a autorização e baixe;
- espere a conclusão, reproduza a faixa e feche o aplicativo;
- abra novamente e confirme que a faixa continua na biblioteca;
- repita com uma opção MP4 disponível;
- inicie outro download e teste **Cancelar** depois que o progresso começar;
- desligue a internet e confirme que um arquivo já salvo continua tocando;
- teste gostar, favoritar e adicionar a uma playlist.

## O que observar

- deixe o app aberto durante download e conversão;
- vídeos longos ou 4K consomem bastante espaço, bateria e memória;
- algumas fontes podem não oferecer todas as resoluções;
- se um site mudar e a análise parar de funcionar, conecte o aparelho à internet e tente novamente; o extrator verifica atualizações semanalmente;
- guarde o link e a mensagem exibida ao registrar um problema, mas nunca publique links privados ou credenciais.

## Antes de entregar ou publicar

- testar em pelo menos um aparelho físico, pois o build automatizado não valida codecs, bateria ou comportamento do fabricante;
- trocar o ícone provisório, se necessário;
- gerar uma build release assinada para distribuição duradoura;
- definir a licença compatível com as dependências GPL e publicar o código-fonte correspondente;
- conferir nome, versão e identificador do pacote.
