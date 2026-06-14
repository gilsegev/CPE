import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { squareClient } from "@/lib/square";
import { readItem, readItems } from "@directus/sdk";

export async function POST(
  req: Request,
  { params }: { params: { courseId: string } }
) {
  try {
    const user = await getCurrentUser();

    if (!user || !user.email) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // 1. Fetch course details
    const course = await db.request(
      readItem("Courses", params.courseId, {
        fields: ["id", "title", "description", "price", "is_published"],
      })
    );

    if (!course || !course.is_published) {
      return new NextResponse("Not found", { status: 404 });
    }

    // 2. Check if purchase already exists
    const existingPurchases = await db.request(
      readItems("Purchases", {
        filter: {
          user_id: { _eq: user.id },
          course_id: { _eq: params.courseId },
          status: { _eq: "active" },
        },
        limit: 1,
      })
    );

    if (existingPurchases[0]) {
      return new NextResponse("Already purchased", { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    let locationId = process.env.SQUARE_LOCATION_ID;

    if (!locationId) {
      try {
        console.log("[COURSE_ID_CHECKOUT] SQUARE_LOCATION_ID not provided. Fetching locations from Square...");
        const locationsResponse = await squareClient.locations.list();
        const activeLocation = locationsResponse.locations?.find(
          (loc) => loc.status === "ACTIVE"
        );
        locationId = activeLocation?.id;
        if (locationId) {
          console.log("[COURSE_ID_CHECKOUT] Using active location ID:", locationId);
        }
      } catch (err) {
        console.error("[COURSE_ID_CHECKOUT] Error listing locations from Square:", err);
      }
    }

    if (!locationId) {
      console.error("[COURSE_ID_CHECKOUT] SQUARE_LOCATION_ID is missing and no active location could be retrieved.");
      return new NextResponse("Square Location ID is not configured", { status: 500 });
    }

    // Create Square payment link
    const response = await squareClient.checkout.paymentLinks.create({
      idempotencyKey: randomUUID(),
      order: {
        locationId: locationId,
        lineItems: [
          {
            name: course.title,
            quantity: "1",
            basePriceMoney: {
              amount: BigInt(Math.round(Number(course.price) * 100)),
              currency: "USD",
            },
          },
        ],
        metadata: {
          userId: user.id,
          courseId: course.id,
        },
      },
      checkoutOptions: {
        redirectUrl: `${appUrl}/courses/${course.id}?success=1`,
      },
    });

    const paymentLinkUrl = response.paymentLink?.url;

    if (!paymentLinkUrl) {
      console.error("[COURSE_ID_CHECKOUT] Payment link URL is missing in Square response:", response);
      return new NextResponse("Failed to create payment link", { status: 500 });
    }

    return NextResponse.json({ url: paymentLinkUrl });
  } catch (error) {
    console.error("[COURSE_ID_CHECKOUT]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}