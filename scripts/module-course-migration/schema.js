const { Client } = require("pg");

const choice = (choices) => ({ interface: "select-dropdown", options: { choices: choices.map((value) => ({ text: value, value })) } });
const uuidId = {
  field: "id",
  type: "uuid",
  schema: { is_primary_key: true, is_nullable: false },
  meta: { interface: "input", readonly: true, hidden: true, special: ["uuid"] },
};

const collectionDefinitions = {
  QuizAttempts: {
    icon: "history_edu",
    fields: [
      uuidId,
      { field: "user_id", type: "uuid", schema: { is_nullable: false }, meta: { interface: "select-dropdown-m2o" } },
      { field: "quiz_id", type: "uuid", schema: { is_nullable: false }, meta: { interface: "select-dropdown-m2o" } },
      { field: "attempt_number", type: "integer", schema: { is_nullable: false }, meta: { interface: "input" } },
      { field: "status", type: "string", schema: { is_nullable: false, default_value: "in_progress" }, meta: choice(["in_progress", "submitted", "abandoned"]) },
      { field: "answers", type: "json", schema: { is_nullable: false }, meta: { interface: "input-code", special: ["cast-json"] } },
      { field: "result_snapshot", type: "json", schema: { is_nullable: true }, meta: { interface: "input-code", special: ["cast-json"] } },
      { field: "score", type: "integer", schema: { is_nullable: true }, meta: { interface: "input" } },
      { field: "passed", type: "boolean", schema: { is_nullable: true }, meta: { interface: "boolean" } },
      { field: "started_at", type: "timestamp", schema: { is_nullable: false, default_value: "CURRENT_TIMESTAMP" }, meta: { interface: "datetime" } },
      { field: "submitted_at", type: "timestamp", schema: { is_nullable: true }, meta: { interface: "datetime" } },
    ],
  },
  CourseCompletions: {
    icon: "task_alt",
    fields: [
      uuidId,
      { field: "user_id", type: "uuid", schema: { is_nullable: false }, meta: { interface: "select-dropdown-m2o" } },
      { field: "course_id", type: "uuid", schema: { is_nullable: false }, meta: { interface: "select-dropdown-m2o" } },
      { field: "completed_at", type: "timestamp", schema: { is_nullable: false }, meta: { interface: "datetime", readonly: true } },
      { field: "cpe_earned", type: "integer", schema: { is_nullable: false }, meta: { interface: "input", readonly: true } },
      { field: "module_snapshot", type: "json", schema: { is_nullable: false }, meta: { interface: "input-code", readonly: true, special: ["cast-json"] } },
      { field: "final_quiz_attempt_id", type: "uuid", schema: { is_nullable: false }, meta: { interface: "select-dropdown-m2o", readonly: true } },
    ],
  },
  FeedbackResponses: {
    icon: "rate_review",
    fields: [
      uuidId,
      { field: "completion_id", type: "uuid", schema: { is_nullable: false }, meta: { interface: "select-dropdown-m2o" } },
      { field: "user_id", type: "uuid", schema: { is_nullable: false }, meta: { interface: "select-dropdown-m2o" } },
      { field: "course_id", type: "uuid", schema: { is_nullable: false }, meta: { interface: "select-dropdown-m2o" } },
      { field: "knowledge_before", type: "integer", schema: { is_nullable: false }, meta: { interface: "input" } },
      { field: "knowledge_after", type: "integer", schema: { is_nullable: false }, meta: { interface: "input" } },
      { field: "relevance", type: "integer", schema: { is_nullable: false }, meta: { interface: "input" } },
      { field: "instructional_effectiveness", type: "integer", schema: { is_nullable: false }, meta: { interface: "input" } },
      { field: "intent_to_apply", type: "integer", schema: { is_nullable: true }, meta: { interface: "input" } },
      { field: "intent_not_applicable", type: "boolean", schema: { is_nullable: false, default_value: false }, meta: { interface: "boolean" } },
      { field: "planned_application", type: "text", schema: { is_nullable: true }, meta: { interface: "input-multiline" } },
      { field: "most_helpful", type: "text", schema: { is_nullable: true }, meta: { interface: "input-multiline" } },
      { field: "improvement", type: "text", schema: { is_nullable: true }, meta: { interface: "input-multiline" } },
      { field: "technical_issues", type: "json", schema: { is_nullable: false }, meta: { interface: "tags", special: ["cast-json"] } },
      { field: "technical_issue_detail", type: "text", schema: { is_nullable: true }, meta: { interface: "input-multiline" } },
      { field: "submitted_at", type: "timestamp", schema: { is_nullable: false, default_value: "CURRENT_TIMESTAMP" }, meta: { interface: "datetime", readonly: true } },
    ],
  },
};

