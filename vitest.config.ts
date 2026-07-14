import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { defineConfig } from "vitest/config";

// Isolate product data so unit tests never write into the user's real %APPDATA%/HFQ-Code.
const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "hfq-vitest-data-"));
process.env.HFQ_DATA_DIR = testDataDir;

export default defineConfig({
  test: {
    include: ["packages/**/src/**/*.test.ts", "packages/**/tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 30_000,
    reporters: ["default"],
    env: {
      HFQ_DATA_DIR: testDataDir,
    },
  },
});
