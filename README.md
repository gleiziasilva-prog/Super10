# Super10

Loja virtual responsiva para apresentar e vender produtos por R$ 10,00.

## Executar no Windows

No VS Code, abra a pasta raiz do projeto e pressione `F5`; a configuração inicia o servidor e abre o site no navegador integrado.

Para executar manualmente:

1. Abra o PowerShell na pasta do projeto.
2. Execute `powershell -NoProfile -ExecutionPolicy Bypass -File .\server.ps1`.
3. Acesse <http://127.0.0.1:8080>.
4. Para encerrar, pressione `Ctrl+C` na janela do servidor.

O servidor usa o PowerShell e o SQLite nativo do Windows, sem instalação de pacotes. O banco é criado em `data\super10.db` e recebe o catálogo inicial de `super10\products.json` na primeira execução. Produtos e estoque cadastrados na área administrativa ficam persistidos nesse banco. O carrinho continua salvo no navegador; a finalização apenas limpa a sacola neste navegador e não envia o pedido à loja.

O servidor fica limitado a `127.0.0.1` e é destinado ao desenvolvimento nesta máquina. Ele não tem autenticação administrativa e não deve ser exposto à internet ou a outros dispositivos. Para publicação, hospede a API e o banco em uma infraestrutura segura e configure autenticação para a administração.

## Avaliações compartilhadas

As avaliações da loja são armazenadas no Supabase para que todos os visitantes possam ler e publicar opiniões, inclusive no GitHub Pages.

1. Crie um projeto no Supabase e execute [`supabase-reviews.sql`](./supabase-reviews.sql) no SQL Editor.
2. Em **Project Settings → API**, copie a Project URL e a chave pública `anon`/publishable.
3. Preencha `supabaseUrl` e `supabaseAnonKey` em [`super10/config.js`](./super10/config.js).
4. Publique as alterações no GitHub Pages.

Use somente a chave pública do projeto no site. Nunca coloque a chave `service_role` em arquivos do frontend. As avaliações são anônimas e públicas; qualquer visitante poderá enviá-las.
