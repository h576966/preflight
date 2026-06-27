import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createTempDir, writeFile } from "./helpers.js";
import { isSecretPath, resolveInsideRoot } from "../src/pathSafety.js";

test("resolveInsideRoot resolves relative paths inside the repository root", () => {
  const repoRoot = createTempDir("preflight-path-");
  writeFile(path.join(repoRoot, "src", "index.ts"), "export {};\n");

  const resolved = resolveInsideRoot(repoRoot, "src/index.ts");

  assert.equal(resolved.absolutePath, path.join(repoRoot, "src", "index.ts"));
  assert.equal(resolved.relativePath, "src/index.ts");
});

test("resolveInsideRoot rejects paths that escape the repository root", () => {
  const repoRoot = createTempDir("preflight-path-");
  const outside = path.join(path.dirname(repoRoot), "outside.txt");
  fs.writeFileSync(outside, "outside", "utf8");

  assert.throws(() => resolveInsideRoot(repoRoot, "../outside.txt"), /escapes repository root/);
});

test("resolveInsideRoot rejects secret-like paths", () => {
  const repoRoot = createTempDir("preflight-path-");
  writeFile(path.join(repoRoot, ".env.local"), "SECRET=value\n");

  assert.throws(() => resolveInsideRoot(repoRoot, ".env.local"), /Blocked secret-like path/);
});

test("isSecretPath blocks env files, keys, and certificates", () => {
  assert.equal(isSecretPath(".env"), true);
  assert.equal(isSecretPath("config/.env.production"), true);
  assert.equal(isSecretPath("secrets/private.key"), true);
  assert.equal(isSecretPath("certs/local.pem"), true);
  assert.equal(isSecretPath("certs/local.crt"), true);
  assert.equal(isSecretPath("src/index.ts"), false);
});
