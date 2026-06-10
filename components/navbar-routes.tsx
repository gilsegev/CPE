"use client";

import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { isTeacher } from "@/lib/teacher";
import { logoutAction } from "@/actions/logout";
import { SearchInput } from "./search-input";

interface NavbarRoutesProps {
  userId?: string | null;
  userName?: string | null;
}

export const NavbarRoutes = ({ userId, userName }: NavbarRoutesProps) => {
  const pathname = usePathname();

  const isTeacherPage = pathname?.startsWith("/teacher");
  const isCoursePage = pathname?.includes("/courses");
  const isSearchPage = pathname === "/search";

  return (
    <>
      {isSearchPage && (
        <div className="hidden md:block">
          <SearchInput />
        </div>
      )}
      <div className="flex gap-x-4 ml-auto items-center">
        {isTeacherPage || isCoursePage ? (
          <Link href="/">
            <Button size="sm" variant="ghost">
              <LogOut className="h-4 w-4 mr-2" />
              Exit
            </Button>
          </Link>
        ) : isTeacher(userId) ? (
          <Link href="/teacher/courses">
            <Button size="sm" variant="ghost">
              Teacher mode
            </Button>
          </Link>
        ) : null}

        {userId && (
          <div className="flex items-center gap-x-4 border-l pl-4 border-slate-200">
            <span className="text-sm font-medium text-slate-600 hidden md:inline-block">
              Hello, <span className="text-slate-800 font-semibold">{userName}</span>
            </span>
            <form action={logoutAction}>
              <Button size="sm" variant="ghost" type="submit" className="text-slate-500 hover:text-slate-800">
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </Button>
            </form>
          </div>
        )}
      </div>
    </>
  );
};