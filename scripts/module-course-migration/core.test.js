const test = require("node:test");
const assert = require("node:assert/strict");
const { generateManifest, validateManifest } = require("./core");

function inventory(overrides = {}) {
  return {
    courses: [{ id: "course", title: "Course", cpe_hours: 1, is_published: true, structure_version: "legacy" }],
    modules: [
      { id: "content", course_id: "course", title: "Content", order_index: 1, type: "video" },
      { id: "quiz-module", course_id: "course", title: "Quiz", order_index: 2, type: "quiz" },
      { id: "essay", course_id: "course", title: "Essay", order_index: 3, type: "essay" },
    ],
    quizzes: [{ id: "quiz", module_id: "quiz-module", passing_score: 80 }],
    questions: [{ id: "question", quiz_id: "quiz", order_index: 1 }],
    userProgress: [],
    quizProgress: [],
    submissions: [],
    certificates: [],
    ...overrides,
  };
}

test("dry-run manifest suggests the immediately preceding content module but does not approve it", () => {
  const manifest = generateManifest(inventory(), "2026-08-26T00:00:00.000Z");
  const course = manifest.courses[0];
  assert.equal(course.quizMappings[0].suggestedContentModuleId, "content");
  assert.equal(course.quizMappings[0].approvedContentModuleId, null);
  assert.equal(course.contentModules[0].cpeValue, null);
  assert.equal(course.action, "defer");
  assert(course.blockers.includes("module_cpe_allocation_unapproved"));
  assert(course.blockers.includes("quiz_mapping_unapproved"));
});

test("validation accepts a fully approved, reconciled course", () => {
  const live = inventory();
  const manifest = generateManifest(live);
  const course = manifest.courses[0];
  course.action = "migrate";
  course.approval = { approved: true, approvedBy: "Course owner", approvedAt: "2026-08-26T00:00:00.000Z" };
  course.contentModules[0].cpeValue = 1;
  course.quizMappings[0].approvedContentModuleId = "content";
  assert.deepEqual(validateManifest(manifest, live), []);
});

test("validation rejects missing CPE approval and final quiz ownership", () => {
  const live = inventory();
  const manifest = generateManifest(live);
  const course = manifest.courses[0];
  course.action = "migrate";
  course.approval = { approved: true, approvedBy: "Course owner", approvedAt: "2026-08-26T00:00:00.000Z" };
  const errors = validateManifest(manifest, live);
  assert(errors.some((error) => error.includes("non-negative integer CPE")));
  assert(errors.some((error) => error.includes("final content module")));
});

test("validation requires an explicit canonical certificate when legacy duplicates exist", () => {
  const live = inventory({
    certificates: [
      { id: "certificate-1", user_id: "user", course_id: "course" },
      { id: "certificate-2", user_id: "user", course_id: "course" },
    ],
  });
  const manifest = generateManifest(live);
  const course = manifest.courses[0];
  course.action = "migrate";
  course.approval = { approved: true, approvedBy: "Course owner", approvedAt: "2026-08-26T00:00:00.000Z" };
  course.contentModules[0].cpeValue = 1;
  course.quizMappings[0].approvedContentModuleId = "content";
  const errors = validateManifest(manifest, live);
  assert(errors.some((error) => error.includes("canonical legacy certificate")));
});
