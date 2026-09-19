# Domus Imobiliária — Site Institucional

## Descrição
Site front-end da **Domus Imobiliária**, desenvolvido como projeto integrador da disciplina de Web Design (2TDSA — 2026).
Sistema de gerenciamento imobiliário com banco de dados relacional MySQL.

## Estrutura do Projeto

```
domus/
├── index.html          # Home (Izabela)
├── sobre.html          # Sobre Nós (Miguel)
├── projetos.html       # Imóveis (Isabela)
├── contato.html        # Contato (Daniel)
│
├── css/
│   ├── style.css       # Estilos globais (Miguel)
│   ├── header.css      # Cabeçalho (Izabela)
│   ├── footer.css      # Rodapé (Miguel)
│   ├── home.css        # Página inicial (Izabela)
│   ├── sobre.css       # Sobre Nós (Miguel)
│   ├── projetos.css    # Imóveis (Isabela)
│   └── contato.css     # Contato (Daniel)
│
├── js/
│   ├── main.js         # Funcionalidades gerais (Izabela)
│   ├── menu.js         # Menu mobile (Izabela)
│   ├── projetos.js     # Listagem e filtro de imóveis (Isabela)
│   ├── contato.js      # Formulário e FAQ (Daniel)
│   └── animacoes.js    # Animações de scroll (Daniel)
│
├── data/
│   ├── projetos.json   # Dados dos imóveis (Isabela)
│   ├── contatos.json   # Dados de contatos (Daniel)
│   └── empresa.json    # Dados institucionais (Miguel)
│
└── assets/
    ├── img/
    │   ├── logo/       # Logos da empresa
    │   ├── projetos/   # Fotos dos imóveis
    │   ├── banners/    # Banners e fundos
    │   └── icones/     # Ícones
    ├── fonts/          # Fontes customizadas
    └── icons/          # Ícones SVG
```

## Divisão de Responsabilidades

| Arquivo | Responsável |
|---------|-------------|
| `index.html` | Izabela |
| `sobre.html` | **Miguel** |
| `projetos.html` | Isabela |
| `contato.html` | Daniel |
| `css/style.css` | **Miguel** |
| `css/header.css` | Izabela |
| `css/footer.css` | **Miguel** |
| `css/home.css` | Izabela |
| `css/sobre.css` | **Miguel** |
| `css/projetos.css` | Isabela |
| `css/contato.css` | Daniel |
| `js/main.js` | Izabela |
| `js/menu.js` | Izabela |
| `js/projetos.js` | Isabela |
| `js/contato.js` | Daniel |
| `js/animacoes.js` | Daniel |
| `data/projetos.json` | Isabela |
| `data/contatos.json` | Daniel |
| `data/empresa.json` | **Miguel** |

## Banco de Dados

O sistema utiliza MySQL com as seguintes tabelas:
- `usuario` — Dados dos usuários do sistema
- `corretor` — Dados dos corretores (CRECI)
- `imovel` — Cadastro dos imóveis
- `anuncio` — Anúncios publicados
- `pagamento` — Pagamentos dos anúncios
- `compra` — Transações de compra e venda
- `visita` — Agendamento de visitas
- `aluguel` — Contratos de locação

## Tecnologias
- HTML5 semântico
- CSS3 com Custom Properties (variáveis CSS)
- JavaScript ES6+ (sem frameworks)
- Font Awesome 6.5 (ícones)
- JSON para dados estáticos
- MySQL (banco de dados)

## Como Executar
1. Clone ou baixe o projeto
2. Abra o arquivo `index.html` em um navegador moderno
3. Para funcionalidade completa dos JSON, use um servidor local (ex: Live Server no VS Code)

## Consultas SQL Implementadas (por pessoa)

### Miguel
- Usuários com sobrenome "Silva" ou "Santos" — `sobre.html`
- Média do valor dos imóveis disponíveis — `sobre.html`
- Detalhes das compras com nome do comprador — `sobre.html`

### Daniel
- Imóveis com preços entre 500 mil e 1 milhão — `contato.html`
- Imóveis e seus proprietários — `contato.html`
- Quantidade de imóveis por tipo — `contato.html`

### Isabela
- Imóveis do tipo Apartamento ou Casa — `projetos.html`
- Total de comissão por corretor — `projetos.html`

### Izabela
- Anúncios publicados a partir de 15/02/2026 — `index.html`
- Histórico de visitas com cliente e CRECI — `index.html`
- Valor total por tipo de compra — `index.html`
