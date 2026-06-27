# MCP Tool Contracts

The server should expose local facts and alignment UI only. ChatGPT remains responsible for reasoning, recommendations, and Codex prompt writing.

## project_snapshot

Return the current local project state:

- root and name
- remote URL
- inferred `owner/repo`
- branch, HEAD, upstream
- changed files with staged/unstaged/untracked status
- local instruction files
- detected stack hints
- output limits
- small auto-included contents for selected instruction/manifest files

## local_diff

Return bounded local diff output for:

- `staged`
- `unstaged`
- `all`

Must support path filters, context lines, byte limits, and truncation metadata.

`project_snapshot` provides changed-file metadata. When ChatGPT explicitly calls `local_diff`, return bounded patches by default instead of adding another metadata-only step.

Untracked file contents are out of scope for this tool. `local_diff` should list tracked patches only and report omitted files when paths are blocked, ignored, binary/unreadable, or beyond the byte budget.

## read_local

Read selected local file ranges only.

Use this for exact paths when they are local-only files, locally changed files, local instruction files, or allowlisted high-value TS/JS/Python project files. Prefer ChatGPT's GitHub tool for normal committed file content when exact local path lookup is not required.

Input:

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

Output:

```json
{
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
  ],
  "truncated": false
}
```

Hard-blocked secret-like paths and paths outside the repository are rejected. Other unreadable or disallowed files are reported in `omittedFiles`.

## show_questions

Render multiple-choice questions created by ChatGPT.

The server should not decide which questions to ask. It should validate and display:

- question text
- 2-5 options
- optional recommended option
- whether one or multiple answers are allowed

## submit_answers

Store submitted answers in memory for the current session and return them in a compact format ChatGPT can use.

## Deferred

- `search_local`
- server-side prompt generation
- server-side recommendation tools
