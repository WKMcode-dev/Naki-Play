# Roteiro de teste Windows

## Instalação

1. Use Windows 10 ou 11 x64.
2. Confirme a origem do instalador e, se desejar, compare o SHA-256 publicado junto da build.
3. Instale o Naki Play no perfil da usuária.

A build local de portfólio não é assinada com certificado Authenticode. Uma distribuição pública deve receber assinatura de código para estabelecer a identidade do autor e reduzir alertas de reputação do Windows.

## Teste essencial

Use um vídeo curto próprio, em domínio público ou autorizado.

- abra **Arquivos** e cole o link;
- confira título, criador, duração e miniatura;
- escolha **MP3 · 192 kbps** e confirme a autorização;
- acompanhe progresso e conversão e reproduza o resultado;
- feche e abra novamente para confirmar a persistência;
- repita com uma opção MP4;
- inicie outro download e teste **Cancelar** após o progresso começar;
- minimize a janela e confirme que o processo continua;
- desligue a internet e reproduza um item já salvo;
- teste gostar, favoritar e adicionar a uma playlist.

## Diagnóstico

- o app não depende de Python, Node, Deno ou FFmpeg instalados globalmente;
- a análise/download precisa de internet, mas conversão e reprodução são locais;
- conteúdo que exige login, cookies, assinatura ou DRM não é suportado;
- mantenha o app aberto até a conclusão;
- se uma fonte mudar, gere uma nova build com `pnpm desktop:prepare` atualizado.

## Antes de publicar

- testar o instalador em outro computador ou numa máquina virtual limpa;
- assinar o instalador e o executável principal;
- escolher a licença compatível e distribuir os avisos das dependências;
- criar uma release no GitHub com hash SHA-256 e changelog;
- validar desinstalação e atualização sobre a versão anterior.
