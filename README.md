# Preflight for ChatGPT and Codex

This repository is for planning and building a small local preflight module that gives ChatGPT controlled context about a local repository/worktree.

The goal is to make ChatGPT a more trustworthy companion for discussing a current coding project and improving prompts that may later be used in Codex.

The first version should stay narrow: a read-only MCP/App that exposes local project facts, bounded diffs, selected local file reads, and a simple multiple-choice UI for staying aligned.

The module is designed as a companion to ChatGPT's GitHub tool, not as a GitHub replacement.

Start here:

- [AGENTS.md](AGENTS.md) - durable repo instructions for coding agents
- [docs/README.md](docs/README.md) - documentation index
- [docs/preflight-mcp-plan.md](docs/preflight-mcp-plan.md) - detailed current plan

## Local Development

```bash
npm install
npm test
npm start -- --repo C:\path\to\repo
```

The initial server exposes a local MCP endpoint at `http://localhost:3327/mcp` with these tools:

- `project_snapshot`
- `local_diff`
- `read_local`
