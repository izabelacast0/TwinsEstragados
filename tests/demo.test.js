import test from "node:test";
import assert from "node:assert/strict";
import { createDemoStore } from "../web/demo-store.js";
import { readFileSync } from "node:fs";
const catalog = JSON.parse(
  readFileSync(new URL("../dist/catalog.json", import.meta.url)),
);
const memory = () => {
  const data = new Map();
  return {
    getItem: (k) => data.get(k) || null,
    setItem: (k, v) => data.set(k, v),
    removeItem: (k) => data.delete(k),
    data,
  };
};
const fixture = () => {
  const storage = memory(),
    session = memory();
  return {
    storage,
    session,
    api: createDemoStore({ catalog, storage, session }),
  };
};
test("navegação pública não grava dados; perfis e favoritos locais persistem", async () => {
  const { storage, session, api } = fixture();
  assert.equal((await api("properties")).length, 6);
  assert.equal(await api("me"), null);
  assert.equal(storage.data.size, 0);
  await api("demo-login", { role: "cliente" });
  assert.equal((await api("me")).role, "cliente");
  await api("favorite", { id: 1, saved: true });
  const reopened = createDemoStore({ catalog, storage, session });
  assert.deepEqual((await reopened("account")).favorites, [1]);
  const independent = fixture();
  assert.equal(await independent.api("me"), null);
  assert.equal(independent.storage.data.size, 0);
  await api("logout");
  assert.equal(await api("me"), null);
  await assert.rejects(api("account"));
});
test("cadastro local, perfil corretor, senha protegida e recuperação", async () => {
  const { storage, api } = fixture();
  const user = {
    name: "Teste",
    email: "teste@example.test",
    password: "Senha-teste-123",
    role: "corretor",
  };
  const { recovery } = await api("register", user);
  assert.ok(
    !JSON.stringify([...storage.data.values()]).includes(user.password),
  );
  await assert.rejects(api("register", user));
  await api("login", user);
  assert.equal((await api("me")).role, "corretor");
  await assert.rejects(api("reset", { ...user, recovery: "inválida" }));
  await api("reset", { ...user, recovery, password: "Nova-senha-123" });
  assert.equal(await api("me"), null);
  await assert.rejects(api("login", user));
  await api("login", { ...user, password: "Nova-senha-123" });
});
test("cliente solicita, corretor confirma e cliente cancela visita demo", async () => {
  const { api } = fixture();
  await api("demo-login", { role: "cliente" });
  const day = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  await api("visit", { id: 1, day, period: "Manhã" });
  await assert.rejects(api("visit", { id: 1, day, period: "Manhã" }));
  const [v] = (await api("account")).visits;
  await assert.rejects(api("visit-status", { id: v.id, status: "Confirmada" }));
  await api("demo-login", { role: "corretor" });
  assert.equal((await api("account")).requests.length, 1);
  await api("visit-status", { id: v.id, status: "Confirmada" });
  await api("demo-login", { role: "cliente" });
  assert.equal((await api("account")).visits[0].status, "Confirmada");
  await api("visit-status", { id: v.id, status: "Cancelada" });
});
test("anúncios locais, isolamento, administração e limpeza", async () => {
  const { api, storage, session } = fixture();
  await api("demo-login", { role: "corretor" });
  const data = {
    title: "Casa teste",
    city: "Uberlândia",
    neighborhood: "Centro",
    type: "Casa",
    purpose: "Comprar",
    price: 100000,
    area: 80,
    rooms: 2,
    baths: 1,
    parking: 1,
    description: "Imóvel de teste",
  };
  await api("listing", data);
  const p = (await api("account")).listings.find(
    (p) => p.title === "Casa teste",
  );
  assert.ok(p);
  await api("demo-login", { role: "cliente" });
  await assert.rejects(api("listing", { ...data, id: p.id }));
  await assert.rejects(api("admin"));
  await api("demo-login", { role: "administrador" });
  await api("listing-status", { id: p.id, active: false });
  assert.ok(!(await api("properties")).some((x) => x.id === p.id));
  await api("demo-clear");
  assert.equal(storage.data.size, 0);
  assert.equal(session.data.size, 0);
  assert.equal((await api("properties")).length, 6);
});
test("pacote público usa caminhos relativos e não contém dados privados", () => {
  const html = readFileSync(
      new URL("../dist/index.html", import.meta.url),
      "utf8",
    ),
    js = readFileSync(new URL("../dist/app.js", import.meta.url), "utf8");
  assert.ok(html.includes("./demo-config.js"));
  assert.ok(html.indexOf("./demo-config.js") < html.indexOf("./app.js"));
  assert.ok(!html.includes('href="/'));
  assert.ok(!js.includes('href="/#/'));
  assert.ok(!js.includes('src="/assets/'));
});
