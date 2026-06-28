#!/usr/bin/env node
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { startMcpHttpServer } from "./httpServer.js";
import { createPreflightMcpServerFactory } from "./mcpServer.js";
import { QUESTION_WIDGET_MIME_TYPE, QUESTION_WIDGET_URI } from "./questionWidget.js";

const EXPECTED_TOOLS = [
  "local_diff",
  "project_snapshot",
  "read_local",
  "show_questions",
  "submit_answers"
].sort();

async function main(): Promise<void> {
  const started = await startMcpHttpServer(createPreflightMcpServerFactory({ repoPath: process.cwd() }), 0);
  const transport = new StreamableHTTPClientTransport(new URL(`http://${started.host}:${started.port}/mcp`));
  const client = new Client({ name: "preflight-smoke", version: "0.1.0" });
  let connected = false;

  try {
    await client.connect(transport);
    connected = true;

    const tools = await client.listTools();
    assert.deepEqual(tools.tools.map((tool) => tool.name).sort(), EXPECTED_TOOLS);
    assertToolOutputSchema(tools.tools, "project_snapshot", ["root", "git"]);
    assertToolOutputSchema(tools.tools, "local_diff", ["truncated", "files", "omittedFiles"]);
    assertToolOutputSchema(tools.tools, "read_local", ["files", "omittedFiles", "truncated"]);
    assertToolOutputSchema(tools.tools, "show_questions", ["questionSetId", "rendered", "questions"]);
    assertToolOutputSchema(tools.tools, "submit_answers", ["questionSetId", "answers", "answeredQuestions"]);

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

    process.stdout.write(`Preflight smoke OK on http://${started.host}:${started.port}/mcp\n`);
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

function assertToolOutputSchema(
  tools: Array<{ name: string; outputSchema?: { type?: unknown; properties?: Record<string, unknown> } }>,
  name: string,
  expectedProperties: string[]
): void {
  const tool = tools.find((candidate) => candidate.name === name);
  assert.ok(tool, `missing tool ${name}`);
  assert.equal(tool.outputSchema?.type, "object", `${name} should declare an object output schema`);

  for (const property of expectedProperties) {
    assert.ok(tool.outputSchema?.properties?.[property], `${name} output schema should include ${property}`);
  }
}
