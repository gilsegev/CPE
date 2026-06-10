import { NavbarRoutes } from "@/components/navbar-routes";
import { getCurrentUser } from "@/lib/auth";
import { CourseMobileSidebar } from "./course-mobile-sidebar";

// Temporary placeholder interface until prisma models are fully removed in data migration step
interface CourseNavbarProps {
  course: any;
  progressCount: number;
};

export const CourseNavbar = async ({
  course,
  progressCount,
}: CourseNavbarProps) => {
  const user = await getCurrentUser();

  return (
    <div className="p-4 border-b h-full flex items-center bg-white shadow-sm">
      <CourseMobileSidebar
        course={course}
        progressCount={progressCount}
      />
      <NavbarRoutes 
        userId={user?.id}
        userName={user?.first_name || user?.legal_name}
      />      
    </div>
  )
}