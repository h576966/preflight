import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createPreflightMcpServer, createPreflightMcpServerFactory } from "../src/mcpServer.js";
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

test("question tools return a stable widget session id", async () => {
  const started = await startMcpHttpServer(() => createPreflightMcpServer({ repoPath: process.cwd() }), 0);
  const client = new Client({ name: "preflight-question-session-test", version: "0.1.0" });

  try {
    const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${started.port}/mcp`));
    await client.connect(transport);

    const questionSetId = "session-test";
    const showResult = await client.callTool({
      name: "show_questions",
      arguments: {
        questionSetId,
        questions: [{
          id: "focus",
          question: "What should Preflight focus on?",
          mode: "single",
          recommendedOptionId: "ui",
          options: [
            { id: "ui", label: "Question UI", description: "Test the widget." },
            { id: "tools", label: "Local tools", description: "Test local repo tools." }
          ]
        }]
      }
    });

    assert.equal(showResult._meta?.["openai/widgetSessionId"], questionSetId);

    const submitResult = await client.callTool({
      name: "submit_answers",
      arguments: {
        questionSetId,
        answers: [{ questionId: "focus", optionIds: ["ui"] }]
      }
    });

    assert.equal(submitResult._meta?.["openai/widgetSessionId"], questionSetId);
  } finally {
    await client.close().catch(() => undefined);
    await started.close();
  }
});

test("question state is shared across MCP HTTP sessions with the Preflight server factory", async () => {
  const started = await startMcpHttpServer(createPreflightMcpServerFactory({ repoPath: process.cwd() }), 0);
  const showClient = new Client({ name: "preflight-question-show-test", version: "0.1.0" });
  const submitClient = new Client({ name: "preflight-question-submit-test", version: "0.1.0" });

  try {
    await showClient.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${started.port}/mcp`)));
    await showClient.callTool({
      name: "show_questions",
      arguments: {
        questionSetId: "cross-session",
        questions: [
          {
            id: "mode",
            question: "What should ChatGPT produce?",
            mode: "single",
            options: [
              { id: "prompt", label: "Next prompt", description: "Write the next Codex prompt." },
              { id: "summary", label: "Summary", description: "Summarize the choices." }
            ]
          },
          {
            id: "signals",
            question: "Which signals matter?",
            mode: "multi",
            options: [
              { id: "changed", label: "Changed files", description: "Use local changed file state." },
              { id: "diff", label: "Tracked diff", description: "Use local tracked diffs." },
              { id: "answers", label: "Recent answer state", description: "Use submitted question answers." }
            ]
          }
        ]
      }
    });
    await showClient.close();

    await submitClient.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${started.port}/mcp`)));
    const submitResult = await submitClient.callTool({
      name: "submit_answers",
      arguments: {
        questionSetId: "cross-session",
        answers: [
          { questionId: "signals", optionIds: ["changed", "answers"] },
          { questionId: "mode", optionIds: ["prompt"] }
        ]
      }
    });

    assert.notEqual(submitResult.isError, true);
    const structured = submitResult.structuredContent as {
      questionSetId: string;
      answers: Array<{ questionId: string; optionIds: string[] }>;
      answeredQuestions: Array<{
        questionId: string;
        question: string;
        optionIds: string[];
        selectedOptions: Array<{ id: string; label: string; description: string }>;
      }>;
      questions?: unknown;
    };

    assert.equal(structured.questionSetId, "cross-session");
    assert.deepEqual(structured.answers, [
      { questionId: "mode", optionIds: ["prompt"] },
      { questionId: "signals", optionIds: ["changed", "answers"] }
    ]);
    assert.deepEqual(structured.answeredQuestions.map((answer) => ({
      questionId: answer.questionId,
      optionIds: answer.optionIds,
      selectedLabels: answer.selectedOptions.map((option) => option.label)
    })), [
      { questionId: "mode", optionIds: ["prompt"], selectedLabels: ["Next prompt"] },
      { questionId: "signals", optionIds: ["changed", "answers"], selectedLabels: ["Changed files", "Recent answer state"] }
    ]);
    assert.equal(structured.questions, undefined);
  } finally {
    await showClient.close().catch(() => undefined);
    await submitClient.close().catch(() => undefined);
    await started.close();
  }
});

test("submit_answers returns diagnostics for unknown question sets", async () => {
  const started = await startMcpHttpServer(createPreflightMcpServerFactory({ repoPath: process.cwd() }), 0);
  const client = new Client({ name: "preflight-question-diagnostic-test", version: "0.1.0" });

  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${started.port}/mcp`)));
    await client.callTool({
      name: "show_questions",
      arguments: {
        questionSetId: "known-set",
        questions: [{
          id: "focus",
          question: "What should Preflight focus on?",
          mode: "single",
          options: [
            { id: "ui", label: "Question UI", description: "Test the widget." },
            { id: "tools", label: "Local tools", description: "Test local repo tools." }
          ]
        }]
      }
    });

    const result = await client.callTool({
      name: "submit_answers",
      arguments: {
        questionSetId: "missing-set",
        answers: [{ questionId: "focus", optionIds: ["ui"] }]
      }
    });

    assert.equal(result.isError, true);
    assert.deepEqual(result.structuredContent, {
      error: "unknown_question_set",
      questionSetId: "missing-set",
      knownQuestionSetIds: ["known-set"],
      likelyCause: [
        "show_questions was not called in this Preflight server run",
        "show_questions ran in a different MCP/HTTP session with an unshared question store",
        "or the Preflight server restarted and lost in-memory question state"
      ].join(", ")
    });
    const text = (result.content as Array<{ type: string; text?: string }>)
      .filter((item) => item.type === "text")
      .map((item) => item.text ?? "")
      .join("\n");
    assert.match(text, /Known questionSetIds: known-set/);
    assert.match(text, /different MCP\/HTTP session/);
  } finally {
    await client.close().catch(() => undefined);
    await started.close();
  }
});

