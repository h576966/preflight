import fs from "node:fs";
import path from "node:path";
import { DEFAULT_LIMITS } from "./constants.js";
import {
  findGitRoot,
  getBranch,
  getChangedFiles,
  getHead,
  getRemoteUrl,
  getUpstream,
  inferOwnerRepo
} from "./git.js";
import { classifyContextFile, matchesSnapshotContextPattern } from "./filePatterns.js";
import { isReadableProjectPath, isSecretPath, resolveInsideRoot } from "./pathSafety.js";
import type { ContextFile, ProjectSnapshot } from "./types.js";

export type SnapshotOptions = {
  repoPath: string;
};

export function createProjectSnapshot(options: SnapshotOptions): ProjectSnapshot {
  const root = findGitRoot(options.repoPath);
  const remoteUrl = getRemoteUrl(root);
  const changedFiles = getChangedFiles(root).filter((file) => isReadableProjectPath(file.path));
  const instructionFiles = findInstructionFiles(root);
  const contextFiles = readSnapshotContextFiles(root);

  return {
    root,
    name: path.basename(root),
    git: {
      remoteUrl,
      ownerRepo: inferOwnerRepo(remoteUrl),
      branch: getBranch(root),
      head: getHead(root),
      upstream: getUpstream(root)
    },
    changedFiles,
    instructionFiles,
    contextFiles,
    stackHints: detectStackHints(root),
    limits: { ...DEFAULT_LIMITS }
  };
}

function findInstructionFiles(repoRoot: string): string[] {
  const candidates = fs.readdirSync(repoRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.toLowerCase() === "agents.md" || name.toLowerCase().startsWith("readme"))
    .filter((name) => !isSecretPath(name))
    .sort((left, right) => left.localeCompare(right));

  return candidates.map((name) => resolveInsideRoot(repoRoot, name).relativePath);
}

function readSnapshotContextFiles(repoRoot: string): ContextFile[] {
  let totalBytes = 0;
  const files: ContextFile[] = [];

  for (const relativePath of findSnapshotContextPaths(repoRoot)) {
    const safePath = resolveInsideRoot(repoRoot, relativePath);
    const stat = fs.statSync(safePath.absolutePath);
    if (!stat.isFile() || stat.size > DEFAULT_LIMITS.maxSnapshotFileBytes) {
      continue;
    }
    if (totalBytes + stat.size > DEFAULT_LIMITS.maxSnapshotContentBytes) {
      continue;
    }

    const content = fs.readFileSync(safePath.absolutePath, "utf8");
    totalBytes += Buffer.byteLength(content, "utf8");

    files.push({
      path: safePath.relativePath,
      kind: classifyContextFile(safePath.relativePath),
      content,
      truncated: false
    });
  }

  return files;
}

function findSnapshotContextPaths(repoRoot: string): string[] {
  const entries = fs.readdirSync(repoRoot, { withFileTypes: true });
  const paths = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => matchesSnapshotContextPattern(name))
    .filter((name) => isReadableProjectPath(name))
    .sort(contextSort);

  return Array.from(new Set(paths));
}

function contextSort(left: string, right: string): number {
  const priority = (value: string): number => {
    const lower = value.toLowerCase();
    if (lower === "agents.md") return 0;
    if (lower.startsWith("readme")) return 1;
    if (lower === "package.json" || lower === "pyproject.toml") return 2;
    return 3;
  };

  return priority(left) - priority(right) || left.localeCompare(right);
}

function detectStackHints(repoRoot: string): string[] {
  const names = new Set(
    fs.readdirSync(repoRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name.toLowerCase())
  );

  const hints = new Set<string>();
  if (names.has("package.json")) {
    hints.add("typescript/javascript");
  }
  if (Array.from(names).some((name) => name.startsWith("tsconfig"))) {
    hints.add("typescript");
  }
  if (Array.from(names).some((name) => name.startsWith("next.config"))) {
    hints.add("nextjs");
  }
  if (Array.from(names).some((name) => name.startsWith("vite.config"))) {
    hints.add("vite");
  }
  if (
    names.has("pyproject.toml") ||
    names.has("setup.py") ||
    names.has("setup.cfg") ||
    Array.from(names).some((name) => name.startsWith("requirements"))
  ) {
    hints.add("python");
  }

  return Array.from(hints).sort();
}
