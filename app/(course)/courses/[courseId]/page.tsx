import { db } from "@/lib/db";
import { readItem, readItems } from "@directus/sdk";
import { redirect } from "next/navigation";

const CourseIdPage = async ({
  params
}: {
  params: { courseId: string; }
}) => {
  const course = await db.request(
    readItem("Courses", params.courseId, {
      fields: ["id", "is_published"],
    })
  );

  if (!course || !course.is_published) {
    return redirect("/");
  }

  const modules = await db.request(
    readItems("Modules", {
      filter: {
        course_id: { _eq: params.courseId },
      },
      sort: ["order_index"],
      limit: 1,
      fields: ["id"],
    })
  );

  if (!modules || modules.length === 0) {
    return redirect("/");
  }

  return redirect(`/courses/${course.id}/chapters/${modules[0].id}`);
}
 
export default CourseIdPage;