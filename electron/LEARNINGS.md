# Electron Wrapper Implementation Learnings

Issues encountered and solutions discovered while wrapping a Bun web app in Electron.

---

## Issue 1: ESM vs CommonJS Module Conflicts

### Problem
Modern npm packages are increasingly ESM-only (`get-port`, `electron-store`), but Electron's Node.js environment and TypeScript compilation can create conflicts.

### Symptoms
```
Error [ERR_REQUIRE_ESM]: require() of ES Module .../get-port/index.js not supported
```

### Solution
Add `"type": "module"` to `electron/package.json` to make Node.js treat `.js` files as ESM.

```json
{
  "type": "module",
  "main": "dist/main/index.js"
}
```

### Gotcha
Some packages like `electron-updater` are still CommonJS. When importing from ESM, use default import:

```typescript
// Before (fails)
import { autoUpdater } from "electron-updater";

// After (works)
import electronUpdater from "electron-updater";
const { autoUpdater } = electronUpdater;
```

---

## Issue 2: Preload Scripts Don't Support ESM

### Problem
Electron's preload scripts run in a sandboxed context that doesn't support ES modules, even with `"type": "module"` in package.json.

### Symptoms
```
SyntaxError: Cannot use import statement outside a module
```

### Solution
Compile preload scripts to CommonJS separately:

**tsconfig.preload.json:**
```json
{
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "Node"
  }
}
```

**tsconfig.main.json** (keep as ESM):
```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```

---

## Issue 3: `__dirname` Not Available in ESM

### Problem
ESM modules don't have `__dirname` or `__filename` globals.

### Symptoms
```
ReferenceError: __dirname is not defined
```

### Solution
Use `import.meta.url` to reconstruct the path:

```typescript
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
```

---

## Issue 4: Bundled Bun Version Compatibility

### Problem
The bundled Bun binary must support the same APIs as the development version. Older Bun versions may lack features like the `routes` API in `Bun.serve()`.

### Symptoms
```
TypeError: Expected fetch() to be a function
```

### Solution
Match the bundled Bun version to your development version, or at least ensure it supports your server's API:

```typescript
// download-bun.ts
const BUN_VERSION = "1.2.5"; // Must support routes API
```

Add `--force` flag to re-download when updating:
```bash
bun scripts/download-bun.ts --current --force
```

---

## Issue 5: Dev Mode Server Conflicts

### Problem
Running Electron's internal Bun server alongside the web dev server causes:
1. Port conflicts
2. Module serving issues (MIME type errors)
3. Hot reloading doesn't work

### Symptoms
```
Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of "text/html"
```

### Solution
In dev mode, connect Electron to the external web dev server instead of starting an internal server:

**electron/src/main/index.ts:**
```typescript
const DEV_SERVER_URL = process.env.ELECTRON_DEV_URL;
const isDev = !!DEV_SERVER_URL;

app.whenReady().then(async () => {
  let port: number;

  if (isDev && DEV_SERVER_URL) {
    // Dev mode: connect to external dev server
    const url = new URL(DEV_SERVER_URL);
    port = parseInt(url.port, 10) || 3000;
  } else {
    // Production: start internal Bun server
    port = await startServer();
  }

  createWindow(port);
});
```

**electron/package.json:**
```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:web\" \"npm run dev:electron\"",
    "dev:web": "cd .. && bun run dev",
    "dev:electron": "wait-on http://localhost:3000 && npm run build && ELECTRON_DEV_URL=http://localhost:3000 electron ."
  }
}
```

---

## Issue 6: nvm/Node.js PATH Issues

### Problem
When spawning processes from Electron or test scripts, `node`/`npm` may not be found if using nvm with lazy loading.

### Symptoms
```
env: node: No such file or directory
```

### Solution
For test scripts, use `bash -lc` to run commands through a login shell:

```typescript
const proc = spawn({
  cmd: ["bash", "-lc", command],
  // ...
});
```

For Electron in production, this isn't an issue since we bundle Bun and don't need Node.js at runtime.

---

## Issue 7: Storage Path for Electron

### Problem
The web app stores data in the current working directory, but Electron apps should use the userData directory.

### Solution
Make storage path configurable via environment variable:

**src/lib/storage.ts:**
```typescript
const DATA_DIR = process.env.TAX_UI_DATA_DIR || process.cwd();
const RETURNS_FILE = path.join(DATA_DIR, ".tax-returns.json");
```

**electron/src/main/bun-server.ts:**
```typescript
serverProcess = spawn(bunPath, ["run", serverPath, "--port", String(port)], {
  env: {
    ...process.env,
    TAX_UI_DATA_DIR: app.getPath("userData"),
  },
});
```

---

## Architecture Decisions

### Two Package Managers
- **Bun** for the web app (faster, simpler)
- **npm** for Electron (better tooling compatibility with electron-builder)

### Two TypeScript Configs
- **tsconfig.main.json** - ESM for main process
- **tsconfig.preload.json** - CommonJS for preload scripts

### Dev vs Production Server
- **Dev mode**: Electron connects to external `bun --hot` dev server (hot reloading works)
- **Production**: Electron spawns bundled Bun binary to run the server

---

## Testing Strategy

Created `scripts/test-electron.ts` - an automated E2E test framework that:
1. Verifies prerequisites (Node, npm, Bun)
2. Downloads/validates bundled Bun binary
3. Builds web app and Electron
4. Tests standalone server
5. Launches Electron and verifies server starts inside it
6. Makes HTTP requests to validate functionality

Run with: `bun scripts/test-electron.ts`

Key insight: The test framework caught most of the module compatibility issues automatically, enabling rapid iteration.

---

## Files Modified/Created

### Modified
- `src/lib/storage.ts` - Added `TAX_UI_DATA_DIR` support
- `package.json` - Added electron scripts
- `tsconfig.json` - Excluded electron/scripts directories
- `.gitignore` - Added electron artifacts

### Created
- `electron/package.json`
- `electron/tsconfig.main.json`
- `electron/tsconfig.preload.json`
- `electron/electron-builder.yml`
- `electron/entitlements.mac.plist`
- `electron/src/main/index.ts`
- `electron/src/main/bun-server.ts`
- `electron/src/main/window.ts`
- `electron/src/main/updater.ts`
- `electron/src/preload/index.ts`
- `scripts/download-bun.ts`
- `scripts/test-electron.ts`
- `.github/workflows/electron-release.yml`