const existingFields = {
  Courses: [
    { field: "structure_version", type: "string", schema: { is_nullable: false, default_value: "legacy" }, meta: choice(["legacy", "module_quiz_v2"]) },
  ],
  Modules: [
    { field: "cpe_value", type: "integer", schema: { is_nullable: true }, meta: { interface: "input", note: "Required for module_quiz_v2 courses; whole-number CPE credit." } },
    { field: "migration_status", type: "string", schema: { is_nullable: false, default_value: "legacy" }, meta: choice(["legacy", "v2_content", "migrated_quiz_shell", "legacy_essay_history"]) },
  ],
  Quizzes: [
    { field: "is_enabled", type: "boolean", schema: { is_nullable: false, default_value: true }, meta: { interface: "boolean" } },
  ],
  Questions: [
    { field: "order_index", type: "integer", schema: { is_nullable: true }, meta: { interface: "input", note: "Unique ordered position within a quiz." } },
    { field: "explanation", type: "text", schema: { is_nullable: true }, meta: { interface: "input-multiline", note: "Shown only after the learner submits an answer." } },
  ],
  UserProgress: [
    { field: "content_completed_at", type: "timestamp", schema: { is_nullable: true }, meta: { interface: "datetime", readonly: true } },
    { field: "quiz_passed_at", type: "timestamp", schema: { is_nullable: true }, meta: { interface: "datetime", readonly: true } },
    { field: "completed_at", type: "timestamp", schema: { is_nullable: true }, meta: { interface: "datetime", readonly: true } },
  ],
  Certificates: [
    { field: "completion_id", type: "uuid", schema: { is_nullable: true }, meta: { interface: "select-dropdown-m2o" } },
    { field: "status", type: "string", schema: { is_nullable: true }, meta: choice(["pending", "processing", "issued", "delivered", "failed"]) },
    { field: "legal_name_snapshot", type: "string", schema: { is_nullable: true }, meta: { interface: "input", readonly: true } },
    { field: "course_title_snapshot", type: "string", schema: { is_nullable: true }, meta: { interface: "input", readonly: true } },
    { field: "cpe_earned", type: "integer", schema: { is_nullable: true }, meta: { interface: "input", readonly: true } },
    { field: "emailed_at", type: "timestamp", schema: { is_nullable: true }, meta: { interface: "datetime", readonly: true } },
    { field: "attempt_count", type: "integer", schema: { is_nullable: false, default_value: 0 }, meta: { interface: "input", readonly: true } },
    { field: "last_attempt_at", type: "timestamp", schema: { is_nullable: true }, meta: { interface: "datetime", readonly: true } },
    { field: "failure_code", type: "string", schema: { is_nullable: true }, meta: { interface: "input", readonly: true } },
    { field: "failure_detail", type: "text", schema: { is_nullable: true }, meta: { interface: "input-multiline", readonly: true } },
  ],
};

const relations = [
  ["QuizAttempts", "user_id", "directus_users"],
  ["QuizAttempts", "quiz_id", "Quizzes"],
  ["CourseCompletions", "user_id", "directus_users"],
  ["CourseCompletions", "course_id", "Courses"],
  ["CourseCompletions", "final_quiz_attempt_id", "QuizAttempts"],
  ["Certificates", "completion_id", "CourseCompletions"],
  ["FeedbackResponses", "completion_id", "CourseCompletions"],
  ["FeedbackResponses", "user_id", "directus_users"],
  ["FeedbackResponses", "course_id", "Courses"],
];

function isAlreadyExists(error) {
  return /already exists|already has an associated relationship|duplicate key|RECORD_NOT_UNIQUE/i.test(error.message);
}

async function ensureField(client, collection, definition) {
  try {
    await client.request(`/fields/${collection}`, "POST", definition);
    console.log(`created field ${collection}.${definition.field}`);
  } catch (error) {
    if (!isAlreadyExists(error)) throw error;
  }
}