test("question tool schemas limit question sets and answer batches to four", async () => {
  const started = await startMcpHttpServer(() => createPreflightMcpServer({ repoPath: process.cwd() }), 0);
  const client = new Client({ name: "preflight-question-limit-test", version: "0.1.0" });

  try {
    const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${started.port}/mcp`));
    await client.connect(transport);

    const tools = await client.listTools();
    const showQuestions = tools.tools.find((tool) => tool.name === "show_questions");
    const submitAnswers = tools.tools.find((tool) => tool.name === "submit_answers");
    const showInputSchema = showQuestions?.inputSchema as { properties?: Record<string, { maxItems?: number }> };
    const submitInputSchema = submitAnswers?.inputSchema as { properties?: Record<string, { maxItems?: number }> };

    assert.equal(showInputSchema.properties?.questions?.maxItems, 4);
    assert.equal(submitInputSchema.properties?.answers?.maxItems, 4);

    const tooManyQuestions = await client.callTool({
      name: "show_questions",
      arguments: {
        questionSetId: "too-many",
        questions: Array.from({ length: 5 }, (_, index) => ({
          id: `q${index}`,
          question: `Question ${index}?`,
          mode: "single",
          options: [
            { id: "a", label: "A", description: "" },
            { id: "b", label: "B", description: "" }
          ]
        }))
      }
    });

    assert.equal(tooManyQuestions.isError, true);

    const tooManyAnswers = await client.callTool({
      name: "submit_answers",
      arguments: {
        questionSetId: "too-many",
        answers: Array.from({ length: 5 }, (_, index) => ({ questionId: `q${index}`, optionIds: ["a"] }))
      }
    });

    assert.equal(tooManyAnswers.isError, true);
  } finally {
    await client.close().catch(() => undefined);
    await started.close();
  }
});
