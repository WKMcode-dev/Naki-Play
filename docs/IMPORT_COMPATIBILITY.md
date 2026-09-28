# Importação e links — 0.5.2 (candidata a teste)

## Diagnóstico do caso enviado

- O arquivo com final `.mp3.mpeg` não é MP3/MPEG: contém **WebM, áudio Opus, 48 kHz, dois canais, 222,881 s**, sem vídeo. A leitura completa no FFmpeg do Windows terminou sem erro.
- O print do link mostra `No address associated with hostname`: falha de resolução de endereço (DNS), diferente do HTTP 403 anterior. Não identifica problema de formato nem ausência de Premium.
- Não temos o modelo/Android/WebView, o link completo ou uma reprodução no aparelho afetado. O funcionamento no desktop não garante o mesmo decodificador no WebView Android.

## Alterações

- Android: o seletor não esconde arquivos com extensão/MIME incorretos. `ContentResolver.openInputStream` copia a mídia para armazenamento privado e consulta o nome original, em vez de interpretar o identificador `content://` como nome de arquivo. A origem não é apagada.
- Android: `MediaExtractor` examina as faixas. Áudio Opus/Vorbis **sem vídeo** recebe cópia AAC/M4A (192 kbps, estéreo, 48 kHz) usando o FFmpeg já incluído. A conversão é offline, serial, com uma thread de codec, limite de 10 minutos e limpeza em caso de falha. Vídeos não perdem sua faixa de imagem. A conversão com perdas pode alterar a qualidade; só ocorre para esses codecs de áudio.
- Conteúdo, não extensão, determina o formato salvo. Corrigidos aliases M4A e cabeçalhos MP3. Arquivos vazios ou sem assinatura reconhecida não entram como músicas. Identificar uma assinatura não prova integridade completa de todos os formatos.
- Lotes: sucesso/falha por arquivo; os sucessos aparecem imediatamente ao concluir o lote, mesmo quando outro arquivo falha. Temporários são removidos em erro. Arrastar arquivos no aplicativo nativo não cria cópias temporárias duplicadas no navegador.
- Links: normalização de watch, youtu.be, Shorts, Live, embed, YouTube Music/mobile, parâmetros de compartilhamento e texto contendo um único link. Mais de um link, credenciais e links de playlist/canal sem vídeo recebem orientação específica. URLs diretas assinadas preservam a consulta.
- Android distingue DNS, offline, timeout, 403, 429 e falta de espaço. Detalhes técnicos ficam recolhidos, com URLs/caminhos omitidos. Não altera DNS, VPN, permissões de internet do fabricante ou restrições da origem.
- Download direto lê em blocos com limite de 220 MB e valida o conteúdo recebido, evitando salvar HTML/JSON como MP3 apenas pelo nome.
- Player distingue bloqueio de autoplay, leitura e decodificação; para o estado de reprodução quando há erro. Mensagem fica acima, sem cobrir os próprios controles.

## Matriz executável

`scripts/media-fixtures.ps1 -OriginalPath <arquivo>` gera apenas fixtures sintéticas na pasta ignorada `.tools/compatibility-fixtures`. O argumento opcional só lê o original e cria uma cópia nessa pasta; não deve ser incluído em commits ou releases.

| Grupo | Cobertura local | Limite |
| --- | --- | --- |
| Links | 48 combinações de host × parâmetros × texto, mais links curtos/Shorts/Live/embed, entradas inválidas e URL assinada | Validação do parser, não 48 downloads no YouTube |
| Formatos | MP3, WAV, M4A, AAC, FLAC, OGG, OPUS, MP4, WebM e MOV gerados; cada um com nome correto, numérico e incorreto | Detector de formato, não todos os codecs existentes |
| Conteúdo inválido | Vazio, HTML, JSON, texto e PDF com extensões de mídia | Assinatura não substitui decodificação integral |
| Provedores Android | Fluxos de tamanho desconhecido, leituras pequenas, vazio e falha de leitura | Testes JVM de fluxo; não SAF/Drive/WhatsApp reais |
| Conversão | Decodificação completa do original e da cópia AAC no Windows; políticas Opus/Vorbis com/sem vídeo em JVM | Binário Android e MediaExtractor precisam de aparelho |
| Rede | DNS em cinco mensagens, offline, 403, 429, timeout, espaço e diagnóstico limitado | Não simula DNS/VPN/operadora de um celular real |
| Interface | Navegador Windows em 360×800, 393×851 e 412×915; original e cópia AAC reproduzidos, sem rolagem horizontal | Redimensionamento não emula Android nem sua barra de navegação nativa |

## Pendente em aparelhos reais

Resultado local: **24 testes Rust, 10 testes JVM/Kotlin e 3 testes de mensagens do player passaram**; build frontend e APK ARM64 concluídos. APK `com.nakiplay.player`, versão `0.5.2`, código `5002`, Android mínimo 7 (API 24), assinatura debug mantida. Nenhum teste instrumentado Android foi executado.

Também foi importado/reproduzido um MP4 sintético no navegador. As fixtures e o arquivo recebido não são publicados no repositório. Esta rodada gera somente APK de teste; não publica release nem gera novo instalador Windows.

Não havia Android conectado/emulador instalado nem sessão BrowserStack acessível aos testes locais. Não há garantia universal de importação ou download.

Na APK de teste, validar Android 7/8, 10/11, 13/14 e 15/16, incluindo Samsung e Xiaomi quando disponíveis. Em cada aparelho:

1. Instalar por cima com a mesma assinatura, **sem desinstalar/limpar dados**; conferir músicas/playlists anteriores.
2. Importar pelo seletor em Downloads, cartão SD (se houver), provedor de arquivos de outro app e nuvem. Testar nome `.mp3.mpeg`, nome sem extensão, M4A e um lote válido/inválido/válido.
3. No caso reportado, reimportar o original: músicas antigas não são convertidas ou apagadas automaticamente. A nova cópia deve aparecer como M4A e tocar até o fim, com seek, pausa e retorno ao aplicativo.
4. Colar o **mesmo link público autorizado** por digitação, copiar/colar do navegador e YouTube/YouTube Music. Baixar MP3 e MP4. A opção Android “Compartilhar diretamente para o Naki” (ACTION_SEND) não é implementada; usar Copiar link ou o seletor interno.
5. Comparar Wi-Fi/dados móveis, modo avião e retorno da conexão. Em DNS/403, registrar print completo, link público, versão Android/WebView e rede. Não enviar cookies/senhas.

Links privados, removidos, com DRM/restrição, limites da origem e falhas de rede não podem ter sucesso garantido. O Naki não contorna controles de acesso.
