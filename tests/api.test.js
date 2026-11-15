import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { createApp } from "../server.js";

async function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "domus-test-"));
  const app = createApp({
    dbPath: join(dir, "db.sqlite3"),
    uploadRoot: join(dir, "uploads"),
  });
  app.server.listen(0, "127.0.0.1");
  await once(app.server, "listening");
  t.after(async () => {
    await new Promise((resolve) => app.server.close(resolve));
    app.db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const url = `http://127.0.0.1:${app.server.address().port}`;
  const call = async (path, data, cookie = "", extra = {}) => {
    const response = await fetch(url + "/api/" + path, {
      method: data === undefined ? "GET" : "POST",
      headers: {
        Cookie: cookie,
        ...(data !== undefined ? { "Content-Type": "application/json" } : {}),
        ...extra,
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    return {
      status: response.status,
      body: await response.json(),
      cookie: response.headers.get("set-cookie")?.split(";")[0] || "",
    };
  };
  const register = async (email) => {
    const data = { name: "Pessoa Teste", email, password: "Senha-teste-123" };
    const created = await call("register", data);
    assert.equal(created.status, 201);
    const login = await call("login", data);
    assert.equal(login.status, 200);
    return { ...data, cookie: login.cookie, recovery: created.body.recovery };
  };
  return { ...app, dir, url, call, register };
}
const listing = {
  title: "Casa teste",
  city: "Uberlândia",
  neighborhood: "Centro",
  type: "Casa",
  purpose: "Comprar",
  price: 400000,
  area: 120,
  rooms: 3,
  baths: 2,
  parking: 1,
  description: "Uma descrição para o anúncio de teste.",
};

test("conta, autenticação, favoritos, recuperação e revogação de sessões", async (t) => {
  const { call, register, db } = await fixture(t);
  assert.equal((await call("account")).status, 401);
  const u = await register("cliente@example.test");
  assert.equal((await call("register", u)).status, 400);
  assert.equal((await call("login", { ...u, password: "errada" })).status, 401);
  assert.equal((await call("me", undefined, u.cookie)).body.email, u.email);
  assert.equal(
    (await call("favorite", { id: 1, saved: true }, u.cookie)).status,
    200,
  );
  assert.deepEqual(
    (await call("account", undefined, u.cookie)).body.favorites,
    [1],
  );
  assert.equal(
    (await call("favorite", { id: 999, saved: true }, u.cookie)).status,
    400,
  );
  assert.equal((await call("reset", { ...u, recovery: "errada" })).status, 400);
  const reset = await call("reset", { ...u, password: "Nova-senha-123" });
  assert.equal(reset.status, 200);
  assert.notEqual(reset.body.recovery, u.recovery);
  assert.equal((await call("me", undefined, u.cookie)).body, null);
  assert.equal((await call("reset", u)).status, 400);
  assert.equal((await call("login", u)).status, 401);
  const login = await call("login", { ...u, password: "Nova-senha-123" });
  assert.deepEqual(
    (await call("account", undefined, login.cookie)).body.favorites,
    [1],
  );
  assert.notEqual(
    db.prepare("SELECT password FROM users WHERE email=?").get(u.email)
      .password,
    "Nova-senha-123",
  );
  await call("logout", {}, login.cookie);
  assert.equal((await call("me", undefined, login.cookie)).body, null);
});

test("anúncios, edição, fotos, visitas e autorização entre contas", async (t) => {
  const { call, register, dir } = await fixture(t),
    owner = await register("owner@example.test"),
    visitor = await register("visit@example.test");
  assert.equal((await call("listing", listing, owner.cookie)).status, 200);
  let own = (await call("account", undefined, owner.cookie)).body.listings[0];
  assert.equal(
    (
      await call(
        "listing",
        { ...listing, id: own.id, title: "Título novo" },
        visitor.cookie,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await call(
        "listing",
        { ...listing, id: own.id, title: "Título novo" },
        owner.cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call(
        "listing",
        { ...listing, id: own.id, rooms: 1.5 },
        owner.cookie,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await call(
        "listing",
        { ...listing, id: own.id, photo: "bm90IGFuIGltYWdl" },
        owner.cookie,
      )
    ).status,
    400,
  );
  const png =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==";
  assert.equal(
    (
      await call(
        "listing",
        { ...listing, id: own.id, photo: png },
        owner.cookie,
      )
    ).status,
    200,
  );
  assert.equal(readdirSync(join(dir, "uploads")).length, 1);
  assert.deepEqual(
    readFileSync(join(dir, "uploads", readdirSync(join(dir, "uploads"))[0])),
    Buffer.from(png, "base64"),
  );
  const day = new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
    request = { id: own.id, day, period: "Manhã" };
  assert.equal(
    (await call("visit", { ...request, day: "2000-01-01" }, visitor.cookie))
      .status,
    400,
  );
  assert.equal(
    (await call("visit", { ...request, day: "2099-02-30" }, visitor.cookie))
      .status,
    400,
  );
  assert.equal((await call("visit", request, visitor.cookie)).status, 200);
  assert.equal((await call("visit", request, visitor.cookie)).status, 400);
  const visit = (await call("account", undefined, owner.cookie)).body
    .requests[0];
  assert.equal(
    (
      await call(
        "visit-status",
        { id: visit.id, status: "Confirmada" },
        visitor.cookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        "visit-status",
        { id: visit.id, status: "Confirmada" },
        owner.cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call(
        "visit-status",
        { id: visit.id, status: "Cancelada" },
        visitor.cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call(
        "listing-status",
        { id: own.id, active: false },
        visitor.cookie,
      )
    ).status,
    404,
  );
  assert.equal(
    (await call("listing-status", { id: own.id, active: false }, owner.cookie))
      .status,
    200,
  );
  assert.ok(!(await call("properties")).body.some((p) => p.id === own.id));
  assert.equal(
    (await call("listing-status", { id: own.id, active: true }, owner.cookie))
      .status,
    200,
  );
});

test("administração, mensagens e bloqueio de elevação de perfil no cadastro", async (t) => {
  const { call, register, makeAdmin } = await fixture(t);
  const u = await register("admin@example.test");
  assert.equal((await call("admin", undefined, u.cookie)).status, 403);
  assert.equal(
    (await call("admin-role", { id: 1, role: "corretor" }, u.cookie)).status,
    403,
  );
  assert.equal(
    (
      await call("contact", {
        name: "Contato",
        email: "p@example.test",
        message: "Quero saber mais sobre o imóvel.",
      })
    ).status,
    201,
  );
  assert.equal(makeAdmin(u.email), 1);
  const admin = await call("admin", undefined, u.cookie);
  assert.equal(admin.status, 200);
  assert.equal(admin.body.messages.length, 1);
  const v = await register("other@example.test"),
    id = (await call("me", undefined, v.cookie)).body.id;
  assert.equal(
    (await call("admin-role", { id, role: "administrador" }, u.cookie)).status,
    400,
  );
  assert.equal(
    (await call("admin-role", { id, role: "corretor" }, u.cookie)).status,
    200,
  );
  assert.equal((await call("me", undefined, v.cookie)).body.role, "corretor");
  await call("register", {
    name: "Sem privilégio",
    email: "fake@example.test",
    password: "Senha-teste-123",
    role: "administrador",
  });
  const login = await call("login", {
    email: "fake@example.test",
    password: "Senha-teste-123",
  });
  assert.equal(
    (await call("me", undefined, login.cookie)).body.role,
    "cliente",
  );
});

test("persistência compatível com o banco existente após reiniciar", async (t) => {
  const { call, register, db, dir } = await fixture(t);
  const u = await register("saved@example.test");
  await call("favorite", { id: 2, saved: true }, u.cookie);
  const another = createApp({ dbPath: join(dir, "db.sqlite3") });
  try {
    assert.equal(
      another.db.prepare("SELECT email FROM users").get().email,
      u.email,
    );
    assert.equal(
      another.db.prepare("SELECT property_id FROM favorites").get().property_id,
      2,
    );
    assert.equal(
      another.db.prepare("SELECT COUNT(*) AS n FROM properties").get().n,
      6,
    );
  } finally {
    another.db.close();
  }
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users").get().n, 1);
});

test("arquivos privados, origem, JSON, validação e limite de tentativas", async (t) => {
  const { call, url } = await fixture(t);
  for (const path of [
    "/server.js",
    "/domus.sqlite3",
    "/.git/config",
    "/assets/",
  ])
    assert.equal((await fetch(url + path)).status, 404);
  for (const path of ["/", "/cadastro.html", "/app.js", "/app.css"])
    assert.equal((await fetch(url + path)).status, 200);
  assert.equal(
    (await call("contact", {}, "", { Origin: "https://evil.test" })).status,
    403,
  );
  assert.equal(
    (await call("register", { name: "A", email: "invalido", password: "123" }))
      .status,
    400,
  );
  assert.equal(
    (await call("contact", { name: "A", email: "invalid", message: "curta" }))
      .status,
    400,
  );
  assert.equal(
    (await fetch(url + "/api/login", { method: "POST", body: "{" })).status,
    400,
  );
  for (let i = 0; i < 30; i++)
    await call("login", { email: "none@example.test", password: "errada" });
  assert.equal(
    (await call("login", { email: "none@example.test", password: "errada" }))
      .status,
    429,
  );
});
