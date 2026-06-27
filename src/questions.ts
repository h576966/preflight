import type {
  Question,
  QuestionAnswer,
  QuestionMode,
  QuestionOption,
  ShowQuestionsInput,
  ShowQuestionsResult,
  SubmitAnswersInput,
  SubmitAnswersResult
} from "./types.js";

type StoredQuestionSet = {
  questions: Question[];
  signature: string;
  answers: Map<string, string[]>;
};

export class QuestionStore {
  private readonly questionSets = new Map<string, StoredQuestionSet>();

  showQuestions(input: ShowQuestionsInput): ShowQuestionsResult {
    const questionSetId = requireNonEmptyString(input.questionSetId, "questionSetId");
    const questions = normalizeQuestions(input.questions);
    const signature = JSON.stringify(questions);
    const existing = this.questionSets.get(questionSetId);

    if (existing) {
      if (existing.signature !== signature) {
        throw new Error(`Question set already exists with different questions: ${questionSetId}`);
      }
      return {
        questionSetId,
        rendered: true,
        questions: copyQuestions(existing.questions)
      };
    }

    this.questionSets.set(questionSetId, {
      questions,
      signature,
      answers: new Map()
    });

    return {
      questionSetId,
      rendered: true,
      questions: copyQuestions(questions)
    };
  }

  submitAnswers(input: SubmitAnswersInput): SubmitAnswersResult {
    const questionSetId = requireNonEmptyString(input.questionSetId, "questionSetId");
    const questionSet = this.questionSets.get(questionSetId);
    if (!questionSet) {
      throw new Error(`Unknown question set: ${questionSetId}`);
    }

    if (!Array.isArray(input.answers) || input.answers.length === 0) {
      throw new Error("answers must contain at least one answer");
    }

    const submittedQuestionIds = new Set<string>();
    const questionById = new Map(questionSet.questions.map((question) => [question.id, question]));
    const pendingAnswers = new Map<string, string[]>();

    for (const answer of input.answers) {
      const questionId = requireNonEmptyString(answer.questionId, "questionId");
      if (submittedQuestionIds.has(questionId)) {
        throw new Error(`Duplicate submitted question id: ${questionId}`);
      }
      submittedQuestionIds.add(questionId);

      const question = questionById.get(questionId);
      if (!question) {
        throw new Error(`Unknown question id: ${questionId}`);
      }

      pendingAnswers.set(questionId, normalizeAnswerOptionIds(question, answer.optionIds));
    }

    for (const [questionId, optionIds] of pendingAnswers) {
      questionSet.answers.set(questionId, optionIds);
    }

    return {
      questionSetId,
      answers: orderedAnswers(questionSet)
    };
  }
}

export function formatQuestionSetForText(result: ShowQuestionsResult): string {
  const lines = [`Question set ${result.questionSetId}`];

  result.questions.forEach((question, questionIndex) => {
    lines.push(`${questionIndex + 1}. ${question.question}`);

    for (const option of question.options) {
      const recommended = option.id === question.recommendedOptionId ? " (recommended)" : "";
      const description = option.description ? ` - ${option.description}` : "";
      lines.push(`   - ${option.id}: ${option.label}${recommended}${description}`);
    }
  });

  return lines.join("\n");
}

function normalizeQuestions(questions: ShowQuestionsInput["questions"]): Question[] {
  if (!Array.isArray(questions) || questions.length < 1 || questions.length > 10) {
    throw new Error("questions must contain between 1 and 10 questions");
  }

  const questionIds = new Set<string>();

  return questions.map((question) => {
    const id = requireNonEmptyString(question.id, "question id");
    if (questionIds.has(id)) {
      throw new Error(`Duplicate question id: ${id}`);
    }
    questionIds.add(id);

    const normalizedOptions = normalizeOptions(question.options, id);
    const recommendedOptionId = normalizeRecommendedOptionId(question.recommendedOptionId);
    if (recommendedOptionId !== null && !normalizedOptions.some((option) => option.id === recommendedOptionId)) {
      throw new Error(`recommendedOptionId does not match an option for question: ${id}`);
    }

    return {
      id,
      question: requireNonEmptyString(question.question, "question text"),
      mode: normalizeMode(question.mode),
      options: normalizedOptions,
      recommendedOptionId
    };
  });
}

function normalizeOptions(options: QuestionOption[], questionId: string): QuestionOption[] {
  if (!Array.isArray(options) || options.length < 2 || options.length > 5) {
    throw new Error(`Question ${questionId} must contain between 2 and 5 options`);
  }

  const optionIds = new Set<string>();

  return options.map((option) => {
    const id = requireNonEmptyString(option.id, "option id");
    if (optionIds.has(id)) {
      throw new Error(`Duplicate option id for question ${questionId}: ${id}`);
    }
    optionIds.add(id);

    return {
      id,
      label: requireNonEmptyString(option.label, "option label"),
      description: normalizeDescription(option.description)
    };
  });
}

function normalizeMode(mode: QuestionMode): QuestionMode {
  if (mode !== "single" && mode !== "multi") {
    throw new Error("question mode must be single or multi");
  }
  return mode;
}

function normalizeRecommendedOptionId(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return requireNonEmptyString(value, "recommendedOptionId");
}

function normalizeAnswerOptionIds(question: Question, optionIds: string[]): string[] {
  if (!Array.isArray(optionIds)) {
    throw new Error(`optionIds must be an array for question: ${question.id}`);
  }
  if (question.mode === "single" && optionIds.length !== 1) {
    throw new Error(`Single-choice question requires exactly one option: ${question.id}`);
  }
  if (question.mode === "multi" && optionIds.length < 1) {
    throw new Error(`Multi-choice question requires at least one option: ${question.id}`);
  }

  const validOptionIds = new Set(question.options.map((option) => option.id));
  const seenOptionIds = new Set<string>();

  return optionIds.map((optionId) => {
    const normalizedOptionId = requireNonEmptyString(optionId, "optionId");
    if (seenOptionIds.has(normalizedOptionId)) {
      throw new Error(`Duplicate submitted option id for question ${question.id}: ${normalizedOptionId}`);
    }
    if (!validOptionIds.has(normalizedOptionId)) {
      throw new Error(`Unknown option id for question ${question.id}: ${normalizedOptionId}`);
    }
    seenOptionIds.add(normalizedOptionId);
    return normalizedOptionId;
  });
}

function orderedAnswers(questionSet: StoredQuestionSet): QuestionAnswer[] {
  return questionSet.questions.flatMap((question) => {
    const optionIds = questionSet.answers.get(question.id);
    return optionIds ? [{ questionId: question.id, optionIds: [...optionIds] }] : [];
  });
}

function copyQuestions(questions: Question[]): Question[] {
  return questions.map((question) => ({
    ...question,
    options: question.options.map((option) => ({ ...option }))
  }));
}

function requireNonEmptyString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value.trim();
}

function normalizeDescription(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("option description must be a string");
  }
  return value.trim();
}
