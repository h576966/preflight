import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { DEFAULT_PORT } from "../src/constants.js";
import { parseCliArgs } from "../src/cliArgs.js";

test("parseCliArgs defaults to cwd and default port", () => {
  const cwd = path.resolve("example");
  const options = parseCliArgs([], cwd);

  assert.equal(options.repoPath, cwd);
  assert.equal(options.port, DEFAULT_PORT);
});

test("parseCliArgs accepts --repo and --port", () => {
  const cwd = path.resolve("workspace");
  const options = parseCliArgs(["--repo", "repo", "--port", "4567"], cwd);

  assert.equal(options.repoPath, path.resolve(cwd, "repo"));
  assert.equal(options.port, 4567);
});

test("parseCliArgs rejects unknown arguments", () => {
  assert.throws(() => parseCliArgs(["--unknown"], process.cwd()), /Unknown argument/);
});
