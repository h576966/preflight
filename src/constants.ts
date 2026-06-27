export const DEFAULT_PORT = 3327;

export const DEFAULT_LIMITS = {
  maxDiffBytes: 60_000,
  maxReadBytes: 60_000,
  maxSnapshotFileBytes: 8_192,
  maxSnapshotContentBytes: 24_576
} as const;

export const HARD_BLOCKED_PATTERNS = [
  ".env",
  ".env.*",
  "*.key",
  "*.pem",
  "*.crt",
  "*.cer",
  "*.p12",
  "*.pfx"
] as const;

export const DEFAULT_IGNORED_DIRECTORIES = [
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage"
] as const;

export const SNAPSHOT_CONTEXT_PATTERNS = [
  "AGENTS.md",
  "README*",
  "package.json",
  "tsconfig*.json",
  "vite.config.*",
  "next.config.*",
  "eslint.config.*",
  "pyproject.toml",
  "requirements*.txt",
  "setup.py",
  "setup.cfg",
  "pytest.ini"
] as const;
