export const TECHNICAL_ISSUE_CATEGORIES: readonly ["video", "quiz", "navigation", "certificate", "other"];
export const TEXT_LIMITS: Readonly<Record<string, number>>;

export type FeedbackPayload = {
  knowledgeBefore: number;
  knowledgeAfter: number;
  relevance: number;
  instructionalEffectiveness: number;
  intentToApply: number | null;
  intentNotApplicable: boolean;
  plannedApplication: string | null;
  mostHelpful: string | null;
  improvement: string | null;
  technicalIssues: string[];
  technicalIssueDetail: string | null;
};

export type FeedbackValidationResult =
  | { success: true; data: FeedbackPayload }
  | { success: false; errors: Record<string, string> };

export function validateFeedbackPayload(payload: unknown): FeedbackValidationResult;

export type FeedbackCompletionReportRow = {
  id: string;
  courseId: string;
  completedAt: string;
};

export type FeedbackReportResponse = FeedbackPayload & {
  id: string;
  completionId: string;
  submittedAt: string;
  [key: string]: unknown;
};

export function buildFeedbackReport(
  completions: FeedbackCompletionReportRow[],
  responses: FeedbackReportResponse[],
  filters?: { courseId?: string; from?: string; to?: string },
): {
  completionCount: number;
  responseCount: number;
  responseRate: number;
  averages: { knowledgeBefore: number | null; knowledgeAfter: number | null; knowledgeChange: number | null; intentToApply: number | null };
  distributions: Record<"relevance" | "instructionalEffectiveness" | "intentToApply", Record<1 | 2 | 3 | 4 | 5, number>>;
  intentNotApplicableCount: number;
  technicalIssues: Record<string, number>;
  rows: Array<FeedbackReportResponse & { completedAt: string | null }>;
};
