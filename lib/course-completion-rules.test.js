const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildModuleSnapshot,
  calculateCpeTotal,
  createOrReadUnique,
  isModuleComplete,
  isV2ContentModule,
} = require("./course-completion-rules");

test("CPE is the whole-number sum of active content modules", () => {
  const modules = [
    { cpe_value: 1 },
    { cpe_value: 0 },
    { cpe_value: 2 },
  ];
  assert.equal(calculateCpeTotal(modules), 3);
  assert.throws(() => calculateCpeTotal([{ cpe_value: 1.5 }]), /whole-number/);
  assert.throws(() => calculateCpeTotal([{ cpe_value: -1 }]), /whole-number/);
});

test("a uniqueness race converges on the record created by the winning request", async () => {
  const winner = { id: "completion-1" };
  const result = await createOrReadUnique(
    async () => { throw new Error("duplicate key value violates unique constraint"); },
    async () => winner,
    (error) => /duplicate key/.test(error.message),
  );
  assert.deepEqual(result, { value: winner, created: false });

  await assert.rejects(
    () => createOrReadUnique(
      async () => { throw new Error("database unavailable"); },
      async () => winner,
      (error) => /duplicate key/.test(error.message),
    ),
    /database unavailable/,
  );
});

test("module completion requires a passing quiz only when an enabled quiz exists", () => {
  const contentOnly = { content_completed_at: "2026-08-26T20:00:00.000Z" };
  assert.equal(isModuleComplete(contentOnly, false), true);
  assert.equal(isModuleComplete(contentOnly, true), false);
  assert.equal(isModuleComplete({ ...contentOnly, quiz_passed_at: "2026-08-26T20:05:00.000Z" }, true), true);
});

test("legacy assessment shells are excluded from v2 course ordering", () => {
  assert.equal(isV2ContentModule({ migration_status: "v2_content", type: "video" }), true);
  assert.equal(isV2ContentModule({ migration_status: "migrated_quiz_shell", type: "quiz" }), false);
  assert.equal(isV2ContentModule({ migration_status: "legacy_essay_history", type: "essay" }), false);
});

test("completion snapshot is ordered and refuses incomplete evidence", () => {
  const modules = [
    { id: "m1", title: "One", order_index: 1, cpe_value: 1 },
    { id: "m2", title: "Two", order_index: 2, cpe_value: 2 },
  ];
  const progress = new Map([
    ["m1", { completed_at: "2026-08-26T20:00:00.000Z" }],
    ["m2", { completed_at: "2026-08-26T21:00:00.000Z" }],
  ]);
  const snapshot = buildModuleSnapshot(modules, progress, new Map([["m2", "attempt-2"]]));
  assert.deepEqual(snapshot.map((item) => item.module_id), ["m1", "m2"]);
  assert.equal(snapshot[1].passing_attempt_id, "attempt-2");
  assert.throws(() => buildModuleSnapshot(modules, new Map(), new Map()), /must be complete/);
});
