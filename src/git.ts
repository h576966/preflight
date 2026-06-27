import { spawnSync } from "node:child_process";
import path from "node:path";
import type { ChangedFile } from "./types.js";

export function findGitRoot(startPath: string): string {
  const result = runGit(startPath, ["rev-parse", "--show-toplevel"]);
  if (!result.ok) {
    throw new Error(`Not a git repository: ${startPath}`);
  }
  return path.resolve(result.stdout.trim());
}

export function getRemoteUrl(repoRoot: string): string | null {
  const result = runGit(repoRoot, ["config", "--get", "remote.origin.url"]);
  return result.ok ? emptyToNull(result.stdout.trim()) : null;
}

export function inferOwnerRepo(remoteUrl: string | null): string | null {
  if (!remoteUrl) {
    return null;
  }

  const normalized = remoteUrl.replace(/\.git$/, "");

  const sshMatch = normalized.match(/^git@github\.com:(?<owner>[^/]+)\/(?<repo>.+)$/);
  if (sshMatch?.groups) {
    return `${sshMatch.groups.owner}/${sshMatch.groups.repo}`;
  }

  const sshUrlMatch = normalized.match(/^ssh:\/\/git@github\.com\/(?<owner>[^/]+)\/(?<repo>.+)$/);
  if (sshUrlMatch?.groups) {
    return `${sshUrlMatch.groups.owner}/${sshUrlMatch.groups.repo}`;
  }

  try {
    const url = new URL(normalized);
    if (url.hostname !== "github.com") {
      return null;
    }
    const [owner, repo] = url.pathname.replace(/^\//, "").split("/");
    return owner && repo ? `${owner}/${repo}` : null;
  } catch {
    return null;
  }
}

export function getBranch(repoRoot: string): string {
  const branch = runGit(repoRoot, ["branch", "--show-current"]);
  if (branch.ok && branch.stdout.trim()) {
    return branch.stdout.trim();
  }

  const fallback = runGit(repoRoot, ["rev-parse", "--abbrev-ref", "HEAD"]);
  return fallback.ok ? fallback.stdout.trim() : "unknown";
}

export function getHead(repoRoot: string): string | null {
  const result = runGit(repoRoot, ["rev-parse", "HEAD"]);
  return result.ok ? emptyToNull(result.stdout.trim()) : null;
}

export function getUpstream(repoRoot: string): string | null {
  const result = runGit(repoRoot, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
  return result.ok ? emptyToNull(result.stdout.trim()) : null;
}

export function getChangedFiles(repoRoot: string): ChangedFile[] {
  const result = runGit(repoRoot, ["-c", "core.quotePath=false", "status", "--porcelain=v1"]);
  if (!result.ok) {
    return [];
  }

  return result.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map(parseStatusLine)
    .filter((file): file is ChangedFile => file !== null);
}

function parseStatusLine(line: string): ChangedFile | null {
  if (line.length < 4) {
    return null;
  }

  const x = line[0] ?? " ";
  const y = line[1] ?? " ";
  const status = `${x}${y}`;
  let filePath = line.slice(3);

  if (filePath.includes(" -> ")) {
    filePath = filePath.split(" -> ").pop() ?? filePath;
  }

  return {
    path: toPosixPath(filePath),
    status,
    staged: x !== " " && x !== "?",
    unstaged: y !== " " && y !== "?",
    untracked: x === "?" && y === "?"
  };
}

export function runGit(cwd: string, args: string[]): { ok: true; stdout: string } | { ok: false; stderr: string } {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true
  });

  if (result.status === 0) {
    return { ok: true, stdout: result.stdout };
  }

  return { ok: false, stderr: result.stderr || result.stdout || "git command failed" };
}

function emptyToNull(value: string): string | null {
  return value.length > 0 ? value : null;
}

function toPosixPath(value: string): string {
  return value.replaceAll("\\", "/");
}
