# Naki Play 0.5.5 — área de vídeos

Agora o Naki Play tem uma seção **Vídeos**, com biblioteca própria e uma área maior para assistir aos arquivos salvos.

- Importe um vídeo para abrir diretamente a área de reprodução.
- Use pausa, posição, volume e tela cheia.
- Continue assistindo no player flutuante ao navegar para outra seção, preservando a posição.
- Encontre seus vídeos pela busca e volte à área de vídeos pelo atalho no player.
- Layout adaptado ao desktop e ao celular.

O responsável pelo projeto confirmou o funcionamento da versão testada e autorizou sua publicação como atualização funcional. Os arquivos desta release são os mesmos disponibilizados para esse teste.

## Instalação

- **Windows x64:** execute `Naki-Play-0.5.5-windows-x64-setup.exe`.
- **Android ARM64, Android 7 ou superior:** instale `Naki-Play-0.5.5-android-arm64.apk` por cima da versão anterior, sem desinstalar nem limpar dados. A assinatura Android é a mesma da versão 0.5.4.

Após instalar, abra **Vídeos** no menu.

## Verificação

Compilação Windows e Android concluída no GitHub Actions, 19 testes Kotlin aprovados e interface verificada no Edge com vídeo real em tamanho de desktop e celular. A assinatura do APK, a versão dos pacotes e seus hashes foram conferidos antes da publicação.

A assinatura Android é de desenvolvimento; o instalador Windows não possui assinatura Authenticode. A compatibilidade de codecs permanece a do player existente.

[Código e alteração](https://github.com/WKMcode-dev/Naki-Play/pull/1) · [Compilação dos instaladores](https://github.com/WKMcode-dev/Naki-Play/actions/runs/41260895012)
