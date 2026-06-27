import path from "node:path";
import { DEFAULT_PORT } from "./constants.js";

export type CliOptions = {
  repoPath: string;
  port: number;
};

export function parseCliArgs(argv: string[], cwd = process.cwd()): CliOptions {
  let repoPath = cwd;
  let port = DEFAULT_PORT;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--repo") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--repo requires a path");
      }
      repoPath = value;
      index += 1;
      continue;
    }

    if (arg?.startsWith("--repo=")) {
      repoPath = arg.slice("--repo=".length);
      continue;
    }

    if (arg === "--port") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--port requires a value");
      }
      port = parsePort(value);
      index += 1;
      continue;
    }

    if (arg?.startsWith("--port=")) {
      port = parsePort(arg.slice("--port=".length));
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      throw new Error(helpText());
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    repoPath: path.resolve(cwd, repoPath),
    port
  };
}

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid port: ${value}`);
  }
  return port;
}

export function helpText(): string {
  return [
    "Usage: preflight [--repo <path>] [--port <port>]",
    "",
    "Options:",
    "  --repo <path>   Repository path. Defaults to the current working directory.",
    `  --port <port>   HTTP port. Defaults to ${DEFAULT_PORT}.`
  ].join("\n");
}
