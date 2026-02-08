import { mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const BUN_VERSION = "1.2.5";

const PLATFORMS = [
  { platform: "darwin", arch: "arm64", file: "bun-darwin-aarch64.zip" },
  { platform: "darwin", arch: "x64", file: "bun-darwin-x64.zip" },
  { platform: "win32", arch: "x64", file: "bun-windows-x64.zip" },
] as const;

const RESOURCES_DIR = path.join(import.meta.dir, "..", "resources", "bun");

async function downloadBun(
  platform: string,
  arch: string,
  file: string,
  force: boolean = false
): Promise<void> {
  const url = `https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/${file}`;
  const outDir = path.join(RESOURCES_DIR, `${platform}-${arch}`);
  const zipPath = path.join(outDir, file);
  const bunExecutable = platform === "win32" ? "bun.exe" : "bun";
  const bunPath = path.join(outDir, bunExecutable);

  if (existsSync(bunPath) && !force) {
    console.log(`Bun already exists for ${platform}-${arch}, skipping (use --force to re-download)...`);
    return;
  }

  if (existsSync(bunPath)) {
    console.log(`Removing existing Bun binary...`);
    await unlink(bunPath);
  }

  console.log(`Downloading Bun for ${platform}-${arch}...`);
  console.log(`URL: ${url}`);

  await mkdir(outDir, { recursive: true });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status}`);
  }

  await Bun.write(zipPath, response);
  console.log(`Downloaded to ${zipPath}`);

  console.log("Extracting...");
  const proc = Bun.spawn(["unzip", "-o", zipPath, "-d", outDir], {
    cwd: outDir,
    stdout: "inherit",
    stderr: "inherit",
  });
  await proc.exited;

  const extractedDir = path.join(outDir, file.replace(".zip", ""));
  const extractedBun = path.join(extractedDir, bunExecutable);

  if (existsSync(extractedBun)) {
    const moveProc = Bun.spawn(["mv", extractedBun, bunPath], {
      stdout: "inherit",
      stderr: "inherit",
    });
    await moveProc.exited;

    const rmProc = Bun.spawn(["rm", "-rf", extractedDir], {
      stdout: "inherit",
      stderr: "inherit",
    });
    await rmProc.exited;
  }

  await unlink(zipPath);

  if (platform !== "win32") {
    const chmodProc = Bun.spawn(["chmod", "+x", bunPath], {
      stdout: "inherit",
      stderr: "inherit",
    });
    await chmodProc.exited;
  }

  console.log(`Bun ready at ${bunPath}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let platforms = PLATFORMS;
  const force = args.includes("--force");

  if (args.includes("--current")) {
    const currentPlatform = process.platform;
    const currentArch = process.arch === "arm64" ? "arm64" : "x64";
    platforms = PLATFORMS.filter(
      (p) => p.platform === currentPlatform && p.arch === currentArch
    );

    if (platforms.length === 0) {
      console.error(`No Bun binary available for ${currentPlatform}-${currentArch}`);
      process.exit(1);
    }
  }

  console.log(`Downloading Bun v${BUN_VERSION} binaries...`);
  console.log(`Platforms: ${platforms.map((p) => `${p.platform}-${p.arch}`).join(", ")}`);
  if (force) console.log(`Force mode: will re-download even if exists`);
  console.log();

  for (const { platform, arch, file } of platforms) {
    await downloadBun(platform, arch, file, force);
    console.log();
  }

  console.log("All downloads complete!");
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
