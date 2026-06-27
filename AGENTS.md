# AGENTS.md

Scope: entire repository.

## Project Intent

Build a strictly read-only local preflight MCP/App that makes ChatGPT a more trustworthy companion for discussing a current coding project and improving prompts for later Codex use.

The project should complement ChatGPT's GitHub tool:

- GitHub handles remote repository context and committed code/docs. PR, issue, review, and CI context can be used when available, but are not part of this version's assumptions.
- Preflight handles local worktree facts, staged/unstaged diffs, selected local file reads, local instructions, and multiple-choice alignment UI.

ChatGPT is the reasoning layer. The MCP server should provide local facts and UI plumbing, not its own analysis engine.

## Working Style

- Be concise.
- Avoid over-engineering.
- Prefer small, reversible changes.
- Keep planning documents current when product or architecture decisions change.
- Do not add infrastructure before the implementation needs it.

## Hard Constraints

- The MCP server must stay read-only.
- Do not expose arbitrary shell execution.
- Do not implement GitHub API functionality in MVP.
- Do not add server-side prompt generation or recommendation logic in MVP.
- Do not read outside the configured repository root.
- Hard-block `.env`, `.env.*`, private keys, certificates, and similar secret material.
- Bound all outputs; never dump a full repository.

## Implementation Defaults

When implementation starts, prefer:

- TypeScript/Node.js
- MCP SDK
- schema validation for every tool input
- `git` CLI wrappers for local git state
- `--repo <path>` for active repository selection, with current working directory fallback
- Secure MCP Tunnel for first ChatGPT integration testing
- in-memory preflight sessions for MVP

## Documentation Map

- `docs/preflight-mcp-plan.md` is the detailed planning source.
- `docs/decisions.md` is the short decision log.
- `docs/mvp-scope.md` defines what belongs in MVP.
- `docs/tool-contracts.md` summarizes the MCP tools.
- `docs/security.md` defines the read-only and secret-handling rules.
- `docs/setup-chatgpt.md` tracks the intended ChatGPT setup flow.

## Verification Expectations

Before claiming implementation work is complete:

- run the relevant local tests once they exist
- verify path safety and secret blocking for file/diff tools
- verify truncation behavior for large outputs
- manually test the MCP connection through ChatGPT Developer Mode when transport exists
