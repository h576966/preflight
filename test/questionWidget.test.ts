import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import {
  createQuestionWidgetResourceMetadata,
  createQuestionWidgetHtml,
  QUESTION_WIDGET_MIME_TYPE,
  QUESTION_SUBMIT_VALIDATION_SCRIPT,
  QUESTION_WIDGET_URI
} from "../src/questionWidget.js";

type SubmitValidator = {
  formatSubmittedAnswers: (structuredContent: unknown) => string;
  validateSubmitAnswersResult: (toolResult: unknown, expectedQuestionSetId: string) => {
    questionSetId: string;
    answers: Array<{ questionId: string; optionIds: string[] }>;
    answeredQuestions: Array<{
      questionId: string;
      question: string;
      optionIds: string[];
      selectedOptions: Array<{ id: string; label: string; description: string }>;
    }>;
  };
};

function loadSubmitValidator(): SubmitValidator {
  return vm.runInNewContext(`${QUESTION_SUBMIT_VALIDATION_SCRIPT}
    ({ validateSubmitAnswersResult, formatSubmittedAnswers });
  `) as SubmitValidator;
}

function validSubmitResult() {
  return {
    structuredContent: {
      questionSetId: "qs1",
      answers: [{ questionId: "focus", optionIds: ["reliability"] }],
      answeredQuestions: [{
        questionId: "focus",
        question: "What matters most?",
        optionIds: ["reliability"],
        selectedOptions: [{ id: "reliability", label: "Reliability", description: "Avoid false continuation." }]
      }]
    }
  };
}

