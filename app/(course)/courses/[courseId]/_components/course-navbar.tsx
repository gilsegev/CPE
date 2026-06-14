import { NavbarRoutes } from "@/components/navbar-routes";
import { getCurrentUser } from "@/lib/auth";
import { CourseMobileSidebar } from "./course-mobile-sidebar";
import { Logo } from "@/app/(dashboard)/_components/logo";
import Link from "next/link";

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
    <div className="px-6 border-b border-[#2d3a5a] h-full flex items-center bg-[#18223b] text-white shadow-md justify-between">
      {/* Left: Mobile trigger & Logo */}
      <div className="flex items-center gap-x-4">
        <CourseMobileSidebar
          course={course}
          progressCount={progressCount}
        />
        <Link href="/" className="hover:opacity-90 transition flex items-center">
          <Logo />
        </Link>
      </div>

      {/* Middle: Squarespace Navigation Links (hidden on mobile/tablet) */}
      <div className="hidden lg:flex items-center gap-x-8 text-sm">
        <a 
          href="https://www.guidingdiversity.com/about" 
          className="text-[#e2e7f2] hover:text-white transition font-medium text-[15px]"
        >
          About
        </a>
        <a 
          href="https://www.guidingdiversity.com/services" 
          className="text-[#e2e7f2] hover:text-white transition font-medium text-[15px]"
        >
          Services
        </a>
        <a 
          href="https://www.guidingdiversity.com/blog" 
          className="text-[#e2e7f2] hover:text-white transition font-medium text-[15px]"
        >
          Blog
        </a>
        <a 
          href="https://www.guidingdiversity.com/contact" 
          className="text-[#e2e7f2] hover:text-white transition font-medium text-[15px]"
        >
          Contact
        </a>
        <Link 
          href="/search" 
          className="text-white border-b-2 border-sky-400 pb-1 transition font-medium text-[15px]"
        >
          CPE Courses
        </Link>
      </div>

      {/* Right: User actions */}
      <div className="flex items-center gap-x-4">
        <NavbarRoutes 
          userId={user?.id}
          userName={user?.first_name || user?.legal_name}
        />
      </div>
    </div>
  )
}