import assert from "node:assert/strict";
import test from "node:test";
import {
  createQuestionWidgetResourceMetadata,
  createQuestionWidgetHtml,
  QUESTION_WIDGET_MIME_TYPE,
  QUESTION_WIDGET_URI
} from "../src/questionWidget.js";

test("question widget uses the expected resource URI and MIME type", () => {
  assert.equal(QUESTION_WIDGET_URI, "ui://widget/questions-v1.html");
  assert.equal(QUESTION_WIDGET_MIME_TYPE, "text/html;profile=mcp-app");
});

test("question widget resource metadata keeps CSP closed", () => {
  const metadata = createQuestionWidgetResourceMetadata();

  assert.equal(metadata._meta.ui.prefersBorder, true);
  assert.equal(metadata._meta["openai/widgetPrefersBorder"], true);
  assert.deepEqual(metadata._meta["openai/widgetCSP"].connect_domains, []);
  assert.deepEqual(metadata._meta["openai/widgetCSP"].resource_domains, []);
  assert.deepEqual(metadata._meta.ui.csp.connectDomains, []);
  assert.deepEqual(metadata._meta.ui.csp.resourceDomains, []);
});

test("question widget reads ChatGPT tool output and listens for host updates", () => {
  const html = createQuestionWidgetHtml();

  assert.match(html, /window\.openai\?\.toolOutput/);
  assert.match(html, /payload\?\.result\?\.content\?\.structuredContent/);
  assert.match(html, /ui\/notifications\/tool-result/);
  assert.match(html, /event\.source && event\.source !== window\.parent/);
  assert.match(html, /window\.addEventListener\("message", handleBridgeMessage\)/);
  assert.match(html, /openai:set_globals/);
  assert.match(html, /render\(\)/);
});

test("question widget calls submit_answers through ChatGPT API with bridge fallback", () => {
  const html = createQuestionWidgetHtml();

  assert.match(html, /method: "tools\/call"/);
  assert.match(html, /window\.parent\.postMessage\(message, "\*"\)/);
  assert.match(html, /window\.openai\?\.callTool/);
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
  assert.match(html, /"Stored " \+ storedAnswers\.length \+ " answer\(s\)\."/);
});
