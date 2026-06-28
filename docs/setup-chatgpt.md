# ChatGPT Setup Runbook

This project targets ChatGPT Developer Mode with a private local MCP server exposed through Secure MCP Tunnel.

Secure MCP Tunnel is the default development path. Use Cloudflare Tunnel, ngrok, or a self-hosted HTTPS endpoint only as fallbacks.

## Prerequisites

- Node.js 20 or newer.
- This repository installed locally.
- A ChatGPT account/workspace where Developer Mode is allowed. Current OpenAI help docs say full MCP apps are available on Business, Enterprise, and Edu; Pro accounts can connect read/fetch MCPs in developer mode. Personal accounts below that may show UI entry points but fail during creation.
- Access to an OpenAI Platform organization with tunnel permissions.
- `tunnel-client` from Platform tunnel settings or the latest `openai/tunnel-client` release.
- A runtime API key for `tunnel-client`.

Developer Mode and tunnel permissions are separate:

- ChatGPT Developer Mode is enabled in ChatGPT workspace/account settings.
- Tunnel creation/editing requires Platform Tunnels Read + Manage.
- Running or selecting a tunnel requires Platform Tunnels Read + Use.
- The tunnel should be associated with the ChatGPT workspace where you want to create the connector. For personal accounts, the workspace selector may be empty; in that case, use the personal Platform organization and paste the `tunnel_id` manually in ChatGPT if the tunnel is not listed.

## Local Verification

Install dependencies and verify the local MCP server before using a tunnel:

```bash
npm install
npm run smoke
```

`npm run smoke` builds the project, starts the MCP server on a temporary local port, verifies tool and widget registration through the MCP HTTP transport, calls `project_snapshot`, and shuts the server down.

## Start Preflight Locally

Start Preflight for the repository ChatGPT should discuss:

```bash
npm run build
npm start -- --repo C:\path\to\repo
```

The local MCP endpoint is:

```text
http://localhost:3327/mcp
```

Keep this terminal running while ChatGPT uses the connector.

## Configure Secure MCP Tunnel

Create or manage the tunnel in Platform tunnel settings:

```text
https://platform.openai.com/settings/organization/tunnels
```

Download `tunnel-client` from that page, or use the latest public release:

```text
https://github.com/openai/tunnel-client/releases/latest
```

In a second terminal, set the runtime API key.

PowerShell:

```powershell
$env:CONTROL_PLANE_API_KEY = "sk-..."
```

Bash:

```bash
export CONTROL_PLANE_API_KEY="sk-..."
```

Initialize a profile for the local HTTP MCP endpoint. Replace the tunnel ID with the value from Platform tunnel settings.

PowerShell:

```powershell
.\tunnel-client.exe init `
  --sample sample_mcp_remote_no_auth `
  --profile preflight-local `
  --tunnel-id tunnel_0123456789abcdef0123456789abcdef `
  --mcp-server-url "http://localhost:3327/mcp"
```

Bash:

```bash
tunnel-client init \
  --sample sample_mcp_remote_no_auth \
  --profile preflight-local \
  --tunnel-id tunnel_0123456789abcdef0123456789abcdef \
  --mcp-server-url "http://localhost:3327/mcp"
```

Validate the profile:

```bash
tunnel-client doctor --profile preflight-local --explain
```

For this no-auth MVP, `doctor` may report `oauth_metadata` as failed because Preflight intentionally does not expose OAuth metadata. That is acceptable if `mcp_server_reachable` passes.

Run the tunnel:

```bash
tunnel-client run --profile preflight-local
```

Keep `tunnel-client run` healthy while creating or testing the ChatGPT connector. Tool discovery and MCP calls depend on both terminals staying active:

- `npm start -- --repo C:\path\to\repo`
- `tunnel-client run --profile preflight-local`

After `tunnel-client run` starts, the runtime readiness check should return `ready`:

```powershell
Invoke-WebRequest http://127.0.0.1:8080/readyz -UseBasicParsing
```

## Connect In ChatGPT Developer Mode

1. In ChatGPT, enable Developer Mode:
   - `Settings -> Apps & Connectors -> Advanced settings`
2. Go to connector creation:
   - `Settings -> Apps & Connectors -> Create`
   - Some ChatGPT UI versions show the same flow under `Settings -> Connectors -> Create`.
3. For Connection, choose `Tunnel`.
4. Select the tunnel from the list, or paste the `tunnel_id`.
5. Use connector name:
   - `Preflight`
6. Use a description like:

   ```text
   Provides read-only local repository context, local diffs, selected local file reads, and alignment questions for coding-project discussions.
   ```

7. Create the connector.
8. Verify ChatGPT shows these tools:
   - `project_snapshot`
   - `local_diff`
   - `read_local`
   - `show_questions`
   - `submit_answers`

