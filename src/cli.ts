#!/usr/bin/env node
import { parseCliArgs } from "./cliArgs.js";
import { createPreflightMcpServerFactory } from "./mcpServer.js";
import { startMcpHttpServer } from "./httpServer.js";

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));
  const started = await startMcpHttpServer(
    createPreflightMcpServerFactory({ repoPath: options.repoPath }),
    options.port
  );

  process.stderr.write(`Preflight MCP server listening on http://localhost:${started.port}/mcp\n`);
  process.stderr.write(`Repository: ${options.repoPath}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
