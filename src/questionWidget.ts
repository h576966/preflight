import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const QUESTION_WIDGET_URI = "ui://widget/questions-v2.html";
export const QUESTION_WIDGET_MIME_TYPE = "text/html;profile=mcp-app";

export function createQuestionWidgetResourceMetadata() {
  return {
    title: "Question Widget",
    description: "Displays single-choice and multi-choice alignment questions.",
    _meta: {
      "openai/widgetDescription": "Displays single-choice and multi-choice alignment questions.",
      "openai/widgetPrefersBorder": true,
      "openai/widgetCSP": {
        connect_domains: [],
        resource_domains: []
      },
      ui: {
        prefersBorder: true,
        csp: {
          connectDomains: [],
          resourceDomains: []
        }
      }
    }
  };
}

export function registerQuestionWidget(server: McpServer): void {
  const metadata = createQuestionWidgetResourceMetadata();

  server.registerResource(
    "question-widget",
    QUESTION_WIDGET_URI,
    {
      title: metadata.title,
      description: metadata.description
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: QUESTION_WIDGET_MIME_TYPE,
          text: createQuestionWidgetHtml(),
          _meta: metadata._meta
        }
      ]
    })
  );
}

export function createQuestionWidgetHtml(): string {
  return String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Preflight Questions</title>
  <style>
    :root {
      color-scheme: light dark;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.35;
    }

    body {
      margin: 0;
      padding: 14px;
      background: Canvas;
      color: CanvasText;
    }

    form {
      display: grid;
      gap: 14px;
    }

    fieldset {
      border: 1px solid color-mix(in srgb, CanvasText 18%, transparent);
      border-radius: 8px;
      padding: 12px;
      margin: 0;
    }

    legend {
      padding: 0 4px;
      font-weight: 650;
    }

    .option {
      display: grid;
      grid-template-columns: 20px 1fr;
      gap: 8px;
      align-items: start;
      padding: 8px 0 0;
    }

    .label-row {
      display: flex;
      gap: 8px;
      align-items: baseline;
      flex-wrap: wrap;
      font-weight: 560;
    }

    .recommended {
      font-size: 12px;
      font-weight: 600;
      opacity: 0.72;
    }

    .description {
      margin: 2px 0 0;
      font-size: 13px;
      opacity: 0.78;
    }

    .actions {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }

    button {
      border: 1px solid color-mix(in srgb, CanvasText 20%, transparent);
      border-radius: 8px;
      background: ButtonFace;
      color: ButtonText;
      cursor: pointer;
      font: inherit;
      font-weight: 650;
      padding: 8px 12px;
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }

    #status {
      font-size: 13px;
      opacity: 0.82;
    }

    #empty {
      margin: 0;
      opacity: 0.72;
    }
  </style>
