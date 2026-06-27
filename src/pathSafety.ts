import fs from "node:fs";
import path from "node:path";
import { DEFAULT_IGNORED_DIRECTORIES, HARD_BLOCKED_PATTERNS } from "./constants.js";

export type SafePath = {
  absolutePath: string;
  relativePath: string;
};

export function resolveInsideRoot(repoRoot: string, requestedPath: string): SafePath {
  if (!requestedPath || requestedPath.includes("\0")) {
    throw new Error("Invalid path");
  }

  const root = path.resolve(repoRoot);
  const absolutePath = path.isAbsolute(requestedPath)
    ? path.resolve(requestedPath)
    : path.resolve(root, requestedPath);

  assertInsideRoot(root, absolutePath);

  if (fs.existsSync(absolutePath)) {
    const realRoot = fs.realpathSync(root);
    const realPath = fs.realpathSync(absolutePath);
    assertInsideRoot(realRoot, realPath);
  }

  const relativePath = toPosixPath(path.relative(root, absolutePath));
  if (isSecretPath(relativePath)) {
    throw new Error(`Blocked secret-like path: ${relativePath}`);
  }

  return { absolutePath, relativePath };
}

export function isSecretPath(relativePath: string): boolean {
  const normalized = toPosixPath(relativePath);
  const basename = path.posix.basename(normalized);

  return HARD_BLOCKED_PATTERNS.some((pattern) => {
    if (pattern === ".env") {
      return basename === ".env";
    }
    if (pattern === ".env.*") {
      return basename.startsWith(".env.");
    }
    if (pattern.startsWith("*.")) {
      return basename.endsWith(pattern.slice(1));
    }
    return basename === pattern;
  });
}

export function isDefaultIgnoredPath(relativePath: string): boolean {
  const parts = toPosixPath(relativePath).split("/");
  return parts.some((part) => DEFAULT_IGNORED_DIRECTORIES.includes(part as never));
}

export function isReadableProjectPath(relativePath: string): boolean {
  return !isSecretPath(relativePath) && !isDefaultIgnoredPath(relativePath);
}

function assertInsideRoot(root: string, candidate: string): void {
  const relative = path.relative(root, candidate);
  if (relative === "") {
    return;
  }
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path escapes repository root: ${candidate}`);
  }
}

function toPosixPath(value: string): string {
  return value.replaceAll("\\", "/");
}
