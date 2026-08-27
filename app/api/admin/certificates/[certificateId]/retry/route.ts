import { NextResponse } from "next/server";

import { getCurrentUser, isAdmin } from "@/lib/auth";
import { CourseWorkflowError, retryCertificate } from "@/lib/course-completion";

export async function POST(
  _req: Request,
  { params }: { params: { certificateId: string } },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return new NextResponse("Unauthorized", { status: 401 });
    if (!(await isAdmin(user.id))) return new NextResponse("Forbidden", { status: 403 });

    const certificate = await retryCertificate(params.certificateId);
    const workerUrl = process.env.N8N_CERTIFICATE_WEBHOOK_URL;
    if (workerUrl) {
      try {
        const response = await fetch(workerUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ certificateId: certificate.id }),
          cache: "no-store",
          signal: AbortSignal.timeout(5_000),
        });
        if (!response.ok) throw new Error(`Certificate worker returned HTTP ${response.status}`);
      } catch (error) {
        console.error("[CERTIFICATE_RETRY_DISPATCH] Pending certificate will be picked up by reconciliation.", error);
      }
    }
    return NextResponse.json({ id: certificate.id, status: certificate.status });
  } catch (error) {
    if (error instanceof CourseWorkflowError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    console.error("[CERTIFICATE_RETRY]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
