import { db } from "@/lib/db";
import { readItems } from "@directus/sdk";

export const getAnalytics = async (userId: string) => {
  try {
    // 1. Fetch all active purchases across the platform
    const purchases = await db.request(
      readItems("Purchases", {
        filter: {
          status: { _eq: "active" },
        },
        fields: ["course_id"],
      })
    );

    if (purchases.length === 0) {
      return {
        data: [],
        totalRevenue: 0,
        totalSales: 0,
      };
    }

    // 2. Fetch the corresponding course titles and prices
    const courseIds = Array.from(new Set(purchases.map((p) => p.course_id)));
    const courses = await db.request(
      readItems("Courses", {
        filter: {
          id: { _in: courseIds },
        },
        fields: ["id", "title", "price"],
      })
    );

    const courseMap = new Map(courses.map((c) => [c.id, c]));

    // 3. Group earnings by course title
    const groupedEarnings: { [courseTitle: string]: number } = {};
    purchases.forEach((purchase) => {
      const course = courseMap.get(purchase.course_id);
      if (course) {
        const courseTitle = course.title;
        const price = Number(course.price) || 0;
        if (!groupedEarnings[courseTitle]) {
          groupedEarnings[courseTitle] = 0;
        }
        groupedEarnings[courseTitle] += price;
      }
    });

    const data = Object.entries(groupedEarnings).map(([courseTitle, total]) => ({
      name: courseTitle,
      total: total,
    }));

    const totalRevenue = data.reduce((acc, curr) => acc + curr.total, 0);
    const totalSales = purchases.length;

    return {
      data,
      totalRevenue,
      totalSales,
    };
  } catch (error) {
    console.error("[GET_ANALYTICS_ERROR]", error);
    return {
      data: [],
      totalRevenue: 0,
      totalSales: 0,
    };
  }
};