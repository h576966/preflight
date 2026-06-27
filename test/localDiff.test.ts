import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { commitAll, createTempDir, initGitRepo, run, writeFile } from "./helpers.js";
import { createLocalDiff } from "../src/localDiff.js";

function createCommittedRepo(): string {
  const repoRoot = createTempDir("preflight-diff-");
  initGitRepo(repoRoot);
  writeFile(path.join(repoRoot, "src", "a.ts"), "export const a = 1;\n");
  writeFile(path.join(repoRoot, "src", "b.ts"), "export const b = 1;\n");
  commitAll(repoRoot);
  return repoRoot;
}

test("createLocalDiff returns an unstaged tracked-file patch", () => {
  const repoRoot = createCommittedRepo();
  writeFile(path.join(repoRoot, "src", "a.ts"), "export const a = 2;\n");
  writeFile(path.join(repoRoot, "src", "untracked.ts"), "export const untracked = true;\n");

  const diff = createLocalDiff({ repoPath: repoRoot, scope: "unstaged" });

  assert.equal(diff.truncated, false);
  assert.deepEqual(diff.files.map((file) => file.path), ["src/a.ts"]);
  assert.equal(diff.files[0]?.changeType, "modified");
  assert.equal(diff.files[0]?.additions, 1);
  assert.equal(diff.files[0]?.deletions, 1);
  assert.match(diff.files[0]?.patch ?? "", /\+export const a = 2;/);
  assert.equal(diff.omittedFiles.length, 0);
});

test("createLocalDiff returns a staged tracked-file patch", () => {
  const repoRoot = createCommittedRepo();
  writeFile(path.join(repoRoot, "src", "a.ts"), "export const a = 3;\n");
  run("git", ["add", "src/a.ts"], repoRoot);

  const diff = createLocalDiff({ repoPath: repoRoot, scope: "staged" });

  assert.deepEqual(diff.files.map((file) => file.path), ["src/a.ts"]);
  assert.match(diff.files[0]?.patch ?? "", /\+export const a = 3;/);
});

test("createLocalDiff all includes staged and unstaged tracked changes", () => {
  const repoRoot = createCommittedRepo();
  writeFile(path.join(repoRoot, "src", "a.ts"), "export const a = 4;\n");
  run("git", ["add", "src/a.ts"], repoRoot);
  writeFile(path.join(repoRoot, "src", "b.ts"), "export const b = 5;\n");

  const diff = createLocalDiff({ repoPath: repoRoot, scope: "all" });

  assert.deepEqual(diff.files.map((file) => file.path).sort(), ["src/a.ts", "src/b.ts"]);
});

test("createLocalDiff filters paths", () => {
  const repoRoot = createCommittedRepo();
  writeFile(path.join(repoRoot, "src", "a.ts"), "export const a = 6;\n");
  writeFile(path.join(repoRoot, "src", "b.ts"), "export const b = 7;\n");

  const diff = createLocalDiff({ repoPath: repoRoot, scope: "unstaged", paths: ["src/a.ts"] });

  assert.deepEqual(diff.files.map((file) => file.path), ["src/a.ts"]);
});

test("createLocalDiff omits blocked secret-like files", () => {
  const repoRoot = createTempDir("preflight-diff-");
  initGitRepo(repoRoot);
  writeFile(path.join(repoRoot, ".env"), "TOKEN=old\n");
  commitAll(repoRoot);

  writeFile(path.join(repoRoot, ".env"), "TOKEN=new\n");

  const diff = createLocalDiff({ repoPath: repoRoot, scope: "all" });

  assert.deepEqual(diff.files, []);
  assert.deepEqual(diff.omittedFiles, [{ path: ".env", reason: "secret-blocked" }]);
});

test("createLocalDiff rejects path filters that escape the repository root", () => {
  const repoRoot = createCommittedRepo();

  assert.throws(
    () => createLocalDiff({ repoPath: repoRoot, scope: "unstaged", paths: ["../outside.ts"] }),
    /escapes repository root/
  );
});

test("createLocalDiff truncates and records byte-budget omissions", () => {
  const repoRoot = createCommittedRepo();
  writeFile(path.join(repoRoot, "src", "a.ts"), "export const a = 8;\n");
  writeFile(path.join(repoRoot, "src", "b.ts"), "export const b = 9;\n");

  const diff = createLocalDiff({ repoPath: repoRoot, scope: "unstaged", maxBytes: 1 });

  assert.equal(diff.truncated, true);
  assert.equal(diff.files.length, 0);
  assert.deepEqual(
    diff.omittedFiles.map((file) => file.reason),
    ["byte-budget", "byte-budget"]
  );
});