</head>
<body>
  <main id="app">
    <p id="empty">Waiting for question data...</p>
  </main>
  <script>
    const app = document.getElementById("app");
    let currentData = null;
    const cachedGlobals = {};
    let bridgeRequestId = 1;
    let initialPollId = null;
    const pendingBridgeRequests = new Map();

    function getToolOutput() {
      const toolOutput = readOpenAiGlobal("toolOutput");
      if (toolOutput) return extractStructuredContent(toolOutput) || toolOutput;

      const toolResponse = readOpenAiGlobal("toolResponse");
      if (toolResponse) return extractStructuredContent(toolResponse);

      return null;
    }

    function readOpenAiGlobal(key) {
      const value = window.openai?.[key];
      if (value !== undefined) {
        cachedGlobals[key] = value;
        return value;
      }

      return Object.prototype.hasOwnProperty.call(cachedGlobals, key)
        ? cachedGlobals[key]
        : undefined;
    }

    function updateCachedGlobals(globals) {
      if (!globals || typeof globals !== "object") return;

      for (const [key, value] of Object.entries(globals)) {
        if (value !== undefined) cachedGlobals[key] = value;
      }
    }

    function extractStructuredContent(payload) {
      return payload?.structuredContent
        || payload?.result?.structuredContent
        || payload?.result?.content?.structuredContent
        || payload?.content?.structuredContent
        || payload?.toolOutput
        || payload?.toolResponse?.structuredContent
        || null;
    }

    function callBridgeTool(name, args) {
      if (!window.parent || window.parent === window) {
        return Promise.reject(new Error("MCP Apps bridge is unavailable."));
      }

      const id = "preflight-" + bridgeRequestId++;
      const message = {
        jsonrpc: "2.0",
        id,
        method: "tools/call",
        params: {
          name,
          arguments: args
        }
      };

      return new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          pendingBridgeRequests.delete(id);
          reject(new Error("Tool call timed out."));
        }, 15000);

        pendingBridgeRequests.set(id, { resolve, reject, timeout });
        window.parent.postMessage(message, "*");
      });
    }

    async function callTool(name, args) {
      if (window.openai?.callTool) {
        return window.openai.callTool(name, args);
      }

      return callBridgeTool(name, args);
    }

    function formatErrorMessage(error) {
      if (error instanceof Error) return error.message;
      if (typeof error === "string") return error;
      if (error && typeof error === "object" && "message" in error) {
        return String(error.message);
      }
      return "Could not submit answers.";
    }

    function handleBridgeMessage(event) {
      if (event.source && event.source !== window.parent) return;

      const message = event.data;
      if (!message || typeof message !== "object") return;

      if (message.id && pendingBridgeRequests.has(message.id)) {
        const pending = pendingBridgeRequests.get(message.id);
        pendingBridgeRequests.delete(message.id);
        window.clearTimeout(pending.timeout);

        if (message.error) {
          pending.reject(new Error(message.error.message || "Tool call failed."));
        } else {
          pending.resolve(message.result);
        }
        return;
      }

      if (message.method === "ui/notifications/tool-result") {
        const content = extractStructuredContent(message.params);
        if (content) render(content);
      }
    }

    function render(data = getToolOutput()) {
      if (!data || !Array.isArray(data.questions) || data.questions.length === 0) {
        if (!currentData) {
          app.innerHTML = '<p id="empty">Waiting for question data...</p>';
        }
        return;
      }

      currentData = data;
      stopInitialPolling();

      const form = document.createElement("form");
      form.id = "question-form";

      for (const question of data.questions) {
        const fieldset = document.createElement("fieldset");
        const legend = document.createElement("legend");
        legend.textContent = question.question;
        fieldset.appendChild(legend);

        const inputType = question.mode === "multi" ? "checkbox" : "radio";
        for (const option of question.options) {
          const optionId = question.id + ":" + option.id;
          const row = document.createElement("label");
          row.className = "option";
          row.htmlFor = optionId;

          const input = document.createElement("input");
          input.type = inputType;
          input.id = optionId;
          input.name = question.id;
          input.value = option.id;
          input.dataset.questionId = question.id;
          input.addEventListener("change", updateSubmitState);

          const text = document.createElement("span");

          const labelRow = document.createElement("span");
          labelRow.className = "label-row";

          const labelText = document.createElement("span");
          labelText.textContent = option.label;
          labelRow.appendChild(labelText);

          if (option.id === question.recommendedOptionId) {
            const recommended = document.createElement("span");
            recommended.className = "recommended";
            recommended.textContent = "Recommended";
            labelRow.appendChild(recommended);
          }

          text.appendChild(labelRow);

          if (option.description) {
            const description = document.createElement("p");
            description.className = "description";
            description.textContent = option.description;
            text.appendChild(description);
          }

          row.append(input, text);
          fieldset.appendChild(row);
        }

        form.appendChild(fieldset);
      }

      const actions = document.createElement("div");
      actions.className = "actions";

      const button = document.createElement("button");
      button.type = "submit";
      button.textContent = "Submit answers";
      button.disabled = true;

      const status = document.createElement("span");
      status.id = "status";
      status.textContent = "Select at least one option.";

      actions.append(button, status);
      form.appendChild(actions);
      form.addEventListener("submit", submitAnswers);

      app.replaceChildren(form);
      updateSubmitState();
    }

    function collectAnswers() {
      const answersByQuestion = new Map();
      const checkedInputs = app.querySelectorAll("input:checked");

      for (const input of checkedInputs) {
        const questionId = input.dataset.questionId;
        if (!answersByQuestion.has(questionId)) {
          answersByQuestion.set(questionId, []);
        }
        answersByQuestion.get(questionId).push(input.value);
      }

      return Array.from(answersByQuestion, ([questionId, optionIds]) => ({ questionId, optionIds }));
    }

    function updateSubmitState() {
      const button = app.querySelector("button[type='submit']");
      const status = app.querySelector("#status");
      if (!button || !status) return;

      const answers = collectAnswers();
      const questionCount = Array.isArray(currentData?.questions) ? currentData.questions.length : 0;
      const remaining = Math.max(0, questionCount - answers.length);

      button.disabled = questionCount === 0 || remaining > 0;
      status.textContent = remaining > 0
        ? "Answer " + remaining + " more question(s)."
        : answers.length + " answer(s) selected.";
    }

    function formatSubmittedAnswers(structuredContent, fallbackAnswers) {
      if (Array.isArray(structuredContent?.answeredQuestions) && structuredContent.answeredQuestions.length > 0) {
        return structuredContent.answeredQuestions.map((answer) => {
          const selectedLabels = Array.isArray(answer.selectedOptions)
            ? answer.selectedOptions.map((option) => option.label).join(", ")
            : answer.optionIds.join(", ");
          return "- " + answer.question + ": " + selectedLabels;
        }).join("\n");
      }

      return fallbackAnswers.map((answer) => {
        const question = currentData.questions.find((item) => item.id === answer.questionId);
        const optionLabels = answer.optionIds.map((optionId) => {
          const option = question?.options.find((item) => item.id === optionId);
          return option?.label || optionId;
        }).join(", ");
        return "- " + (question?.question || answer.questionId) + ": " + optionLabels;
      }).join("\n");
    }

    async function notifyModelAfterSubmit(structuredContent, summary) {
      const widgetState = {
        questionSetId: currentData.questionSetId,
        answers: structuredContent?.answers || [],
        answeredQuestions: structuredContent?.answeredQuestions || [],
        submittedAt: new Date().toISOString()
      };

      if (window.openai?.setWidgetState) {
        await window.openai.setWidgetState(widgetState).catch(() => undefined);
      }

      if (!window.openai?.sendFollowUpMessage) return false;

      try {
        await window.openai.sendFollowUpMessage({
          prompt: "Preflight questions have been answered. Continue from the previous task using these answers:\n" + summary,
          scrollToBottom: true
        });
        return true;
      } catch {
        return false;
      }
    }

    function stopInitialPolling() {
      if (initialPollId !== null) {
        window.clearInterval(initialPollId);
        initialPollId = null;
      }
    }

    function startInitialPolling() {
      let remainingChecks = 40;
      initialPollId = window.setInterval(() => {
        const data = getToolOutput();
        if (data) {
          render(data);
          return;
        }

        remainingChecks -= 1;
        if (remainingChecks <= 0) stopInitialPolling();
      }, 250);
    }

    async function submitAnswers(event) {
      event.preventDefault();
      const status = app.querySelector("#status");
      const button = app.querySelector("button[type='submit']");
      const answers = collectAnswers();
      const questionCount = Array.isArray(currentData?.questions) ? currentData.questions.length : 0;

      if (!currentData?.questionSetId || answers.length < questionCount) return;

      try {
        if (button) button.disabled = true;
        if (status) status.textContent = "Submitting...";

        const result = await callTool("submit_answers", {
          questionSetId: currentData.questionSetId,
          answers
        });

        const structuredContent = extractStructuredContent(result) || result || {};
        const storedAnswers = structuredContent.answers || answers;
        const summary = formatSubmittedAnswers(structuredContent, storedAnswers);
        const notified = await notifyModelAfterSubmit(structuredContent, summary);
        if (status) {
          status.textContent = notified
            ? "Stored " + storedAnswers.length + " answer(s). Continuing..."
            : "Stored " + storedAnswers.length + " answer(s).";
        }
        if (button) button.disabled = answers.length === 0;
      } catch (error) {
        if (status) status.textContent = formatErrorMessage(error);
        if (button) button.disabled = answers.length === 0;
      }
    }

    window.addEventListener("message", handleBridgeMessage);
    window.addEventListener("openai:set_globals", (event) => {
      updateCachedGlobals(event.detail?.globals);
      render();
    });
    render();
    startInitialPolling();
  </script>
</body>
</html>`;
}
