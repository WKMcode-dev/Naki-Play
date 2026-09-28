# Auditoria de reprodução Android — 2026-09-07

## Evidências e limites

O relato confirma Naki 0.5.2 no Android, com a tela acesa: a reprodução começa e depois falha. O arquivo anteriormente recebido é WebM/Opus somente áudio (222,881 s), embora seu nome termine em `.mp3.mpeg`. A leitura integral no FFmpeg Windows foi registrada na rodada anterior; isso não valida o decodificador Android nem o transporte do WebView.

Não atribuir a falha somente ao formato ou à bateria, nem declarar o caso resolvido com testes de interface redimensionada. As conclusões abaixo são da revisão do caminho 0.5.2, antes das alterações de reprodução nativa. O arquivo pessoal não deve ser publicado em fixtures ou releases.

## Caminhos examinados

- **Transporte (hipótese):** `hydrateTrack` gera `convertFileSrc`; o player HTML lê o arquivo pelo protocolo asset. No Tauri 2.11.5, `src/protocol/asset.rs` limita cada resposta Range a 1.024.000 bytes. No Wry 0.55.1, `src/android/binding.rs` entrega um `ByteArrayInputStream` e omite o cabeçalho Content-Length. Isso não prova defeito, mas exige verificar leituras sucessivas, além do primeiro trecho. Cerca de 43 s de AAC a 192 kbps já ultrapassam esse limite. Há [relato aberto semelhante no Tauri](https://github.com/tauri-apps/tauri/issues/14776), ainda sem diagnóstico confirmado para o Naki.
- **Classificação (constatada):** `PlayerBar.isVideoTrack` usa extensão. WebM e MP4 podem conter somente áudio; uma rota nativa limitada a extensões consideradas áudio não cobre essas cópias antigas. A classificação deve observar as faixas reais.
- **Entradas diferentes (constatado):** a importação Android via seletor passa por `LocalMediaImport`, que converte Opus/Vorbis sem vídeo. O download direto em `library.rs` apenas reconhece o cabeçalho; arquivos da biblioteca anterior não passam por nova conversão. Examinar esses caminhos separadamente.
- **Fragmentos ausentes (correção isolada):** o yt-dlp [ignora fragmentos indisponíveis por padrão](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/options.py). As solicitações de download Android e Windows agora usam `--abort-on-unavailable-fragments`. A política impede que esse caso seja apresentado como download completo; não repara arquivos antigos e não comprova a causa do arquivo reportado.
- **Contêiner não é codec (risco identificado):** a seleção atual de vídeo filtra `.mp4`, não codec/perfil. `--merge-output-format` não é conversão e pode não ser aplicado se não houver união, conforme o [README do yt-dlp](https://github.com/yt-dlp/yt-dlp/blob/master/README.md). Esta correção de fragmentos não altera seletores/codecs.
- **Tela apagada (requisito arquitetural):** fila e reprodução não podem depender apenas de `onEnded` JavaScript enquanto o WebView fica suspenso. O Android recomenda player/sessão dentro de um [MediaSessionService](https://developer.android.com/media/media3/session/background-playback). Mesmo um player nativo depende dos [decodificadores disponíveis no dispositivo](https://developer.android.com/media/media3/exoplayer/supported-formats).
- **Estado React:** a revisão não encontrou recarga da mídia causada por progresso; os efeitos dependem de URL, tipo e estado de reprodução. Isso não elimina outras condições de corrida.

## Regressão leve e reproduzível

Executar `node --test scripts/download-fragments.test.mjs`.

Dois contratos verificam a opção de aborto nas solicitações reais Android/Windows e impedem uma opção posterior que a desative. Um teste adicional usa o yt-dlp Windows já incluído contra um servidor HLS **somente em 127.0.0.1**, com primeiro fragmento sintético e segundo fragmento 404. Verifica que a política padrão aceita apenas a parte disponível e a política corrigida retorna erro. Não usa YouTube, mídia pessoal, FFmpeg, conta externa nem compilação. Sem o binário Windows, esse teste de integração é explicitamente ignorado; os contratos continuam executáveis. Não é teste de decodificação nem teste instrumentado Android.

Resultado em 2026-09-07: **3 testes passaram, 0 falhas, 0 ignorados** no Windows (aproximadamente 5 s). Confirmada a diferença de comportamento no cenário HLS local; a causa da parada no telefone reportado permanece não confirmada por esse teste.

## Matriz de aceitação proposta

| Eixo | Casos mínimos | Evidência necessária |
| --- | --- | --- |
| Arquivo e tamanho | Original integral; cópia M4A; MP3; áudio WebM/MP4; arquivo maior que 1 MB; inválido/truncado | Posição progride até o fim; duração e erro nativo/HTML registrados; nenhum sucesso apenas por tocar 1,5 s |
| Origem | Biblioteca antiga; seletor Downloads; provedor externo; link direto; download analisado | Formato/faixas reais e arquivo privado final identificados; origem preservada |
| Transporte | Asset URL anterior versus caminho privado no player nativo | Comparação no mesmo Android; observar passagem pelos 1.024.000 bytes e seek |
| Controles | Início, pausa/retorno, seek 25/75/95%, próxima/anterior, repetir uma, aleatório | Sem reinício inesperado, duplicação de som ou eventos de faixa anterior |
| Ciclo de vida | Tela acesa; bloquear por mais de 60 s; Home; retornar; fim de faixa bloqueado | Serviço/sessão e posição registrados; fila avança sem execução contínua do JavaScript |
| Android | API mínima 24, intermediária e recente; Samsung/Xiaomi quando disponíveis | Identificar modelo, API, ABI e WebView; distinguir emulador de hardware real |
| Rede | Offline para mídia local; Wi-Fi/dados; fragmento 404; DNS/timeout | Reprodução local não exige rede; falha de transferência não vira biblioteca incompleta |
| Atualização | Instalar por cima com mesma assinatura | Músicas e playlists anteriores preservadas; sem limpar dados para facilitar teste |

Cada célula executada deve ter resultado e ambiente registrados. Não presumir que todas as combinações foram testadas: nenhuma matriz finita garante todo dispositivo, codec ou link do YouTube. Falhas DNS, acesso restrito e indisponibilidade da origem continuam possíveis.

## Retomada de 2026-09-09 — candidata 0.5.3

### Mudanças implementadas

O áudio no Android agora segue `useAndroidAudio` → comando Rust `audio_playback` → `NativeAudioBridge` → `NakiAudioService` (Media3 1.9.4). O ExoPlayer lê a cópia privada por arquivo, sem Range/asset/WebView. O serviço é o proprietário da fila e continua independente da Activity e dos temporizadores JavaScript. A interface consulta posição apenas enquanto visível, e atualiza a barra sem renderizar toda a biblioteca a cada consulta.

O comando público recebe IDs, não caminhos. O Rust resolve-os no catálogo e valida o diretório privado; o Kotlin valida novamente todos os arquivos antes de alterar o player. Controladores do próprio aplicativo podem enviar comandos de fila; controladores confiáveis do Android têm controles de reprodução, mas não podem injetar arquivos/URLs. Não há receptor de depuração, servidor local ou nova permissão ampla de armazenamento.

A inspeção usa as faixas reais, não apenas a extensão. Uma entrada indisponível não bloqueia a inspeção de todas as outras. Erros nativos são exibidos com código, sem equiparar uma interrupção de leitura automaticamente a codec incompatível. A resposta atrasada de uma seleção antiga não substitui uma seleção nova na interface.

O serviço mantém repetição de **uma** faixa, aleatório, avanço automático entre músicas, volume/mudo, foco de áudio e pausa ao desconectar fones. Atualizações de fila/metadados preservam a faixa atual; a interface se reconecta à fila em andamento ao reabrir. O banco e os arquivos existentes não são apagados nem convertidos novamente pelo player. O original do usuário não é alterado.

**Limites de escopo:** vídeos continuam no player HTML existente. Uma playlist somente de músicas pode avançar no serviço sem a interface. Em playlists mistas, o trecho de músicas termina ao chegar a um vídeo; a interface visível faz a transição para ele. Não se promete reprodução de vídeo em segundo plano, retomada após forçar a parada do aplicativo, reparo de arquivos já truncados nem compatibilidade com todo codec/fabricante.

### Evidência desta rodada

| Verificação | Resultado | O que não comprova |
| --- | --- | --- |
| Rust, com diretório dos dez formatos gerados configurado | 26 testes aprovados | Decodificação Android |
| Kotlin/JVM: importação, diagnóstico e política de reprodução | 14 testes aprovados | Execução do serviço num telefone |
| Hooks reais React + comunicação Android simulada | 8 testes aprovados | MediaCodec, bateria ou som do aparelho |
| Mensagens de reprodução | 3 testes aprovados | Decodificação |
| Política de fragmentos e HLS local com 404 | 3 testes aprovados | Disponibilidade de todo link do YouTube |
| TypeScript, lint e produção web | Aprovados | Ciclo de vida nativo |
| Quatro testes instrumentados Android | Compilados; **não executados** | Reprodução integral/tela apagada |
| Android 11 x86_64, emulador 37.1.11, 1536 MB/2 CPUs limitadas | Encerrou antes do boot; virtualização do host desativada | Não há resultado de playback Android |
| Cópia AAC/M4A de 222,85 s | Decodificação integral FFmpeg Windows sem erro | Decodificador Android |

**Total executado: 54 testes, sem falhas. Não inclui os quatro instrumentados.** Na retomada, o original `.mp3.mpeg` não estava mais no caminho fornecido; a comparação original/convertido no Android aguarda o reenvio/localização dele e acesso a um dispositivo. A análise anterior do original está preservada acima; não foi repetida nesta rodada. Nenhuma conta externa foi criada nem termos aceitos automaticamente.

### APK local verificado

- Arquivo: `artifacts/Naki-Play-0.5.3-android-arm64-debug.apk`, 116.528.798 bytes.
- SHA-256: `CF995A95C9850A08AB8D8C4FFEE95E15018C6AB57C0AFF0D613FC298EC333B31`.
- Pacote `com.nakiplay.player`, versão `0.5.3`, código `5003`, ABI `arm64-v8a`, Android mínimo API 24, alvo API 36.
- Assinatura válida; certificado SHA-256 `6c8569a535c5f5b28b9db55883fcfd9f68b83a442eb3181684f5030424c2be09`, igual ao APK 0.5.2. Instalar por cima, sem desinstalar/limpar dados. A instalação de atualização em um Android não foi executada nesta rodada.
- Manifesto empacotado contém `NakiAudioService`, tipo `mediaPlayback`, permissões de serviço de mídia e wake lock; não contém a Activity instrumentada.
- Candidata **local**, não publicada no GitHub. Nenhum instalador Windows novo foi gerado nesta rodada.

A compilação Rust/Android terminou com sucesso. O empacotador Tauri encontrou a restrição de links simbólicos do Windows; o APK foi concluído copiando a biblioteca recém-compilada para o diretório Android gerado e executando o empacotamento, sem recompilar Rust e sem mudar permissões/BIOS do sistema.

### Reprodução dos testes leves

```powershell
$env:NAKI_MEDIA_FIXTURES = (Resolve-Path .tools/compatibility-fixtures).Path
$env:CARGO_BUILD_JOBS = '1'
cargo test --manifest-path backend/Cargo.toml --lib --offline -j 1
node --experimental-strip-types --test scripts/playback-error.test.mjs
node --test scripts/download-fragments.test.mjs

# Dependência de teste isolada e ignorada pelo Git; mesma versão do React do app.
npm install --prefix .tools/hook-tests --no-save --package-lock=false --ignore-scripts react-test-renderer@19.2.8
node --experimental-vm-modules --test scripts/native-audio.test.mjs
```

`scripts/media-fixtures.ps1` gera as dez amostras sintéticas caso o diretório ainda não exista. O renderer React é usado somente na ferramenta de regressão, não no aplicativo; sua API depreciada está fixada para esta versão e o teste não pretende substituir testes de interface/dispositivo.

### Testes dentro do Android

O arquivo `plugins/naki-media/android/src/androidTest/java/com/nakiplay/media/NativeAudioPlaybackTest.kt` contém quatro testes instrumentados:

1. Original inteiro com tela acesa, exigindo duração superior a 220 s e arquivo maior que 1.024.000 bytes.
2. Cópia M4A inteira, apagando a tela após 65 s, liberando/reconectando o controlador e conferindo continuidade/posição/ausência de erro até o fim.
3. Duas faixas sintéticas: repetir a atual, desligar repetição e avançar com tela apagada; verificar serviço em primeiro plano.
4. Reordenar fila preservando posição e rejeitar arquivo fora do diretório privado sem alterar a fila válida.

Colocar cópias dos insumos em `.tools/android-playback-assets/reported-original.mp3.mpeg` e `reported-compatible.m4a`. Esse diretório é ignorado pelo Git e incluído **somente no APK de teste instrumentado**, nunca no APK normal. Sem os insumos pessoais, os dois testes longos são explicitamente ignorados, não aprovados. Não publicar esse APK de instrumentação com a mídia pessoal.

Com um Android de teste desbloqueado e autorizado conectado, definir `JAVA_HOME`/`ANDROID_HOME`/`NDK_HOME` locais e executar:

```powershell
./backend/gen/android/gradlew.bat -p backend/gen/android :tauri-plugin-naki-media:connectedDebugAndroidTest --no-daemon --max-workers=1 --no-parallel '-Dorg.gradle.jvmargs=-Xmx1536m -XX:ActiveProcessorCount=2 -Dfile.encoding=UTF-8' '-Pkotlin.compiler.execution.strategy=in-process'
```

Executar apenas em dispositivo/emulador reservado para testes: esses testes abrem uma Activity de teste e apagam/acendem sua tela. Geram e removem somente cópias privadas do pacote de teste. Depois, testar também o **APK completo**: seletor de arquivos, download/importação, interface, atualização sobre 0.5.2, playlists antigas, controles da notificação, Home e tela bloqueada. Registrar modelo/API/ABI e resultado; não substituir essa etapa pelo teste isolado do serviço.

## Pacotes de teste 0.5.3 — 27/09/2026

Recompilados Android ARM64 e Windows x64 com a correção do fallback MP4 e os novos diagnósticos de download. A compilação Android foi concluída por cópia da biblioteca Rust recém-compilada para `jniLibs` e empacotamento Gradle; o hash da biblioteca dentro do APK coincide com o artefato Rust atual.

- 56 testes aprovados nesta rodada: 26 Rust, 15 Kotlin, 15 JavaScript; TypeScript e produção web compilados.
- APK: 116.574.162 bytes; SHA-256 `0957653bb2005a9ead6a70b63fc530087f1d6e6772aedb503063da280b00de94`.
- Windows NSIS x64: 134.522.417 bytes; SHA-256 `e47d2741d0cb7f906839402dafc41a4514169fb09a60e08a6ce0b3e160306a8e`.
- APK `com.nakiplay.player`, versão 0.5.3/código 5003, Android mínimo 7/API 24, ARM64. Assinatura válida e mesmo certificado da 0.5.2; nenhuma mídia pessoal de instrumentação foi encontrada no pacote.
- Não houve teste físico nem execução dos testes instrumentados nesta rodada. A instalação sobre uma versão anterior e a reprodução/download no aparelho continuam pendentes.
- O pacote Windows não recebeu assinatura Authenticode; o Android utiliza a assinatura de desenvolvimento existente.
