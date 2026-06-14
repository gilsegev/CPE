import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createItem } from "@directus/sdk";
import { WebhooksHelper } from "square";
import { db } from "@/lib/db";
import { squareClient } from "@/lib/square";

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = headers();
  const signature = headersList.get("x-square-hmacsha256-signature") || "";
  const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || "";

  // Construct notification URL dynamically to support local ngrok/localtunnel testing easily
  const host = headersList.get("x-forwarded-host") || headersList.get("host");
  const rawProto = headersList.get("x-forwarded-proto") || "http";
  const proto = rawProto.split(",")[0].trim();
  const dynamicUrl = `${proto}://${host}/api/webhook`;
  const notificationUrl = process.env.SQUARE_WEBHOOK_URL || dynamicUrl;

  // Verify the signature
  try {
    const isValid = await WebhooksHelper.verifySignature({
      requestBody: body,
      signatureHeader: signature,
      signatureKey,
      notificationUrl,
    });

    if (!isValid) {
      console.error("[WEBHOOK] Signature validation failed. URL used:", notificationUrl);
      return new NextResponse("Webhook Error: Invalid signature", { status: 400 });
    }
  } catch (error: any) {
    console.error("[WEBHOOK] Signature verification error:", error);
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
  }

  // Parse the event payload
  let event;
  try {
    event = JSON.parse(body);
  } catch (error: any) {
    console.error("[WEBHOOK] JSON parsing error:", error);
    return new NextResponse(`Webhook Error: Invalid JSON`, { status: 400 });
  }

  const eventType = event.type;

  // Handle payment.updated event when payment is COMPLETED
  if (eventType === "payment.updated") {
    const payment = event.data?.object?.payment;
    const status = payment?.status;

    if (status === "COMPLETED") {
      const orderId = payment?.order_id;
      const paymentId = payment?.id;

      if (!orderId) {
        console.error("[WEBHOOK] Missing order_id on completed payment:", payment);
        return new NextResponse("Webhook Error: Missing order_id on payment", { status: 400 });
      }
      try {
        // Retrieve order details to get metadata (userId and courseId)
        const orderResponse = await squareClient.orders.get({ orderId });
        const order = orderResponse.order;
        const metadata = order?.metadata;

        const userId = metadata?.userId;
        const courseId = metadata?.courseId;

        if (!userId || !courseId) {
          console.error("[WEBHOOK] Missing metadata on order:", order);
          return new NextResponse("Webhook Error: Missing metadata in order details", { status: 400 });
        }

        console.log(`[WEBHOOK] Provisioning purchase. User: ${userId}, Course: ${courseId}, Payment: ${paymentId}`);

        // Write the Purchase to Directus
        await db.request(
          createItem("Purchases", {
            user_id: userId,
            course_id: courseId,
            status: "active",
            stripe_payment_id: paymentId, // Keeping DB column name but storing Square payment ID
          })
        );

      } catch (error: any) {
        console.error("[WEBHOOK] Error retrieving order or provisioning purchase:", error);
        return new NextResponse(`Webhook Error: ${error.message}`, { status: 500 });
      }
    } else {
      console.log(`[WEBHOOK] Received payment.updated with status: ${status} (Ignored)`);
    }
  } else {
    console.log(`[WEBHOOK] Unhandled event type: ${eventType}`);
  }

  return new NextResponse(null, { status: 200 });
}