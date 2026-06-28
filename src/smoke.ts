#!/usr/bin/env node
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { startMcpHttpServer } from "./httpServer.js";
import { createPreflightMcpServer } from "./mcpServer.js";
import { QUESTION_WIDGET_MIME_TYPE, QUESTION_WIDGET_URI } from "./questionWidget.js";

const EXPECTED_TOOLS = [
  "local_diff",
  "project_snapshot",
  "read_local",
  "show_questions",
  "submit_answers"
].sort();

async function main(): Promise<void> {
  const started = await startMcpHttpServer(() => createPreflightMcpServer({ repoPath: process.cwd() }), 0);
  const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${started.port}/mcp`));
  const client = new Client({ name: "preflight-smoke", version: "0.1.0" });
  let connected = false;

  try {
    await client.connect(transport);
    connected = true;

    const tools = await client.listTools();
    assert.deepEqual(tools.tools.map((tool) => tool.name).sort(), EXPECTED_TOOLS);

    const resources = await client.listResources();
    assert.ok(resources.resources.some((resource) => resource.uri === QUESTION_WIDGET_URI));

    const widget = await client.readResource({ uri: QUESTION_WIDGET_URI });
    assert.equal(widget.contents[0]?.mimeType, QUESTION_WIDGET_MIME_TYPE);
    assert.equal(widget.contents[0]?.uri, QUESTION_WIDGET_URI);

    const snapshot = await client.callTool({ name: "project_snapshot", arguments: {} });
    const content = snapshot.structuredContent as Record<string, unknown> | undefined;
    assert.ok(content);
    assert.equal(typeof content?.root, "string");
    assert.equal(typeof content?.name, "string");
    assert.equal(typeof content?.git, "object");

    process.stdout.write(`Preflight smoke OK on http://127.0.0.1:${started.port}/mcp\n`);
  } finally {
    if (connected) {
      await client.close();
    } else {
      await client.close().catch(() => undefined);
    }
    await started.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Preflight smoke failed: ${message}\n`);
  process.exitCode = 1;
});
