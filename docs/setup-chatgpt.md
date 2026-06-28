# ChatGPT Setup Runbook

This project targets ChatGPT Developer Mode with a private local MCP server exposed over a temporary public HTTPS endpoint.

For this personal setup, the practical default is Tailscale Funnel. Secure MCP Tunnel remains documented as an optional path for accounts or workspaces where OpenAI tunnel association works cleanly.

## Prerequisites

- Node.js 20 or newer.
- This repository installed locally.
- A ChatGPT account where Developer Mode and custom MCP apps/connectors are available.
- Tailscale installed and signed in on this machine.
- Tailscale Funnel enabled for the machine or tailnet.

The Preflight MCP server stays read-only, blocks secret-like files, and bounds all tool output. Do not use this setup for shared or sensitive repositories unless you add stronger authentication and operational controls.

## Local Verification

Install dependencies and verify the local MCP server before exposing it:

```powershell
npm install
npm run smoke
```

`npm run smoke` builds the project, starts the MCP server on a temporary local port, verifies tool and widget registration through the real MCP HTTP transport, calls `project_snapshot`, and shuts the server down.

## Start Preflight Locally

Start Preflight for the repository ChatGPT should discuss:

```powershell
npm run build
npm start -- --repo C:\path\to\repo --port 3327
```

The local MCP endpoint is:

```text
http://127.0.0.1:3327/mcp
```

Keep this terminal running while ChatGPT uses Preflight.

## Expose With Tailscale Funnel

In a second terminal, expose local port `3327`:

```powershell
tailscale funnel --bg --yes 3327
```

Check the public HTTPS URL:

```powershell
tailscale funnel status --json
```

Use the HTTPS URL reported by Tailscale with `/mcp` appended:

```text
https://<machine>.<tailnet>.ts.net/mcp
```

Tailscale Funnel is public internet exposure. Keep Preflight read-only, keep secret blocking enabled, use it only while testing or working, and turn it off when finished:

```powershell
tailscale funnel --https=443 off
```

## Connect In ChatGPT Developer Mode

1. In ChatGPT, enable Developer Mode:
   - `Settings -> Apps & Connectors -> Advanced settings`
2. Go to app/connector creation:
   - `Settings -> Apps & Connectors -> Create`
   - Some ChatGPT UI versions show the same flow under `Settings -> Connectors -> Create`.
3. For Connection, choose `Server URL`.
4. Paste the Tailscale HTTPS MCP URL, including `/mcp`.
5. Use app/connector name:
   - `Preflight`
6. Use a description like:

   ```text
   Provides read-only local repository context, local diffs, selected local file reads, and alignment questions for coding-project discussions.
   ```

7. Create the app/connector.
8. Verify ChatGPT shows these tools:
   - `project_snapshot`
   - `local_diff`
   - `read_local`
   - `show_questions`
   - `submit_answers`

Do not use Platform `ChatGPT Apps -> New App` for this local Developer Mode flow. That page is for creating or publishing app records in Platform; this project should be connected from ChatGPT settings.

## Refreshing ChatGPT Metadata

ChatGPT can cache tool and widget metadata. After changing tool names, descriptions, schemas, widget metadata, or the widget URI:

1. Run `npm run build`.
2. Restart `npm start -- --repo C:\path\to\repo --port 3327`.
3. Confirm Tailscale Funnel is still exposing the server.
4. Open the Preflight app/connector in ChatGPT settings and choose `Refresh` or refresh metadata.
5. Start a new ChatGPT chat and re-add Preflight from the composer.

The current question widget resource is:

```text
ui://widget/questions-v6.html
```

If ChatGPT reports `Failed to fetch template`, it is usually using stale widget metadata. Refresh metadata and start a new chat rather than adding old widget URI aliases back to the server.

## Manual Verification Checklist

Use a new ChatGPT chat after creating or refreshing Preflight.

1. Add `Preflight` from the composer.
2. Ask ChatGPT to call `project_snapshot` and summarize the active local repository.
3. If the repository has tracked local changes, ask ChatGPT to call `local_diff` with `scope: "all"`.
4. Ask ChatGPT to call `read_local` for one safe exact path such as `README.md` or `AGENTS.md`.
5. Ask ChatGPT to call `show_questions` with one single-choice and one multi-choice question.
6. Confirm the question widget renders.
7. Answer every displayed question in the widget and submit.
8. Confirm a successful submit keeps the selections selected, stores the answers, and ChatGPT continues with the selected answer labels.
9. Repeat `show_questions` with the same `questionSetId` and same payload to verify idempotent replay.
10. Repeat `show_questions` with the same `questionSetId` and changed payload to verify it is rejected.
11. To test failed submit behavior, render questions, restart Preflight without re-rendering the same question set, then submit from the old widget. The widget should show an unknown-question-set error, keep selections visible, allow retry, and ChatGPT should not continue automatically.

