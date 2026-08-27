export class CompletionRuleError extends Error {
  code: string;
  constructor(message: string, code: string);
}

export function relationId(value: unknown): string;

export function isV2ContentModule(module: {
  type?: string | null;
  migration_status?: string | null;
}): boolean;

export function calculateCpeTotal(modules: Array<{ cpe_value?: number | null }>): number;

export function createOrReadUnique<T>(
  create: () => Promise<T>,
  readExisting: () => Promise<T | null | undefined>,
  isUniqueConflict: (error: unknown) => boolean,
): Promise<{ value: T; created: boolean }>;

export function isModuleComplete(
  progress: { content_completed_at?: string | null; quiz_passed_at?: string | null },
  quizEnabled: boolean,
): boolean;

export interface ModuleSnapshot {
  module_id: string;
  title: string;
  order_index: number;
  cpe_value: number;
  completed_at: string;
  passing_attempt_id: string | null;
}

export function buildModuleSnapshot(
  modules: Array<{ id: string; title: string; order_index: number; cpe_value?: number | null }>,
  progressByModule: Map<string, { completed_at?: string | null }>,
  passingAttemptByModule: Map<string, string>,
): ModuleSnapshot[];
