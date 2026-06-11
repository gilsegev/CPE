"use client";

import { usePathname, useRouter } from "next/navigation";
import { LogOut, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";
import axios from "axios";

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
  const router = useRouter();
  const [isCleaning, setIsCleaning] = useState(false);

  const isTeacherPage = pathname?.startsWith("/teacher");
  const isCoursePage = pathname?.includes("/courses");
  const isSearchPage = pathname === "/search";

  const onCleanUser = async () => {
    try {
      setIsCleaning(true);
      await axios.post("/api/user/clean");
      toast.success("User progress and enrollments cleared");
      window.location.assign("/");
    } catch (error) {
      toast.error("Failed to clean user");
    } finally {
      setIsCleaning(false);
    }
  };

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

        {userId ? (
          <div className="flex items-center gap-x-4 border-l pl-4 border-slate-200">
            <Button
              size="sm"
              variant="outline"
              onClick={onCleanUser}
              disabled={isCleaning}
              className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clean user
            </Button>
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
        ) : (
          <Link href="/sign-in">
            <Button size="sm" variant="outline" className="border-slate-300 text-slate-700 hover:text-slate-900">
              Sign in
            </Button>
          </Link>
        )}
      </div>
    </>
  );
};