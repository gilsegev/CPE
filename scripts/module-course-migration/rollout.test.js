const test = require("node:test");
const assert = require("node:assert/strict");
const { buildRolloutReport } = require("./rollout");

function inventory(overrides = {}) {
  return {
    courses: [{ id: "course", title: "Course", structure_version: "module_quiz_v2", is_published: true }],
    modules: [{ id: "module", course_id: "course", type: "video", order_index: 1, cpe_value: 2, migration_status: "v2_content" }],
    quizzes: [{ id: "quiz", module_id: "module", is_enabled: true, passing_score: 80 }],
    questions: [{ id: "question", quiz_id: "quiz", order_index: 1 }],
    courseCompletions: [{
      id: "completion",
      course_id: "course",
      cpe_earned: 2,
      module_snapshot: [{ module_id: "module", cpe_value: 2 }],
    }],
    certificates: [{ id: "certificate", completion_id: "completion", status: "delivered", cpe_earned: 2 }],
    ...overrides,
  };
}

test("cleanup becomes ready only when every course is v2 and reconciliation is clean", () => {
  const report = buildRolloutReport(inventory(), new Date("2026-08-27T00:00:00.000Z"));
  assert.equal(report.courseValidation[0].status, "valid");
  assert.equal(report.reconciliation.status, "clean");
  assert.equal(report.cleanupReadiness.ready, true);
});

test("cleanup remains blocked by legacy courses, invalid v2 structure, and missing certificate work", () => {
  const report = buildRolloutReport(inventory({
    courses: [
      { id: "course", title: "Course", structure_version: "module_quiz_v2", is_published: true },
      { id: "legacy", title: "Legacy", structure_version: "legacy", is_published: false },
    ],
    quizzes: [],
    questions: [],
    certificates: [],
  }));
  assert.equal(report.cleanupReadiness.ready, false);
  assert(report.cleanupReadiness.blockers.some((blocker) => blocker.includes("legacy behavior")));
  assert(report.cleanupReadiness.blockers.some((blocker) => blocker.includes("activation invariants")));
  assert(report.cleanupReadiness.blockers.some((blocker) => blocker.includes("reconciliation")));
});

test("stale processing certificates prevent a clean reconciliation", () => {
  const report = buildRolloutReport(inventory({
    certificates: [{
      id: "certificate",
      completion_id: "completion",
      status: "processing",
      cpe_earned: 2,
      last_attempt_at: "2026-08-26T20:00:00.000Z",
    }],
  }), new Date("2026-08-27T00:00:00.000Z"));
  assert.equal(report.reconciliation.status, "attention_required");
  assert(report.reconciliation.issues.some((issue) => issue.includes("stuck in processing")));
});
