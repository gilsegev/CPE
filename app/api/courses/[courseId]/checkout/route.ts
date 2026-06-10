import Stripe from "stripe";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
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

    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        quantity: 1,
        price_data: {
          currency: "USD",
          product_data: {
            name: course.title,
            description: course.description || "",
          },
          unit_amount: Math.round(Number(course.price) * 100),
        },
      },
    ];

    // Create Stripe checkout session using customer_email directly (simplifying customer model)
    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      line_items,
      mode: "payment",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/courses/${course.id}?success=1`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/courses/${course.id}?canceled=1`,
      metadata: {
        courseId: course.id,
        userId: user.id,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[COURSE_ID_CHECKOUT]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}