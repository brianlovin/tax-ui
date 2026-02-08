#!/usr/bin/env bun
import { mkdir, rm } from "fs/promises";
import path from "path";

async function main(): Promise<void> {
  const outDir = path.join(import.meta.dir, "..", "resources", "server");

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const result = await Bun.build({
    entrypoints: [path.join(import.meta.dir, "..", "src", "index.ts")],
    target: "bun",
    minify: true,
    outdir: outDir,
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
    },
  });

  if (!result.success) {
    console.error("Server build failed");
    process.exit(1);
  }

  console.log(`Server bundle written to ${outDir}`);
}

main().catch((error) => {
  console.error("Server build error:", error);
  process.exit(1);
});
