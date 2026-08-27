// @ts-check

class CompletionRuleError extends Error {
  /** @param {string} message @param {string} code */
  constructor(message, code) {
    super(message);
    this.name = "CompletionRuleError";
    this.code = code;
  }
}

/** @param {unknown} value */
function relationId(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = /** @type {{ id?: unknown }} */ (value).id;
    return typeof id === "string" ? id : "";
  }
  return "";
}

/** @param {{ type?: string | null, migration_status?: string | null }} module */
function isV2ContentModule(module) {
  if (module.migration_status === "migrated_quiz_shell" || module.migration_status === "legacy_essay_history") {
    return false;
  }
  if (module.migration_status === "v2_content") return true;
  return module.type !== "quiz" && module.type !== "essay";
}

/** @param {Array<{ cpe_value?: number | null }>} modules */
function calculateCpeTotal(modules) {
  return modules.reduce((total, module) => {
    const value = Number(module.cpe_value);
    if (!Number.isInteger(value) || value < 0) {
      throw new CompletionRuleError(
        "Every module must have a non-negative whole-number CPE value.",
        "invalid_module_cpe",
      );
    }
    return total + value;
  }, 0);
}

/**
 * @param {{ content_completed_at?: string | null, quiz_passed_at?: string | null }} progress
 * @param {boolean} quizEnabled
 */
function isModuleComplete(progress, quizEnabled) {
  return Boolean(progress.content_completed_at) && (!quizEnabled || Boolean(progress.quiz_passed_at));
}

/**
 * @param {Array<{ id: string, title: string, order_index: number, cpe_value?: number | null }>} modules
 * @param {Map<string, { completed_at?: string | null }>} progressByModule
 * @param {Map<string, string>} passingAttemptByModule
 */
function buildModuleSnapshot(modules, progressByModule, passingAttemptByModule) {
  return modules.map((module) => {
    const progress = progressByModule.get(module.id);
    if (!progress?.completed_at) {
      throw new CompletionRuleError("Every module must be complete before the course can complete.", "course_incomplete");
    }
    return {
      module_id: module.id,
      title: module.title,
      order_index: module.order_index,
      cpe_value: Number(module.cpe_value),
      completed_at: progress.completed_at,
      passing_attempt_id: passingAttemptByModule.get(module.id) || null,
    };
  });
}

/**
 * @template T
 * @param {() => Promise<T>} create
 * @param {() => Promise<T | null | undefined>} readExisting
 * @param {(error: unknown) => boolean} isUniqueConflict
 */
async function createOrReadUnique(create, readExisting, isUniqueConflict) {
  try {
    return { value: await create(), created: true };
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    const existing = await readExisting();
    if (!existing) throw error;
    return { value: existing, created: false };
  }
}

module.exports = {
  CompletionRuleError,
  buildModuleSnapshot,
  calculateCpeTotal,
  createOrReadUnique,
  isModuleComplete,
  isV2ContentModule,
  relationId,
};
