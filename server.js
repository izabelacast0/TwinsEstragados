import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import {
  randomBytes,
  pbkdf2Sync,
  createHash,
  timingSafeEqual,
} from "node:crypto";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  realpathSync,
  statSync,
} from "node:fs";
import { resolve, dirname, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const seed = [
  [
    "Casa entre jardins",
    "Uberlândia",
    "Jardim Karaíba",
    "Casa",
    "Comprar",
    890000,
    210,
    3,
    3,
    2,
    "Um projeto de linhas simples, ambientes integrados e um jardim para desacelerar.",
    "photo-1600596542815-ffad4c1539a9",
  ],
  [
    "Luz em cada detalhe",
    "Uberlândia",
    "Santa Mônica",
    "Apartamento",
    "Alugar",
    2400,
    84,
    2,
    2,
    1,
    "Luz natural, varanda e uma planta que acompanha sua rotina.",
    "photo-1600607687920-4e2a09cf159d",
  ],
  [
    "Arquitetura para viver",
    "Uberlândia",
    "Granja Marileusa",
    "Casa",
    "Comprar",
    1250000,
    280,
    4,
    4,
    3,
    "Espaço para reunir, trabalhar e viver com tranquilidade.",
    "photo-1600047509807-ba8f99d2cdde",
  ],
  [
    "Seu primeiro endereço",
    "Uberlândia",
    "Centro",
    "Apartamento",
    "Comprar",
    320000,
    62,
    2,
    1,
    1,
    "Uma base prática perto dos serviços e dos encontros da cidade.",
    "photo-1600566753086-00f18fb6b3ea",
  ],
  [
    "Um novo ritmo",
    "Araguari",
    "Centro",
    "Casa",
    "Alugar",
    3200,
    160,
    3,
    2,
    2,
    "Quintal amplo e espaços flexíveis para uma vida mais leve.",
    "photo-1600607687939-ce8a6c25118c",
  ],
  [
    "Espaço para criar",
    "Uberlândia",
    "Tibery",
    "Comercial",
    "Alugar",
    1800,
    55,
    0,
    1,
    1,
    "Um espaço versátil para tirar seus próximos projetos do papel.",
    "photo-1497366754035-f200968a6e72",
  ],
];
const hash = (value) => createHash("sha256").update(value).digest("hex");
const password = (value, salt) =>
  pbkdf2Sync(value, salt, 260000, 32, "sha256").toString("hex");
const equal = (a, b) =>
  typeof a === "string" &&
  typeof b === "string" &&
  a.length === b.length &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));
const random = (size = 24) => randomBytes(size).toString("base64url");
class HttpError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const fail = (message, status = 400) => {
  throw new HttpError(message, status);
};
const text = (value) => (typeof value === "string" ? value.trim() : "");
const idOf = (value) => {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1) fail("Identificador inválido.");
  return n;
};
const emailValid = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;