test("question widget uses the expected resource URI and MIME type", () => {
  assert.equal(QUESTION_WIDGET_URI, "ui://widget/questions-v6.html");
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
  assert.match(html, /validateSubmitAnswersResult\(result, currentData\.questionSetId\)/);
  assert.match(html, /formatSubmittedAnswers\(structuredContent\)/);
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
  assert.match(html, /function showSubmitFailure\(error\)/);
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
  assert.match(html, /status\.textContent = submittedStatusText\(structuredContent\.answers\.length, continuationResult\)/);
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

test("question widget submit validation accepts a valid answer result", () => {
  const validator = loadSubmitValidator();
  const result = validator.validateSubmitAnswersResult(validSubmitResult(), "qs1");

  assert.equal(result.questionSetId, "qs1");
  assert.deepEqual(result.answers, [{ questionId: "focus", optionIds: ["reliability"] }]);
  assert.equal(validator.formatSubmittedAnswers(result), "- What matters most?: Reliability");
});

test("question widget submit validation rejects tool errors and unknown question sets", () => {
  const validator = loadSubmitValidator();

  assert.throws(
    () => validator.validateSubmitAnswersResult({ isError: true, content: [{ type: "text", text: "Unknown question set: qs1." }] }, "qs1"),
    /Submit failed: Unknown question set: qs1/
  );

  assert.throws(
    () => validator.validateSubmitAnswersResult({
      structuredContent: {
        error: "unknown_question_set",
        questionSetId: "missing",
        knownQuestionSetIds: ["known"],
        likelyCause: "server restarted"
      }
    }, "missing"),
    /unknown question set missing.*Known question sets: known.*server restarted/
  );
});

test("question widget submit validation rejects malformed successful-looking results", () => {
  const validator = loadSubmitValidator();

  assert.throws(
    () => validator.validateSubmitAnswersResult({ structuredContent: { ...validSubmitResult().structuredContent, questionSetId: "other" } }, "qs1"),
    /different question set/
  );
  assert.throws(
    () => validator.validateSubmitAnswersResult({ structuredContent: { questionSetId: "qs1", answeredQuestions: [] } }, "qs1"),
    /did not return answers/
  );
  assert.throws(
    () => validator.validateSubmitAnswersResult({ structuredContent: { questionSetId: "qs1", answers: [] } }, "qs1"),
    /did not return selected answer labels/
  );
  assert.throws(
    () => validator.validateSubmitAnswersResult({ structuredContent: { questionSetId: "qs1", answers: [], answeredQuestions: [] } }, "qs1"),
    /returned no answers/
  );
  assert.throws(
    () => validator.validateSubmitAnswersResult({
      structuredContent: {
        questionSetId: "qs1",
        answers: [{ questionId: "focus", optionIds: ["reliability"] }],
        answeredQuestions: []
      }
    }, "qs1"),
    /selected answer labels do not match answers/
  );
  assert.throws(
    () => validator.validateSubmitAnswersResult({
      structuredContent: {
        questionSetId: "qs1",
        answers: [{ questionId: "focus", optionIds: ["reliability"] }],
        answeredQuestions: [{
          questionId: "focus",
          question: "What matters most?",
          optionIds: ["reliability"],
          selectedOptions: []
        }]
      }
    }, "qs1"),
    /selected option labels are missing/
  );
  assert.throws(
    () => validator.validateSubmitAnswersResult({
      structuredContent: {
        questionSetId: "qs1",
        answers: [{ questionId: "focus", optionIds: ["reliability"] }],
        answeredQuestions: [{
          questionId: "other",
          question: "What matters most?",
          optionIds: ["reliability"],
          selectedOptions: [{ id: "reliability", label: "Reliability", description: "" }]
        }]
      }
    }, "qs1"),
    /selected answer labels do not match answers/
  );
  assert.throws(
    () => validator.validateSubmitAnswersResult({
      structuredContent: {
        questionSetId: "qs1",
        answers: [{ questionId: "focus", optionIds: ["reliability"] }],
        answeredQuestions: [{
          questionId: "focus",
          question: "What matters most?",
          optionIds: ["speed"],
          selectedOptions: [{ id: "speed", label: "Speed", description: "" }]
        }]
      }
    }, "qs1"),
    /selected answer labels do not match answer option IDs/
  );
  assert.throws(
    () => validator.validateSubmitAnswersResult({
      structuredContent: {
        questionSetId: "qs1",
        answers: [{ questionId: "focus", optionIds: ["reliability"] }],
        answeredQuestions: [{
          questionId: "focus",
          question: "What matters most?",
          optionIds: ["reliability"],
          selectedOptions: [{ id: "speed", label: "Reliability", description: "" }]
        }]
      }
    }, "qs1"),
    /selected option labels do not match answer option IDs/
  );
  assert.throws(
    () => validator.validateSubmitAnswersResult({
      structuredContent: {
        questionSetId: "qs1",
        answers: [
          { questionId: "focus", optionIds: ["reliability"] },
          { questionId: "scope", optionIds: ["small"] }
        ],
        answeredQuestions: [
          {
            questionId: "focus",
            question: "What matters most?",
            optionIds: ["reliability"],
            selectedOptions: [{ id: "reliability", label: "Reliability", description: "" }]
          },
          {
            questionId: "focus",
            question: "What matters most?",
            optionIds: ["reliability"],
            selectedOptions: [{ id: "reliability", label: "Reliability", description: "" }]
          }
        ]
      }
    }, "qs1"),
    /duplicate answered question labels/
  );
});

test("question widget only continues after validated submit success", () => {
  const html = createQuestionWidgetHtml();

  assert.ok(html.indexOf("validateSubmitAnswersResult(result, currentData.questionSetId)") < html.indexOf("notifyModelAfterSubmit(summary)"));
  assert.ok(html.indexOf("validateSubmitAnswersResult(result, currentData.questionSetId)") < html.indexOf('submitStatus: "submitted"'));
  assert.ok(html.indexOf("catch (error)") < html.indexOf("showSubmitFailure"));
  assert.doesNotMatch(html, /result\.questionSetId !== currentData\.questionSetId/);
  assert.doesNotMatch(html, /structuredContent\.answers \|\| answers/);
  assert.doesNotMatch(html, /formatSubmittedAnswers\(structuredContent, storedAnswers\)/);
});