## Expected Failures And Fixes

Local endpoint unreachable:

- Confirm the Preflight terminal says it is listening on `http://127.0.0.1:3327/mcp`.
- A plain browser GET may not show a useful page because `/mcp` expects MCP requests.
- Run `npm run smoke` to verify local MCP wiring.

Tailscale URL does not work:

- Confirm Funnel is enabled with `tailscale funnel status --json`.
- Confirm the public URL includes `/mcp`.
- Restart Funnel after restarting or changing local ports.
- Check local firewall or Tailscale policy if requests never reach the server.

Tool discovery fails:

- Run `npm run smoke`.
- Restart Preflight and confirm Tailscale still points to port `3327`.
- Refresh ChatGPT app/connector metadata and start a new chat.

Widget does not render or update:

- Refresh metadata in ChatGPT settings.
- Start a new chat.
- Confirm `show_questions` advertises `ui://widget/questions-v6.html`.
- If the error says `Failed to fetch template`, assume stale metadata first.

Widget submit reports an unknown question set:

- The most likely cause is that Preflight restarted after `show_questions` rendered the widget.
- The widget should keep selected answers visible and should not ask ChatGPT to continue.
- Refresh metadata, start a new chat, or ask ChatGPT to call `show_questions` again so the running server has the question set.

Permission or policy issue:

- Check ChatGPT Developer Mode access under workspace/account settings.
- Try recreating the app/connector with the Server URL path.
- If Server URL apps are unavailable for the account, use Secure MCP Tunnel only if the tunnel can be associated with a usable ChatGPT workspace.

## Optional: Secure MCP Tunnel

Use Secure MCP Tunnel only when your OpenAI Platform organization and ChatGPT workspace can be associated with the tunnel and ChatGPT shows the tunnel during app/connector creation.

Additional prerequisites:

- Access to OpenAI Platform tunnel settings.
- `tunnel-client` from Platform tunnel settings or the latest `openai/tunnel-client` release.
- A runtime API key for `tunnel-client`.
- Platform Tunnels Read + Use permission for running/selecting a tunnel.
- Platform Tunnels Read + Manage permission for creating/editing a tunnel.

Tunnel settings:

```text
https://platform.openai.com/settings/organization/tunnels
```

Set the runtime API key in the terminal running `tunnel-client`:

```powershell
$env:CONTROL_PLANE_API_KEY = "sk-..."
```

Initialize a profile for the local HTTP MCP endpoint. Replace the tunnel ID with the value from Platform tunnel settings:

```powershell
.\tunnel-client.exe init `
  --sample sample_mcp_remote_no_auth `
  --profile preflight-local `
  --tunnel-id tunnel_0123456789abcdef0123456789abcdef `
  --mcp-server-url "http://127.0.0.1:3327/mcp"
```

Validate and run:

```powershell
.\tunnel-client.exe doctor --profile preflight-local --explain
.\tunnel-client.exe run --profile preflight-local
```

For this no-auth MVP, `doctor` may report `oauth_metadata` as failed because Preflight intentionally does not expose OAuth metadata. That is acceptable if the MCP server reachability check passes.

In ChatGPT app/connector creation, choose `Tunnel` instead of `Server URL`, then select the tunnel or paste the `tunnel_id`.

## Authentication

MVP stays simple for personal use: no OAuth or bearer token on the Preflight MCP server.

This is acceptable only with strict read-only tools, secret blocking, bounded output, and short-lived personal testing exposure. Revisit authentication before sharing the app, using a public tunnel for regular work, or exposing repositories that should not be reachable by anyone with the public URL.

OpenAI's Apps SDK auth guidance says read-only anonymous apps can be acceptable, but customer-specific data or write actions should authenticate users. This MVP is intentionally personal, read-only, and tunnel-first; do not generalize that choice to a shared or published app.

## Reference Docs

- https://developers.openai.com/apps-sdk/deploy/connect-chatgpt
- https://developers.openai.com/apps-sdk/reference
- https://developers.openai.com/apps-sdk/build/auth
- https://developers.openai.com/api/docs/guides/secure-mcp-tunnels
- https://tailscale.com/kb/1223/funnel
