import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

export function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

export function run(command: string, args: string[], cwd: string): string {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    windowsHide: true
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stderr || result.stdout}`);
  }

  return result.stdout;
}

export function initGitRepo(repoRoot: string): void {
  run("git", ["init", "-b", "main"], repoRoot);
  run("git", ["config", "user.name", "Preflight Test"], repoRoot);
  run("git", ["config", "user.email", "preflight@example.test"], repoRoot);
}

export function commitAll(repoRoot: string, message = "initial commit"): void {
  run("git", ["add", "."], repoRoot);
  run("git", ["commit", "-m", message], repoRoot);
}
