# DOMUS — sistema imobiliário

Interface integrada inspirada no Figma original: verde oliva, creme, amarelo, tipografia condensada, arquitetura em destaque e páginas com rolagem. HTML/CSS/JavaScript sem framework; API JavaScript (Node.js) e banco SQLite, sem dependências externas de execução.

## Abrir o projeto

Instale Node.js 24 ou superior. Na pasta do projeto:

```sh
npm start
```

Não é necessário instalar pacotes: o servidor usa os módulos nativos do Node.js.
Abra **http://localhost:3000**. Não abra os arquivos HTML por duplo clique ou Live Server: cadastro e demais operações precisam da API.

O banco `domus.sqlite3` é criado automaticamente. Contém seis imóveis fictícios para experimentar a busca. Contas, favoritos, anúncios, visitas e mensagens continuam salvos após reiniciar. Faça backup do banco e da pasta `web/uploads`.

## Fluxos disponíveis

- Início com pesquisa por finalidade, cidade/bairro e tipo.
- Catálogo com filtros combinados, preço máximo, quartos, ordenação e estado vazio.
- Detalhes com valor, descrição e características.
- Cadastro, login, saída e recuperação por chave entregue uma única vez. Senhas usam PBKDF2 com salt individual; sessões usam cookie HttpOnly/SameSite.
- Favoritos vinculados à conta.
- Pedido de visita com data futura; cancelamento pelo cliente; confirmação/cancelamento pelo anunciante ou administrador.
- Publicação, edição e pausa de anúncios próprios; foto PNG/JPEG de até 4 MB.
- Painel com favoritos, visitas, anúncios e solicitações recebidas.
- Administração de mensagens, perfis cliente/corretor e moderação de anúncios.
- Sobre, contato, privacidade, menu móvel, campos rotulados, foco visível e navegação por teclado.
- As URLs HTML antigas continuam abrindo a rota correspondente; a interface e os estilos efetivos ficam em `web/`.

### Administrador

Cadastre uma conta normalmente. No terminal do servidor, habilite o perfil:

```sh
node server.js --make-admin seu-email@example.com
```

Entre novamente ou atualize a página. A aba Administração aparece somente para esse perfil, com autorização verificada na API. Contas públicas nunca podem escolher o perfil administrador. O administrador pode habilitar o perfil corretor para contas existentes; anunciantes gerenciam apenas seus próprios anúncios. Os perfis e permissões deverão ser confrontados com o documento de requisitos quando ele estiver disponível.

### Recuperação da conta

Guarde a chave exibida após o cadastro. Em “Esqueci minha senha”, informe e-mail, chave e nova senha. A operação encerra sessões anteriores e gera uma nova chave. **Não há serviço de envio de e-mail configurado.**

## Estrutura

```text
server.js          API, autenticação, autorização e inicialização do banco
web/index.html     Estrutura compartilhada
web/app.css        Sistema visual e responsividade
web/app.js         Rotas, formulários e integração com API
web/assets/        Marca original e imagem arquitetônica
web/uploads/       Fotografias dos anúncios (não versionadas)
tests/api.test.js  Testes de integração em banco temporário
```

Os HTML da raiz são entradas compatíveis, sem as antigas senhas fixas e scripts simulados. Os CSS e JSON antigos foram preservados como referência, mas não são carregados pela nova aplicação.

## Validação

```sh
npm test
node --check web/app.js
```

Os testes cobrem persistência, duplicidade, autenticação, recuperação, revogação de sessão, favoritos, visitas, autorização entre usuários, anúncios, administração e isolamento de arquivos privados. Os testes usam o executor nativo do Node.js e bancos temporários.

## Limites de implantação

Esta entrega é uma aplicação acadêmica executável, não um serviço imobiliário em produção. O servidor HTTP incluído é voltado ao desenvolvimento. Antes de exposição pública, use servidor de aplicação/reverse proxy apropriado com HTTPS, configure `DOMUS_SECURE_COOKIE=1`, backups e limites de requisição no proxy. `DOMUS_DB` permite definir o caminho do banco. Não use armazenamento efêmero para banco ou uploads.

GitHub Pages e hospedagens somente estáticas **não executam esta API Node.js**. Não foi feita implantação pública ou alteração da branch principal. Não há pagamentos, contratos, geolocalização, integração com CRM ou envio de e-mail. Mensagens de contato são registradas e aparecem na administração. Fotos do catálogo inicial vêm do Unsplash; fontes vêm do Google Fonts e possuem fallback local. Anúncios sem foto usam a imagem institucional original, que tem resolução limitada (387 × 305).

A imagem do Figma e o ZIP foram usados como referência. O slide citado com casos de uso, relacionamentos e requisitos não constava dos anexos disponíveis; a conformidade completa com ele ainda precisa ser verificada.
