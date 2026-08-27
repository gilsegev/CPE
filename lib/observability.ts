import { db } from "@/lib/db";
import { createItem, readItems } from "@directus/sdk";
import { cookies, headers } from "next/headers";
import { getCurrentUser, isAdmin } from "@/lib/auth";

export const ALLOWED_TELEMETRY_EVENTS = new Set([
  "session_start", "page_view", "page_exit", "login_success", "signup_success",
  "checkout_start", "purchase_success", "video_watch", "module_content_completed",
  "quiz_attempt_submitted", "course_completed", "survey_shown", "survey_closed",
  "survey_submitted", "certificate_status_changed",
]);

const ALLOWED_METADATA_KEYS = new Set([
  "method", "courseId", "moduleId", "chapterId", "attemptId", "completionId",
  "cpeEarned", "quizRequired", "score", "passed", "segmentMs", "totalMs", "price",
  "maxScrollPercent", "technicalIssues",
]);

export function sanitizeTelemetryMetadata(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
    if (!ALLOWED_METADATA_KEYS.has(key)) continue;
    if (typeof value === "string") sanitized[key] = value.slice(0, 200);
    else if (typeof value === "number" && Number.isFinite(value)) sanitized[key] = value;
    else if (typeof value === "boolean") sanitized[key] = value;
    else if (key === "technicalIssues" && Array.isArray(value)) {
      sanitized[key] = value.filter((item): item is string => typeof item === "string").slice(0, 5);
    }
  }
  return sanitized;
}

export function sanitizeTelemetryPath(value: unknown): string {
  if (typeof value !== "string" || !value) return "/";
  try {
    const decoded = decodeURIComponent(value);
    const parsed = new URL(decoded, "https://telemetry.invalid");
    return (parsed.pathname || "/").slice(0, 500);
  } catch {
    const withoutQuery = value.split(/[?#]/, 1)[0] || "/";
    return withoutQuery.startsWith("/") ? withoutQuery.slice(0, 500) : "/";
  }
}

export async function logServerEvent(
  eventType: string,
  pathname: string,
  metadata: any = {},
  userId?: string
) {
  try {
    if (!ALLOWED_TELEMETRY_EVENTS.has(eventType)) return;
    // Prevent logging administrative actions in the system observability database
    if (userId) {
      const isUserAdmin = await isAdmin(userId);
      if (isUserAdmin) return;
    } else {
      const user = await getCurrentUser();
      if (user) {
        const isUserAdmin = await isAdmin(user.id);
        if (isUserAdmin) return;
      }
    }
    const cookieStore = cookies();
    const sessionId = cookieStore.get("cpe_session_id")?.value || "anonymous";

    const headerList = headers();
    const ipAddress = headerList.get("x-forwarded-for")?.split(",")[0].trim() || 
                      headerList.get("x-real-ip") || 
                      "127.0.0.1";

    const utmSource = cookieStore.get("utm_source")?.value || null;
    const utmMedium = cookieStore.get("utm_medium")?.value || null;
    const utmCampaign = cookieStore.get("utm_campaign")?.value || null;
    const referrer = cookieStore.get("cpe_referrer")?.value || null;

    // Deduplicate purchase_success events to avoid duplicates on refresh
    if (eventType === "purchase_success" && userId) {
      const existing = await db.request(
        readItems("UserActivityLogs", {
          filter: {
            user_id: { _eq: userId },
            event_type: { _eq: "purchase_success" },
            pathname: { _eq: pathname },
          },
          limit: 1,
        })
      );
      if (existing && existing.length > 0) {
        return; // Already logged!
      }
    }

    await db.request(
      createItem("UserActivityLogs", {
        user_id: userId || undefined,
        session_id: sessionId,
        event_type: eventType,
        pathname: sanitizeTelemetryPath(pathname),
        referrer: referrer ? sanitizeTelemetryPath(referrer) : undefined,
        ip_address: ipAddress,
        utm_source: utmSource?.slice(0, 100) || undefined,
        utm_medium: utmMedium?.slice(0, 100) || undefined,
        utm_campaign: utmCampaign?.slice(0, 100) || undefined,
        metadata: sanitizeTelemetryMetadata(metadata),
      } as any)
    );
  } catch (error) {
    console.error("[OBSERVABILITY_SERVER_LOG_ERROR]", error);
  }
}
