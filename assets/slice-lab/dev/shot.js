/* ============================================================
   dev/shot.js — screenshot a live page through the DevTools
   protocol, so animations get real wall-clock time to play.

   node dev/shot.js <url> <out.png> [waitMs] [jsBeforeWait]

   Example:
     node dev/shot.js "http://localhost:8899/12-slice-game.html?lv=1" out.png 900
   ============================================================ */
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9333;

function get(pathname) {
  return new Promise((resolve, reject) => {
    http.get({ host: "127.0.0.1", port: PORT, path: pathname }, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on("error", reject);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const [url, out, waitArg, js] = process.argv.slice(2);
  if (!url || !out) {
    console.error("usage: node shot.js <url> <out.png> [waitMs] [js]");
    process.exit(2);
  }
  const waitMs = parseInt(waitArg || "900", 10);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "slice-prof-"));

  const chrome = spawn(CHROME, [
    "--headless=new",
    "--enable-unsafe-swiftshader",
    "--use-angle=swiftshader",
    "--remote-debugging-port=" + PORT,
    "--window-size=" + (process.env.WSIZE || "1440,1100"),
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--user-data-dir=" + profile,
    "about:blank"
  ], { stdio: "ignore" });

  let targets = null;
  for (let i = 0; i < 60; i++) {
    try { targets = await get("/json/list"); break; } catch (e) { await sleep(250); }
  }
  if (!targets) { console.error("chrome did not start"); chrome.kill(); process.exit(1); }

  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();

  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method === "Runtime.exceptionThrown") {
      const d = msg.params.exceptionDetails;
      console.error("PAGE EXCEPTION:", (d.exception && d.exception.description) || d.text);
    }
    if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
      console.error("CONSOLE ERROR:", msg.params.args.map(a => a.value || a.description).join(" "));
    }
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    }
  });

  await new Promise((r) => ws.addEventListener("open", r));
  const send = (method, params) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
  });

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.navigate", { url });
  await sleep(1200);            // let three.js boot

  if (js) {
    const r = await send("Runtime.evaluate", { expression: js, awaitPromise: true, returnByValue: true });
    if (r && r.exceptionDetails) console.error("JS ERROR:", JSON.stringify(r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
    else if (r && r.result && r.result.value !== undefined) console.log("RETURN:", r.result.value);
  }
  await sleep(waitMs);

  const shot = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(out, Buffer.from(shot.data, "base64"));
  console.log("wrote " + out);

  ws.close();
  chrome.kill();
  setTimeout(() => process.exit(0), 300);
}

main().catch((e) => { console.error(e); process.exit(1); });
