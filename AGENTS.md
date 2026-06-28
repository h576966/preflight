# AGENTS.md

Scope: entire repository.

## Project Intent

Build a strictly read-only local preflight MCP/App that makes ChatGPT a more trustworthy companion for discussing a current coding project and improving prompts for later Codex use.

The project should complement ChatGPT's GitHub tool:

- GitHub handles remote repository context and committed code/docs. PR, issue, review, and CI workflows are not part of this personal MVP unless the user explicitly asks for them.
- Preflight handles local worktree facts, staged/unstaged diffs, selected local file reads, local instructions, and multiple-choice alignment UI.

ChatGPT is the reasoning layer. The MCP server should provide local facts and UI plumbing, not its own analysis engine.

Use alignment questions naturally when user input would materially improve reliability because tradeoffs, preferences, scope, or expected output are unclear. Do not make questions a default workflow step when a direct answer is sufficient.

Codex-ready prompts are optional outputs. Produce them when the user asks for one, asks for next implementation steps suitable for Codex, or when a prompt is clearly the most useful final artifact.

When producing a Codex-ready prompt from Preflight context, put task instructions first, separate context from instructions, keep the task focused, include only relevant local/GitHub facts, state constraints and non-goals, include verification steps for implementation work, and say what final report is expected.

## Working Style

- Be concise.
- Avoid over-engineering.
- Prefer small, reversible changes.
- Keep planning documents current when product or architecture decisions change.
- Do not add infrastructure before the implementation needs it.
- Treat review requests as local/manual code review unless the user explicitly asks for a specific external tool.
- Never use CodeRabbit for this repository.
- Do not create PRs, issues, or GitHub workflow artifacts unless the user explicitly asks.
- Prefer working on the current branch for normal small changes.
- Create a short-lived branch only for risky, experimental, or parallel work, or when the user asks. Do not accumulate branches.

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
- Tailscale Funnel for personal ChatGPT integration testing, with Secure MCP Tunnel as an optional path when workspace association works
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