export function createApp({
  dbPath = process.env.DOMUS_DB || resolve(ROOT, "domus.sqlite3"),
  webRoot = resolve(ROOT, "web"),
  uploadRoot = resolve(webRoot, "uploads"),
} = {}) {
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,role TEXT NOT NULL DEFAULT 'cliente',name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,salt TEXT NOT NULL,password TEXT NOT NULL,recovery TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS attempts(ip TEXT,created REAL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id INTEGER REFERENCES users(id),expires REAL);
 CREATE TABLE IF NOT EXISTS properties(id INTEGER PRIMARY KEY,owner INTEGER REFERENCES users(id),title TEXT,city TEXT,neighborhood TEXT,type TEXT,purpose TEXT,price REAL,area REAL,rooms INTEGER,baths INTEGER,parking INTEGER,description TEXT,image TEXT,active INTEGER DEFAULT 1);
 CREATE TABLE IF NOT EXISTS favorites(user_id INTEGER REFERENCES users(id),property_id INTEGER REFERENCES properties(id),PRIMARY KEY(user_id,property_id));
 CREATE TABLE IF NOT EXISTS visits(id INTEGER PRIMARY KEY,user_id INTEGER REFERENCES users(id),property_id INTEGER REFERENCES properties(id),day TEXT,period TEXT,status TEXT DEFAULT 'Solicitada',UNIQUE(user_id,property_id,day,period));
 CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY,name TEXT,email TEXT,message TEXT,created REAL);`);
  const get = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  if (!all("PRAGMA table_info(users)").some((r) => r.name === "role"))
    db.exec(
      "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'cliente'",
    );
  if (!get("SELECT 1 FROM properties"))
    for (const row of seed)
      run(
        "INSERT INTO properties(title,city,neighborhood,type,purpose,price,area,rooms,baths,parking,description,image) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
        ...row,
      );
  const transaction = (fn) => {
    db.exec("BEGIN");
    try {
      const result = fn();
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  };
  const session = (req) =>
    (req.headers.cookie || "")
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("domus_session="))
      ?.slice(14) || "";
  const user = (req) =>
    get(
      "SELECT u.id,u.name,u.email,u.role FROM users u JOIN sessions s ON u.id=s.user_id WHERE s.token=? AND s.expires>?",
      session(req),
      Date.now() / 1000,
    );
  const json = (res, body, status = 200, cookie) => {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...(cookie ? { "Set-Cookie": cookie } : {}),
    });
    res.end(JSON.stringify(body));
  };
  async function body(req) {
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 6000000) fail("Conteúdo muito grande.", 413);
      chunks.push(chunk);
    }
    let data;
    try {
      data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      fail("JSON inválido.");
    }
    if (!data || typeof data !== "object" || Array.isArray(data))
      fail("Dados inválidos.");
    return data;
  }
  const requireUser = (req) => {
    const u = user(req);
    if (!u) fail("Entre na sua conta para continuar.", 401);
    return u;
  };
  const requireAdmin = (u) => {
    if (u.role !== "administrador") fail("Acesso restrito.", 403);
  };
  const server = createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "same-origin");
    try {
      const path = new URL(req.url, "http://localhost").pathname;
      if (req.method === "GET" && path.startsWith("/api/")) {
        if (path === "/api/properties")
          return json(res, all("SELECT * FROM properties WHERE active=1"));
        if (path === "/api/me") return json(res, user(req) || null);
        const u = requireUser(req);
        if (path === "/api/admin") {
          requireAdmin(u);
          return json(res, {
            messages: all("SELECT * FROM messages ORDER BY id DESC"),
            users: all("SELECT id,name,email,role FROM users"),
            listings: all("SELECT * FROM properties"),
          });
        }
        if (path === "/api/account")
          return json(res, {
            favorites: all(
              "SELECT property_id FROM favorites WHERE user_id=?",
              u.id,
            ).map((r) => r.property_id),
            visits: all(
              "SELECT v.*,p.title FROM visits v JOIN properties p ON p.id=v.property_id WHERE v.user_id=? ORDER BY day",
              u.id,
            ),
            listings: all("SELECT * FROM properties WHERE owner=?", u.id),
            requests: all(
              "SELECT v.*,p.title,u.name,u.email FROM visits v JOIN properties p ON p.id=v.property_id JOIN users u ON u.id=v.user_id WHERE p.owner=? OR ?=1",
              u.id,
              u.role === "administrador" ? 1 : 0,
            ),
          });
        fail("Recurso não encontrado.", 404);
      }
      if (req.method === "POST" && path.startsWith("/api/")) {
        if (req.headers.origin) {
          let origin;
          try {
            origin = new URL(req.headers.origin);
          } catch {
            fail("Origem inválida.", 403);
          }
          if (origin.host !== req.headers.host) fail("Origem inválida.", 403);
        }
        const data = await body(req);
        if (["/api/register", "/api/login", "/api/reset"].includes(path)) {
          const now = Date.now() / 1000,
            ip = req.socket.remoteAddress || "";
          run("DELETE FROM attempts WHERE created<?", now - 60);
          run("DELETE FROM sessions WHERE expires<?", now);
          if (
            get("SELECT COUNT(*) AS total FROM attempts WHERE ip=?", ip)
              .total >= 30
          )
            fail("Muitas tentativas. Aguarde um minuto.", 429);
          run("INSERT INTO attempts VALUES(?,?)", ip, now);
          const email = text(data.email).toLowerCase(),
            pw = typeof data.password === "string" ? data.password : "";
          if (!emailValid(email)) fail("Informe um e-mail válido.");
          if (pw.length > 128) fail("Use uma senha de até 128 caracteres.");
          if (path === "/api/register") {
            const name = text(data.name);
            if (name.length < 2 || name.length > 100 || pw.length < 8)
              fail("Informe seu nome e uma senha de 8 a 128 caracteres.");
            if (get("SELECT 1 FROM users WHERE email=?", email))
              fail("Este e-mail já está cadastrado.");
            const salt = randomBytes(16).toString("hex"),
              recovery = random();
            run(
              "INSERT INTO users(name,email,salt,password,recovery) VALUES(?,?,?,?,?)",
              name,
              email,
              salt,
              password(pw, salt),
              hash(recovery),
            );
            return json(res, { recovery }, 201);
          }
          const row = get("SELECT * FROM users WHERE email=?", email);
          if (path === "/api/reset") {
            if (!row || !equal(row.recovery, hash(text(data.recovery))))
              fail("E-mail ou chave de recuperação inválidos.");
            if (pw.length < 8) fail("Use uma senha de 8 a 128 caracteres.");
            const salt = randomBytes(16).toString("hex"),
              recovery = random();
            transaction(() => {
              run(
                "UPDATE users SET salt=?,password=?,recovery=? WHERE id=?",
                salt,
                password(pw, salt),
                hash(recovery),
                row.id,
              );
              run("DELETE FROM sessions WHERE user_id=?", row.id);
            });
            return json(res, { recovery });
          }
          if (!row || !equal(row.password, password(pw, row.salt)))
            fail("E-mail ou senha incorretos.", 401);
          const token = random(32);
          run("INSERT INTO sessions VALUES(?,?,?)", token, row.id, now + 86400);
          return json(
            res,
            { ok: true },
            200,
            `domus_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${process.env.DOMUS_SECURE_COOKIE === "1" ? "; Secure" : ""}`,
          );
        }
        if (path === "/api/contact") {
          const name = text(data.name),
            email = text(data.email),
            message = text(data.message);
          if (!name || !emailValid(email) || message.length < 10)
            fail(
              "Preencha nome, e-mail e uma mensagem com pelo menos 10 caracteres.",
            );
          run(
            "INSERT INTO messages(name,email,message,created) VALUES(?,?,?,?)",
            name.slice(0, 100),
            email,
            message.slice(0, 5000),
            Date.now() / 1000,
          );
          return json(res, { ok: true }, 201);
        }
        const u = requireUser(req);
        if (path === "/api/logout") {
          run("DELETE FROM sessions WHERE token=?", session(req));
          return json(
            res,
            { ok: true },
            200,
            "domus_session=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/",
          );
        }
        if (path === "/api/favorite") {
          const id = idOf(data.id);
          if (!get("SELECT 1 FROM properties WHERE id=? AND active=1", id))
            fail("Imóvel indisponível.");
          if (data.saved)
            run("INSERT OR IGNORE INTO favorites VALUES(?,?)", u.id, id);
          else
            run(
              "DELETE FROM favorites WHERE user_id=? AND property_id=?",
              u.id,
              id,
            );
        } else if (path === "/api/visit") {
          const id = idOf(data.id),
            day = text(data.day),
            parsed = new Date(day + "T12:00:00Z"),
            today = new Date().toLocaleDateString("en-CA", {
              timeZone: "America/Sao_Paulo",
            });
          if (
            !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
            !Number.isFinite(parsed.getTime()) ||
            parsed.toISOString().slice(0, 10) !== day ||
            day <= today ||
            !["Manhã", "Tarde"].includes(data.period)
          )
            fail("Escolha uma data futura e um período válido.");
          if (!get("SELECT 1 FROM properties WHERE id=? AND active=1", id))
            fail("Imóvel indisponível.");
          if (
            get(
              "SELECT 1 FROM visits WHERE user_id=? AND property_id=? AND day=? AND period=?",
              u.id,
              id,
              day,
              data.period,
            )
          )
            fail("Você já solicitou essa visita.");
          run(
            "INSERT INTO visits(user_id,property_id,day,period) VALUES(?,?,?,?)",
            u.id,
            id,
            day,
            data.period,
          );
        } else if (path === "/api/visit-status") {
          const v = get(
            "SELECT v.*,p.owner FROM visits v JOIN properties p ON p.id=v.property_id WHERE v.id=?",
            idOf(data.id),
          );
          if (
            !v ||
            !(
              (v.user_id === u.id && data.status === "Cancelada") ||
              ((v.owner === u.id || u.role === "administrador") &&
                ["Confirmada", "Cancelada"].includes(data.status))
            )
          )
            fail("Ação não permitida.", 403);
          run("UPDATE visits SET status=? WHERE id=?", data.status, v.id);
        } else if (path === "/api/admin-role") {
          requireAdmin(u);
          if (!["cliente", "corretor"].includes(data.role))
            fail("Perfil inválido.");
          run(
            "UPDATE users SET role=? WHERE id=? AND role!='administrador'",
            data.role,
            idOf(data.id),
          );
        } else if (path === "/api/listing") {
          const values = [
            "title",
            "city",
            "neighborhood",
            "type",
            "purpose",
            "description",
          ].map((k) => text(data[k]));
          if (
            values.some((v) => !v || v.length > 3000) ||
            !["Casa", "Apartamento", "Comercial"].includes(data.type) ||
            !["Comprar", "Alugar"].includes(data.purpose)
          )
            fail("Preencha todos os dados do imóvel.");
          const nums = ["price", "area", "rooms", "baths", "parking"].map((k) =>
            Number(data[k]),
          );
          if (
            nums.some((n) => !Number.isFinite(n) || n < 0 || n > 1000000000) ||
            nums[0] <= 0 ||
            nums[1] <= 0 ||
            nums.slice(2).some((n) => !Number.isInteger(n))
          )
            fail("Informe preço, área e quantidades válidas.");
          const previous = data.id
            ? get(
                "SELECT * FROM properties WHERE id=? AND owner=?",
                idOf(data.id),
                u.id,
              )
            : null;
          if (data.id && !previous) fail("Anúncio não encontrado.", 404);
          let image = previous?.image || "";
          if (data.photo) {
            if (
              typeof data.photo !== "string" ||
              !/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
                data.photo,
              )
            )
              fail("Imagem inválida.");
            const raw = Buffer.from(data.photo, "base64");
            if (raw.length > 4000000) fail("Use uma foto de até 4 MB.");
            const ext = raw
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
              ? "png"
              : raw.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
                ? "jpg"
                : null;
            if (!ext) fail("Use uma imagem PNG ou JPEG.");
            const filename = randomBytes(16).toString("hex") + "." + ext;
            mkdirSync(uploadRoot, { recursive: true });
            writeFileSync(resolve(uploadRoot, filename), raw);
            image = "/uploads/" + filename;
          }
          if (previous)
            run(
              "UPDATE properties SET title=?,city=?,neighborhood=?,type=?,purpose=?,description=?,price=?,area=?,rooms=?,baths=?,parking=?,image=? WHERE id=?",
              ...values,
              ...nums,
              image,
              previous.id,
            );
          else
            run(
              "INSERT INTO properties(owner,title,city,neighborhood,type,purpose,description,price,area,rooms,baths,parking,image) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
              u.id,
              ...values,
              ...nums,
              image,
            );
        } else if (path === "/api/listing-status") {
          if (
            !run(
              "UPDATE properties SET active=? WHERE id=? AND (owner=? OR ?=1)",
              data.active ? 1 : 0,
              idOf(data.id),
              u.id,
              u.role === "administrador" ? 1 : 0,
            ).changes
          )
            fail("Anúncio não encontrado.", 404);
        } else fail("Recurso não encontrado.", 404);
        return json(res, { ok: true });
      }
      if (!["GET", "HEAD"].includes(req.method))
        fail("Método não permitido.", 405);
      const decoded = decodeURIComponent(path),
        asset =
          decoded === "/" || decoded.endsWith(".html")
            ? "index.html"
            : decoded.slice(1);
      if (
        asset.split("/").some((part) => part.startsWith(".")) ||
        asset.includes("\\")
      )
        fail("Não encontrado.", 404);
      let filename;
      try {
        filename = realpathSync(resolve(webRoot, asset));
        if (
          !filename.startsWith(realpathSync(webRoot) + sep) ||
          !statSync(filename).isFile()
        )
          fail("Não encontrado.", 404);
      } catch {
        fail("Não encontrado.", 404);
      }
      const content = readFileSync(filename),
        types = {
          ".html": "text/html; charset=utf-8",
          ".js": "text/javascript; charset=utf-8",
          ".css": "text/css; charset=utf-8",
          ".png": "image/png",
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".svg": "image/svg+xml",
        };
      res.writeHead(200, {
        "Content-Type": types[extname(filename)] || "application/octet-stream",
        "Content-Length": content.length,
        "Cache-Control": "no-cache",
      });
      res.end(req.method === "HEAD" ? undefined : content);
    } catch (error) {
      if (!res.headersSent)
        json(
          res,
          {
            error:
              error instanceof HttpError
                ? error.message
                : "Não foi possível concluir a operação.",
          },
          error.status || 500,
        );
      else res.end();
      if (!(error instanceof HttpError)) console.error(error);
    }
  });
  return {
    server,
    db,
    makeAdmin(email) {
      return run(
        "UPDATE users SET role='administrador' WHERE email=?",
        text(email).toLowerCase(),
      ).changes;
    },
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const option = (name, fallback) => {
    const i = process.argv.lastIndexOf(name);
    return i >= 0 ? process.argv[i + 1] : fallback;
  };
  const app = createApp(),
    admin = option("--make-admin");
  if (admin) {
    const changed = app.makeAdmin(admin);
    console.log(
      changed ? "Administrador atualizado." : "Cadastre este e-mail primeiro.",
    );
    app.db.close();
    process.exitCode = changed ? 0 : 1;
  } else {
    const port = Number(option("--port", process.env.PORT || 3000)),
      host = option("--host", "127.0.0.1");
    app.server.listen(port, host, () =>
      console.log(`DOMUS: http://${host}:${port}`),
    );
  }
}
