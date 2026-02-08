#!/usr/bin/env bun
/**
 * Electron E2E Test Framework
 *
 * Allows autonomous testing of the Electron wrapper with minimal human intervention.
 * Run with: bun scripts/test-electron.ts
 *
 * Phases:
 * 1. Prerequisites - Check/download Bun binary, verify builds
 * 2. Server Test - Start Bun server standalone, verify it works
 * 3. Electron Test - Launch Electron, verify window loads
 * 4. Integration Test - Full flow with PDF parsing (requires API key)
 */

import { spawn, type Subprocess } from "bun";
import { existsSync } from "fs";
import path from "path";

const ROOT_DIR = path.join(import.meta.dir, "..");
const ELECTRON_DIR = path.join(ROOT_DIR, "electron");
const RESOURCES_DIR = path.join(ROOT_DIR, "resources", "bun");

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  logs?: string[];
}

interface TestContext {
  results: TestResult[];
  logs: string[];
  serverProcess?: Subprocess;
  electronProcess?: Subprocess;
  serverPort?: number;
}

const ctx: TestContext = {
  results: [],
  logs: [],
};

function log(message: string) {
  const timestamp = new Date().toISOString().split("T")[1].slice(0, 8);
  const line = `[${timestamp}] ${message}`;
  console.log(line);
  ctx.logs.push(line);
}

function logError(message: string) {
  const timestamp = new Date().toISOString().split("T")[1].slice(0, 8);
  const line = `[${timestamp}] ERROR: ${message}`;
  console.error(line);
  ctx.logs.push(line);
}

async function runTest(name: string, fn: () => Promise<void>): Promise<TestResult> {
  log(`\n${"=".repeat(60)}`);
  log(`TEST: ${name}`);
  log("=".repeat(60));

  const start = Date.now();
  const testLogs: string[] = [];

  try {
    await fn();
    const result: TestResult = {
      name,
      passed: true,
      duration: Date.now() - start,
      logs: testLogs,
    };
    log(`✓ PASSED (${result.duration}ms)`);
    ctx.results.push(result);
    return result;
  } catch (error) {
    const result: TestResult = {
      name,
      passed: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
      logs: testLogs,
    };
    logError(`✗ FAILED: ${result.error}`);
    ctx.results.push(result);
    return result;
  }
}

async function execCommand(
  command: string[],
  options: { cwd?: string; timeout?: number; captureOutput?: boolean } = {}
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const { cwd = ROOT_DIR, timeout = 30000 } = options;
  const cmdStr = command.join(" ");

  log(`$ ${cmdStr}`);

  try {
    // Use spawn with shell: true to handle nvm and other shell integrations
    const proc = spawn({
      cmd: ["bash", "-lc", cmdStr],
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        proc.kill();
        reject(new Error(`Command timed out after ${timeout}ms`));
      }, timeout);
    });

    const exitCode = await Promise.race([proc.exited, timeoutPromise]);
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();

    if (stdout.trim()) log(`stdout: ${stdout.trim().slice(0, 500)}`);
    if (stderr.trim()) log(`stderr: ${stderr.trim().slice(0, 500)}`);

    return { exitCode, stdout, stderr };
  } catch (error) {
    throw error;
  }
}

async function waitForServer(port: number, timeout = 30000): Promise<boolean> {
  const start = Date.now();
  const url = `http://localhost:${port}`;

  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        log(`Server ready at ${url}`);
        return true;
      }
    } catch {
      // Not ready yet
    }
    await Bun.sleep(200);
  }
  return false;
}

function getPortCandidates(): number[] {
  const randoms: number[] = [];
  for (let i = 0; i < 10; i++) {
    randoms.push(20000 + Math.floor(Math.random() * 5000));
    randoms.push(30000 + Math.floor(Math.random() * 5000));
  }
  const fixed = [3100, 3200, 3300, 3400, 3500, 8000, 8100, 8200];
  return [...randoms, ...fixed];
}

// =============================================================================
// TESTS
// =============================================================================

async function testPrerequisites() {
  await runTest("Node.js installed", async () => {
    const { exitCode } = await execCommand(["node", "--version"]);
    if (exitCode !== 0) throw new Error("Node.js not found");
  });

  await runTest("npm installed", async () => {
    const { exitCode } = await execCommand(["npm", "--version"]);
    if (exitCode !== 0) throw new Error("npm not found");
  });

  await runTest("Bun installed", async () => {
    const { exitCode } = await execCommand(["bun", "--version"]);
    if (exitCode !== 0) throw new Error("Bun not found");
  });
}

