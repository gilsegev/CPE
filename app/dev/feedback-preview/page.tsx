import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { FeedbackPreviewClient } from "./preview-client";

export const dynamic = "force-dynamic";

export default function FeedbackPreviewPage() {
  const host = headers().get("host") || "";
  const isLocal = host === "localhost"
    || host.startsWith("localhost:")
    || host.startsWith("127.0.0.1")
    || host.startsWith("[::1]");

  if (!isLocal && process.env.ENABLE_DEV_PREVIEWS !== "true") notFound();

  return <FeedbackPreviewClient />;
}
