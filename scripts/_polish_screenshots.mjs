#!/usr/bin/env node
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const PORT = 9223;
const OUT =
  process.env.POLISH_SHOT_DIR ||
  "C:/Users/rick/AppData/Local/Cursor/AgentStores/cursor_agent_stores/bc-6fcde62b-18b2-4d5e-9375-b0de2727b2df/files/media";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CdpSession {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
  }
  async open() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", () => reject(new Error("ws failed")), {
        once: true,
      });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result ?? {});
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  close() {
    this.socket.close();
  }
}

async function connect() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      const pages = list.filter((t) => t.type === "page" && t.webSocketDebuggerUrl);
      const page =
        pages.find((t) => /InputMaster/i.test(t.title) && !/osd/i.test(t.url)) ||
        pages.find((t) => t.url?.endsWith("/") || t.url?.includes("index")) ||
        pages.find((t) => !/osd\.html/i.test(t.url || "")) ||
        pages[0];
      if (page?.webSocketDebuggerUrl) {
        const cdp = new CdpSession(page.webSocketDebuggerUrl);
        await cdp.open();
        await cdp.send("Runtime.enable");
        await cdp.send("Page.enable");
        return cdp;
      }
    } catch {
      // retry
    }
    await sleep(500);
  }
  throw new Error("CDP not ready");
}

async function shot(cdp, name, script) {
  if (script) {
    await cdp.send("Runtime.evaluate", {
      expression: script,
      awaitPromise: true,
      returnByValue: true,
    });
    await sleep(700);
  }
  const { data } = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  const path = join(OUT, name);
  await writeFile(path, Buffer.from(data, "base64"));
  console.log("wrote", path);
}

async function metrics(cdp, label) {
  const { result } = await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const header = document.querySelector('.inputs-panel.active .ui-page-header');
      const icon = header?.querySelector('.ui-page-header__icon');
      const title = header?.querySelector('.ui-content-title');
      const help = header?.querySelector('.ui-help');
      const panel = document.querySelector('.inputs-panel.active .ui-panel');
      const enableCol = document.querySelector('.midi-route-column-label--enable');
      const enableCell = document.querySelector('.midi-route-row .midi-route-enable');
      const fa = document.querySelectorAll('svg.fa-icon').length;
      const tr = title?.getBoundingClientRect();
      const hr = help?.getBoundingClientRect();
      const ir = icon?.getBoundingClientRect();
      const hdr = header?.getBoundingClientRect();
      const pr = panel?.getBoundingClientRect();
      return {
        label: ${JSON.stringify(label)},
        iconH: ir?.height ?? null,
        titleH: tr?.height ?? null,
        helpH: hr?.height ?? null,
        gapTitleHelp: tr && hr ? hr.top - tr.bottom : null,
        textBlockH: tr && hr ? hr.bottom - tr.top : null,
        headerOutside: Boolean(header && panel && !panel.contains(header)),
        headerAbovePanel: hdr && pr ? hdr.bottom <= pr.top + 1 : null,
        panelOpacity: panel ? getComputedStyle(panel).opacity : null,
        masterOff: panel?.classList.contains('is-master-off') ?? null,
        enableCol: enableCol?.textContent ?? null,
        enableIsLast: enableCell ? enableCell === enableCell.parentElement?.lastElementChild : null,
        faIcons: fa,
        subtitle: help?.textContent ?? null,
      };
    })()`,
    returnByValue: true,
  });
  console.log(JSON.stringify(result?.value, null, 2));
  return result?.value;
}

await mkdir(OUT, { recursive: true });
const cdp = await connect();

await shot(
  cdp,
  "polish-midi.png",
  `(() => {
    document.querySelector('[data-page="inputs"]')?.click();
    return new Promise((r) => setTimeout(() => {
      document.querySelector('[data-inputs-section="midi"]')?.click();
      setTimeout(() => {
        const add = [...document.querySelectorAll('.midi-route-action-button')]
          .find((b) => /add route/i.test(b.textContent || ''));
        if (add && !document.querySelector('.midi-route-row')) add.click();
        setTimeout(() => {
          const input = document.querySelector('#midi-master-enabled');
          if (input && !input.checked) {
            input.checked = true;
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
          const panel = document.querySelector('[data-role="midi-panel"]');
          panel?.classList.remove('is-master-off');
          setTimeout(r, 500);
        }, 400);
      }, 400);
    }, 300));
  })()`
);
await metrics(cdp, "midi-on");

await shot(
  cdp,
  "polish-midi-off.png",
  `(() => {
    const input = document.querySelector('#midi-master-enabled');
    if (input && input.checked) {
      input.click();
    }
    return true;
  })()`
);
await metrics(cdp, "midi-off");

// re-enable for other shots
await cdp.send("Runtime.evaluate", {
  expression: `(() => { const i=document.querySelector('#midi-master-enabled'); if (i && !i.checked) i.click(); return true; })()`,
  returnByValue: true,
});
await sleep(400);

await shot(
  cdp,
  "polish-keyboard.png",
  `(() => {
    document.querySelector('[data-inputs-section="keyboard"]')?.click();
    return new Promise((r) => setTimeout(r, 500));
  })()`
);
await metrics(cdp, "keyboard");

await shot(
  cdp,
  "polish-controller.png",
  `(() => {
    document.querySelector('[data-inputs-section="controller"]')?.click();
    return new Promise((r) => setTimeout(r, 500));
  })()`
);
await metrics(cdp, "controller");

await shot(
  cdp,
  "polish-bindings-toolbar.png",
  `(() => {
    document.querySelector('[data-page="bindings"]')?.click();
    return new Promise((r) => setTimeout(r, 400));
  })()`
);

cdp.close();
console.log("done");