async function testBunBinaryDownload() {
  const platform = process.platform;
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  const bunExecutable = platform === "win32" ? "bun.exe" : "bun";
  const bunPath = path.join(RESOURCES_DIR, `${platform}-${arch}`, bunExecutable);

  await runTest("Bun binary exists or can be downloaded", async () => {
    if (existsSync(bunPath)) {
      log(`Bun binary already exists at ${bunPath}`);
      return;
    }

    log("Downloading Bun binary...");
    const { exitCode, stderr } = await execCommand(
      ["bun", "scripts/download-bun.ts", "--current"],
      { timeout: 120000 }
    );

    if (exitCode !== 0) {
      throw new Error(`Download failed: ${stderr}`);
    }

    if (!existsSync(bunPath)) {
      throw new Error(`Bun binary not found at ${bunPath} after download`);
    }
  });

  await runTest("Bundled Bun binary is executable", async () => {
    if (!existsSync(bunPath)) {
      throw new Error("Bun binary not found - run download test first");
    }

    const { exitCode, stdout } = await execCommand([bunPath, "--version"]);
    if (exitCode !== 0) throw new Error("Bundled Bun not executable");
    log(`Bundled Bun version: ${stdout.trim()}`);
  });
}

async function testWebAppBuild() {
  await runTest("Web app dependencies installed", async () => {
    if (!existsSync(path.join(ROOT_DIR, "node_modules"))) {
      log("Installing dependencies...");
      const { exitCode } = await execCommand(["bun", "install"], { timeout: 60000 });
      if (exitCode !== 0) throw new Error("bun install failed");
    } else {
      log("node_modules exists");
    }
  });

  await runTest("Web app TypeScript compiles", async () => {
    const { exitCode, stderr } = await execCommand(["bunx", "tsc", "--noEmit"]);
    if (exitCode !== 0) throw new Error(`TypeScript errors: ${stderr}`);
  });

  await runTest("Web app builds successfully", async () => {
    const { exitCode, stderr } = await execCommand(["bun", "run", "build"], { timeout: 60000 });
    if (exitCode !== 0) throw new Error(`Build failed: ${stderr}`);

    if (!existsSync(path.join(ROOT_DIR, "dist"))) {
      throw new Error("dist directory not created");
    }
  });
}

async function testElectronSetup() {
  await runTest("Electron dependencies installed", async () => {
    const nodeModules = path.join(ELECTRON_DIR, "node_modules");
    if (!existsSync(nodeModules)) {
      log("Installing Electron dependencies...");
      const { exitCode, stderr } = await execCommand(["npm", "install"], {
        cwd: ELECTRON_DIR,
        timeout: 120000,
      });
      if (exitCode !== 0) throw new Error(`npm install failed: ${stderr}`);
    } else {
      log("electron/node_modules exists");
    }
  });

  await runTest("Electron main TypeScript compiles", async () => {
    const { exitCode, stderr } = await execCommand(
      ["npx", "tsc", "-p", "tsconfig.main.json", "--noEmit"],
      { cwd: ELECTRON_DIR }
    );
    if (exitCode !== 0) throw new Error(`TypeScript errors: ${stderr}`);
  });

  await runTest("Electron preload TypeScript compiles", async () => {
    const { exitCode, stderr } = await execCommand(
      ["npx", "tsc", "-p", "tsconfig.preload.json", "--noEmit"],
      { cwd: ELECTRON_DIR }
    );
    if (exitCode !== 0) throw new Error(`TypeScript errors: ${stderr}`);
  });

  await runTest("Electron TypeScript builds", async () => {
    const { exitCode, stderr } = await execCommand(["npm", "run", "build"], {
      cwd: ELECTRON_DIR,
    });
    if (exitCode !== 0) throw new Error(`Build failed: ${stderr}`);

    const mainJs = path.join(ELECTRON_DIR, "dist", "main", "index.js");
    if (!existsSync(mainJs)) {
      throw new Error("dist/main/index.js not created");
    }
  });
}

async function testStandaloneServer() {
  const candidates = getPortCandidates();
  let port: number | null = null;

  await runTest("Bun server starts and responds", async () => {
    for (const candidate of candidates) {
      log(`Starting server on port ${candidate}...`);

      ctx.serverProcess = spawn({
        cmd: ["bun", "run", "src/index.ts", "--port", String(candidate)],
        cwd: ROOT_DIR,
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          TAX_UI_DATA_DIR: path.join(ROOT_DIR, ".test-data"),
        },
      });

      const ready = await waitForServer(candidate, 7000);
      if (ready) {
        port = candidate;
        ctx.serverPort = candidate;
        return;
      }

      const stderr = await new Response(ctx.serverProcess.stderr).text();
      const snippet = stderr.trim().split("\n").slice(-3).join(" | ").slice(0, 240);
      logError(`Server failed on port ${candidate}: ${snippet || "no stderr"}`);
      ctx.serverProcess.kill();
      ctx.serverProcess = undefined;
    }

    throw new Error("Server did not start on any candidate port");
  });

  await runTest("Server returns HTML on root", async () => {
    const response = await fetch(`http://localhost:${port}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();
    if (!html.includes("<!DOCTYPE html>") && !html.includes("<html")) {
      throw new Error("Response is not HTML");
    }
    log(`Got ${html.length} bytes of HTML`);
  });

  await runTest("Server API endpoint works", async () => {
    const response = await fetch(`http://localhost:${port}/api/returns`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    log(`API response: ${JSON.stringify(data).slice(0, 200)}`);
  });

  // Cleanup
  if (ctx.serverProcess) {
    log("Stopping server...");
    ctx.serverProcess.kill();
    ctx.serverProcess = undefined;
  }
}

