import path from "node:path";
import { SNAPSHOT_CONTEXT_PATTERNS } from "./constants.js";
import type { ContextFile } from "./types.js";

export function matchesSnapshotContextPattern(relativePath: string): boolean {
  const basename = path.posix.basename(toPosixPath(relativePath));
  return SNAPSHOT_CONTEXT_PATTERNS.some((pattern) => wildcardMatch(pattern, basename));
}

export function classifyContextFile(relativePath: string): ContextFile["kind"] {
  const basename = path.posix.basename(toPosixPath(relativePath)).toLowerCase();

  if (basename === "agents.md" || basename.startsWith("readme")) {
    return "instruction";
  }

  if (
    basename === "package.json" ||
    basename === "pyproject.toml" ||
    basename.startsWith("requirements") ||
    basename === "setup.py" ||
    basename === "setup.cfg"
  ) {
    return "manifest";
  }

  return "config";
}

export function wildcardMatch(pattern: string, value: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*");
  return new RegExp(`^${escaped}$`, "i").test(value);
}

function toPosixPath(value: string): string {
  return value.replaceAll("\\", "/");
}
