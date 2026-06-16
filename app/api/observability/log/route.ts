import { NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { createItem } from "@directus/sdk";

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

    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || 
                      req.headers.get("x-real-ip") || 
                      "127.0.0.1";

    const log = await db.request(
      createItem("UserActivityLogs", {
        user_id: user?.id || undefined,
        session_id: sessionId || "anonymous",
        event_type: eventType,
        pathname: pathname || "/",
        referrer: referrer || undefined,
        duration_ms: durationMs ? parseInt(durationMs) : undefined,
        ip_address: ipAddress,
        utm_source: utmSource || undefined,
        utm_medium: utmMedium || undefined,
        utm_campaign: utmCampaign || undefined,
        metadata: metadata || undefined,
      } as any)
    );

    return NextResponse.json(log);
  } catch (error) {
    console.error("[OBSERVABILITY_LOG_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
