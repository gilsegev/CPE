import { db } from "@/lib/db";
import { createItem, readItems } from "@directus/sdk";
import { cookies, headers } from "next/headers";

export async function logServerEvent(
  eventType: string,
  pathname: string,
  metadata: any = {},
  userId?: string
) {
  try {
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
        pathname: pathname || "/",
        referrer: referrer || undefined,
        ip_address: ipAddress,
        utm_source: utmSource || undefined,
        utm_medium: utmMedium || undefined,
        utm_campaign: utmCampaign || undefined,
        metadata: metadata || undefined,
      } as any)
    );
  } catch (error) {
    console.error("[OBSERVABILITY_SERVER_LOG_ERROR]", error);
  }
}
