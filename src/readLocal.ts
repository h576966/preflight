import fs from "node:fs";
import { DEFAULT_LIMITS } from "./constants.js";
import { matchesSnapshotContextPattern } from "./filePatterns.js";
import { findGitRoot, getChangedFiles } from "./git.js";
import { isDefaultIgnoredPath, isReadableProjectPath, resolveInsideRoot } from "./pathSafety.js";
import type {
  OmittedReadLocalFile,
  ReadLocal,
  ReadLocalFile,
  ReadLocalRequestFile
} from "./types.js";

export type ReadLocalOptions = {
  repoPath: string;
  files: ReadLocalRequestFile[];
  maxBytes?: number;
};

type NormalizedReadLocalRequest = {
  path: string;
  startLine: number;
  endLine?: number;
};

type ReadTextResult =
  | { ok: true; content: string }
  | { ok: false; reason: OmittedReadLocalFile["reason"] };

export function createReadLocal(options: ReadLocalOptions): ReadLocal {
  const repoRoot = findGitRoot(options.repoPath);
  const requests = normalizeRequests(options.files);
  const maxBytes = normalizeMaxBytes(options.maxBytes);
  const locallyReadablePaths = getLocallyReadablePaths(repoRoot);

  let usedBytes = 0;
  let truncated = false;
  const files: ReadLocalFile[] = [];
  const omittedFiles: OmittedReadLocalFile[] = [];

  for (const request of requests) {
    const safePath = resolveInsideRoot(repoRoot, request.path);

    if (isDefaultIgnoredPath(safePath.relativePath)) {
      omittedFiles.push({ path: safePath.relativePath, reason: "ignored" });
      continue;
    }

    if (!locallyReadablePaths.has(safePath.relativePath) && !isAllowlistedRootFile(safePath.relativePath)) {
      omittedFiles.push({ path: safePath.relativePath, reason: "not-allowed" });
      continue;
    }

    if (usedBytes >= maxBytes) {
      truncated = true;
      omittedFiles.push({ path: safePath.relativePath, reason: "byte-budget" });
      continue;
    }

    const readResult = readTextFile(safePath.absolutePath);
    if (!readResult.ok) {
      omittedFiles.push({ path: safePath.relativePath, reason: readResult.reason });
      continue;
    }

    const selected = selectLineRange(readResult.content, request);
    const bounded = takeLinesWithinBudget(selected.lines, maxBytes - usedBytes);

    if (selected.lines.length > 0 && bounded.lineCount === 0) {
      truncated = true;
      omittedFiles.push({ path: safePath.relativePath, reason: "byte-budget" });
      continue;
    }

    usedBytes += Buffer.byteLength(bounded.content, "utf8");
    truncated = truncated || bounded.truncated;

    files.push({
      path: safePath.relativePath,
      startLine: selected.startLine,
      endLine: getEndLine(selected.startLine, bounded.lineCount),
      content: bounded.content,
      truncated: bounded.truncated
    });
  }

  return { files, omittedFiles, truncated };
}

function normalizeRequests(files: ReadLocalRequestFile[]): NormalizedReadLocalRequest[] {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("files must contain at least one file request");
  }

  return files.map((file) => {
    const startLine = file.startLine ?? 1;
    if (!Number.isInteger(startLine) || startLine < 1) {
      throw new Error("startLine must be a positive integer");
    }

    if (file.endLine !== undefined && (!Number.isInteger(file.endLine) || file.endLine < startLine)) {
      throw new Error("endLine must be an integer greater than or equal to startLine");
    }

    return {
      path: file.path,
      startLine,
      endLine: file.endLine
    };
  });
}

function normalizeMaxBytes(value: number | undefined): number {
  const maxBytes = value ?? DEFAULT_LIMITS.maxReadBytes;
  if (!Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > DEFAULT_LIMITS.maxReadBytes) {
    throw new Error(`maxBytes must be an integer between 1 and ${DEFAULT_LIMITS.maxReadBytes}`);
  }
  return maxBytes;
}

function getLocallyReadablePaths(repoRoot: string): Set<string> {
  return new Set(
    getChangedFiles(repoRoot)
      .filter((file) => isReadableProjectPath(file.path))
      .map((file) => file.path)
  );
}

function isAllowlistedRootFile(relativePath: string): boolean {
  return (
    !relativePath.includes("/") &&
    matchesSnapshotContextPattern(relativePath) &&
    isReadableProjectPath(relativePath)
  );
}

function getEndLine(startLine: number, lineCount: number): number {
  return lineCount > 0 ? startLine + lineCount - 1 : startLine;
}

function readTextFile(absolutePath: string): ReadTextResult {
  try {
    const stat = fs.statSync(absolutePath);
    if (!stat.isFile()) {
      return { ok: false, reason: "not-found" };
    }

    const content = fs.readFileSync(absolutePath, "utf8");
    return content.includes("\0")
      ? { ok: false, reason: "binary-or-unreadable" }
      : { ok: true, content };
  } catch {
    return fs.existsSync(absolutePath)
      ? { ok: false, reason: "binary-or-unreadable" }
      : { ok: false, reason: "not-found" };
  }
}

function selectLineRange(
  content: string,
  request: NormalizedReadLocalRequest
): { startLine: number; lines: string[] } {
  const lines = splitLinesWithEndings(content);
  const startIndex = request.startLine - 1;
  const endIndex = request.endLine === undefined ? lines.length : Math.min(request.endLine, lines.length);

  return {
    startLine: request.startLine,
    lines: startIndex >= lines.length ? [] : lines.slice(startIndex, endIndex)
  };
}

function splitLinesWithEndings(content: string): string[] {
  if (content.length === 0) {
    return [];
  }
  return content.match(/[^\r\n]*(?:\r\n|\n|\r|$)/g)?.filter((line) => line.length > 0) ?? [];
}

function takeLinesWithinBudget(lines: string[], maxBytes: number): {
  content: string;
  lineCount: number;
  truncated: boolean;
} {
  let usedBytes = 0;
  const selected: string[] = [];

  for (const line of lines) {
    const lineBytes = Buffer.byteLength(line, "utf8");
    if (usedBytes + lineBytes > maxBytes) {
      if (selected.length === 0 && maxBytes > 0) {
        return {
          content: truncateUtf8(line, maxBytes),
          lineCount: 1,
          truncated: true
        };
      }
      return {
        content: selected.join(""),
        lineCount: selected.length,
        truncated: true
      };
    }

    selected.push(line);
    usedBytes += lineBytes;
  }

  return {
    content: selected.join(""),
    lineCount: selected.length,
    truncated: false
  };
}

function truncateUtf8(value: string, maxBytes: number): string {
  let usedBytes = 0;
  let endIndex = 0;

  for (const char of value) {
    const charBytes = Buffer.byteLength(char, "utf8");
    if (usedBytes + charBytes > maxBytes) {
      break;
    }
    usedBytes += charBytes;
    endIndex += char.length;
  }

  return value.slice(0, endIndex);
}
