import { db } from "@/lib/db";
import { readItem, readItems } from "@directus/sdk";
import { redirect } from "next/navigation";
import { isV2ContentModule } from "@/lib/course-completion-rules";

const CourseIdPage = async ({
  params,
  searchParams,
}: {
  params: { courseId: string; }
  searchParams: { success?: string };
}) => {
  const course = await db.request(
    readItem("Courses", params.courseId, {
      fields: ["id", "is_published", "structure_version"],
    })
  );

  if (!course || !course.is_published) {
    return redirect("/");
  }

  const allModules = await db.request(
    readItems("Modules", {
      filter: {
        course_id: { _eq: params.courseId },
      },
      sort: ["order_index"],
      fields: ["id", "type", "migration_status"],
    })
  );
  const modules = course.structure_version === "module_quiz_v2"
    ? allModules.filter(isV2ContentModule)
    : allModules;

  if (!modules || modules.length === 0) {
    return redirect("/");
  }

  const queryString = searchParams.success === "1" ? "?success=1" : "";
  return redirect(`/courses/${course.id}/chapters/${modules[0].id}${queryString}`);
}
 
export default CourseIdPage;
