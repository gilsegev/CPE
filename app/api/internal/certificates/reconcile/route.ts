import { NextResponse } from "next/server";

import { reconcileCertificates } from "@/lib/course-completion";

export async function POST(req: Request) {
  const expectedSecret = process.env.CERTIFICATE_RECONCILIATION_SECRET;
  const authorization = req.headers.get("authorization");
  if (!expectedSecret || authorization !== `Bearer ${expectedSecret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const timeoutMinutes = Number(process.env.CERTIFICATE_PROCESSING_TIMEOUT_MINUTES || 30);
    const staleBefore = new Date(Date.now() - Math.max(timeoutMinutes, 5) * 60_000);
    return NextResponse.json(await reconcileCertificates(staleBefore));
  } catch (error) {
    console.error("[CERTIFICATE_RECONCILIATION]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
