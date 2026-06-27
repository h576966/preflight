# Security Model

MVP is strictly read-only.

## Allowed Local Operations

- `git status --short --branch`
- `git diff` with bounded output
- `git rev-parse`
- `git ls-files`
- direct file reads under the configured repository root

## Blocked Operations

- writes
- deletes
- arbitrary shell execution
- `git reset`
- `git checkout`
- `git clean`
- dependency installs
- reading outside the configured repository root
- reading secret-like files

## Hard-Blocked Paths And Patterns

```text
.env
.env.*
*.key
*.pem
*.crt
*.cer
*.p12
*.pfx
```

## Default Ignored Output

These are not primarily security-sensitive, but should be skipped by default to keep output useful:

```text
.git/**
node_modules/**
dist/**
build/**
coverage/**
```

## Output Rules

- Every tool must enforce byte or match limits.
- Truncated output must be marked as truncated.
- Full repository dumps are not allowed.
- Tool responses should distinguish `local`, `github`, `user`, and `assumption` context when applicable.
