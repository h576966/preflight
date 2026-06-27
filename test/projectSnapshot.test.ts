import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { commitAll, createTempDir, initGitRepo, run, writeFile } from "./helpers.js";
import { createProjectSnapshot } from "../src/projectSnapshot.js";

test("createProjectSnapshot returns local repo identity, changed files, and bounded context", () => {
  const repoRoot = createTempDir("preflight-snapshot-");
  initGitRepo(repoRoot);

  writeFile(path.join(repoRoot, "AGENTS.md"), "# AGENTS.md\n\n- Be concise.\n");
  writeFile(path.join(repoRoot, "README.md"), "# Demo\n");
  writeFile(path.join(repoRoot, "package.json"), JSON.stringify({ name: "demo", type: "module" }, null, 2));
  writeFile(path.join(repoRoot, "src", "index.ts"), "export const value = 1;\n");
  commitAll(repoRoot);

  run("git", ["remote", "add", "origin", "https://github.com/h576966/preflight.git"], repoRoot);

  writeFile(path.join(repoRoot, "src", "index.ts"), "export const value = 2;\n");
  writeFile(path.join(repoRoot, "src", "new.ts"), "export const created = true;\n");
  writeFile(path.join(repoRoot, ".env"), "SECRET=value\n");

  const snapshot = createProjectSnapshot({ repoPath: path.join(repoRoot, "src") });

  assert.equal(snapshot.root, repoRoot);
  assert.equal(snapshot.name, path.basename(repoRoot));
  assert.equal(snapshot.git.remoteUrl, "https://github.com/h576966/preflight.git");
  assert.equal(snapshot.git.ownerRepo, "h576966/preflight");
  assert.equal(snapshot.git.branch, "main");
  assert.match(snapshot.git.head ?? "", /^[a-f0-9]{40}$/);

  const changedPaths = snapshot.changedFiles.map((file) => file.path).sort();
  assert.deepEqual(changedPaths, ["src/index.ts", "src/new.ts"]);
  assert.equal(snapshot.changedFiles.find((file) => file.path === "src/index.ts")?.unstaged, true);
  assert.equal(snapshot.changedFiles.find((file) => file.path === "src/new.ts")?.untracked, true);

  assert.deepEqual(snapshot.instructionFiles, ["AGENTS.md", "README.md"]);

  const contextPaths = snapshot.contextFiles.map((file) => file.path).sort();
  assert.deepEqual(contextPaths, ["AGENTS.md", "README.md", "package.json"]);
  assert.equal(snapshot.contextFiles.some((file) => file.content.includes("SECRET")), false);
  assert.ok(snapshot.stackHints.includes("typescript/javascript"));
});
