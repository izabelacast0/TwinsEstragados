// Somente demonstração: dados locais não são autenticação nem registros compartilhados.
export function createDemoStore({
  catalog,
  accounts = [],
  storage = localStorage,
  session = sessionStorage,
  cryptoApi = crypto,
}) {
  const key = "domus-demo-v1";
  const cleanUser = ({ id, name, email, role }) => ({ id, name, email, role });
  const initial = () => ({
    users: [
      {
        id: 1,
        name: "Cliente Demo",
        email: "cliente@domus.example",
        role: "cliente",
      },
      {
        id: 2,
        name: "Corretora Demo",
        email: "corretora@domus.example",
        role: "corretor",
      },
      {
        id: 3,
        name: "Admin Demo",
        email: "admin@domus.example",
        role: "administrador",
      },
    ],
    properties: catalog.map((p) => ({ ...p, owner: 2 })),
    favorites: [],
    visits: [],
    messages: [],
  });
  const load = () => {
    try {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : initial();
    } catch {
      throw Error(
        "Não foi possível ler os dados locais. Use “Limpar demonstração” para recomeçar.",
      );
    }
  };
  const save = (s) => {
    try {
      storage.setItem(key, JSON.stringify(s));
    } catch {
      throw Error(
        "O navegador não conseguiu salvar. Use uma foto menor ou libere espaço nos dados do site.",
      );
    }
  };
  const next = (rows) => Math.max(0, ...rows.map((r) => r.id)) + 1;
  const random = () =>
    Array.from(cryptoApi.getRandomValues(new Uint8Array(24)), (n) =>
      n.toString(16).padStart(2, "0"),
    ).join("");
  const digest = async (text) =>
    Array.from(
      new Uint8Array(
        await cryptoApi.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(text),
        ),
      ),
      (n) => n.toString(16).padStart(2, "0"),
    ).join("");
  const password = async (value, salt) => {
    const key = await cryptoApi.subtle.importKey(
      "raw",
      new TextEncoder().encode(value),
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    return Array.from(
      new Uint8Array(
        await cryptoApi.subtle.deriveBits(
          {
            name: "PBKDF2",
            salt: new TextEncoder().encode(salt),
            iterations: 100000,
            hash: "SHA-256",
          },
          key,
          256,
        ),
      ),
      (n) => n.toString(16).padStart(2, "0"),
    ).join("");
  };
  const required = (ok, message) => {
    if (!ok) throw Error(message);
  };
  return async function api(path, data) {
    if (path === "demo-clear") {
      storage.removeItem(key);
      session.removeItem(key);
      return { ok: true };
    }
    const s = load(),
      u = s.users.find((u) => u.id === Number(session.getItem(key)));
    if (path === "properties")
      return structuredClone(s.properties.filter((p) => p.active));
    if (path === "me") return u ? cleanUser(u) : null;
    if (path === "demo-login") {
      const demo = s.users.find((u) => u.id <= 3 && u.role === data.role);
      required(demo, "Perfil indisponível.");
      session.setItem(key, String(demo.id));
      return { ok: true };
    }
    // Contas públicas de apresentação; não autenticação de produção.
    if (path === "login") {
      const login = String(data.email || "").trim().toLowerCase();
      const preset = accounts.find((a) => a.login === login || a.email === login);
      if (preset) {
        required(String(data.password || "") === preset.password, "Usuário ou senha incorretos.");
        const existing = s.users.find((a) => a.id === preset.id);
        required(existing, "Perfil indisponível.");
        Object.assign(existing, cleanUser(preset));
        save(s);
        session.setItem(key, String(preset.id));
        return { ok: true };
      }
    }
    if (["register", "login", "reset"].includes(path)) {
      const email = String(data.email || "")
          .trim()
          .toLowerCase(),
        pw = String(data.password || "");
      required(
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
        "Informe um e-mail válido.",
      );
      const row = s.users.find((u) => u.email === email);
      if (path === "register") {
        required(!row, "Este e-mail já está cadastrado neste navegador.");
        required(
          String(data.name || "").trim().length >= 2 &&
            pw.length >= 8 &&
            pw.length <= 128,
          "Informe nome e senha com pelo menos 8 caracteres.",
        );
        const salt = random(),
          recovery = random();
        s.users.push({
          id: next(s.users),
          name: data.name.trim(),
          email,
          role: data.role === "corretor" ? "corretor" : "cliente",
          salt,
          password: await password(pw, salt),
          recovery: await digest(recovery),
        });
        save(s);
        return { recovery };
      }
      if (path === "reset") {
        required(
          row?.recovery &&
            row.recovery === (await digest(String(data.recovery || ""))),
          "E-mail ou chave de recuperação inválidos.",
        );
        required(
          pw.length >= 8 && pw.length <= 128,
          "Use uma senha de 8 a 128 caracteres.",
        );
        const recovery = random();
        row.salt = random();
        row.password = await password(pw, row.salt);
        row.recovery = await digest(recovery);
        save(s);
        session.removeItem(key);
        return { recovery };
      }
      required(
        row?.password && row.password === (await password(pw, row.salt)),
        "E-mail ou senha incorretos.",
      );
      session.setItem(key, String(row.id));
      return { ok: true };
    }
    if (path === "contact") {
      required(
        data.name && data.email && data.message?.trim().length >= 10,
        "Preencha todos os campos.",
      );
      s.messages.push({
        id: next(s.messages),
        name: data.name,
        email: data.email,
        message: data.message,
        created: Date.now() / 1000,
      });
      save(s);
      return { ok: true };
    }
    required(u, "Entre em um perfil para continuar.");
    if (path === "logout") {
      session.removeItem(key);
      return { ok: true };
    }
    if (path === "account")
      return {
        favorites: s.favorites
          .filter((f) => f.user_id === u.id)
          .map((f) => f.property_id),
        listings: s.properties.filter((p) => p.owner === u.id),
        visits: s.visits
          .filter((v) => v.user_id === u.id)
          .map((v) => ({
            ...v,
            title: s.properties.find((p) => p.id === v.property_id)?.title,
          })),
        requests: s.visits
          .filter(
            (v) =>
              u.role === "administrador" ||
              s.properties.find((p) => p.id === v.property_id)?.owner === u.id,
          )
          .map((v) => ({
            ...v,
            title: s.properties.find((p) => p.id === v.property_id)?.title,
            ...Object.fromEntries(
              ["name", "email"].map((k) => [
                k,
                s.users.find((a) => a.id === v.user_id)?.[k],
              ]),
            ),
          })),
      };
    if (path === "admin") {
      required(
        u.role === "administrador",
        "Acesso restrito ao perfil administrador de demonstração.",
      );
      return {
        users: s.users.map(cleanUser),
        listings: s.properties,
        messages: s.messages,
      };
    }
    if (path === "favorite") {
      required(
        s.properties.some((p) => p.id === data.id && p.active),
        "Imóvel indisponível.",
      );
      s.favorites = s.favorites.filter(
        (f) => !(f.user_id === u.id && f.property_id === data.id),
      );
      if (data.saved) s.favorites.push({ user_id: u.id, property_id: data.id });
    } else if (path === "visit") {
      required(
        s.properties.some((p) => p.id === data.id && p.active),
        "Imóvel indisponível.",
      );
      const parsed = new Date(data.day + "T12:00:00Z");
      required(
        /^\d{4}-\d{2}-\d{2}$/.test(data.day) &&
          Number.isFinite(parsed.getTime()) &&
          parsed.toISOString().slice(0, 10) === data.day &&
          data.day > new Date().toLocaleDateString("en-CA") &&
          ["Manhã", "Tarde"].includes(data.period),
        "Escolha uma data futura e um período válido.",
      );
      required(
        !s.visits.some(
          (v) =>
            v.user_id === u.id &&
            v.property_id === data.id &&
            v.day === data.day &&
            v.period === data.period,
        ),
        "Você já solicitou essa visita.",
      );
      s.visits.push({
        id: next(s.visits),
        user_id: u.id,
        property_id: data.id,
        day: data.day,
        period: data.period,
        status: "Solicitada",
      });
    } else if (path === "visit-status") {
      const v = s.visits.find((v) => v.id === data.id),
        p = s.properties.find((p) => p.id === v?.property_id);
      required(
        v &&
          ((v.user_id === u.id && data.status === "Cancelada") ||
            ((p.owner === u.id || u.role === "administrador") &&
              ["Confirmada", "Cancelada"].includes(data.status))),
        "Ação não permitida.",
      );
      v.status = data.status;
    } else if (path === "listing") {
      required(u.role === "corretor" || u.role === "administrador", "Entre como corretor para anunciar imóveis.");
      const old = data.id
        ? s.properties.find((p) => p.id === data.id && p.owner === u.id)
        : null;
      required(!data.id || old, "Anúncio não encontrado.");
      const p = {};
      for (const k of [
        "title",
        "city",
        "neighborhood",
        "type",
        "purpose",
        "description",
      ]) {
        p[k] = String(data[k] || "").trim();
        required(
          p[k] && p[k].length <= 3000,
          "Preencha todos os dados do imóvel.",
        );
      }
      required(
        ["Casa", "Apartamento", "Comercial"].includes(p.type) &&
          ["Comprar", "Alugar"].includes(p.purpose),
        "Tipo ou finalidade inválidos.",
      );
      for (const k of ["price", "area", "rooms", "baths", "parking"]) {
        p[k] = Number(data[k]);
        required(
          Number.isFinite(p[k]) && p[k] >= 0 && p[k] <= 1e9,
          "Informe valores válidos.",
        );
      }
      required(
        p.price > 0 &&
          p.area > 0 &&
          ["rooms", "baths", "parking"].every((k) => Number.isInteger(p[k])),
        "Informe área, preço e quantidades válidas.",
      );
      p.image = old?.image || "";
      if (data.photo) {
        required(
          data.photo.length < 1500000,
          "Na demonstração, use fotos menores que 1 MB.",
        );
        const raw = atob(data.photo),
          mime = raw.startsWith("\x89PNG\r\n\x1a\n")
            ? "image/png"
            : raw.startsWith("\xff\xd8\xff")
              ? "image/jpeg"
              : null;
        required(mime, "Use uma imagem PNG ou JPEG.");
        p.image = `data:${mime};base64,${data.photo}`;
      }
      if (old) Object.assign(old, p);
      else
        s.properties.push({
          ...p,
          id: next(s.properties),
          owner: u.id,
          active: 1,
        });
    } else if (path === "listing-status") {
      const p = s.properties.find(
        (p) =>
          p.id === data.id && (p.owner === u.id || u.role === "administrador"),
      );
      required(p, "Anúncio não encontrado.");
      p.active = data.active ? 1 : 0;
    } else if (path === "admin-role") {
      required(
        u.role === "administrador" &&
          ["cliente", "corretor"].includes(data.role),
        "Ação não permitida.",
      );
      const target = s.users.find((a) => a.id === data.id && a.id > 3);
      required(
        target,
        "Os perfis prontos de demonstração não podem ser alterados.",
      );
      target.role = data.role;
    } else throw Error("Operação indisponível na demonstração.");
    save(s);
    return { ok: true };
  };
}
