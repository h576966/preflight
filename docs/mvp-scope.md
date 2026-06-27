# MVP Scope

## In Scope

- One active local repository per running session.
- Active repository selected by `--repo <path>`, with current working directory fallback.
- Local repository identity: remote URL, inferred `owner/repo`, branch, HEAD, upstream.
- Worktree status.
- Staged, unstaged, and all-local diff output with bounded output.
- Local file reads for selected changed, untracked, instruction, and allowlisted project files.
- Local instruction files such as `AGENTS.md` and README.
- Small auto-included contents for high-value instruction/manifest files.
- Multiple-choice question flow.
- Simple ChatGPT App UI for question selection.

## Out Of Scope

- Write access.
- Arbitrary shell commands.
- GitHub API client.
- PR, issue, review, or CI integrations.
- External review automation such as CodeRabbit.
- Remote repository indexing.
- Local code search in MVP.
- Server-side Codex prompt generation.
- Server-side recommendation logic.
- Prompt preview UI in MVP.
- Full repository dumps.
- Secret file reads.
- Persistent session storage.
- Full multi-project configuration.
- App OAuth/authentication.
- Long-lived or accumulated task branches.

## Phase Order

1. Read-only MCP server: `project_snapshot`, `local_diff`, `read_local`.
2. Minimal UI: `show_questions`, `submit_answers`.
3. Hardening: repo selection, tests, truncation, setup docs.
