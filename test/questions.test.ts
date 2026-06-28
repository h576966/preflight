import assert from "node:assert/strict";
import test from "node:test";
import { QuestionStore } from "../src/questions.js";
import type { ShowQuestionsInput } from "../src/types.js";

function sampleQuestions(): ShowQuestionsInput["questions"] {
  return [
    {
      id: "scope",
      question: "What should this change optimize for?",
      mode: "single",
      options: [
        { id: "simple", label: "Keep it simple", description: "Prefer the smallest useful change." },
        { id: "complete", label: "Make it complete", description: "Cover more edge cases now." }
      ],
      recommendedOptionId: "simple"
    },
    {
      id: "focus",
      question: "Which areas matter?",
      mode: "multi",
      options: [
        { id: "tests", label: "Tests", description: "Prioritize coverage." },
        { id: "docs", label: "Docs", description: "Prioritize documentation." },
        { id: "api", label: "API", description: "Prioritize contracts." }
      ]
    }
  ];
}

function storeWithQuestions(): QuestionStore {
  const store = new QuestionStore();
  store.showQuestions({ questionSetId: "qs1", questions: sampleQuestions() });
  return store;
}

test("QuestionStore stores and returns a valid question set", () => {
  const store = new QuestionStore();

  const result = store.showQuestions({ questionSetId: "qs1", questions: sampleQuestions() });

  assert.equal(result.questionSetId, "qs1");
  assert.equal(result.rendered, true);
  assert.equal(result.questions.length, 2);
  assert.equal(result.questions[1]?.recommendedOptionId, null);
});

test("QuestionStore allows identical question set replay", () => {
  const store = new QuestionStore();
  const input = { questionSetId: "qs1", questions: sampleQuestions() };

  const first = store.showQuestions(input);
  const second = store.showQuestions(input);

  assert.deepEqual(second, first);
});

test("QuestionStore rejects reused questionSetId with changed questions", () => {
  const store = storeWithQuestions();
  const changed = sampleQuestions();
  changed[0] = { ...changed[0]!, question: "Changed?" };

  assert.throws(
    () => store.showQuestions({ questionSetId: "qs1", questions: changed }),
    /already exists with different questions/
  );
});

test("QuestionStore rejects duplicate question and option IDs", () => {
  const duplicateQuestions = sampleQuestions();
  duplicateQuestions[1] = { ...duplicateQuestions[1]!, id: "scope" };

  assert.throws(
    () => new QuestionStore().showQuestions({ questionSetId: "qs1", questions: duplicateQuestions }),
    /Duplicate question id/
  );

  const duplicateOptions = sampleQuestions();
  duplicateOptions[0] = {
    ...duplicateOptions[0]!,
    options: [
      { id: "same", label: "A", description: "" },
      { id: "same", label: "B", description: "" }
    ]
  };

  assert.throws(
    () => new QuestionStore().showQuestions({ questionSetId: "qs1", questions: duplicateOptions }),
    /Duplicate option id/
  );
});

test("QuestionStore rejects empty IDs, question text, and labels", () => {
  const emptySetId = { questionSetId: " ", questions: sampleQuestions() };
  assert.throws(() => new QuestionStore().showQuestions(emptySetId), /questionSetId/);

  const emptyQuestionId = sampleQuestions();
  emptyQuestionId[0] = { ...emptyQuestionId[0]!, id: " " };
  assert.throws(
    () => new QuestionStore().showQuestions({ questionSetId: "qs1", questions: emptyQuestionId }),
    /question id/
  );

  const emptyQuestionText = sampleQuestions();
  emptyQuestionText[0] = { ...emptyQuestionText[0]!, question: " " };
  assert.throws(
    () => new QuestionStore().showQuestions({ questionSetId: "qs1", questions: emptyQuestionText }),
    /question text/
  );

  const emptyLabel = sampleQuestions();
  emptyLabel[0] = {
    ...emptyLabel[0]!,
    options: [
      { id: "a", label: " ", description: "" },
      { id: "b", label: "B", description: "" }
    ]
  };
  assert.throws(
    () => new QuestionStore().showQuestions({ questionSetId: "qs1", questions: emptyLabel }),
    /option label/
  );
});

test("QuestionStore rejects non-string option descriptions", () => {
  const questions = sampleQuestions();
  questions[0] = {
    ...questions[0]!,
    options: [
      { id: "a", label: "A", description: "" },
      { id: "b", label: "B", description: undefined as unknown as string }
    ]
  };

  assert.throws(
    () => new QuestionStore().showQuestions({ questionSetId: "qs1", questions }),
    /option description/
  );
});

test("QuestionStore rejects invalid question set sizes", () => {
  assert.throws(
    () => new QuestionStore().showQuestions({ questionSetId: "qs1", questions: [] }),
    /between 1 and 10 questions/
  );

  assert.throws(
    () => new QuestionStore().showQuestions({
      questionSetId: "qs1",
      questions: Array.from({ length: 11 }, (_, index) => ({
        ...sampleQuestions()[0]!,
        id: `q${index}`
      }))
    }),
    /between 1 and 10 questions/
  );
});

test("QuestionStore rejects invalid recommended options", () => {
  const questions = sampleQuestions();
  questions[0] = { ...questions[0]!, recommendedOptionId: "missing" };

  assert.throws(
    () => new QuestionStore().showQuestions({ questionSetId: "qs1", questions }),
    /recommendedOptionId/
  );
});

