# Arquitetura

## Camadas

1. **Interface React (`frontend`)** — telas, acessibilidade, tema, seleção de formato e estado do download.
2. **Serviços TypeScript (`frontend/src/services`)** — contratos tipados e canais de progresso entre React e Tauri.
3. **Comandos Rust (`backend/src/commands`)** — validação, diretórios privados, persistência e limites de segurança.
4. **Plugin `naki-media`** — contrato único para Android e Windows.
5. **Android/Kotlin** — `youtubedl-android`, `yt-dlp`, Python e FFmpeg.
6. **Windows/Rust** — processos isolados de `yt-dlp`, Deno, FFmpeg e FFprobe.
7. **Persistência (`backend/src/database.rs`)** — SQLite e arquivos na pasta privada `media`.

## Fluxo de um link

```text
                                  ┌─ Android: Kotlin + Python/yt-dlp
Link → React → comando Rust → plugin
                                  └─ Windows: Rust + yt-dlp/Deno
                                                   ↓
Biblioteca SQLite ← validação de caminho ← MP3/MP4 ← FFmpeg
```

1. A interface solicita a análise.
2. O Rust aceita apenas HTTP/HTTPS sem credenciais embutidas.
3. O plugin da plataforma consulta os metadados e normaliza as opções.
4. A usuária escolhe formato/qualidade e confirma a autorização.
5. O backend cria IDs independentes para o trabalho e a faixa e escolhe um destino privado.
6. O motor envia preparação, progresso, conversão e conclusão por um `Channel` Tauri.
7. O backend canonicaliza o resultado, confirma que ele permanece dentro da biblioteca e valida a extensão.
8. Só então a faixa é persistida no SQLite e entregue ao player.
9. Falhas removem os arquivos parciais daquele trabalho.

## Motor Windows

`scripts/prepare-desktop.mjs` baixa yt-dlp, Deno e a build FFmpeg recomendada pelo projeto yt-dlp. Os arquivos de checksum oficiais são lidos antes de aceitar cada download. O Tauri inclui quatro sidecars específicos para `x86_64-pc-windows-msvc` no instalador NSIS.

O processo principal:

- informa explicitamente os caminhos do Deno e FFmpeg;
- ignora configurações globais de yt-dlp para comportamento previsível;
- usa timeout e número limitado de tentativas;
- não abre janela de terminal;
- lê stdout/stderr simultaneamente para evitar bloqueios;
- associa cada processo a um UUID e usa `taskkill /T` no cancelamento.

## Motor Android

O APK inclui uma versão funcional do motor. Antes da primeira análise e, no máximo, uma vez a cada sete dias, o plugin tenta atualizar o yt-dlp pelo canal estável. Se a rede falhar, a versão embarcada continua disponível.

## Decisões de segurança

- componentes React não acessam diretamente o sistema de arquivos ou processos;
- só o backend escolhe o destino persistente;
- nomes vindos da internet nunca formam o caminho físico;
- credenciais em URL são rejeitadas;
- nenhuma conta, cookie ou token externo é armazenado;
- opções do processo são montadas por argumentos, sem interpolação em shell;
- IDs de cancelamento são UUIDs e PIDs nunca vêm do frontend;
- executáveis de build são verificados por SHA-256;
- a política de conteúdo do WebView restringe scripts, mídia e conexões.

## Limitações conscientes

- o app deve continuar aberto; o Android ainda não usa serviço em primeiro plano;
- apenas um item é iniciado pela interface por vez;
- playlists inteiras usam `--no-playlist`;
- builds públicas precisam de assinatura de código/loja;
- os pacotes são maiores porque os motores são autossuficientes.
