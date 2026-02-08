import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import pngToIco from "png-to-ico";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const assetsDir = path.resolve(__dirname, "..", "assets");
const inputPng = path.join(assetsDir, "app-icon.png");
const outputIco = path.join(assetsDir, "icon.ico");

try {
  await fs.access(inputPng);
} catch {
  console.error(`Missing PNG source: ${inputPng}`);
  console.error("Add electron/assets/app-icon.png (512x512+ recommended).");
  process.exit(1);
}

const icoBuffer = await pngToIco(inputPng);
await fs.writeFile(outputIco, icoBuffer);
console.log(`Generated ${outputIco}`);
