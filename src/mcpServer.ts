import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { DEFAULT_LIMITS } from "./constants.js";
import { createLocalDiff } from "./localDiff.js";
import { createProjectSnapshot } from "./projectSnapshot.js";
import { formatQuestionSetForText, QuestionStore } from "./questions.js";
import { createReadLocal } from "./readLocal.js";

export type PreflightServerOptions = {
  repoPath: string;
};

const questionOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string()
});

const questionInputSchema = z.object({
  id: z.string(),
  question: z.string(),
  mode: z.enum(["single", "multi"]),
  options: z.array(questionOptionSchema).min(2).max(5),
  recommendedOptionId: z.string().nullable().optional()
});

const questionOutputSchema = z.object({
  id: z.string(),
  question: z.string(),
  mode: z.enum(["single", "multi"]),
  options: z.array(questionOptionSchema),
  recommendedOptionId: z.string().nullable()
});

const answerSchema = z.object({
  questionId: z.string(),
  optionIds: z.array(z.string())
});

export function createPreflightMcpServer(options: PreflightServerOptions): McpServer {
  const questionStore = new QuestionStore();
  const server = new McpServer(
    {
      name: "preflight",
      version: "0.1.0"
    },
    {
      instructions: [
        "Preflight is a read-only local repository companion.",
        "Use project_snapshot for local worktree facts that ChatGPT's GitHub tool cannot see.",
        "Use local_diff for bounded tracked-file patches when local changes matter.",
        "Use read_local for bounded local-only or exact-path file reads.",
        "Use show_questions and submit_answers to keep alignment choices explicit in chat.",
        "Prefer GitHub for committed remote code/docs; use Preflight for local state, diffs, and exact local paths."
      ].join(" ")
    }
  );

  server.registerTool(
    "project_snapshot",
    {
      title: "Project Snapshot",
      description: [
        "Use this when you need local worktree facts for the active repository.",
        "Returns repository identity, changed files, instruction files, and small high-value TS/JS/Python project context.",
        "This tool is read-only and does not replace GitHub for committed remote context."
      ].join(" "),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async (): Promise<CallToolResult> => {
      const snapshot = createProjectSnapshot({ repoPath: options.repoPath });
      return {
        structuredContent: snapshot,
        content: [
          {
            type: "text",
            text: `Project snapshot for ${snapshot.name}: ${snapshot.changedFiles.length} changed file(s).`
          }
        ]
      };
    }
  );

  server.registerTool(
    "local_diff",
    {
      title: "Local Diff",
      description: [
        "Use this when you need bounded patch output for tracked local changes in the active repository.",
        "Supports staged, unstaged, and all tracked changes.",
        "This tool is read-only and does not include untracked file contents; use project_snapshot to see untracked paths."
      ].join(" "),
      inputSchema: {
        scope: z.enum(["staged", "unstaged", "all"]),
        paths: z.array(z.string()).optional(),
        contextLines: z.number().int().min(0).max(20).optional(),
        maxBytes: z.number().int().min(1).max(DEFAULT_LIMITS.maxDiffBytes).optional()
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async (args): Promise<CallToolResult> => {
      const diff = createLocalDiff({
        repoPath: options.repoPath,
        scope: args.scope,
        paths: args.paths,
        contextLines: args.contextLines,
        maxBytes: args.maxBytes
      });

      return {
        structuredContent: diff,
        content: [
          {
            type: "text",
            text: `Local ${args.scope} diff: ${diff.files.length} file patch(es), ${diff.omittedFiles.length} omitted.`
          }
        ]
      };
    }
  );

  server.registerTool(
    "read_local",
    {
      title: "Read Local",
      description: [
        "Use this for bounded local file-range reads in the active repository.",
        "Prefer GitHub for normal committed content.",
        "Use read_local for exact paths when they are local-only, changed, instruction files, or allowlisted TS/JS/Python project files.",
        "This tool is read-only and hard-blocks secret-like paths."
      ].join(" "),
      inputSchema: {
        files: z.array(z.object({
          path: z.string(),
          startLine: z.number().int().min(1).optional(),
          endLine: z.number().int().min(1).optional()
        })).min(1).max(20),
        maxBytes: z.number().int().min(1).max(DEFAULT_LIMITS.maxReadBytes).optional()
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async (args): Promise<CallToolResult> => {
      const result = createReadLocal({
        repoPath: options.repoPath,
        files: args.files,
        maxBytes: args.maxBytes
      });

      return {
        structuredContent: result,
        content: [
          {
            type: "text",
            text: `Local read: ${result.files.length} file(s), ${result.omittedFiles.length} omitted.`
          }
        ]
      };
    }
  );

  server.registerTool(
    "show_questions",
    {
      title: "Show Questions",
      description: [
        "Use this when you need to ask the user concise single-choice or multi-choice alignment questions.",
        "This Phase 2A tool stores the question set and returns a normal-chat text fallback; widget rendering is deferred."
      ].join(" "),
      inputSchema: {
        questionSetId: z.string(),
        questions: z.array(questionInputSchema).min(1).max(10)
      },
      outputSchema: {
        questionSetId: z.string(),
        rendered: z.literal(true),
        questions: z.array(questionOutputSchema)
      },
      annotations: {
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async (args): Promise<CallToolResult> => {
      const result = questionStore.showQuestions(args);

      return {
        structuredContent: result,
        content: [
          {
            type: "text",
            text: formatQuestionSetForText(result)
          }
        ]
      };
    }
  );

  server.registerTool(
    "submit_answers",
    {
      title: "Submit Answers",
      description: [
        "Use this when the user has selected answers for a previously shown question set.",
        "Stores answers in memory for the current server session and returns the current compact answer set."
      ].join(" "),
      inputSchema: {
        questionSetId: z.string(),
        answers: z.array(answerSchema).min(1).max(10)
      },
      outputSchema: {
        questionSetId: z.string(),
        answers: z.array(answerSchema)
      },
      annotations: {
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async (args): Promise<CallToolResult> => {
      const result = questionStore.submitAnswers(args);

      return {
        structuredContent: result,
        content: [
          {
            type: "text",
            text: `Stored ${result.answers.length} answer(s) for question set ${result.questionSetId}.`
          }
        ]
      };
    }
  );

  return server;
}
