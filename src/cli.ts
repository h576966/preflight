#!/usr/bin/env node
import { parseCliArgs } from "./cliArgs.js";
import { createPreflightMcpServer } from "./mcpServer.js";
import { startMcpHttpServer } from "./httpServer.js";

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));
  const server = createPreflightMcpServer({ repoPath: options.repoPath });
  await startMcpHttpServer(server, options.port);

  process.stderr.write(`Preflight MCP server listening on http://localhost:${options.port}/mcp\n`);
  process.stderr.write(`Repository: ${options.repoPath}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