async function applyDirectusSchema(client) {
  // Creating a collection without fields makes Directus choose an integer key.
  // Repair only empty, migration-owned collections from interrupted early runs.
  for (const collection of Object.keys(collectionDefinitions).reverse()) {
    try {
      const idField = await client.request(`/fields/${collection}/id`);
      if (idField.type !== "uuid") {
        const count = Number((await client.request(`/items/${collection}?aggregate[count]=*`))[0].count);
        if (count > 0) throw new Error(`${collection} has a non-UUID key and ${count} records; refusing destructive repair`);
        await client.request(`/collections/${collection}`, "DELETE");
        console.log(`recreated empty collection ${collection} to correct its primary-key type`);
      }
    } catch (error) {
      if (!/403|404|FORBIDDEN|ROUTE_NOT_FOUND|does not exist/i.test(error.message)) throw error;
    }
  }

  for (const [collection, definition] of Object.entries(collectionDefinitions)) {
    try {
      await client.request("/collections", "POST", {
        collection,
        schema: {},
        meta: { show_in_navigation: true, icon: definition.icon },
        fields: [uuidId],
      });
      console.log(`created collection ${collection}`);
    } catch (error) {
      if (!isAlreadyExists(error)) throw error;
    }
    for (const field of definition.fields.filter((field) => field.field !== "id")) {
      await ensureField(client, collection, field);
    }
  }

  for (const [collection, fields] of Object.entries(existingFields)) {
    for (const field of fields) await ensureField(client, collection, field);
  }

  for (const [collection, field, relatedCollection] of relations) {
    try {
      await client.request("/relations", "POST", {
        collection,
        field,
        related_collection: relatedCollection,
      });
      console.log(`created relation ${collection}.${field} -> ${relatedCollection}`);
    } catch (error) {
      if (!isAlreadyExists(error)) throw error;
    }
  }

  const courses = await client.listAll("Courses", "id,structure_version");
  for (const course of courses.filter((row) => !row.structure_version)) {
    await client.request(`/items/Courses/${course.id}`, "PATCH", { structure_version: "legacy" });
  }

  const quizzes = await client.listAll("Quizzes", "id,is_enabled");
  for (const quiz of quizzes.filter((row) => row.is_enabled == null)) {
    await client.request(`/items/Quizzes/${quiz.id}`, "PATCH", { is_enabled: true });
  }

  const modules = await client.listAll("Modules", "id,type,migration_status");
  for (const module of modules.filter((row) => !row.migration_status)) {
    await client.request(`/items/Modules/${module.id}`, "PATCH", { migration_status: "legacy" });
  }

  const questions = await client.listAll("Questions", "id,quiz_id,order_index");
  const grouped = questions.reduce((groups, question) => {
    const quizId = typeof question.quiz_id === "object" ? question.quiz_id.id : question.quiz_id;
    (groups[quizId] ||= []).push(question);
    return groups;
  }, {});
  for (const quizQuestions of Object.values(grouped)) {
    const used = new Set(quizQuestions.filter((row) => row.order_index != null).map((row) => Number(row.order_index)));
    let next = 1;
    for (const question of quizQuestions.filter((row) => row.order_index == null)) {
      while (used.has(next)) next += 1;
      await client.request(`/items/Questions/${question.id}`, "PATCH", { order_index: next });
      used.add(next);
    }
  }

  const requiredLegacyCompatibleFields = [
    ["Modules", "course_id"],
    ["Modules", "order_index"],
    ["Quizzes", "module_id"],
    ["Quizzes", "passing_score"],
    ["Questions", "quiz_id"],
    ["Questions", "order_index"],
    ["UserProgress", "user_id"],
    ["UserProgress", "module_id"],
  ];
  for (const [collection, field] of requiredLegacyCompatibleFields) {
    await client.request(`/fields/${collection}/${field}`, "PATCH", {
      schema: { is_nullable: false },
      meta: { required: true },
    });
  }

  const certificates = await client.listAll("Certificates", "id,status,pdf_url,issued_date");
  for (const certificate of certificates.filter((row) => !row.status)) {
    await client.request(`/items/Certificates/${certificate.id}`, "PATCH", {
      status: certificate.pdf_url || certificate.issued_date ? "issued" : "failed",
      attempt_count: 0,
      failure_code: certificate.pdf_url || certificate.issued_date ? null : "legacy_certificate_incomplete",
    });
  }
  await client.request("/fields/Certificates/pdf_url", "PATCH", { schema: { is_nullable: true, default_value: null } });
  await client.request("/fields/Certificates/issued_date", "PATCH", { schema: { is_nullable: true, default_value: null } });
  await client.request("/fields/Certificates/status", "PATCH", { schema: { default_value: "pending", is_nullable: false } });

  const serverInfo = await client.request("/server/info");
  const majorVersion = Number(String(serverInfo.version || "0").split(".")[0]);
  const targetField = majorVersion >= 11 ? "policy" : "role";
  const targets = majorVersion >= 11 ? await client.request("/policies?limit=-1") : await client.request("/roles?limit=-1");
  const studentTarget = targets.find((target) => String(target.name).toLowerCase().includes("student"));
  const permissions = await client.request("/permissions?limit=-1");
  if (studentTarget) {
    const safeReadFields = {
      Questions: ["id", "quiz_id", "question_text", "options", "order_index"],
      Certificates: [
        "id", "user_id", "course_id", "completion_id", "status", "legal_name_snapshot",
        "course_title_snapshot", "cpe_earned", "pdf_url", "issued_date", "emailed_at",
      ],
    };
    for (const [collection, fields] of Object.entries(safeReadFields)) {
      const permission = permissions.find(
        (row) => row.collection === collection && row.action === "read" && row[targetField] === studentTarget.id,
      );
      if (permission) await client.request(`/permissions/${permission.id}`, "PATCH", { fields });
    }
  }

  const nonAdminTargetIds = new Set(
    targets
      .filter((target) => !String(target.name).toLowerCase().includes("administrator"))
      .map((target) => target.id),
  );
  const unsafeFeedbackPermissions = permissions.filter(
    (permission) => permission.collection === "FeedbackResponses" && nonAdminTargetIds.has(permission[targetField]),
  );
  for (const permission of unsafeFeedbackPermissions) {
    await client.request(`/permissions/${permission.id}`, "DELETE");
    console.log(`removed non-administrator ${permission.action} permission for FeedbackResponses`);
  }
}

