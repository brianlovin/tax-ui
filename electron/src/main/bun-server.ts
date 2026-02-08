import { spawn, type ChildProcess } from "child_process";
import path from "path";
import { app } from "electron";
import log from "electron-log";
import getPort from "get-port";

let serverProcess: ChildProcess | null = null;
let currentPort: number | null = null;

function getBunPath(): string {
  const platform = process.platform;
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  const platformArch = `${platform}-${arch}`;
  const bunExecutable = platform === "win32" ? "bun.exe" : "bun";

  if (app.isPackaged) {
    return path.join(process.resourcesPath, "bun", bunExecutable);
  }

  return path.join(
    app.getAppPath(),
    "..",
    "resources",
    "bun",
    platformArch,
    bunExecutable
  );
}

function getServerPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "server", "index.js");
  }

  return path.join(app.getAppPath(), "..", "src", "index.ts");
}

export async function startServer(): Promise<number> {
  if (serverProcess) {
    log.info("Server already running on port", currentPort);
    return currentPort!;
  }

  const port = await getPort({ port: [3000, 3001, 3002, 3003, 3004] });
  const bunPath = getBunPath();
  const serverPath = getServerPath();
  const dataDir = app.getPath("userData");

  log.info("Starting Bun server...");
  log.info("Bun path:", bunPath);
  log.info("Server path:", serverPath);
  log.info("Data directory:", dataDir);
  log.info("Port:", port);

  const staticDir = app.isPackaged
    ? path.join(process.resourcesPath, "dist")
    : path.join(app.getAppPath(), "..", "dist");

  serverProcess = spawn(bunPath, ["run", serverPath, "--port", String(port)], {
    env: {
      ...process.env,
      TAX_UI_DATA_DIR: dataDir,
      TAX_UI_STATIC_DIR: staticDir,
      NODE_ENV: "production",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverProcess.stdout?.on("data", (data) => {
    log.info("[server]", data.toString().trim());
  });

  serverProcess.stderr?.on("data", (data) => {
    log.error("[server]", data.toString().trim());
  });

  serverProcess.on("error", (error) => {
    log.error("Failed to start server:", error);
    serverProcess = null;
    currentPort = null;
  });

  serverProcess.on("exit", (code, signal) => {
    log.info(`Server exited with code ${code}, signal ${signal}`);
    serverProcess = null;
    currentPort = null;
  });

  currentPort = port;

  await waitForServer(port);

  return port;
}

async function waitForServer(
  port: number,
  timeout: number = 30000
): Promise<void> {
  const start = Date.now();
  const url = `http://localhost:${port}`;

  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        log.info("Server is ready");
        return;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Server failed to start within ${timeout}ms`);
}

export function stopServer(): void {
  if (serverProcess) {
    log.info("Stopping server...");
    serverProcess.kill("SIGTERM");
    serverProcess = null;
    currentPort = null;
  }
}

export function getServerPort(): number | null {
  return currentPort;
}
