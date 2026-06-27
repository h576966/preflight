export type ChangedFile = {
  path: string;
  status: string;
  staged: boolean;
  unstaged: boolean;
  untracked: boolean;
};

export type ContextFile = {
  path: string;
  kind: "instruction" | "manifest" | "config";
  content: string;
  truncated: boolean;
};

export type ProjectSnapshot = {
  root: string;
  name: string;
  git: {
    remoteUrl: string | null;
    ownerRepo: string | null;
    branch: string;
    head: string | null;
    upstream: string | null;
  };
  changedFiles: ChangedFile[];
  instructionFiles: string[];
  contextFiles: ContextFile[];
  stackHints: string[];
  limits: {
    maxDiffBytes: number;
    maxReadBytes: number;
    maxSnapshotFileBytes: number;
    maxSnapshotContentBytes: number;
  };
};

export type LocalDiffScope = "staged" | "unstaged" | "all";

export type LocalDiffFile = {
  path: string;
  changeType: "added" | "modified" | "deleted" | "renamed";
  additions: number;
  deletions: number;
  patch: string;
};

export type OmittedDiffFile = {
  path: string;
  reason: "secret-blocked" | "ignored" | "binary-or-unreadable" | "byte-budget";
};

export type LocalDiff = {
  truncated: boolean;
  files: LocalDiffFile[];
  omittedFiles: OmittedDiffFile[];
};

export type ReadLocalRequestFile = {
  path: string;
  startLine?: number;
  endLine?: number;
};

export type ReadLocalFile = {
  path: string;
  startLine: number;
  endLine: number;
  content: string;
  truncated: boolean;
};

export type OmittedReadLocalFile = {
  path: string;
  reason: "ignored" | "not-allowed" | "not-found" | "binary-or-unreadable" | "byte-budget";
};

export type ReadLocal = {
  files: ReadLocalFile[];
  omittedFiles: OmittedReadLocalFile[];
  truncated: boolean;
};

export type QuestionMode = "single" | "multi";

export type QuestionOption = {
  id: string;
  label: string;
  description: string;
};

export type Question = {
  id: string;
  question: string;
  mode: QuestionMode;
  options: QuestionOption[];
  recommendedOptionId: string | null;
};

export type QuestionAnswer = {
  questionId: string;
  optionIds: string[];
};

export type ShowQuestionsInput = {
  questionSetId: string;
  questions: Array<Omit<Question, "recommendedOptionId"> & { recommendedOptionId?: string | null }>;
};

export type ShowQuestionsResult = {
  questionSetId: string;
  rendered: true;
  questions: Question[];
};

export type SubmitAnswersInput = {
  questionSetId: string;
  answers: QuestionAnswer[];
};

export type SubmitAnswersResult = {
  questionSetId: string;
  answers: QuestionAnswer[];
};
