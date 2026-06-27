import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { commitAll, createTempDir, initGitRepo, writeFile } from "./helpers.js";
import { createReadLocal } from "../src/readLocal.js";

function createCommittedRepo(): string {
  const repoRoot = createTempDir("preflight-read-");
  initGitRepo(repoRoot);
  writeFile(path.join(repoRoot, "AGENTS.md"), "agent\nrules\n");
  writeFile(path.join(repoRoot, "README.md"), "# Demo\nMore detail\n");
  writeFile(path.join(repoRoot, "package.json"), "{\n  \"name\": \"demo\",\n  \"version\": \"1.0.0\"\n}\n");
  writeFile(path.join(repoRoot, "src", "a.ts"), "export const a = 1;\n");
  writeFile(path.join(repoRoot, "src", "unchanged.ts"), "export const unchanged = true;\n");
  commitAll(repoRoot);
  return repoRoot;
}

test("createReadLocal reads a selected line range from an allowlisted file", () => {
  const repoRoot = createCommittedRepo();

  const result = createReadLocal({
    repoPath: repoRoot,
    files: [{ path: "package.json", startLine: 2, endLine: 3 }]
  });

  assert.equal(result.truncated, false);
  assert.equal(result.omittedFiles.length, 0);
  assert.equal(result.files[0]?.path, "package.json");
  assert.equal(result.files[0]?.startLine, 2);
  assert.equal(result.files[0]?.endLine, 3);
  assert.equal(result.files[0]?.content, "  \"name\": \"demo\",\n  \"version\": \"1.0.0\"\n");
});

test("createReadLocal reads a changed tracked file", () => {
  const repoRoot = createCommittedRepo();
  writeFile(path.join(repoRoot, "src", "a.ts"), "export const a = 2;\n");

  const result = createReadLocal({
    repoPath: repoRoot,
    files: [{ path: "src/a.ts" }]
  });

  assert.deepEqual(result.omittedFiles, []);
  assert.equal(result.files[0]?.path, "src/a.ts");
  assert.equal(result.files[0]?.content, "export const a = 2;\n");
});

test("createReadLocal reads an untracked file", () => {
  const repoRoot = createCommittedRepo();
  writeFile(path.join(repoRoot, "src", "new.ts"), "export const localOnly = true;\n");

  const result = createReadLocal({
    repoPath: repoRoot,
    files: [{ path: "src/new.ts" }]
  });

  assert.deepEqual(result.omittedFiles, []);
  assert.equal(result.files[0]?.path, "src/new.ts");
  assert.equal(result.files[0]?.content, "export const localOnly = true;\n");
});

test("createReadLocal reads AGENTS.md and README files", () => {
  const repoRoot = createCommittedRepo();

  const result = createReadLocal({
    repoPath: repoRoot,
    files: [
      { path: "AGENTS.md", startLine: 1, endLine: 1 },
      { path: "README.md", startLine: 1, endLine: 1 }
    ]
  });

  assert.deepEqual(result.files.map((file) => file.path), ["AGENTS.md", "README.md"]);
  assert.equal(result.files[0]?.content, "agent\n");
  assert.equal(result.files[1]?.content, "# Demo\n");
});

test("createReadLocal returns stable line numbers for empty allowlisted files", () => {
  const repoRoot = createCommittedRepo();
  writeFile(path.join(repoRoot, "README.md"), "");

  const result = createReadLocal({
    repoPath: repoRoot,
    files: [{ path: "README.md" }]
  });

  assert.equal(result.files[0]?.startLine, 1);
  assert.equal(result.files[0]?.endLine, 1);
  assert.equal(result.files[0]?.content, "");
});

test("createReadLocal rejects paths escaping the repository root", () => {
  const repoRoot = createCommittedRepo();

  assert.throws(
    () => createReadLocal({ repoPath: repoRoot, files: [{ path: "../outside.ts" }] }),
    /escapes repository root/
  );
});

test("createReadLocal blocks .env, key, and certificate-like paths", () => {
  const repoRoot = createCommittedRepo();

  for (const blockedPath of [".env", "private.key", "server.crt", "bundle.pem"]) {
    assert.throws(
      () => createReadLocal({ repoPath: repoRoot, files: [{ path: blockedPath }] }),
      /Blocked secret-like path/
    );
  }
});

test("createReadLocal omits ignored directory paths", () => {
  const repoRoot = createCommittedRepo();
  writeFile(path.join(repoRoot, "node_modules", "pkg", "index.js"), "module.exports = true;\n");

  const result = createReadLocal({
    repoPath: repoRoot,
    files: [{ path: "node_modules/pkg/index.js" }]
  });

  assert.deepEqual(result.files, []);
  assert.deepEqual(result.omittedFiles, [{ path: "node_modules/pkg/index.js", reason: "ignored" }]);
});

test("createReadLocal omits non-allowlisted unchanged committed source files", () => {
  const repoRoot = createCommittedRepo();

  const result = createReadLocal({
    repoPath: repoRoot,
    files: [{ path: "src/unchanged.ts" }]
  });

  assert.deepEqual(result.files, []);
  assert.deepEqual(result.omittedFiles, [{ path: "src/unchanged.ts", reason: "not-allowed" }]);
});

test("createReadLocal enforces total byte budget and marks truncation", () => {
  const repoRoot = createCommittedRepo();

  const result = createReadLocal({
    repoPath: repoRoot,
    files: [{ path: "README.md" }],
    maxBytes: 8
  });

  assert.equal(result.truncated, true);
  assert.equal(result.files[0]?.truncated, true);
  assert.equal(result.files[0]?.content, "# Demo\n");
});

test("createReadLocal omits later files when the byte budget is exhausted", () => {
  const repoRoot = createCommittedRepo();

  const result = createReadLocal({
    repoPath: repoRoot,
    files: [
      { path: "AGENTS.md", startLine: 1, endLine: 1 },
      { path: "README.md", startLine: 1, endLine: 1 }
    ],
    maxBytes: 6
  });

  assert.equal(result.truncated, true);
  assert.deepEqual(result.files.map((file) => file.path), ["AGENTS.md"]);
  assert.deepEqual(result.omittedFiles, [{ path: "README.md", reason: "byte-budget" }]);
});