After changing tool names, descriptions, schemas, widget metadata, or resource metadata, open the connector in ChatGPT settings and choose `Refresh`. Start a new chat after refreshing.

Do not use Platform `ChatGPT Apps -> New App` for this local Developer Mode flow. That page is for creating or publishing app records in Platform; this project should be connected from ChatGPT settings.

## Tailscale Funnel Fallback

Use Tailscale Funnel when Secure MCP Tunnel cannot be associated with the target ChatGPT account/workspace, or when you need to test the public HTTPS Server URL path.

Preflight must already be running on `http://localhost:3327/mcp`. Then run:

```powershell
tailscale funnel --bg --yes 3327
```

Check the public URL:

```powershell
tailscale funnel status --json
```

Use the HTTPS URL reported by `tailscale funnel status`, with `/mcp` at the end:

```text
https://<machine>.<tailnet>.ts.net/mcp
```

To disable the public proxy:

```powershell
tailscale funnel --https=443 off
```

Tailscale Funnel is public internet exposure. Keep Preflight read-only, keep secret blocking enabled, and turn Funnel off when not testing.

## Manual Verification Checklist

Use a new ChatGPT chat after creating or refreshing the connector.

1. Add the `Preflight` connector from the composer.
2. Ask ChatGPT to call `project_snapshot` and summarize the active local repository.
3. If the repository has tracked local changes, ask ChatGPT to call `local_diff` with `scope: "all"`.
4. Ask ChatGPT to call `read_local` for one safe exact path such as `README.md` or `AGENTS.md`.
5. Ask ChatGPT to call `show_questions` with one single-choice and one multi-choice question.
6. Confirm the question widget renders.
7. Select options in the widget and submit.
8. Confirm ChatGPT receives a `submit_answers` result with the stored answer count.
9. Repeat `show_questions` with the same `questionSetId` and same payload to verify idempotent replay.
10. Repeat `show_questions` with the same `questionSetId` and changed payload to verify it is rejected.

## Expected Failures And Fixes

Tunnel not visible in ChatGPT:

- Check that the tunnel is associated with the target ChatGPT workspace, not only a Platform organization.
- For personal accounts where no workspace is available in Platform tunnel settings, paste the `tunnel_id` manually in ChatGPT's Tunnel connection field.
- Check that the connector operator has Platform Tunnels Read + Use.
- Check ChatGPT workspace/admin settings if Developer Mode is missing.

Connector creation fails:

- Confirm Preflight is still running on `http://localhost:3327/mcp`.
- Confirm `tunnel-client run --profile preflight-local` is still running.
- If tunnel-client logs do not show any new request when you click Create, the failure happened before ChatGPT reached the local MCP server. Check plan eligibility, Developer Mode access, and tunnel workspace/organization association.
- Run `tunnel-client doctor --profile preflight-local --explain`.

Tool discovery fails:

- Run `npm run smoke`.
- Run `tunnel-client doctor --profile preflight-local --explain`.
- If only `oauth_metadata` fails, keep `tunnel-client run --profile preflight-local` running and verify `http://127.0.0.1:8080/readyz` returns `ready`.
- Refresh the connector metadata in ChatGPT settings.

Widget does not render or update:

- Refresh connector metadata in ChatGPT.
- Start a new chat.
- Confirm `show_questions` returns structured content and references the question widget.

Local endpoint unreachable:

- Confirm the Preflight terminal says it is listening on `http://localhost:3327/mcp`.
- Try `http://127.0.0.1:3327/mcp` in tunnel-client profile setup if Windows localhost resolution behaves oddly.
- A plain browser GET may not show a useful page because `/mcp` expects MCP requests.

Permission or policy issue:

- Check ChatGPT Developer Mode access under workspace/account settings.
- Check Platform tunnel permissions under the organization that owns the tunnel.
- Ask a workspace or Platform admin to grant the missing permission.

## Authentication

MVP stays simple for personal use: no OAuth or bearer token on the Preflight MCP server.

This is acceptable only with strict read-only tools, secret blocking, bounded output, and the default Secure MCP Tunnel development path. Revisit authentication before sharing the app, using a public tunnel for regular work, or exposing repositories that should not be reachable by anyone with the tunnel URL.

OpenAI's Apps SDK auth guidance says read-only anonymous apps can be acceptable, but customer-specific data or write actions should authenticate users. This MVP is intentionally personal, read-only, and tunnel-first; do not generalize that choice to a shared or published app.

## Reference Docs

- https://developers.openai.com/api/docs/guides/secure-mcp-tunnels
- https://developers.openai.com/apps-sdk/deploy/connect-chatgpt
- https://developers.openai.com/apps-sdk/build/auth
- https://help.openai.com/en/articles/11145903-connecting-github-to-chatgpt
