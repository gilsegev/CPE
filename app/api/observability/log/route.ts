import { NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { createItem } from "@directus/sdk";
import { ALLOWED_TELEMETRY_EVENTS, sanitizeTelemetryMetadata, sanitizeTelemetryPath } from "@/lib/observability";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    
    // Skip tracking client action logs triggered by administrators
    if (user) {
      const isUserAdmin = await isAdmin(user.id);
      if (isUserAdmin) {
        return NextResponse.json({ skipped: true, reason: "Admin activities are not logged" });
      }
    }
    let body;
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    
    const {
      sessionId,
      eventType,
      pathname,
      referrer,
      durationMs,
      utmSource,
      utmMedium,
      utmCampaign,
      metadata
    } = body;

    if (typeof eventType !== "string" || !ALLOWED_TELEMETRY_EVENTS.has(eventType)) {
      return NextResponse.json({ error: "unsupported_event" }, { status: 400 });
    }

    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || 
                      req.headers.get("x-real-ip") || 
                      "127.0.0.1";

    const log = await db.request(
      createItem("UserActivityLogs", {
        user_id: user?.id || undefined,
        session_id: typeof sessionId === "string" ? sessionId.slice(0, 100) : "anonymous",
        event_type: eventType,
        pathname: sanitizeTelemetryPath(pathname),
        referrer: referrer ? sanitizeTelemetryPath(referrer) : undefined,
        duration_ms: Number.isFinite(Number(durationMs)) ? Math.max(0, Math.min(Number(durationMs), 600000)) : undefined,
        ip_address: ipAddress,
        utm_source: typeof utmSource === "string" ? utmSource.slice(0, 100) : undefined,
        utm_medium: typeof utmMedium === "string" ? utmMedium.slice(0, 100) : undefined,
        utm_campaign: typeof utmCampaign === "string" ? utmCampaign.slice(0, 100) : undefined,
        metadata: sanitizeTelemetryMetadata(metadata),
      } as any)
    );

    return NextResponse.json(log);
  } catch (error) {
    console.error("[OBSERVABILITY_LOG_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
