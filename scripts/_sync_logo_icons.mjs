import { Resvg } from "@resvg/resvg-js";
import { copyFileSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";

const svgPath = "resources/InputMasterIcon.svg";
const svg = readFileSync(svgPath);
console.log("svg", svgPath, "bytes", svg.length, "mtime", statSync(svgPath).mtime.toISOString());

function render(size, out) {
  const png = new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
  writeFileSync(out, png);
  console.log("wrote", out, png.length);
}

render(256, "src/assets/InputMaster.png");
render(256, "src/assets/InputMaster-light.png");
render(512, "src-tauri/icons/InputMaster.png");
render(256, "src-tauri/icons/128x128.png");
render(32, "src-tauri/icons/32x32.png");
copyFileSync("src-tauri/icons/InputMaster.png", "src-tauri/icons/icon.png");

const py = `
from PIL import Image
from pathlib import Path
src = Image.open('src-tauri/icons/InputMaster.png').convert('RGBA')
sizes = [(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)]
src.save('src-tauri/icons/icon.ico', format='ICO', sizes=sizes)
Path('src-tauri/icons/InputMaster.ico').write_bytes(Path('src-tauri/icons/icon.ico').read_bytes())
print('ico', Path('src-tauri/icons/icon.ico').stat().st_size)
`;
const r = spawnSync("python", ["-c", py], { encoding: "utf8" });
if (r.status !== 0) {
  console.error(r.stderr || r.stdout);
  process.exit(r.status || 1);
}
console.log(r.stdout.trim());
