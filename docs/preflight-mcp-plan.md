# Preflight MCP Plan

Date: 2026-06-27

## Purpose

Make ChatGPT a more trustworthy companion for discussing a current coding project and improving prompts that may later be used in Codex.

ChatGPT can already reason, discuss tradeoffs, use the GitHub tool, and write prompts. Preflight should only add the small amount of local context ChatGPT cannot reliably see:

- current local repository identity
- local worktree status
- staged and unstaged diffs
- selected local file ranges
- local instruction files such as `AGENTS.md`
- multiple-choice alignment UI

## Core Principle

Preflight transports local truth. ChatGPT does the reasoning.

The MCP server should not become:

- a coding agent
- a GitHub client
- a review engine
- a prompt-generation engine
- a general shell wrapper
- a repository indexer

## Product Shape

```text
ChatGPT
  -> GitHub tool for committed remote context
  -> Preflight MCP/App for local worktree context and alignment UI
    -> git status/diff wrappers
    -> safe local file reader
    -> simple question UI
```

## GitHub Boundary

Use the ChatGPT GitHub tool for:

- committed source files
- README and docs from the remote repository
- broad code search
- citations to committed code

Do not assume PR, issue, review-comment, branch-management, or CI/check workflows for this personal MVP.

Known GitHub tool limitations for this design:

- Availability can vary by ChatGPT plan and experience.
- The GitHub app is read-only for repository analysis/search; it does not push code or update PRs.
- Searching for specific file names is not supported, so do not depend on GitHub for exact path lookup.
- Newly connected, private, or newly created repositories can take a few minutes to appear or be indexed.

Use Preflight for:

- uncommitted local worktree state
- staged and unstaged diffs
- untracked/local-only files when explicitly read
- local instructions and conventions
- exact local filesystem state and exact local path reads
- multiple-choice alignment questions

Preflight should expose GitHub identity hints, but it should not call the GitHub API.

## Accepted MVP Decisions

- One active repository per chat/session.
- Project switching happens by changing config or startup target between chats.
- Built primarily for personal use by the repository owner.
- Strictly read-only.
- Hard-block `.env`, `.env.*`, private keys, certificates, and similar secret material.
- Assume TS/JS and Python projects only for MVP.
- Select the active repository with `--repo <path>`, falling back to the current working directory.
- Use Secure MCP Tunnel as the default ChatGPT connection path.
- Keep MVP app authentication simple: no OAuth/bearer token in the first personal-use version.
- Use an 80/20 local-read model: changed files, untracked files, instruction files, and a small allowlist of high-value non-secret TS/JS/Python project files.
- In-memory session state only.
- ChatGPT writes conclusions, recommendations, and Codex prompts.
- The early UI focuses on multiple-choice questions.
- Prompt preview stays in normal ChatGPT chat for MVP.
- Treat `AGENTS.md` and README guidance as strong recommendations, not hidden hard policy.
- Assume the ChatGPT GitHub tool can provide committed repository code, README/docs, search, analysis, and citations.
- Do not assume PR, issue, review, or CI context in this version.
- Review requests mean local/manual review by default.
- Do not use CodeRabbit for this repository.
- Use the current branch for ordinary small changes. Create short-lived branches only for risky, experimental, or parallel work, and do not accumulate branches.

## MVP Tool Surface

Keep the external MCP surface small.

### project_snapshot

Purpose: give ChatGPT enough local state to understand what has changed and how to route follow-up context requests.

Returns:

```json
{
  "root": "string",
  "name": "string",
  "git": {
    "remoteUrl": "string|null",
    "ownerRepo": "string|null",
    "branch": "string",
    "head": "string",
    "upstream": "string|null"
  },
  "changedFiles": [
    {
      "path": "string",
      "status": "string",
      "staged": true,
      "unstaged": true,
      "untracked": false
    }
  ],
  "instructionFiles": ["string"],
  "contextFiles": [
    {
      "path": "string",
      "kind": "instruction|manifest|config",
      "content": "string",
      "truncated": false
    }
  ],
  "stackHints": ["string"],
  "limits": {
    "maxDiffBytes": 60000,
    "maxReadBytes": 60000,
    "maxSnapshotFileBytes": 8192,
    "maxSnapshotContentBytes": 24576
  }
}
```

Implementation notes:

- Use local `git` only.
- Infer `ownerRepo` from remote URL when possible.
- Include `AGENTS.md` and README paths if present.
- Auto-include small high-value instruction/manifest contents when under size limits.
- List oversized files without content and let ChatGPT request explicit `read_local` if needed.
- Do not include lockfile contents automatically.

### local_diff

Purpose: provide bounded local diffs when local changes matter.

Inputs:

```json
{
  "scope": "staged|unstaged|all",
  "paths": ["string"],
  "contextLines": 3,
  "maxBytes": 60000
}
```

Returns:

```json
{
  "truncated": false,
  "files": [
    {
      "path": "string",
      "changeType": "string",
      "additions": 0,
      "deletions": 0,
      "patch": "string"
    }
  ],
  "omittedFiles": [
    {
      "path": "string",
      "reason": "secret-blocked|ignored|binary-or-unreadable|byte-budget"
    }
  ]
}
```

Implementation notes:

