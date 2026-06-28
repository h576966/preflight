import assert from "node:assert/strict";
import test from "node:test";
import {
  createQuestionWidgetResourceMetadata,
  createQuestionWidgetHtml,
  QUESTION_WIDGET_MIME_TYPE,
  QUESTION_WIDGET_URI
} from "../src/questionWidget.js";

test("question widget uses the expected resource URI and MIME type", () => {
  assert.equal(QUESTION_WIDGET_URI, "ui://widget/questions-v5.html");
  assert.equal(QUESTION_WIDGET_MIME_TYPE, "text/html;profile=mcp-app");
});

test("question widget resource metadata keeps CSP closed", () => {
  const metadata = createQuestionWidgetResourceMetadata();

  assert.equal(metadata._meta.ui.prefersBorder, false);
  assert.equal(metadata._meta["openai/widgetPrefersBorder"], false);
  assert.deepEqual(metadata._meta["openai/widgetCSP"].connect_domains, []);
  assert.deepEqual(metadata._meta["openai/widgetCSP"].resource_domains, []);
  assert.deepEqual(metadata._meta.ui.csp.connectDomains, []);
  assert.deepEqual(metadata._meta.ui.csp.resourceDomains, []);
});

test("question widget reads ChatGPT tool output and listens for host updates", () => {
  const html = createQuestionWidgetHtml();

  assert.match(html, /readOpenAiGlobal\("toolOutput"\)/);
  assert.match(html, /event\.detail\?\.globals/);
  assert.match(html, /cachedGlobals/);
  assert.match(html, /startInitialPolling/);
  assert.match(html, /readOpenAiGlobal\("widgetState"\)/);
  assert.match(html, /payload\?\.result\?\.content\?\.structuredContent/);
  assert.match(html, /ui\/notifications\/tool-result/);
  assert.match(html, /event\.source && event\.source !== window\.parent/);
  assert.match(html, /window\.addEventListener\("message", handleBridgeMessage\)/);
  assert.match(html, /openai:set_globals/);
  assert.match(html, /render\(\)/);
});

test("question widget calls submit_answers through ChatGPT API with bridge fallback", () => {
  const html = createQuestionWidgetHtml();

  assert.match(html, /"tools\/call"/);
  assert.match(html, /window\.parent\.postMessage\(message, "\*"\)/);
  assert.match(html, /window\.openai\?\.callTool/);
  assert.match(html, /window\.openai\?\.setWidgetState/);
  assert.match(html, /window\.openai\?\.sendFollowUpMessage/);
  assert.match(html, /window\.openai\.setWidgetState\(nextState\)/);
  assert.doesNotMatch(html, /maybePromise/);
  assert.doesNotMatch(html, /setWidgetState\(nextState\)\.catch/);
  assert.doesNotMatch(html, /questions: currentData\.questions/);
  assert.match(html, /input\.addEventListener\("change", handleAnswerChange\)/);
  assert.match(html, /restoreSelections\(\)/);
  assert.match(html, /submitStatus: "submitting"/);
  assert.match(html, /submitStatus: "submitted"/);
  assert.match(html, /"ui\/message"/);
  assert.match(html, /"ui\/initialize"/);
  assert.match(html, /ui\/notifications\/initialized/);
  assert.match(html, /function ensureBridgeReady\(\)/);
  assert.ok(html.indexOf("window.openai?.sendFollowUpMessage") < html.indexOf("return sendUiMessage(prompt)"));
  assert.match(html, /async function callBridgeTool\(name, args\) \{\s*await ensureBridgeReady\(\);[\s\S]*"tools\/call"/);
  assert.match(html, /async function sendUiMessage\(prompt\) \{\s*try \{\s*await ensureBridgeReady\(\);[\s\S]*bridgeNotify\("ui\/message"/);
  assert.match(html, /return \{ status: "delivered" \}/);
  assert.match(html, /return \{ status: "requested" \}/);
  assert.match(html, /return \{ status: "unavailable" \}/);
  assert.doesNotMatch(html, /sendBridgeFollowUpMessage/);
  assert.ok(html.indexOf('submitStatus: "submitting"') < html.indexOf('callTool("submit_answers"'));
  assert.ok(html.indexOf("window.openai?.callTool") < html.indexOf("return callBridgeTool"));
  assert.match(html, /callTool\("submit_answers"/);
  assert.match(html, /questionSetId:\s*currentData\.questionSetId/);
  assert.match(html, /answers/);
  assert.match(html, /formatErrorMessage/);
});

test("question widget supports radio and checkbox inputs", () => {
  const html = createQuestionWidgetHtml();

  assert.match(html, /question\.mode === "multi" \? "checkbox" : "radio"/);
  assert.match(html, /input\.type = inputType/);
});

test("question widget renders recommended options and submit status", () => {
  const html = createQuestionWidgetHtml();

  assert.match(html, /Recommended/);
  assert.match(html, /Submit answers/);
  assert.match(html, /isSubmitResult\(data\)/);
  assert.match(html, /Answer " \+ remaining \+ " more question\(s\)\./);
  assert.match(html, /"Stored " \+ \(Array\.isArray\(submittedAnswers\) \? submittedAnswers\.length : 0\) \+ " answer\(s\)\."/);
  assert.match(html, /"Stored " \+ answerCount \+ " answer\(s\)\. Continuing\.\.\."/);
  assert.match(html, /"Stored " \+ answerCount \+ " answer\(s\)\. Continuation requested\."/);
  assert.match(html, /status\.textContent = submittedStatusText\(storedAnswers\.length, continuationResult\)/);
  assert.match(html, /button\.disabled = true/);
});

test("question widget uses compact overflow-safe layout", () => {
  const html = createQuestionWidgetHtml();

  assert.match(html, /box-sizing: border-box/);
  assert.match(html, /overflow-x: hidden/);
  assert.match(html, /grid-template-columns: 18px minmax\(0, 1fr\)/);
  assert.match(html, /window\.openai\?\.notifyIntrinsicHeight\?\.\(\)/);
  assert.doesNotMatch(html, /margin: 2px -10px/);
});