async function verifyFeedbackPermissions(client) {
  const serverInfo = await client.request("/server/info");
  const majorVersion = Number(String(serverInfo.version || "0").split(".")[0]);
  const targetField = majorVersion >= 11 ? "policy" : "role";
  const targets = majorVersion >= 11 ? await client.request("/policies?limit=-1") : await client.request("/roles?limit=-1");
  const targetById = new Map(targets.map((target) => [target.id, target]));
  const permissions = await client.request("/permissions?limit=-1");
  return permissions.flatMap((permission) => {
    if (permission.collection !== "FeedbackResponses") return [];
    const target = targetById.get(permission[targetField]);
    if (!target || String(target.name).toLowerCase().includes("administrator")) return [];
    return [`permission FeedbackResponses.${permission.action} granted to ${target.name}`];
  });
}

const ddl = `
CREATE UNIQUE INDEX IF NOT EXISTS uq_modules_course_order ON "Modules" (course_id, order_index) WHERE course_id IS NOT NULL AND order_index IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_quizzes_module ON "Quizzes" (module_id) WHERE module_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_questions_quiz_order ON "Questions" (quiz_id, order_index) WHERE quiz_id IS NOT NULL AND order_index IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_progress_user_module ON "UserProgress" (user_id, module_id) WHERE user_id IS NOT NULL AND module_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_quiz_attempt_number ON "QuizAttempts" (user_id, quiz_id, attempt_number);
CREATE UNIQUE INDEX IF NOT EXISTS uq_quiz_attempt_in_progress ON "QuizAttempts" (user_id, quiz_id) WHERE status = 'in_progress';
CREATE UNIQUE INDEX IF NOT EXISTS uq_course_completion_user_course ON "CourseCompletions" (user_id, course_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_certificate_completion ON "Certificates" (completion_id) WHERE completion_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_feedback_completion ON "FeedbackResponses" (completion_id);
CREATE INDEX IF NOT EXISTS ix_feedback_course_submitted ON "FeedbackResponses" (course_id, submitted_at);
CREATE INDEX IF NOT EXISTS ix_course_completion_course_completed ON "CourseCompletions" (course_id, completed_at);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_modules_cpe_nonnegative') THEN
    ALTER TABLE "Modules" ADD CONSTRAINT ck_modules_cpe_nonnegative CHECK (cpe_value IS NULL OR cpe_value >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_quizzes_passing_score') THEN
    ALTER TABLE "Quizzes" ADD CONSTRAINT ck_quizzes_passing_score CHECK (passing_score BETWEEN 0 AND 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_quiz_attempt_score') THEN
    ALTER TABLE "QuizAttempts" ADD CONSTRAINT ck_quiz_attempt_score CHECK (score IS NULL OR score BETWEEN 0 AND 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_quiz_attempt_status') THEN
    ALTER TABLE "QuizAttempts" ADD CONSTRAINT ck_quiz_attempt_status CHECK (status IN ('in_progress', 'submitted', 'abandoned'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_certificate_status') THEN
    ALTER TABLE "Certificates" ADD CONSTRAINT ck_certificate_status CHECK (status IN ('pending', 'processing', 'issued', 'delivered', 'failed'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_feedback_ratings') THEN
    ALTER TABLE "FeedbackResponses" ADD CONSTRAINT ck_feedback_ratings CHECK (
      knowledge_before BETWEEN 1 AND 5 AND knowledge_after BETWEEN 1 AND 5 AND relevance BETWEEN 1 AND 5
      AND instructional_effectiveness BETWEEN 1 AND 5 AND (intent_to_apply IS NULL OR intent_to_apply BETWEEN 1 AND 5)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_feedback_intent') THEN
    ALTER TABLE "FeedbackResponses" ADD CONSTRAINT ck_feedback_intent CHECK (
      (intent_not_applicable AND intent_to_apply IS NULL) OR (NOT intent_not_applicable AND intent_to_apply IS NOT NULL)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_feedback_lengths') THEN
    ALTER TABLE "FeedbackResponses" ADD CONSTRAINT ck_feedback_lengths CHECK (
      char_length(COALESCE(planned_application, '')) <= 2000 AND char_length(COALESCE(most_helpful, '')) <= 2000
      AND char_length(COALESCE(improvement, '')) <= 2000 AND char_length(COALESCE(technical_issue_detail, '')) <= 1000
    );
  END IF;
END $$;
`;

