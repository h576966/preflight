# ChatGPT Setup Notes

This project targets ChatGPT Developer Mode with a remote HTTPS MCP endpoint.

## Local Development Assumption

ChatGPT does not directly attach to an arbitrary local stdio MCP server. The local server should be exposed through an HTTPS tunnel during development.

Recommended first tunnel to try:

- Secure MCP Tunnel

Alternatives:

- Cloudflare Tunnel
- ngrok
- a self-hosted HTTPS endpoint

## Intended Flow

1. Start the local preflight MCP server for one repository.
   - Prefer `preflight --repo <path>`.
   - Fall back to the current working directory when `--repo` is omitted.
2. Expose its `/mcp` endpoint through an HTTPS tunnel.
3. Add the MCP server in ChatGPT Developer Mode.
4. Use it together with the ChatGPT GitHub tool.
5. Prefer GitHub for committed remote context and preflight for local worktree deltas.
6. Use preflight `read_local` when exact local file paths matter, because the GitHub app may not support direct file-name lookup.

## Authentication

MVP stays simple for personal use: no OAuth or bearer token.

This is acceptable only with strict read-only tools, secret blocking, bounded output, and the default Secure MCP Tunnel development path. Revisit authentication before sharing the app, using a public tunnel for regular work, or exposing repositories that should not be reachable by anyone with the tunnel URL.

OpenAI's Apps SDK auth guidance says read-only anonymous apps can be acceptable, but customer-specific data or write actions should authenticate users. This MVP is intentionally personal, read-only, and tunnel-first; do not generalize that choice to a shared or published app.

## Reference Docs

- https://developers.openai.com/apps-sdk/deploy/connect-chatgpt
- https://developers.openai.com/api/docs/guides/secure-mcp-tunnels
- https://developers.openai.com/apps-sdk/build/auth
- https://help.openai.com/en/articles/11145903-connecting-github-to-chatgpt

## App UI

The first UI should stay small:

- multiple-choice questions
- selected answer state

Diff summary UI can wait until the text-only workflow proves it is useful.