test("QuestionStore rejects invalid option counts", () => {
  const tooFew = sampleQuestions();
  tooFew[0] = {
    ...tooFew[0]!,
    options: [{ id: "only", label: "Only", description: "" }]
  };

  assert.throws(
    () => new QuestionStore().showQuestions({ questionSetId: "qs1", questions: tooFew }),
    /between 2 and 5 options/
  );

  const tooMany = sampleQuestions();
  tooMany[0] = {
    ...tooMany[0]!,
    options: [
      { id: "a", label: "A", description: "" },
      { id: "b", label: "B", description: "" },
      { id: "c", label: "C", description: "" },
      { id: "d", label: "D", description: "" },
      { id: "e", label: "E", description: "" },
      { id: "f", label: "F", description: "" }
    ]
  };

  assert.throws(
    () => new QuestionStore().showQuestions({ questionSetId: "qs1", questions: tooMany }),
    /between 2 and 5 options/
  );
});

test("QuestionStore stores a valid single answer", () => {
  const store = storeWithQuestions();

  const result = store.submitAnswers({
    questionSetId: "qs1",
    answers: [{ questionId: "scope", optionIds: ["simple"] }]
  });

  assert.deepEqual(result.answers, [{ questionId: "scope", optionIds: ["simple"] }]);
  assert.deepEqual(result.answeredQuestions, [{
    questionId: "scope",
    question: "What should this change optimize for?",
    optionIds: ["simple"],
    selectedOptions: [
      { id: "simple", label: "Keep it simple", description: "Prefer the smallest useful change." }
    ]
  }]);
});

test("QuestionStore rejects multiple options for single-choice answers", () => {
  const store = storeWithQuestions();

  assert.throws(
    () => store.submitAnswers({
      questionSetId: "qs1",
      answers: [{ questionId: "scope", optionIds: ["simple", "complete"] }]
    }),
    /exactly one option/
  );
});

test("QuestionStore stores a valid multi answer", () => {
  const store = storeWithQuestions();

  const result = store.submitAnswers({
    questionSetId: "qs1",
    answers: [{ questionId: "focus", optionIds: ["tests", "docs"] }]
  });

  assert.deepEqual(result.answers, [{ questionId: "focus", optionIds: ["tests", "docs"] }]);
});

test("QuestionStore rejects empty multi-choice answers", () => {
  const store = storeWithQuestions();

  assert.throws(
    () => store.submitAnswers({
      questionSetId: "qs1",
      answers: [{ questionId: "focus", optionIds: [] }]
    }),
    /at least one option/
  );
});

test("QuestionStore rejects unknown question sets, questions, and options", () => {
  assert.throws(
    () => new QuestionStore().submitAnswers({
      questionSetId: "missing",
      answers: [{ questionId: "scope", optionIds: ["simple"] }]
    }),
    /Unknown question set/
  );

  const store = storeWithQuestions();

  assert.throws(
    () => store.submitAnswers({
      questionSetId: "qs1",
      answers: [{ questionId: "missing", optionIds: ["simple"] }]
    }),
    /Unknown question id/
  );

  assert.throws(
    () => store.submitAnswers({
      questionSetId: "qs1",
      answers: [{ questionId: "scope", optionIds: ["missing"] }]
    }),
    /Unknown option id/
  );
});

test("QuestionStore rejects duplicate submitted question and option IDs", () => {
  const store = storeWithQuestions();

  assert.throws(
    () => store.submitAnswers({
      questionSetId: "qs1",
      answers: [
        { questionId: "scope", optionIds: ["simple"] },
        { questionId: "scope", optionIds: ["complete"] }
      ]
    }),
    /Duplicate submitted question id/
  );

  assert.throws(
    () => store.submitAnswers({
      questionSetId: "qs1",
      answers: [{ questionId: "focus", optionIds: ["tests", "tests"] }]
    }),
    /Duplicate submitted option id/
  );
});

test("QuestionStore replaces repeated answers", () => {
  const store = storeWithQuestions();

  store.submitAnswers({
    questionSetId: "qs1",
    answers: [{ questionId: "scope", optionIds: ["simple"] }]
  });

  const result = store.submitAnswers({
    questionSetId: "qs1",
    answers: [{ questionId: "scope", optionIds: ["complete"] }]
  });

  assert.deepEqual(result.answers, [{ questionId: "scope", optionIds: ["complete"] }]);
});

test("QuestionStore does not partially store invalid answer batches", () => {
  const store = storeWithQuestions();

  store.submitAnswers({
    questionSetId: "qs1",
    answers: [{ questionId: "scope", optionIds: ["simple"] }]
  });

  assert.throws(
    () => store.submitAnswers({
      questionSetId: "qs1",
      answers: [
        { questionId: "focus", optionIds: ["api"] },
        { questionId: "scope", optionIds: ["simple", "complete"] }
      ]
    }),
    /exactly one option/
  );

  const result = store.submitAnswers({
    questionSetId: "qs1",
    answers: [{ questionId: "scope", optionIds: ["complete"] }]
  });

  assert.deepEqual(result.answers, [{ questionId: "scope", optionIds: ["complete"] }]);
});

test("QuestionStore allows partial answers and returns stored answers in question order", () => {
  const store = storeWithQuestions();

  const partial = store.submitAnswers({
    questionSetId: "qs1",
    answers: [{ questionId: "focus", optionIds: ["api"] }]
  });

  assert.deepEqual(partial.answers, [{ questionId: "focus", optionIds: ["api"] }]);

  const complete = store.submitAnswers({
    questionSetId: "qs1",
    answers: [{ questionId: "scope", optionIds: ["simple"] }]
  });

  assert.deepEqual(complete.answers, [
    { questionId: "scope", optionIds: ["simple"] },
    { questionId: "focus", optionIds: ["api"] }
  ]);
});
