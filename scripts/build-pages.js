import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  cpSync,
  rmSync,
} from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../server.js";
const root = fileURLToPath(new URL("../", import.meta.url)),
  out = resolve(root, "dist");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const f of ["index.html", "app.js", "app.css", "demo-store.js", "usuarios-demo.json"])
  copyFileSync(resolve(root, "web", f), resolve(out, f));
cpSync(resolve(root, "web/assets"), resolve(out, "assets"), {
  recursive: true,
});
const app = createApp({ dbPath: ":memory:" });
writeFileSync(
  resolve(out, "catalog.json"),
  JSON.stringify(app.db.prepare("SELECT * FROM properties").all()),
);
app.db.close();
let html = readFileSync(resolve(out, "index.html"), "utf8").replace(
  '<script src="./app.js" defer></script>',
  '<script src="./demo-config.js" defer></script>\n    <script src="./app.js" defer></script>',
);
writeFileSync(resolve(out, "index.html"), html);
writeFileSync(
  resolve(out, "demo-config.js"),
  "globalThis.DOMUS_DEMO = true;\n",
);
writeFileSync(resolve(out, ".nojekyll"), "");
console.log(
  "GitHub Pages pronto em dist/. Nenhum banco, conta real ou upload local foi incluído.",
);
