"use strict";
const $ = (s, root = document) => root.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (n) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(n);
let properties = [],
  me = null,
  account = { favorites: [], visits: [], listings: [], requests: [] },
  activeTab = "favorites",
  renderId = 0;
const main = $("#main");
async function api(path, data) {
  const res = await fetch("/api/" + path, {
    method: data ? "POST" : "GET",
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
  });
  const body = await res.json();
  if (!res.ok)
    throw Error(body.error || "Não foi possível concluir. Tente novamente.");
  return body;
}
function notice(text) {
  const el = $("#notice");
  el.textContent = text;
  el.style.display = "block";
  clearTimeout(notice.timer);
  notice.timer = setTimeout(() => (el.style.display = "none"), 4500);
}
function photo(p) {
  if (p.image?.startsWith("/uploads/")) return p.image;
  return p.image
    ? `https://images.unsplash.com/${encodeURIComponent(p.image)}?auto=format&fit=crop&w=1200&q=85`
    : "/assets/arquitetura.png";
}
function field(label, name, type = "text", extra = "") {
  return `<label class="field">${label}<input name="${name}" type="${type}" ${extra}></label>`;
}
function select(label, name, values, value = "") {
  return `<label class="field">${label}<select name="${name}">${values
    .map((v) => {
      const [key, text] = Array.isArray(v) ? v : [v, v];
      return `<option value="${esc(key)}" ${key === value ? "selected" : ""}>${esc(text)}</option>`;
    })
    .join("")}</select></label>`;
}
function card(p) {
  const saved = account.favorites.includes(p.id);
  return `<article class="property"><div class="property-photo"><a href="/#/imovel/${p.id}" aria-label="Ver ${esc(p.title)}"><img src="${photo(p)}" alt="${esc(p.title)} — imagem ilustrativa" loading="lazy"></a><span class="tag">${esc(p.purpose)} · ${esc(p.type)}</span><button class="save" data-save="${p.id}" aria-label="${saved ? "Remover dos" : "Adicionar aos"} favoritos" aria-pressed="${saved}">${saved ? "♥" : "♡"}</button></div><div class="property-info"><p class="location">${esc(p.neighborhood)} / ${esc(p.city)}</p><h3><a href="/#/imovel/${p.id}">${esc(p.title)}</a></h3><div class="specs"><span>${p.area} m²</span><span>${p.rooms} quartos</span><span>${p.parking} vagas</span></div><div class="price-row"><strong>${money(p.price)}${p.purpose === "Alugar" ? "<small> / mês</small>" : ""}</strong><a href="/#/imovel/${p.id}" aria-label="Conhecer ${esc(p.title)}">→</a></div></div></article>`;
}
const empty = (title, text) =>
  `<div class="empty"><h3>${title}</h3><p>${text}</p><a class="text-link" href="/#/imoveis">Explorar imóveis →</a></div>`;
