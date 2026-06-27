# Decisions

Date: 2026-06-27

## Accepted

- Build for one active repository per chat/session.
- Allow project switching between chats through configuration or startup target.
- Build primarily for personal use by the repository owner.
- Design preflight as a local companion to ChatGPT's GitHub tool.
- Keep ChatGPT as the reasoning and prompt-writing layer.
- Treat code review as local/manual review by default.
- Never use CodeRabbit for this repository.
- Avoid PR, issue, and GitHub workflow management unless explicitly requested.
- Use the current branch for normal small changes; create short-lived branches only for risky, experimental, or parallel work.
- Keep the server strictly read-only.
- Hard-block `.env`, `.env.*`, private keys, certificates, and similar secret material.
- Use an 80/20 local-read model: changed files, untracked files, instruction files, and a small allowlist of high-value non-secret project files.
- Prioritize prompt discussion/generation first, then improvement suggestions.
- Build a small ChatGPT App UI early for multiple-choice questions only.
- Keep session state in memory for MVP.
- Optimize prompts for Codex usage from VS Code, while keeping them usable in other Codex surfaces.
- Expose fewer MCP tools: project snapshot, local diff, selected local read, and question UI helpers.
- Treat local `AGENTS.md` and README guidance as strong recommendations for ChatGPT's generated prompts.
- Assume the ChatGPT GitHub tool can provide committed repository code, README/docs, search, analysis, and citations.
- Do not rely on GitHub for exact file-path lookup; use `read_local` when exact local paths matter.
- Assume TS/JS and Python projects only for MVP.
- Select the active repository with `--repo <path>`, falling back to the current working directory.
- Use Secure MCP Tunnel as the first local connection path for ChatGPT.
- Keep MVP app authentication simple: no OAuth/bearer token in the first personal-use version.
- `local_diff` returns bounded patches when explicitly called; `project_snapshot` already provides changed-file metadata.
- `project_snapshot` may include small contents for high-value instruction/manifest files under strict size limits.

## Recommended Defaults

- TypeScript/Node.js for the MCP server.
- Secure MCP Tunnel as the first local tunnel to try.
- Cloudflare Tunnel or ngrok only as fallback options.
- GitHub tool first for committed repo context, docs, search, and citations.
- Preflight first for local worktree status, staged/unstaged diffs, and untracked files.
- Preflight `read_local` first when the exact local path matters.
- Local commits are enough for normal personal-project checkpoints.
- Keep branch count low: one active task branch only when it materially reduces risk or confusion.
- Default `read_local` allowlist: `AGENTS.md`, `README*`, `package.json`, `tsconfig*.json`, `vite.config.*`, `next.config.*`, `eslint.config.*`, `pyproject.toml`, `requirements*.txt`, `setup.py`, `setup.cfg`, `pytest.ini`.
- Lockfiles may be read explicitly when needed, but should not be included automatically in `project_snapshot`.
- Auto-included file contents are capped at 8 KB per file and 24 KB total.

## Deferred

- Local worktree search.
- Server-side Codex prompt generation.
- Server-side recommendation logic.
- Prompt preview and diff summary UI.
- PR, issue, review, and CI context for this version.
- External review automation.

## Still Open

- Preferred final prompt format for Codex in the VS Code extension.