async function testElectronLaunch() {
  // Use a specific port for testing so we can verify the server
  const candidates = getPortCandidates();
  let testPort: number | null = null;

  await runTest("Electron app launches and server starts", async () => {
    log("Building Electron...");
    await execCommand(["npm", "run", "build"], { cwd: ELECTRON_DIR });

    for (const candidate of candidates) {
      log(`Launching Electron with test port ${candidate}...`);

      // Launch via bash login shell to ensure nvm/node are available
      // This is needed because Electron's CLI requires node
      const electronCmd = `cd "${ELECTRON_DIR}" && TAX_UI_TEST_PORT=${candidate} TAX_UI_DATA_DIR="${path.join(ROOT_DIR, ".test-data")}" ELECTRON_ENABLE_LOGGING=1 ./node_modules/.bin/electron .`;

      ctx.electronProcess = spawn({
        cmd: ["bash", "-lc", electronCmd],
        cwd: ELECTRON_DIR,
        stdout: "pipe",
        stderr: "pipe",
      });

      // Wait for the server inside Electron to start
      const serverReady = await waitForServer(candidate, 15000);
      if (serverReady) {
        testPort = candidate;
        log("Server is running inside Electron");
        return;
      }

      const proc = ctx.electronProcess;
      const stderrReader = proc.stderr.getReader();
      const decoder = new TextDecoder();
      let stderr = "";
      try {
        const { value } = await stderrReader.read();
        if (value) stderr = decoder.decode(value);
      } catch {}
      const snippet = stderr.trim().split("\n").slice(-3).join(" | ").slice(0, 240);
      logError(`Electron failed on port ${candidate}: ${snippet || "no stderr"}`);
      ctx.electronProcess.kill();
      ctx.electronProcess = undefined;
    }

    throw new Error("Electron server did not start on any candidate port");
  });

  await runTest("Electron server serves HTML", async () => {
    if (!testPort) throw new Error("No Electron port available");
    const response = await fetch(`http://localhost:${testPort}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();
    if (!html.includes("<!DOCTYPE html>") && !html.includes("<html")) {
      throw new Error("Response is not HTML");
    }
    log(`Got ${html.length} bytes of HTML from Electron server`);
  });

  await runTest("Electron server API works", async () => {
    if (!testPort) throw new Error("No Electron port available");
    const response = await fetch(`http://localhost:${testPort}/api/returns`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    log(`API response: ${JSON.stringify(data).slice(0, 200)}`);
  });

  // Cleanup
  if (ctx.electronProcess) {
    log("Stopping Electron...");
    ctx.electronProcess.kill();
    ctx.electronProcess = undefined;
  }
}

async function cleanup() {
  log("\nCleaning up...");

  if (ctx.serverProcess) {
    ctx.serverProcess.kill();
  }
  if (ctx.electronProcess) {
    ctx.electronProcess.kill();
  }
}

async function printSummary() {
  log("\n" + "=".repeat(60));
  log("TEST SUMMARY");
  log("=".repeat(60));

  const passed = ctx.results.filter(r => r.passed).length;
  const failed = ctx.results.filter(r => !r.passed).length;
  const total = ctx.results.length;

  for (const result of ctx.results) {
    const status = result.passed ? "✓" : "✗";
    const time = `(${result.duration}ms)`;
    log(`${status} ${result.name} ${time}`);
    if (result.error) {
      log(`    Error: ${result.error}`);
    }
  }

  log("");
  log(`Passed: ${passed}/${total}`);
  log(`Failed: ${failed}/${total}`);

  // Write results to file for later analysis
  const resultsPath = path.join(ROOT_DIR, ".test-results.json");
  await Bun.write(resultsPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    results: ctx.results,
    logs: ctx.logs,
  }, null, 2));
  log(`\nResults written to ${resultsPath}`);

  return failed === 0;
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const skipElectron = args.includes("--skip-electron");
  const onlyServer = args.includes("--only-server");

  log("Electron E2E Test Framework");
  log(`Platform: ${process.platform}-${process.arch}`);
  log(`Root: ${ROOT_DIR}`);
  log("");

  try {
    // Phase 1: Prerequisites
    await testPrerequisites();

    // Phase 2: Bun binary
    await testBunBinaryDownload();

    // Phase 3: Web app
    await testWebAppBuild();

    if (!onlyServer) {
      // Phase 4: Electron setup
      await testElectronSetup();
    }

    // Phase 5: Server test
    await testStandaloneServer();

    if (!skipElectron && !onlyServer) {
      // Phase 6: Electron launch
      await testElectronLaunch();
    }

  } catch (error) {
    logError(`Unexpected error: ${error}`);
  } finally {
    await cleanup();
  }

  const success = await printSummary();
  process.exit(success ? 0 : 1);
}

main();