function home() {
  return `<section class="hero"><div class="hero-copy"><div class="eyebrow">DOMUS / UM NOVO JEITO DE HABITAR</div><h1>Espaços que<br><span>transformam</span><br>a vida urbana.</h1><p>Mais do que um endereço. Um lugar que faz sentido para quem você é.</p><a class="button yellow" href="/#/imoveis">Encontre seu espaço <span>→</span></a><span class="hero-number">01 — FEITO PARA A SUA PRÓXIMA HISTÓRIA</span></div><div class="hero-media"><img src="/assets/arquitetura.png" alt="Arquitetura de concreto com varanda amarela, identidade visual da Domus"><span class="hero-stamp">FORMAS SIMPLES.<br>NOVAS POSSIBILIDADES.<br>→ DOMUS</span></div></section><div class="search-wrap"><form class="search-bar" id="quick-search">${select("O que você procura?", "purpose", ["Comprar", "Alugar"])}${field("Onde você quer viver?", "q", "search", 'placeholder="Cidade ou bairro"')}${select("Tipo de espaço", "type", [["", "Todos os tipos"], "Casa", "Apartamento", "Comercial"])}<button class="button">Buscar imóveis →</button></form></div><section class="section"><div class="section-top"><div><div class="eyebrow">UMA SELEÇÃO PARA COMEÇAR</div><h2>Seu próximo<br>lugar no mundo.</h2></div><a class="text-link" href="/#/imoveis">Ver todos os imóveis →</a></div><div class="grid">${properties.slice(0, 3).map(card).join("")}</div><p class="demo-note">Catálogo demonstrativo · Fotografias ilustrativas</p></section><section class="manifesto"><div class="manifesto-img"><img src="/assets/arquitetura.png" loading="lazy" alt="Detalhes de concreto e amarelo na fachada"></div><div class="manifesto-copy"><div class="eyebrow">A ESSÊNCIA DOMUS</div><h2>O espaço muda.<br>A vida<br>acontece.</h2><p>Acreditamos em uma cidade feita de encontros. Entre pessoas e lugares. Entre o que você precisa hoje e o que quer construir amanhã.</p><p>Por isso, aproximamos você de espaços com possibilidades reais.</p><a class="text-link" href="/#/sobre">Conheça a Domus →</a></div></section><section class="section"><div class="eyebrow">DO PRIMEIRO CLIQUE À PRÓXIMA PORTA</div><h2>Menos distância.<br>Mais possibilidades.</h2><div class="steps"><div class="step"><span>01 / EXPLORE</span><h3>Encontre o seu ritmo.</h3><p>Escolha a região, o tipo de imóvel e o valor que cabe nos seus planos.</p></div><div class="step"><span>02 / ESCOLHA</span><h3>Guarde o que faz sentido.</h3><p>Salve seus favoritos e veja os detalhes de cada espaço no seu tempo.</p></div><div class="step"><span>03 / CONHEÇA</span><h3>Veja de perto.</h3><p>Solicite uma visita e acompanhe o pedido pela sua conta.</p></div></div></section><section class="cta"><h2>Seu imóvel.<br>Uma nova história.</h2><div><p>Tem um espaço para vender ou alugar? Comece um anúncio pela Domus.</p><a class="button yellow" href="/#/anunciar">Quero anunciar →</a></div></section>`;
}
function catalog(params) {
  return `<section class="page-head"><div class="eyebrow">ENCONTRE SEU ESPAÇO</div><h1>Uma cidade.<br>Muitos jeitos de viver.</h1><p>Explore, compare e escolha um lugar com a sua cara.</p></section><div class="catalog"><div><button class="button light mobile-filter" id="toggle-filters" aria-expanded="false">Filtros +</button><form class="filters" id="filters"><h3>Refine sua busca</h3>${select("Finalidade", "purpose", [["", "Comprar ou alugar"], "Comprar", "Alugar"], params.get("purpose") || "")}${field("Cidade ou bairro", "q", "search", `placeholder="Digite uma região" value="${esc(params.get("q") || "")}"`)}${select("Tipo de imóvel", "type", [["", "Todos os tipos"], "Casa", "Apartamento", "Comercial"], params.get("type") || "")}${field("Preço máximo (R$)", "max", "number", `min="0" placeholder="Sem limite" value="${esc(params.get("max") || "")}"`)}${select(
    "Quartos",
    "rooms",
    [
      ["", "Qualquer quantidade"],
      ["1", "1 ou mais"],
      ["2", "2 ou mais"],
      ["3", "3 ou mais"],
      ["4", "4 ou mais"],
    ],
    params.get("rooms") || "",
  )}<button class="button">Aplicar filtros →</button><button class="button light" type="reset">Limpar filtros</button></form></div><section><div class="results-toolbar"><span id="result-count"></span><label>Ordenar <select id="sort" aria-label="Ordenar imóveis"><option value="recent">Mais recentes</option><option value="low">Menor preço</option><option value="high">Maior preço</option><option value="area">Maior área</option></select></label></div><div id="results" class="grid"></div><p class="demo-note">Catálogo demonstrativo · Fotografias ilustrativas</p></section></div>`;
}
function filterResults() {
  const f = Object.fromEntries(new FormData($("#filters")));
  const norm = (s) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  let list = properties.filter(
    (p) =>
      (!f.purpose || p.purpose === f.purpose) &&
      (!f.type || p.type === f.type) &&
      (!f.q || norm(p.city + " " + p.neighborhood).includes(norm(f.q))) &&
      (!f.max || p.price <= +f.max) &&
      (!f.rooms || p.rooms >= +f.rooms),
  );
  const sort = $("#sort").value;
  list.sort((a, b) =>
    sort === "low"
      ? a.price - b.price
      : sort === "high"
        ? b.price - a.price
        : sort === "area"
          ? b.area - a.area
          : b.id - a.id,
  );
  $("#result-count").textContent =
    `${list.length} ${list.length === 1 ? "espaço encontrado" : "espaços encontrados"}`;
  $("#results").innerHTML = list.length
    ? list.map(card).join("")
    : empty(
        "Ainda não encontramos esse espaço.",
        "Tente outra região ou amplie os filtros de preço e quartos.",
      );
}
function auth(mode) {
  const register = mode === "cadastro",
    reset = mode === "recuperar";
  return `<section class="auth"><div class="auth-copy"><div class="eyebrow">SEU ESPAÇO NA DOMUS</div><h1>${register ? "Novos espaços.<br>Novos começos." : reset ? "Vamos<br>recomeçar." : "Bem-vindo<br>à Domus."}</h1><p>${register ? "Crie sua conta para salvar imóveis, solicitar visitas e anunciar." : reset ? "Use a chave entregue ao criar sua conta para definir uma nova senha." : "Seus favoritos e seus próximos planos, em um só lugar."}</p><form class="form-stack" id="auth-form" data-mode="${mode}">${register ? field("Seu nome", "name", "text", 'required minlength="2" maxlength="100" autocomplete="name"') : ""}${field("E-mail", "email", "email", 'required autocomplete="email"')}${reset ? field("Chave de recuperação", "recovery", "text", 'required autocomplete="off"') : ""}${field(reset ? "Nova senha" : "Senha", "password", "password", `required minlength="8" maxlength="128" autocomplete="${register || reset ? "new-password" : "current-password"}"`)}${register || reset ? field("Confirme a senha", "confirm", "password", 'required minlength="8" autocomplete="new-password"') : ""}<label class="hint"><input type="checkbox" id="show-password"> Mostrar senha</label>${register ? '<label class="hint"><input type="checkbox" required> Li as <a class="text-link" href="/#/privacidade">informações de privacidade</a>.</label>' : ""}<div class="error" role="alert"></div><button class="button">${register ? "Criar minha conta" : reset ? "Redefinir senha" : "Entrar"} →</button><p>${register || reset ? '<a class="text-link" href="/#/login">Voltar para entrar</a>' : 'Ainda não tem conta? <a class="text-link" href="/#/cadastro">Cadastre-se</a>'}</p>${!register && !reset ? '<p><a class="text-link" href="/#/recuperar">Esqueci minha senha</a></p>' : ""}</form></div><div class="auth-image" role="img" aria-label="Fachada de concreto e amarelo"></div></section>`;
}
function detail(id) {
  const p = properties.find((p) => p.id === +id);
  if (!p)
    return `<section class="section">${empty("Imóvel indisponível", "Esse anúncio não está mais disponível. Explore outras opções.")}</section>`;
  return `<section class="detail"><div class="breadcrumbs"><a href="/#/imoveis">Imóveis</a> / ${esc(p.title)}</div><img class="detail-photo" src="${photo(p)}" alt="${esc(p.title)} — fotografia ilustrativa"><div class="detail-layout"><div><div class="eyebrow">${esc(p.type)} / ${esc(p.purpose)} / DOMUS ${p.id.toString().padStart(3, "0")}</div><h1>${esc(p.title)}</h1><p>${esc(p.neighborhood)}, ${esc(p.city)}</p><div class="specs"><span>${p.area} m² de área</span><span>${p.rooms} quartos</span><span>${p.baths} banheiros</span><span>${p.parking} vagas</span></div><h3>Sobre este espaço</h3><p>${esc(p.description)}</p><button class="button light" data-detail-save="${p.id}">${account.favorites.includes(p.id) ? "♥ Salvo nos favoritos" : "♡ Salvar nos favoritos"}</button><p class="demo-note">Imóvel demonstrativo. A imagem é ilustrativa e não representa um endereço verificado.</p></div><aside class="booking"><span>${p.purpose === "Alugar" ? "Aluguel mensal" : "Valor de venda"}</span><strong>${money(p.price)}</strong><h3>Imagine sua vida aqui.</h3><p>Solicite uma visita. O horário será confirmado pelo responsável pelo anúncio.</p><form id="visit-form" class="form-stack" data-id="${p.id}">${field("Melhor dia", "day", "date", 'required min="' + new Date(Date.now() + 86400000).toLocaleDateString("en-CA") + '"')}${select("Período", "period", ["Manhã", "Tarde"])}<div class="error" role="alert"></div><button class="button">${me ? "Solicitar visita" : "Entrar para solicitar"} →</button></form></aside></div></section>`;
}
function accountPage() {
  if (!me) return auth("login");
  return `<section class="page-head"><div class="eyebrow">MINHA DOMUS</div><h1>Olá, ${esc(me.name.split(" ")[0])}.</h1><p>Seu próximo capítulo começa por aqui.</p></section><section class="dashboard"><div class="section-top"><span>${esc(me.email)} · ${esc(me.role)}</span><button class="button light small" id="logout">Sair da conta →</button></div><div class="tabs" role="tablist" aria-label="Sua conta">${[["favorites", "Favoritos"], ["visits", "Minhas visitas"], ["listings", "Meus anúncios"], ["requests", "Visitas recebidas"], ...(me.role === "administrador" ? [["admin", "Administração"]] : [])].map(([key, label]) => `<button role="tab" data-tab="${key}" aria-selected="${activeTab === key}">${label}</button>`).join("")}</div><div id="account-panel" role="tabpanel">${accountPanel()}</div></section>`;
}
let adminData = null;
function accountPanel() {
  if (activeTab === "admin" && adminData) {
    return `<h3>Mensagens recebidas</h3>${adminData.messages.map((m) => `<article class="visit"><div><strong>${esc(m.name)} · ${esc(m.email)}</strong><p>${esc(m.message)}</p></div></article>`).join("") || "<p>Nenhuma mensagem recebida.</p>"}<h3>Perfis de acesso</h3>${adminData.users.map((u) => `<article class="visit"><div>${esc(u.name)} · ${esc(u.email)}<br><span class="status">${esc(u.role)}</span></div>${u.role !== "administrador" ? `<button class="button small light" data-role-user="${u.id}" data-role="${u.role === "corretor" ? "cliente" : "corretor"}">${u.role === "corretor" ? "Tornar cliente" : "Habilitar corretor"}</button>` : ""}</article>`).join("")}<h3>Moderação de anúncios</h3>${adminData.listings.map((p) => `<article class="visit"><div>${esc(p.title)}<br><span class="status">${p.active ? "Publicado" : "Pausado"}</span></div><button class="button small light" data-listing="${p.id}" data-active="${p.active ? 0 : 1}">${p.active ? "Pausar" : "Publicar"}</button></article>`).join("")}`;
  }
  if (activeTab === "favorites") {
    const list = properties.filter((p) => account.favorites.includes(p.id));
    return list.length
      ? `<div class="grid">${list.map(card).join("")}</div>`
      : empty(
          "Um lugar para os seus preferidos.",
          "Toque no coração de um imóvel para encontrá-lo aqui.",
        );
  }
  if (activeTab === "listings")
    return `<a class="button" href="/#/anunciar">Novo anúncio +</a>${account.listings.length ? account.listings.map((p) => `<article class="visit"><div><h3>${esc(p.title)}</h3><p>${esc(p.city)} · ${money(p.price)}</p><span class="status">${p.active ? "Publicado" : "Pausado"}</span></div><a class="button light small" href="/#/editar/${p.id}">Editar</a><button class="button light small" data-listing="${p.id}" data-active="${p.active ? 0 : 1}">${p.active ? "Pausar anúncio" : "Publicar novamente"}</button></article>`).join("") : '<p class="hint">Seus anúncios publicados aparecerão aqui.</p>'}`;
  const requests = activeTab === "requests",
    list = account[activeTab];
  return list.length
    ? list
        .map(
          (v) =>
            `<article class="visit"><div><h3>${esc(v.title)}</h3><p>${esc(v.day.split("-").reverse().join("/"))} · ${esc(v.period)}</p>${requests ? `<p>${esc(v.name)} · ${esc(v.email)}</p>` : ""}<span class="status">${esc(v.status)}</span></div><div class="inline-actions">${v.status !== "Cancelada" ? `${requests && v.status !== "Confirmada" ? `<button class="button small" data-visit="${v.id}" data-status="Confirmada">Confirmar</button>` : ""}<button class="button light small" data-visit="${v.id}" data-status="Cancelada">Cancelar visita</button>` : ""}</div></article>`,
        )
        .join("")
    : empty(
        requests
          ? "Nenhum pedido recebido."
          : "Sua próxima visita começa aqui.",
        requests
          ? "Pedidos de visita aos seus anúncios aparecerão aqui."
          : "Encontre um imóvel e escolha uma data para solicitar uma visita.",
      );
}
function listing(edit = false) {
  if (!me) {
    sessionStorage.setItem("domus-next", location.hash.slice(1));
    return auth("login");
  }
  return `<section class="page-head"><div class="eyebrow">ANUNCIE NA DOMUS</div><h1>${edit ? "Ajuste os detalhes.<br>Abra possibilidades." : "Abra espaço<br>para novas histórias."}</h1><p>Preencha os detalhes do imóvel. Você poderá pausar o anúncio pela sua conta.</p></section><section class="section contact-layout"><div><h2>Seu espaço,<br>em detalhe.</h2><p>Informações claras ajudam quem procura a encontrar o lugar certo.</p><p class="hint">Inclua uma foto do imóvel em PNG ou JPEG, com até 4 MB. Sem foto, usaremos a imagem institucional. Não publique dados pessoais na descrição.</p></div><form class="form-stack" id="listing-form">${field("Título do anúncio", "title", "text", 'required maxlength="100" placeholder="Ex.: Casa com jardim em Santa Mônica"')}<div class="row">${field("Cidade", "city", "text", 'required maxlength="100"')}${field("Bairro", "neighborhood", "text", 'required maxlength="100"')}</div><div class="row">${select("Tipo", "type", ["Casa", "Apartamento", "Comercial"])}${select("Finalidade", "purpose", ["Comprar", "Alugar"])}</div><div class="row">${field("Preço de venda ou aluguel (R$)", "price", "number", 'required min="1" max="1000000000" step="0.01"')}${field("Área (m²)", "area", "number", 'required min="1" step="0.01"')}</div><div class="row">${field("Quartos", "rooms", "number", 'required min="0" value="0"')}${field("Banheiros", "baths", "number", 'required min="0" value="1"')}</div>${field("Vagas de garagem", "parking", "number", 'required min="0" value="0"')}<label class="field">Descrição<textarea name="description" required maxlength="3000" placeholder="Conte o que torna este espaço especial."></textarea></label>${field("Foto do imóvel (opcional)", "photo", "file", 'accept="image/png,image/jpeg"')}<div class="error" role="alert"></div><button class="button">${edit ? "Salvar alterações" : "Publicar anúncio"} →</button></form></section>`;
}
function about() {
  return `<section class="page-head"><div class="eyebrow">SOBRE A DOMUS</div><h1>Entre pessoas.<br>Entre possibilidades.</h1><p>Uma imobiliária pensada para aproximar você do seu próximo lugar.</p></section><section class="manifesto"><div class="manifesto-img"><img src="/assets/arquitetura.png" alt="Arquitetura da identidade Domus"></div><div class="manifesto-copy"><h2>Habitar é<br>pertencer.</h2><p>Uma casa guarda rotinas, encontros e planos. A Domus nasce da vontade de tornar a procura por esse espaço mais simples e humana.</p><p>Reunimos busca, favoritos, anúncios e pedidos de visita em uma experiência contínua, com informações claras em cada etapa.</p><a class="text-link" href="/#/imoveis">Encontre seu espaço →</a></div></section><section class="section"><div class="eyebrow">NO QUE ACREDITAMOS</div><div class="steps"><div class="step"><span>01</span><h3>Clareza para escolher.</h3><p>Informações acessíveis e caminhos diretos para tomar decisões.</p></div><div class="step"><span>02</span><h3>Espaços para pessoas.</h3><p>Diferentes rotinas pedem diferentes formas de morar e trabalhar.</p></div><div class="step"><span>03</span><h3>Uma cidade mais próxima.</h3><p>Conexões entre quem tem um imóvel e quem busca um novo começo.</p></div></div><p class="demo-note">Domus é um projeto acadêmico de sistema imobiliário. O catálogo inicial é fictício.</p></section>`;
}
function contact() {
  return `<section class="page-head"><div class="eyebrow">VAMOS CONVERSAR</div><h1>Fale com<br>a Domus.</h1><p>Uma dúvida, uma ideia ou um novo começo.</p></section><section class="section contact-layout"><div><h2>Todo encontro<br>começa com<br>uma conversa.</h2><p>Conte como podemos ajudar. Sua mensagem será registrada no sistema.</p><p class="hint">Projeto acadêmico: não há uma equipe comercial nem envio automático de e-mail nesta versão.</p></div><form class="form-stack" id="contact-form">${field("Nome", "name", "text", 'required maxlength="100" autocomplete="name"')}${field("E-mail", "email", "email", 'required autocomplete="email"')}<label class="field">Sua mensagem<textarea name="message" required minlength="10" maxlength="5000"></textarea></label><div class="error" role="alert"></div><button class="button">Registrar mensagem →</button></form></section>`;
}
async function refresh() {
  [properties, me] = await Promise.all([api("properties"), api("me")]);
  account = me
    ? await api("account")
    : { favorites: [], visits: [], listings: [], requests: [] };
  adminData = me?.role === "administrador" ? await api("admin") : null;
  if (activeTab === "admin" && !adminData) activeTab = "favorites";
  $(".account-link").textContent = me ? "Minha Domus →" : "Minha conta →";
  $(".account-link").href = me ? "/#/conta" : "/#/login";
}
async function render() {
  const id = ++renderId;
  try {
    await refresh();
    if (id !== renderId) return;
    const [route, query = ""] = (location.hash.slice(2) || "").split("?");
    const params = new URLSearchParams(query);
    main.innerHTML =
      route === ""
        ? home()
        : route === "imoveis"
          ? catalog(params)
          : route.startsWith("imovel/")
            ? detail(route.split("/")[1])
            : ["login", "cadastro", "recuperar"].includes(route)
              ? auth(route)
              : route === "conta"
                ? accountPage()
                : route === "anunciar"
                  ? listing()
                  : route.startsWith("editar/")
                    ? listing(true)
                    : route === "sobre"
                      ? about()
                      : route === "contato"
                        ? contact()
                        : route === "privacidade"
                          ? `<section class="section"><div class="eyebrow">PRIVACIDADE</div><h1>Seus dados.</h1><p>Este projeto acadêmico salva nome, e-mail, senha protegida por hash, favoritos, anúncios, mensagens e pedidos de visita no banco do servidor. Um cookie de sessão mantém sua conta conectada por até 24 horas.</p><p>O nome e o e-mail de quem solicita uma visita ficam visíveis ao responsável pelo anúncio. Não informe dados sensíveis. Fontes e fotografias são carregadas de Google Fonts e Unsplash.</p><p>Para excluir seus dados, solicite ao responsável pela instalação. A chave de recuperação substitui o envio de e-mail e deve ser guardada em local seguro.</p><a class="text-link" href="/#/cadastro">Voltar ao cadastro →</a></section>`
                          : `<section class="section">${empty("Página não encontrada.", "Vamos encontrar outro caminho.")}</section>`;
    document.title = `${route === "imoveis" ? "Encontre seu imóvel" : route === "conta" ? "Minha conta" : "Espaços para viver"} | Domus`;
    document
      .querySelectorAll("nav a")
      .forEach((a) =>
        a.setAttribute(
          "aria-current",
          a.hash === location.hash ? "page" : "false",
        ),
      );
    $("header").classList.remove("open");
    $(".menu-toggle").setAttribute("aria-expanded", "false");
    if (route === "imoveis") filterResults();
    if (route.startsWith("editar/") && me) {
      const p = account.listings.find((p) => p.id === +route.split("/")[1]);
      if (p) {
        const form = $("#listing-form");
        form.dataset.id = p.id;
        for (const [key, value] of Object.entries(p)) {
          const input = form.elements.namedItem(key);
          if (input && input.type !== "file") input.value = value;
        }
      } else {
        main.innerHTML = empty(
          "Anúncio não encontrado.",
          "Você só pode editar seus próprios anúncios.",
        );
      }
    }
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  } catch (e) {
    main.innerHTML =
      '<section class="section"><h2>Não conseguimos carregar.</h2><p>Verifique se o servidor está disponível e tente novamente.</p><button class="button" id="retry">Tentar novamente</button></section>';
  }
}
document.addEventListener("click", async (e) => {
  if (e.target.closest(".skip")) {
    e.preventDefault();
    main.focus();
    return;
  }
  const el = e.target.closest("button");
  if (!el) return;
  try {
    if (el.matches(".menu-toggle")) {
      const open = $("header").classList.toggle("open");
      el.setAttribute("aria-expanded", open);
      return;
    }
    if (el.matches(".close")) return $("#modal").close();
    if (el.id === "retry") return render();
    if (el.id === "toggle-filters") {
      const open = $(".filters").classList.toggle("visible");
      el.setAttribute("aria-expanded", open);
      return;
    }
    if (el.dataset.tab) {
      activeTab = el.dataset.tab;
      main.innerHTML = accountPage();
      return;
    }
    if (el.id === "logout") {
      await api("logout", {});
      location.hash = "/login";
      return;
    }
    const pid = el.dataset.save || el.dataset.detailSave;
    if (pid) {
      if (!me) {
        sessionStorage.setItem("domus-next", location.hash.slice(1));
        notice("Entre para salvar seus favoritos.");
        location.hash = "/login";
        return;
      }
      el.disabled = true;
      await api("favorite", {
        id: +pid,
        saved: !account.favorites.includes(+pid),
      });
      account = await api("account");
      const saved = account.favorites.includes(+pid);
      document.querySelectorAll(`[data-save="${pid}"]`).forEach((b) => {
        b.textContent = saved ? "♥" : "♡";
        b.setAttribute("aria-pressed", saved);
        b.setAttribute(
          "aria-label",
          saved ? "Remover dos favoritos" : "Adicionar aos favoritos",
        );
      });
      if (el.dataset.detailSave)
        el.textContent = saved
          ? "♥ Salvo nos favoritos"
          : "♡ Salvar nos favoritos";
      if (location.hash === "/conta")
        $("#account-panel").innerHTML = accountPanel();
      notice(
        saved
          ? "Imóvel salvo nos favoritos."
          : "Imóvel removido dos favoritos.",
      );
      return;
    }
    if (el.dataset.roleUser) {
      await api("admin-role", {
        id: +el.dataset.roleUser,
        role: el.dataset.role,
      });
      await refresh();
      $("#account-panel").innerHTML = accountPanel();
      notice("Perfil atualizado.");
    }
    if (el.dataset.visit) {
      await api("visit-status", {
        id: +el.dataset.visit,
        status: el.dataset.status,
      });
      await refresh();
      $("#account-panel").innerHTML = accountPanel();
      notice("Status da visita atualizado.");
    }
    if (el.dataset.listing) {
      await api("listing-status", {
        id: +el.dataset.listing,
        active: el.dataset.active === "1",
      });
      await refresh();
      $("#account-panel").innerHTML = accountPanel();
      notice("Anúncio atualizado.");
    }
  } catch (err) {
    notice(err.message);
  } finally {
    el.disabled = false;
  }
});
document.addEventListener("change", (e) => {
  if (e.target.id === "sort") filterResults();
  if (e.target.id === "show-password")
    document
      .querySelectorAll("[name=password],[name=confirm]")
      .forEach((i) => (i.type = e.target.checked ? "text" : "password"));
});
document.addEventListener("reset", (e) => {
  if (e.target.id === "filters") {
    e.preventDefault();
    location.hash = "/imoveis";
    if (!location.hash.includes("?")) {
      $("#filters")
        .querySelectorAll("input,select")
        .forEach((i) => (i.value = ""));
      filterResults();
    }
  }
});
document.addEventListener("submit", async (e) => {
  const form = e.target;
  if (!form.matches("form")) return;
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  if (form.id === "quick-search" || form.id === "filters") {
    location.hash = "/imoveis?" + new URLSearchParams(data);
    return;
  }
  const button = $("button[type=submit],button:not([type])", form),
    error = $(".error", form);
  if (error) error.textContent = "";
  if (button) button.disabled = true;
  try {
    if (form.id === "auth-form") {
      const mode = form.dataset.mode;
      if (mode !== "login" && data.password !== data.confirm)
        throw Error("As senhas não conferem.");
      const result = await api(
        mode === "cadastro"
          ? "register"
          : mode === "recuperar"
            ? "reset"
            : "login",
        data,
      );
      if (mode === "login") {
        const next = sessionStorage.getItem("domus-next");
        sessionStorage.removeItem("domus-next");
        location.hash = next?.startsWith("/") ? next : "/conta";
      } else {
        $("#modal-content").innerHTML =
          `<div class="eyebrow">${mode === "cadastro" ? "CONTA CRIADA" : "SENHA ALTERADA"}</div><h2>Guarde sua chave.</h2><p>Você precisará dela para recuperar a conta. Ela aparece somente agora. Não compartilhe com outras pessoas.</p><code class="recovery">${esc(result.recovery)}</code><button class="button" id="continue-login">Guardei. Quero entrar →</button>`;
        $("#modal").showModal();
        $("#continue-login").onclick = () => {
          $("#modal").close();
          location.hash = "/login";
        };
      }
    }
    if (form.id === "visit-form") {
      if (!me) {
        sessionStorage.setItem("domus-next", location.hash.slice(1));
        notice("Entre na sua conta para solicitar a visita.");
        location.hash = "/login";
        return;
      }
      await api("visit", { ...data, id: +form.dataset.id });
      notice("Visita solicitada. Aguarde a confirmação do responsável.");
      activeTab = "visits";
      location.hash = "/conta";
    }
    if (form.id === "listing-form") {
      const file = data.photo;
      delete data.photo;
      if (file?.size) {
        if (file.size > 4000000) throw Error("Use uma foto de até 4 MB.");
        data.photo = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(",")[1]);
          reader.onerror = () => reject(Error("Não foi possível ler a foto."));
          reader.readAsDataURL(file);
        });
      }
      if (form.dataset.id) data.id = +form.dataset.id;
      await api("listing", data);
      activeTab = "listings";
      notice(
        form.dataset.id ? "Anúncio atualizado." : "Seu anúncio foi publicado.",
      );
      location.hash = "/conta";
    }
    if (form.id === "contact-form") {
      await api("contact", data);
      form.reset();
      notice("Mensagem registrada no sistema.");
    }
  } catch (err) {
    if (error) error.textContent = err.message;
    else notice(err.message);
  } finally {
    if (button) button.disabled = false;
  }
});
$("#year").textContent = new Date().getFullYear();
const legacy = {
  "indexDomus.html": "",
  "outroIndex.html": "",
  "sobre.html": "sobre",
  "contato.html": "contato",
  "cadastro.html": "cadastro",
  "loginDomus.html": "login",
  "recuperarSenha.html": "recuperar",
  "cliente.html": "conta",
  "paginaClienteDomus.html": "conta",
  "corretor.html": "conta",
  "administracao.html": "conta",
  "projetos.html": "imoveis",
};
if (!location.hash && Object.hasOwn(legacy, location.pathname.slice(1)))
  history.replaceState(null, "", "/#/" + legacy[location.pathname.slice(1)]);
window.addEventListener("hashchange", render);
render();