async function applyDatabaseConstraints(connectionString = process.env.MODULE_COURSE_DB_URL || process.env.DB_CONNECTION_STRING) {
  if (!connectionString) throw new Error("MODULE_COURSE_DB_URL or DB_CONNECTION_STRING is required for database constraints");
  const database = new Client({ connectionString });
  await database.connect();
  try {
    await database.query("BEGIN");
    await database.query(ddl);
    await database.query("COMMIT");
  } catch (error) {
    await database.query("ROLLBACK");
    throw error;
  } finally {
    await database.end();
  }
}

const expectedDatabaseObjects = [
  "uq_modules_course_order",
  "uq_quizzes_module",
  "uq_questions_quiz_order",
  "uq_user_progress_user_module",
  "uq_quiz_attempt_number",
  "uq_quiz_attempt_in_progress",
  "uq_course_completion_user_course",
  "uq_certificate_completion",
  "uq_feedback_completion",
  "ix_feedback_course_submitted",
  "ix_course_completion_course_completed",
  "ck_modules_cpe_nonnegative",
  "ck_quizzes_passing_score",
  "ck_quiz_attempt_score",
  "ck_quiz_attempt_status",
  "ck_certificate_status",
  "ck_feedback_ratings",
  "ck_feedback_intent",
  "ck_feedback_lengths",
];

async function verifyDatabaseConstraints(connectionString = process.env.MODULE_COURSE_DB_URL || process.env.DB_CONNECTION_STRING) {
  if (!connectionString) return { checked: false, missing: [] };
  const database = new Client({ connectionString });
  await database.connect();
  try {
    const indexes = await database.query("SELECT indexname AS name FROM pg_indexes WHERE schemaname = current_schema()");
    const constraints = await database.query("SELECT conname AS name FROM pg_constraint");
    const present = new Set([...indexes.rows, ...constraints.rows].map((row) => row.name));
    return { checked: true, missing: expectedDatabaseObjects.filter((name) => !present.has(name)) };
  } finally {
    await database.end();
  }
}

module.exports = {
  applyDatabaseConstraints,
  applyDirectusSchema,
  collectionDefinitions,
  existingFields,
  relations,
  verifyFeedbackPermissions,
  verifyDatabaseConstraints,
};
