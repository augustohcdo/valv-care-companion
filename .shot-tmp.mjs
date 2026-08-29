import { chromium } from "playwright";
const PROXY = process.env["HTTPS_PROXY"];
const b = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  ...(PROXY ? { proxy: { server: PROXY, bypass: "127.0.0.1,localhost" } } : {}),
});
const p = await b.newPage({ viewport: { width: 1280, height: 1100 } });
for (const [rota, nome] of [["/ferramentas", "euroscore"], ["/ferramentas/proteses", "catalogo"]]) {
  await p.goto("http://127.0.0.1:4173" + rota, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(3500);
  await p.screenshot({ path: `tela-${nome}.png` });
  console.log(nome, "ok");
}
await b.close();
