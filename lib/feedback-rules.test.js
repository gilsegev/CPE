const test = require("node:test");
const assert = require("node:assert/strict");
const { buildFeedbackReport, validateFeedbackPayload } = require("./feedback-rules");

const validPayload = {
  knowledgeBefore: 2,
  knowledgeAfter: 4,
  relevance: 5,
  instructionalEffectiveness: 4,
  intentToApply: 5,
  intentNotApplicable: false,
  plannedApplication: "  Use a new classroom routine.  ",
  mostHelpful: "Examples",
  improvement: "More practice",
  technicalIssues: [],
  technicalIssueDetail: "",
};

test("feedback validation normalizes valid answers and optional text", () => {
  const result = validateFeedbackPayload(validPayload);
  assert.equal(result.success, true);
  assert.equal(result.data.plannedApplication, "Use a new classroom routine.");
  assert.equal(result.data.technicalIssueDetail, null);
});

test("feedback validation rejects missing, out-of-range, and contradictory answers", () => {
  const result = validateFeedbackPayload({
    ...validPayload,
    knowledgeBefore: 0,
    intentToApply: null,
    technicalIssues: ["other", "unsupported"],
  });
  assert.equal(result.success, false);
  assert.match(result.errors.knowledgeBefore, /1 to 5/);
  assert.match(result.errors.intentToApply, /Not applicable/);
  assert.match(result.errors.technicalIssues, /unsupported/);
  assert.match(result.errors.technicalIssueDetail, /Describe/);
});

test("feedback validation rejects an intent rating combined with Not applicable", () => {
  const result = validateFeedbackPayload({
    ...validPayload,
    intentToApply: 4,
    intentNotApplicable: true,
  });
  assert.equal(result.success, false);
  assert.match(result.errors.intentToApply, /either a rating or Not applicable/);
});

test("feedback report uses completion date membership for response rate and excludes N/A intent", () => {
  const completions = [
    { id: "inside-with-response", courseId: "course-a", completedAt: "2026-08-10T12:00:00Z" },
    { id: "inside-without-response", courseId: "course-a", completedAt: "2026-08-11T12:00:00Z" },
    { id: "outside", courseId: "course-a", completedAt: "2026-07-01T12:00:00Z" },
  ];
  const responses = [
    { id: "r1", completionId: "inside-with-response", submittedAt: "2026-09-01T12:00:00Z", knowledgeBefore: 2, knowledgeAfter: 5, relevance: 5, instructionalEffectiveness: 4, intentToApply: null, intentNotApplicable: true, technicalIssues: ["video"] },
    { id: "r2", completionId: "outside", submittedAt: "2026-08-10T12:00:00Z", knowledgeBefore: 1, knowledgeAfter: 2, relevance: 2, instructionalEffectiveness: 2, intentToApply: 2, intentNotApplicable: false, technicalIssues: [] },
  ];
  const report = buildFeedbackReport(completions, responses, { courseId: "course-a", from: "2026-08-01", to: "2026-08-31" });
  assert.equal(report.completionCount, 2);
  assert.equal(report.responseCount, 1);
  assert.equal(report.responseRate, 50);
  assert.equal(report.averages.knowledgeChange, 3);
  assert.equal(report.averages.intentToApply, null);
  assert.equal(report.intentNotApplicableCount, 1);
  assert.equal(report.technicalIssues.video, 1);
});
