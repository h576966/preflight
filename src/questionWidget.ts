import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const QUESTION_WIDGET_URI = "ui://widget/questions-v5.html";
export const QUESTION_WIDGET_MIME_TYPE = "text/html;profile=mcp-app";

export function createQuestionWidgetResourceMetadata() {
  return {
    title: "Question Widget",
    description: "Displays single-choice and multi-choice alignment questions.",
    _meta: {
      "openai/widgetDescription": "Displays single-choice and multi-choice alignment questions.",
      "openai/widgetPrefersBorder": false,
      "openai/widgetCSP": {
        connect_domains: [],
        resource_domains: []
      },
      ui: {
        prefersBorder: false,
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
      --accent: #2563eb;
      --muted: color-mix(in srgb, CanvasText 62%, transparent);
      --subtle: color-mix(in srgb, CanvasText 8%, transparent);
      --separator: color-mix(in srgb, CanvasText 12%, transparent);
    }

    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    html,
    body {
      max-width: 100%;
      overflow-x: hidden;
    }

    body {
      margin: 0;
      padding: 6px 8px 8px;
      background: Canvas;
      color: CanvasText;
    }

    #app,
    form {
      max-width: 100%;
      overflow-x: hidden;
    }

    form {
      display: grid;
      gap: 0;
    }

    fieldset {
      border: 0;
      border-radius: 0;
      padding: 6px 0 8px;
      margin: 0;
    }

    fieldset + fieldset {
      border-top: 1px solid var(--separator);
      padding-top: 10px;
    }

    legend {
      padding: 0;
      margin-bottom: 4px;
      font-size: 14px;
      font-weight: 680;
      letter-spacing: 0;
      overflow-wrap: anywhere;
    }

    .option {
      display: grid;
      grid-template-columns: 18px minmax(0, 1fr);
      gap: 8px;
      align-items: center;
      padding: 6px 8px;
      margin: 1px 0;
      border-radius: 8px;
      cursor: pointer;
      transition: background-color 120ms ease, color 120ms ease;
    }

    .option:hover {
      background: var(--subtle);
    }

    .option:has(input:checked) {
      background: color-mix(in srgb, var(--accent) 12%, transparent);
    }

    input {
      accent-color: var(--accent);
      margin-top: 1px;
    }

    .option > span {
      min-width: 0;
    }

    .label-row {
      display: flex;
      gap: 6px;
      align-items: baseline;
      flex-wrap: wrap;
      font-weight: 560;
      overflow-wrap: anywhere;
    }

    .recommended {
      font-size: 11px;
      font-weight: 600;
      color: var(--muted);
    }

    .description {
      margin: 1px 0 0;
      font-size: 12px;
      color: var(--muted);
      overflow-wrap: anywhere;
    }

    .actions {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      border-top: 1px solid var(--separator);
      margin-top: 2px;
      padding-top: 8px;
      position: sticky;
      bottom: 0;
      background: Canvas;
    }

    button {
      border: 0;
      border-radius: 8px;
      background: var(--accent);
      color: white;
      cursor: pointer;
      font: inherit;
      font-weight: 650;
      padding: 6px 10px;
      min-height: 32px;
    }

    button:disabled {
      cursor: not-allowed;
      background: color-mix(in srgb, CanvasText 10%, Canvas);
      color: var(--muted);
    }

    #status {
      font-size: 12px;
      color: var(--muted);
      min-width: 0;
    }

    #empty {
      margin: 0;
      color: var(--muted);
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
    let currentWidgetState = null;
    const cachedGlobals = {};
    let bridgeRequestId = 1;
    let initialPollId = null;
    let bridgeReadyPromise = null;
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

    function isObject(value) {
      return Boolean(value) && typeof value === "object" && !Array.isArray(value);
    }

    function isQuestionPayload(data) {
      return isObject(data) && typeof data.questionSetId === "string" && Array.isArray(data.questions);
    }

    function isSubmitResult(data) {
      return isObject(data) && typeof data.questionSetId === "string" && Array.isArray(data.answers);
    }

    function normalizeSelections(value) {
      if (!isObject(value)) return {};

      const selections = {};
      for (const [questionId, optionIds] of Object.entries(value)) {
        if (!Array.isArray(optionIds)) continue;
        selections[questionId] = optionIds.filter((optionId) => typeof optionId === "string");
      }
      return selections;
    }

    function answersToSelections(answers) {
      const selections = {};
      for (const answer of answers) {
        if (typeof answer.questionId === "string" && Array.isArray(answer.optionIds)) {
          selections[answer.questionId] = answer.optionIds.filter((optionId) => typeof optionId === "string");
        }
      }
      return selections;
    }

    function getStoredWidgetState() {
      if (currentWidgetState?.questionSetId === currentData?.questionSetId) {
        return currentWidgetState;
      }

      const hostState = readOpenAiGlobal("widgetState");
      if (hostState?.questionSetId === currentData?.questionSetId) {
        currentWidgetState = hostState;
        return hostState;
      }

      return null;
    }

    function createWidgetState(patch = {}) {
      const storedState = getStoredWidgetState();
      return {
        questionSetId: currentData.questionSetId,
        selections: normalizeSelections(storedState?.selections),
        submitStatus: storedState?.submitStatus || "idle",
        submittedResult: storedState?.submittedResult || null,
        ...patch
      };
    }

    function persistWidgetState(patch = {}) {
      if (!currentData?.questionSetId) return null;

      const nextState = createWidgetState(patch);
      currentWidgetState = nextState;
      cachedGlobals.widgetState = nextState;

      if (window.openai?.setWidgetState) {
        try {
          window.openai.setWidgetState(nextState);
        } catch {
          // Local state is already updated; host persistence is a best-effort layer.
        }
      }

      return nextState;
    }

    function notifyIntrinsicHeight() {
      try {
        window.openai?.notifyIntrinsicHeight?.();
      } catch {
        // Height reporting is optional; layout still works without it.
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

    function bridgeRequest(method, params, timeoutMessage) {
      if (!window.parent || window.parent === window) {
        return Promise.reject(new Error("MCP Apps bridge is unavailable."));
      }

      const id = "preflight-" + bridgeRequestId++;
      const message = {
        jsonrpc: "2.0",
        id,
        method,
        params
      };

      return new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          pendingBridgeRequests.delete(id);
          reject(new Error(timeoutMessage));
        }, 15000);

        pendingBridgeRequests.set(id, { resolve, reject, timeout });
        window.parent.postMessage(message, "*");
      });
    }

    function bridgeNotify(method, params) {
      if (!window.parent || window.parent === window) {
        throw new Error("MCP Apps bridge is unavailable.");
      }

      window.parent.postMessage({ jsonrpc: "2.0", method, params }, "*");
    }

    function ensureBridgeReady() {
      if (bridgeReadyPromise) return bridgeReadyPromise;

      bridgeReadyPromise = bridgeRequest(
        "ui/initialize",
        {
          appInfo: { name: "preflight-question-widget", version: "0.1.0" },
          appCapabilities: {},
          protocolVersion: "2026-01-26"
        },
        "MCP Apps bridge initialization timed out."
      ).then(() => {
        bridgeNotify("ui/notifications/initialized", {});
        return true;
      }).catch((error) => {
        bridgeReadyPromise = null;
        throw error;
      });

      return bridgeReadyPromise;
    }

    async function callBridgeTool(name, args) {
      await ensureBridgeReady();
      return bridgeRequest(
        "tools/call",
        { name, arguments: args },
        "Tool call timed out."
      );
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
      if (isSubmitResult(data)) {
        applySubmittedResult(data);
        return;
      }

      if (!isQuestionPayload(data) || data.questions.length === 0) {
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
          input.addEventListener("change", handleAnswerChange);

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
      restoreSelections();
      if (!getStoredWidgetState()) {
        persistWidgetState({
          selections: {},
          submitStatus: "idle",
          submittedResult: null
        });
      }
      updateSubmitState();
      notifyIntrinsicHeight();
    }

    function applySubmittedResult(result) {
      if (!currentData || result.questionSetId !== currentData.questionSetId) return;

      const selections = answersToSelections(result.answers);
      persistWidgetState({
        selections,
        submitStatus: "submitted",
        submittedResult: result
      });
      restoreSelections();
      updateSubmitState();
      notifyIntrinsicHeight();
    }

    function restoreSelections() {
      const selections = normalizeSelections(getStoredWidgetState()?.selections);
      for (const input of app.querySelectorAll("input[data-question-id]")) {
        const selectedOptions = selections[input.dataset.questionId] || [];
        input.checked = selectedOptions.includes(input.value);
      }
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

    function handleAnswerChange() {
      const answers = collectAnswers();
      persistWidgetState({
        selections: answersToSelections(answers),
        submitStatus: "idle",
        submittedResult: null
      });
      updateSubmitState();
    }

    function updateSubmitState() {
      const button = app.querySelector("button[type='submit']");
      const status = app.querySelector("#status");
      if (!button || !status) return;

      const storedState = getStoredWidgetState();
      const submittedAnswers = storedState?.submittedResult?.answers;
      if (storedState?.submitStatus === "submitted") {
        button.disabled = true;
        status.textContent = "Stored " + (Array.isArray(submittedAnswers) ? submittedAnswers.length : 0) + " answer(s).";
        return;
      }

      if (storedState?.submitStatus === "submitting") {
        button.disabled = true;
        status.textContent = "Submitting...";
        return;
      }

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

    async function notifyModelAfterSubmit(summary) {
      const prompt = "Preflight questions have been answered. Continue from the previous task using these answers:\n" + summary;

      if (window.openai?.sendFollowUpMessage) {
        try {
          await window.openai.sendFollowUpMessage({
            prompt,
            scrollToBottom: true
          });
          return { status: "delivered" };
        } catch {
          // Fall back to the standard bridge path below.
        }
      }

      return sendUiMessage(prompt);
    }

    async function sendUiMessage(prompt) {
      try {
        await ensureBridgeReady();
        bridgeNotify("ui/message", {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt
            }
          ]
        });
        return { status: "requested" };
      } catch {
        return { status: "unavailable" };
      }
    }

    function submittedStatusText(answerCount, continuationResult) {
      if (continuationResult.status === "delivered") {
        return "Stored " + answerCount + " answer(s). Continuing...";
      }
      if (continuationResult.status === "requested") {
        return "Stored " + answerCount + " answer(s). Continuation requested.";
      }
      return "Stored " + answerCount + " answer(s), but ChatGPT did not receive an automatic continuation message.";
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
      const selections = answersToSelections(answers);

      try {
        if (button) button.disabled = true;
        if (status) status.textContent = "Submitting...";
        persistWidgetState({
          selections,
          submitStatus: "submitting",
          submittedResult: null
        });

        const result = await callTool("submit_answers", {
          questionSetId: currentData.questionSetId,
          answers
        });

        const structuredContent = extractStructuredContent(result) || result || {};
        const storedAnswers = structuredContent.answers || answers;
        const summary = formatSubmittedAnswers(structuredContent, storedAnswers);
        persistWidgetState({
          selections: answersToSelections(storedAnswers),
          submitStatus: "submitted",
          submittedResult: structuredContent
        });
        const continuationResult = await notifyModelAfterSubmit(summary);
        if (status) {
          status.textContent = submittedStatusText(storedAnswers.length, continuationResult);
        }
        if (button) button.disabled = true;
        notifyIntrinsicHeight();
      } catch (error) {
        persistWidgetState({
          selections,
          submitStatus: "idle",
          submittedResult: null
        });
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
