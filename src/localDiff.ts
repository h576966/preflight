import { DEFAULT_LIMITS } from "./constants.js";
import { findGitRoot, getHead, runGit } from "./git.js";
import { isDefaultIgnoredPath, isSecretPath, resolveInsideRoot } from "./pathSafety.js";
import type { LocalDiff, LocalDiffFile, LocalDiffScope, OmittedDiffFile } from "./types.js";

export type LocalDiffOptions = {
  repoPath: string;
  scope: LocalDiffScope;
  paths?: string[];
  contextLines?: number;
  maxBytes?: number;
};

type ParsedPatch = LocalDiffFile | { path: string; binary: true };

export function createLocalDiff(options: LocalDiffOptions): LocalDiff {
  const repoRoot = findGitRoot(options.repoPath);
  const contextLines = normalizeContextLines(options.contextLines);
  const maxBytes = normalizeMaxBytes(options.maxBytes);
  const paths = normalizePaths(repoRoot, options.paths);

  const patches = options.scope === "all" && getHead(repoRoot) === null
    ? [
        ...runDiff(repoRoot, "staged", contextLines, paths),
        ...runDiff(repoRoot, "unstaged", contextLines, paths)
      ]
    : runDiff(repoRoot, options.scope, contextLines, paths);

  return boundPatches(patches, maxBytes);
}

function normalizeContextLines(value: number | undefined): number {
  const contextLines = value ?? 3;
  if (!Number.isInteger(contextLines) || contextLines < 0 || contextLines > 20) {
    throw new Error("contextLines must be an integer between 0 and 20");
  }
  return contextLines;
}

function normalizeMaxBytes(value: number | undefined): number {
  const maxBytes = value ?? DEFAULT_LIMITS.maxDiffBytes;
  if (!Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > DEFAULT_LIMITS.maxDiffBytes) {
    throw new Error(`maxBytes must be an integer between 1 and ${DEFAULT_LIMITS.maxDiffBytes}`);
  }
  return maxBytes;
}

function normalizePaths(repoRoot: string, paths: string[] | undefined): string[] {
  if (!paths || paths.length === 0) {
    return [];
  }

  return paths.map((requestedPath) => resolveInsideRoot(repoRoot, requestedPath).relativePath);
}

function runDiff(
  repoRoot: string,
  scope: LocalDiffScope,
  contextLines: number,
  paths: string[]
): ParsedPatch[] {
  const args = ["-c", "core.quotePath=false", "diff", "--no-ext-diff", `--unified=${contextLines}`];

  if (scope === "staged") {
    args.push("--cached");
  } else if (scope === "all") {
    args.push("HEAD");
  }

  if (paths.length > 0) {
    args.push("--", ...paths);
  }

  const result = runGit(repoRoot, args);
  if (!result.ok || result.stdout.trim().length === 0) {
    return [];
  }

  return splitDiff(result.stdout).map(parsePatch).filter((patch): patch is ParsedPatch => patch !== null);
}

function splitDiff(diff: string): string[] {
  const lines = diff.split(/\r?\n/);
  const chunks: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (line.startsWith("diff --git ") && current.length > 0) {
      chunks.push(current.join("\n"));
      current = [];
    }
    current.push(line);
  }

  if (current.length > 0) {
    chunks.push(current.join("\n"));
  }

  return chunks;
}

function parsePatch(patch: string): ParsedPatch | null {
  const lines = patch.split("\n");
  const path = getPatchPath(lines);
  if (!path) {
    return null;
  }

  if (lines.some((line) => line.startsWith("Binary files ") || line === "GIT binary patch")) {
    return { path, binary: true };
  }

  let additions = 0;
  let deletions = 0;
  for (const line of lines) {
    if (line.startsWith("+") && !line.startsWith("+++")) {
      additions += 1;
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      deletions += 1;
    }
  }

  return {
    path,
    changeType: getChangeType(lines),
    additions,
    deletions,
    patch
  };
}

function getPatchPath(lines: string[]): string | null {
  const renameTo = lines.find((line) => line.startsWith("rename to "));
  if (renameTo) {
    return normalizeGitPath(renameTo.slice("rename to ".length));
  }

  const plusLine = lines.find((line) => line.startsWith("+++ "));
  if (plusLine && !plusLine.includes("/dev/null")) {
    return normalizeGitPath(plusLine.slice(4));
  }

  const minusLine = lines.find((line) => line.startsWith("--- "));
  if (minusLine && !minusLine.includes("/dev/null")) {
    return normalizeGitPath(minusLine.slice(4));
  }

  const header = lines.find((line) => line.startsWith("diff --git "));
  if (!header) {
    return null;
  }

  const parts = header.split(" ");
  return parts[3] ? normalizeGitPath(parts[3]) : null;
}

function normalizeGitPath(value: string): string {
  return value
    .replace(/^"|"$/g, "")
    .replace(/^[ab]\//, "")
    .replaceAll("\\", "/");
}

function getChangeType(lines: string[]): LocalDiffFile["changeType"] {
  if (lines.some((line) => line.startsWith("new file mode"))) {
    return "added";
  }
  if (lines.some((line) => line.startsWith("deleted file mode"))) {
    return "deleted";
  }
  if (lines.some((line) => line.startsWith("rename from ") || line.startsWith("rename to "))) {
    return "renamed";
  }
  return "modified";
}

function boundPatches(patches: ParsedPatch[], maxBytes: number): LocalDiff {
  let usedBytes = 0;
  let truncated = false;
  const files: LocalDiffFile[] = [];
  const omittedFiles: OmittedDiffFile[] = [];

  for (const patch of patches) {
    if ("binary" in patch) {
      omittedFiles.push({ path: patch.path, reason: "binary-or-unreadable" });
      continue;
    }

    const omissionReason = getOmissionReason(patch.path);
    if (omissionReason) {
      omittedFiles.push({ path: patch.path, reason: omissionReason });
      continue;
    }

    const patchBytes = Buffer.byteLength(patch.patch, "utf8");
    if (usedBytes + patchBytes > maxBytes) {
      truncated = true;
      omittedFiles.push({ path: patch.path, reason: "byte-budget" });
      continue;
    }

    usedBytes += patchBytes;
    files.push(patch);
  }

  return { truncated, files, omittedFiles };
}

function getOmissionReason(path: string): OmittedDiffFile["reason"] | null {
  if (isSecretPath(path)) {
    return "secret-blocked";
  }
  if (isDefaultIgnoredPath(path)) {
    return "ignored";
  }
  return null;
}
