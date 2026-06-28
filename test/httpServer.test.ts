import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createPreflightMcpServer } from "../src/mcpServer.js";
import { startMcpHttpServer } from "../src/httpServer.js";

test("startMcpHttpServer returns the actual bound port for ephemeral port 0", async () => {
  const started = await startMcpHttpServer(() => createPreflightMcpServer({ repoPath: process.cwd() }), 0);

  try {
    assert.ok(Number.isInteger(started.port));
    assert.ok(started.port > 0);
  } finally {
    await started.close();
  }
});

test("startMcpHttpServer accepts repeated client sessions", async () => {
  const started = await startMcpHttpServer(() => createPreflightMcpServer({ repoPath: process.cwd() }), 0);

  try {
    for (let index = 0; index < 2; index += 1) {
      const client = new Client({ name: "preflight-test", version: "0.1.0" });
      const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${started.port}/mcp`));
      await client.connect(transport);
      const tools = await client.listTools();
      assert.equal(tools.tools.length, 5);

      const submitAnswers = tools.tools.find((tool) => tool.name === "submit_answers");
      assert.equal(submitAnswers?._meta?.["openai/widgetAccessible"], true);
      await client.close();
    }
  } finally {
    await started.close();
  }
});
