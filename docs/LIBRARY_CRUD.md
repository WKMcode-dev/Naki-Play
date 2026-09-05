# Gestão da biblioteca

## Operações disponíveis

| Dados | Criar | Consultar | Atualizar | Excluir ou restaurar |
| --- | --- | --- | --- | --- |
| Músicas e vídeos | Importar ou baixar conteúdo autorizado | Biblioteca, pesquisa e reprodução | Menu ⋯ → Editar informações: título, artista e álbum | Menu ⋯ → Excluir do dispositivo, com confirmação |
| Playlists | Criar playlist | Biblioteca → Suas playlists; também na lateral do desktop | Renomear; adicionar/remover mídias; reordenar | Abrir a playlist → Excluir playlist, com confirmação |
| Gostadas e favoritas | Marcar uma mídia | Telas dedicadas | Alternar marcação | Desmarcar; não apaga a mídia |
| Preferências locais | Criadas no primeiro uso | Configurações | Editar e salvar | Restaurar preferências padrão no formulário e salvar |

As preferências são um registro único, não uma coleção: restaurar os valores padrão é a alternativa à exclusão. Não há contas, artistas ou álbuns independentes; artista e álbum são informações da mídia. Downloads em andamento são tarefas canceláveis, não coleções editáveis.

## Garantias de escopo

- Excluir uma playlist remove só seu registro e suas associações. Não apaga arquivos, outras playlists ou a fila já em reprodução.
- Editar título, artista e álbum altera só o banco local, não o nome do arquivo, seu conteúdo nem seu endereço usado pelo player.
- Remover da playlist não equivale a excluir do dispositivo.
- Restauração de preferências não limpa a biblioteca.
- As mudanças de playlist aparecem após sucesso na persistência. Falhas mantêm o formulário aberto e exibem a mensagem.
- Nenhuma migração destrutiva nem mudança de identificador é necessária nesta versão.

## Roteiro de regressão

1. Criar duas playlists e adicionar a mesma mídia às duas.
2. Renomear uma delas; verificar o nome no título, na biblioteca e no menu de adicionar mídias.
3. Editar título, artista e álbum; verificar pesquisa e player sem reinício da reprodução.
4. Cancelar a exclusão da playlist e verificar que nada mudou.
5. Confirmar a exclusão: voltar à biblioteca, manter a mídia e a outra playlist.
6. Reiniciar o aplicativo instalado e verificar persistência.
7. Repetir criação e acesso por Biblioteca em tela móvel, inclusive com playlist vazia.
8. Tentar nomes vazios/só espaços e campos acima do limite; verificar rejeição.
9. Restaurar preferências no formulário, sair sem salvar e verificar que o tema salvo não mudou.

Testes automatizados de banco usam dados fictícios em memória. Testes de navegador não substituem a validação no Android físico.
