import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { createDemoStore } from "../web/demo-store.js";
const accounts = JSON.parse(readFileSync(new URL("../web/usuarios-demo.json", import.meta.url), "utf8"));
const memory = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
};
test("contas JSON: login, permissões e dados preservados entre perfis", async () => {
  const api = createDemoStore({ catalog: [{ id: 1, title: "Casa teste", active: 1 }], accounts, storage: memory(), session: memory(), cryptoApi: webcrypto });
  await assert.rejects(api("login", { email: "admin", password: "errada" }));
  await api("login", { email: "cliente", password: "1234567" });
  assert.equal((await api("me")).role, "cliente");
  await api("favorite", { id: 1, saved: true });
  await assert.rejects(api("admin"));
  await assert.rejects(api("listing", {}));
  await api("logout", {});
  await api("login", { email: "corretor", password: "1234567" });
  assert.equal((await api("me")).role, "corretor");
  assert.equal((await api("account")).listings.length, 1);
  await api("listing-status", { id: 1, active: false });
  await api("login", { email: "admin", password: "1234567" });
  assert.equal((await api("admin")).listings[0].active, 0);
  await api("listing-status", { id: 1, active: true });
  await api("login", { email: "cliente@domus.example", password: "1234567" });
  assert.deepEqual((await api("account")).favorites, [1]);
});
