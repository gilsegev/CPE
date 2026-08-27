const RATING_FIELDS = [
  "knowledgeBefore",
  "knowledgeAfter",
  "relevance",
  "instructionalEffectiveness",
];

const TECHNICAL_ISSUE_CATEGORIES = [
  "video",
  "quiz",
  "navigation",
  "certificate",
  "other",
];

const TEXT_LIMITS = {
  plannedApplication: 2000,
  mostHelpful: 2000,
  improvement: 2000,
  technicalIssueDetail: 1000,
};

function isRating(value) {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

function normalizeOptionalText(value, limit, field, errors) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") {
    errors[field] = "Must be text.";
    return null;
  }
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > limit) {
    errors[field] = `Must be ${limit.toLocaleString("en-US")} characters or fewer.`;
  }
  return normalized;
}

function validateFeedbackPayload(payload) {
  const errors = {};
  const source = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};

  for (const field of RATING_FIELDS) {
    if (!isRating(source[field])) errors[field] = "Select a rating from 1 to 5.";
  }

  const intentNotApplicable = source.intentNotApplicable === true;
  const intentToApply = intentNotApplicable ? null : source.intentToApply;
  if (intentNotApplicable && source.intentToApply != null) {
    errors.intentToApply = "Choose either a rating or Not applicable, not both.";
  }
  if (!intentNotApplicable && !isRating(intentToApply)) {
    errors.intentToApply = "Select a rating from 1 to 5 or Not applicable.";
  }
  if (source.intentNotApplicable != null && typeof source.intentNotApplicable !== "boolean") {
    errors.intentNotApplicable = "Must be true or false.";
  }

  const technicalIssues = Array.isArray(source.technicalIssues)
    ? Array.from(new Set(source.technicalIssues))
    : [];
  if (!Array.isArray(source.technicalIssues)) {
    errors.technicalIssues = "Must be a list.";
  } else if (technicalIssues.some((category) => !TECHNICAL_ISSUE_CATEGORIES.includes(category))) {
    errors.technicalIssues = "Contains an unsupported technical issue category.";
  }

  const text = {};
  for (const [field, limit] of Object.entries(TEXT_LIMITS)) {
    text[field] = normalizeOptionalText(source[field], limit, field, errors);
  }
  if (technicalIssues.includes("other") && !text.technicalIssueDetail) {
    errors.technicalIssueDetail = "Describe the other technical issue.";
  }
  if (technicalIssues.length === 0 && text.technicalIssueDetail) {
    errors.technicalIssueDetail = "Select a technical issue category before adding details.";
  }

  if (Object.keys(errors).length > 0) return { success: false, errors };

  return {
    success: true,
    data: {
      knowledgeBefore: source.knowledgeBefore,
      knowledgeAfter: source.knowledgeAfter,
      relevance: source.relevance,
      instructionalEffectiveness: source.instructionalEffectiveness,
      intentToApply,
      intentNotApplicable,
      plannedApplication: text.plannedApplication,
      mostHelpful: text.mostHelpful,
      improvement: text.improvement,
      technicalIssues,
      technicalIssueDetail: text.technicalIssueDetail,
    },
  };
}

function emptyDistribution() {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
}

function average(values) {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

function buildFeedbackReport(completions, responses, filters = {}) {
  const fromTime = filters.from ? new Date(`${filters.from}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
  const toTime = filters.to ? new Date(`${filters.to}T23:59:59.999`).getTime() : Number.POSITIVE_INFINITY;
  const selectedCompletions = completions.filter((completion) => {
    const completedAt = new Date(completion.completedAt).getTime();
    return completedAt >= fromTime && completedAt <= toTime && (!filters.courseId || completion.courseId === filters.courseId);
  });
  const completionIds = new Set(selectedCompletions.map((completion) => completion.id));
  const completionById = new Map(selectedCompletions.map((completion) => [completion.id, completion]));
  const selectedResponses = responses.filter((response) => completionIds.has(response.completionId));

  const distributions = {
    relevance: emptyDistribution(),
    instructionalEffectiveness: emptyDistribution(),
    intentToApply: emptyDistribution(),
  };
  const technicalIssues = Object.fromEntries(TECHNICAL_ISSUE_CATEGORIES.map((category) => [category, 0]));
  for (const response of selectedResponses) {
    distributions.relevance[response.relevance] += 1;
    distributions.instructionalEffectiveness[response.instructionalEffectiveness] += 1;
    if (!response.intentNotApplicable && isRating(response.intentToApply)) {
      distributions.intentToApply[response.intentToApply] += 1;
    }
    for (const category of response.technicalIssues || []) {
      if (Object.prototype.hasOwnProperty.call(technicalIssues, category)) technicalIssues[category] += 1;
    }
  }

  const knowledgeBefore = selectedResponses.map((response) => response.knowledgeBefore);
  const knowledgeAfter = selectedResponses.map((response) => response.knowledgeAfter);
  const intentRatings = selectedResponses
    .filter((response) => !response.intentNotApplicable && isRating(response.intentToApply))
    .map((response) => response.intentToApply);

  return {
    completionCount: selectedCompletions.length,
    responseCount: selectedResponses.length,
    responseRate: selectedCompletions.length === 0
      ? 0
      : Math.round((selectedResponses.length / selectedCompletions.length) * 1000) / 10,
    averages: {
      knowledgeBefore: average(knowledgeBefore),
      knowledgeAfter: average(knowledgeAfter),
      knowledgeChange: average(selectedResponses.map((response) => response.knowledgeAfter - response.knowledgeBefore)),
      intentToApply: average(intentRatings),
    },
    distributions,
    intentNotApplicableCount: selectedResponses.filter((response) => response.intentNotApplicable).length,
    technicalIssues,
    rows: selectedResponses
      .map((response) => ({ ...response, completedAt: completionById.get(response.completionId)?.completedAt || null }))
      .sort((left, right) => new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime()),
  };
}

module.exports = {
  TECHNICAL_ISSUE_CATEGORIES,
  TEXT_LIMITS,
  validateFeedbackPayload,
  buildFeedbackReport,
};
