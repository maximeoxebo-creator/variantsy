import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
await p.setContent("<h1 style='font:700 80px system-ui'>Variantsy</h1>");
await p.screenshot({ path: "/tmp/pw-test.png" });
await b.close();
console.log("rendu 1600x900 OK");