- No branch comparison in MVP; GitHub can handle remote comparisons.
- `project_snapshot` already provides changed-file metadata, so this tool returns bounded patches by default.
- Untracked file contents are not included; use `project_snapshot` for untracked paths and wait for `read_local` for explicit untracked reads.
- Apply deny patterns before returning patches.
- Mark truncation clearly.

### read_local

Purpose: read selected local file ranges.

Inputs:

```json
{
  "files": [
    {
      "path": "string",
      "startLine": 1,
      "endLine": 120
    }
  ],
  "maxBytes": 60000
}
```

Returns:

```json
{
  "truncated": false,
  "files": [
    {
      "path": "string",
      "startLine": 1,
      "endLine": 120,
      "content": "string",
      "truncated": false
    }
  ],
  "omittedFiles": [
    {
      "path": "string",
      "reason": "ignored|not-allowed|not-found|binary-or-unreadable|byte-budget"
    }
  ]
}
```

Usage guidance:

- Prefer GitHub for normal committed file content.
- Use this for local-only files, locally changed files, instruction files, or allowlisted high-value TS/JS/Python project files.
- Reject path escapes and secret-like paths.
- Omit ignored, disallowed, unreadable, or byte-budget-skipped files.

Default allowlist beyond changed/untracked/instruction files:

```text
AGENTS.md
README*
package.json
tsconfig*.json
vite.config.*
next.config.*
eslint.config.*
pyproject.toml
requirements*.txt
setup.py
setup.cfg
pytest.ini
```

Lockfiles are not in the default allowlist. They can be read only when locally changed or untracked.

### show_questions

Purpose: render multiple-choice questions created by ChatGPT.

Phase 2A behavior: validate and store the question set, then return a normal-chat text fallback with `rendered: true`. The ChatGPT App widget renderer is deferred to Phase 2B.

Inputs:

```json
{
  "questionSetId": "string",
  "questions": [
    {
      "id": "string",
      "question": "string",
      "mode": "single|multi",
      "options": [
        {
          "id": "string",
          "label": "string",
          "description": "string"
        }
      ],
      "recommendedOptionId": "string|null"
    }
  ]
}
```

Returns:

```json
{
  "questionSetId": "string",
  "rendered": true,
  "questions": [
    {
      "id": "string",
      "question": "string",
      "mode": "single|multi",
      "options": [
        {
          "id": "string",
          "label": "string",
          "description": "string"
        }
      ],
      "recommendedOptionId": "string|null"
    }
  ]
}
```

Implementation notes:

- The server validates and renders questions.
- ChatGPT decides which questions to ask.
- Keep option count small, usually 2-5.
- Keep 1-10 questions per set.
- Reusing `questionSetId` is allowed only for the same normalized question payload.
- Recommended options must match an option in the same question.

### submit_answers

Purpose: store user choices for the current in-memory session.

Inputs:

```json
{
  "questionSetId": "string",
  "answers": [
    {
      "questionId": "string",
      "optionIds": ["string"]
    }
  ]
}
```

Returns:

```json
{
  "questionSetId": "string",
  "answers": [
    {
      "questionId": "string",
      "optionIds": ["string"]
    }
  ]
}
```

Implementation notes:

- Reject unknown question sets, question IDs, and option IDs.
- Reject duplicate submitted question IDs and duplicate option IDs.
- Require exactly one option for `single` questions.
- Require one or more options for `multi` questions.
- Repeated answers replace the previous stored answer for that question.
- Return stored answers in the original question order.

## Deferred

- Local worktree search.
- Branch comparison.
- Server-side prompt generation.
- Server-side recommendation logic.
- Persistent sessions.
- Diff summary UI.
- Prompt preview UI.
- PR, issue, review, or CI tools.
- GitHub API integration.

## Safety Model

Allowed:

- `git status --short --branch`
- `git diff` with bounded output
- `git rev-parse`
- `git ls-files`
- direct file reads under the configured repository root

Blocked:

- writes
- deletes
- arbitrary shell execution
- dependency installs
- `git reset`
- `git checkout`
- `git clean`
- reading outside the configured repository root
- secret-like files

Hard-blocked patterns:

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

Default ignored output:

```text
.git/**
node_modules/**
dist/**
build/**
coverage/**
```

## Intended ChatGPT Workflow

For project discussion:

```text
GitHub tool: committed project context if needed
project_snapshot()
local_diff(scope: "all") only if local changes matter
read_local(...) only for local-only, changed, instruction, or allowlisted project-file details
```

For Codex prompt improvement:

```text
project_snapshot()
local_diff(scope: "all")
GitHub tool: committed context around affected files if it can find relevant snippets
show_questions(...) when alignment is unclear
submit_answers(...)
ChatGPT writes the final Codex-ready prompt
```

## Implementation Phases

### Phase 1: Local Facts

- `project_snapshot`
- `local_diff`
- `read_local`
- path safety
- deny patterns
- truncation

### Phase 2: Alignment UI

- `show_questions`
- `submit_answers`
- minimal ChatGPT App component
- in-memory question sets

### Phase 3: Setup And Hardening

- active repository selection with `--repo <path>` and current working directory fallback
- tests for path safety and blocked files
- tests for truncation
- local HTTPS tunnel setup
- manual ChatGPT Developer Mode verification

## Open Decisions

- Preferred final prompt format for Codex in the VS Code extension.
