# MCP Tool Contracts

The server should expose local facts and alignment UI only. ChatGPT remains responsible for reasoning, recommendations, and any Codex prompt writing.

## project_snapshot

Return the current local project state:

- root and name
- remote URL
- inferred `owner/repo`
- branch, HEAD, upstream
- changed files with staged/unstaged/untracked status
- local instruction files
- detected stack hints
- output limits
- small auto-included contents for selected instruction/manifest files

## local_diff

Return bounded local diff output for:

- `staged`
- `unstaged`
- `all`

Must support path filters, context lines, byte limits, and truncation metadata.

`project_snapshot` provides changed-file metadata. When ChatGPT explicitly calls `local_diff`, return bounded patches by default instead of adding another metadata-only step.

Untracked file contents are out of scope for this tool. `local_diff` should list tracked patches only and report omitted files when paths are blocked, ignored, binary/unreadable, or beyond the byte budget.

## read_local

Read selected local file ranges only.

Use this for exact paths when they are local-only files, locally changed files, local instruction files, or allowlisted high-value TS/JS/Python project files. Prefer ChatGPT's GitHub tool for normal committed file content when exact local path lookup is not required.

Input:

```json
{
  "files": [
    {
      "path": "string",
      "startLine": 1,
      "endLine": 120
    }
  ],
  "maxBytes": 60000
}
```

Output:

```json
{
  "files": [
    {
      "path": "string",
      "startLine": 1,
      "endLine": 120,
      "content": "string",
      "truncated": false
    }
  ],
  "omittedFiles": [
    {
      "path": "string",
      "reason": "ignored|not-allowed|not-found|binary-or-unreadable|byte-budget"
    }
  ],
  "truncated": false
}
```

Hard-blocked secret-like paths and paths outside the repository are rejected. Other unreadable or disallowed files are reported in `omittedFiles`.

## show_questions

Render multiple-choice questions created by ChatGPT.

The server should not decide which questions to ask. It validates and stores the question set for the current Preflight server run, returns structured question data, and renders the minimal ChatGPT App question widget.

ChatGPT should use `show_questions` naturally and proactively when user input would materially improve reliability, especially when there are meaningful trade-offs, missing preferences, unclear scope, or a real risk of producing the wrong output. The user should not need to say "ask me questions" for this tool to be useful.

Do not use `show_questions` as a default workflow step. If the answer is clear, the task is narrow, or a direct response is sufficient, ChatGPT should answer directly. After calling this tool, ChatGPT should wait for `submit_answers` or the widget follow-up before continuing with recommendations or analysis.

Input:

```json
{
  "questionSetId": "string",
  "questions": [
    {
      "id": "string",
      "question": "string",
      "mode": "single|multi",
      "options": [
        {
          "id": "string",
          "label": "string",
          "description": "string"
        }
      ],
      "recommendedOptionId": "string|null"
    }
  ]
}
```

Output:

```json
{
  "questionSetId": "string",
  "rendered": true,
  "questions": [
    {
      "id": "string",
      "question": "string",
      "mode": "single|multi",
      "options": [
        {
          "id": "string",
          "label": "string",
          "description": "string"
        }
      ],
      "recommendedOptionId": "string|null"
    }
  ]
}
```

Validation:

- 1-4 questions per set.
- 2-5 options per question.
- question IDs are unique within a set.
- option IDs are unique within each question.
- reused `questionSetId` is allowed only for the same normalized question payload.
- `recommendedOptionId`, when present, must match an option.

UI:

- widget resource: `ui://widget/questions-v5.html`
- widget MIME type: `text/html;profile=mcp-app`
- no remote assets or external CSP domains
- widget uses the MCP Apps bridge for tool results and widget-initiated tool calls
- widget falls back to ChatGPT `window.openai` helpers when the bridge path is unavailable
- widget calls `submit_answers` after the user answers all displayed questions
- tool results set `_meta["openai/widgetSessionId"]` to `questionSetId`
- widget stores selections and submitted answers in `widgetState` when available
- widget uses ChatGPT `sendFollowUpMessage` first so ChatGPT continues with selected answers
- widget falls back to initialized MCP Apps `ui/message` when the ChatGPT helper is unavailable

## submit_answers

Store submitted answers in memory for the current Preflight server run and return both compact IDs and selected option labels ChatGPT can use. The question store is shared across MCP HTTP sessions in one running server process so widget-initiated submits can answer question sets created by assistant-initiated `show_questions` calls.

Input:

```json
{
  "questionSetId": "string",
  "answers": [
    {
      "questionId": "string",
      "optionIds": ["string"]
    }
  ]
}
```

Output:

```json
{
  "questionSetId": "string",
  "answers": [
    {
      "questionId": "string",
      "optionIds": ["string"]
    }
  ],
  "answeredQuestions": [
    {
      "questionId": "string",
      "question": "string",
      "optionIds": ["string"],
      "selectedOptions": [
        {
          "id": "string",
          "label": "string",
          "description": "string"
        }
      ]
    }
  ]
}
```

Validation:

- question set, question IDs, and option IDs must already exist.
- duplicate submitted question IDs and option IDs are rejected.
- single-choice questions require exactly one option.
- multi-choice questions require at least one option.
- repeated answers replace the previous stored answer for that question.
- returned answers are ordered by the original question order.
- `answeredQuestions` mirrors the stored answers and includes question text plus selected option labels.
- unknown question sets return an error diagnostic with the requested `questionSetId`, known question set IDs, and likely causes.

## Deferred

- `search_local`
- server-side prompt generation
- server-side recommendation tools
