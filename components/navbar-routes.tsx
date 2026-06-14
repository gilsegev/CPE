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
import { ConfirmModal } from "@/components/modals/confirm-modal";

interface NavbarRoutesProps {
  userId?: string | null;
  userName?: string | null;
}

export const NavbarRoutes = ({ userId, userName }: NavbarRoutesProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const [isCleaning, setIsCleaning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const onDeleteUser = async () => {
    try {
      setIsDeleting(true);
      await axios.post("/api/user/delete");
      toast.success("User account and all data deleted");
      window.location.assign("/sign-up");
    } catch (error) {
      toast.error("Failed to delete user");
    } finally {
      setIsDeleting(false);
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
            <Button size="sm" variant="ghost" className="text-white hover:text-[#e2e7f2] hover:bg-[#2d3a5a]">
              <LogOut className="h-4 w-4 mr-2" />
              Exit
            </Button>
          </Link>
        ) : isTeacher(userId) ? (
          <Link href="/teacher/courses">
            <Button size="sm" variant="ghost" className="text-white hover:text-[#e2e7f2] hover:bg-[#2d3a5a]">
              Teacher mode
            </Button>
          </Link>
        ) : null}

        {userId ? (
          <div className="flex items-center gap-x-4 border-l pl-4 border-[#2d3a5a]">
            {process.env.NODE_ENV !== "production" && (
              <Button
                size="sm"
                variant="outline"
                onClick={onCleanUser}
                disabled={isCleaning || isDeleting}
                className="text-red-400 hover:text-red-300 border-red-900/30 bg-red-950/20 hover:bg-red-950/30"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clean user
              </Button>
            )}
            <ConfirmModal onConfirm={onDeleteUser}>
              <Button
                size="sm"
                variant="destructive"
                disabled={isCleaning || isDeleting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete user
              </Button>
            </ConfirmModal>
            <span className="text-sm font-medium text-[#e2e7f2] hidden md:inline-block">
              Hello, <span className="text-white font-bold">{userName}</span>
            </span>
            <form action={logoutAction}>
              <Button size="sm" variant="ghost" type="submit" className="text-[#e2e7f2] hover:text-white hover:bg-[#2d3a5a]">
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </Button>
            </form>
          </div>
        ) : (
          <div className="flex items-center gap-x-6">
            <Link href="/sign-in" className="text-sm font-semibold text-[#e2e7f2] hover:text-white transition uppercase tracking-wider text-xs">
              Sign in
            </Link>
            <Link href="/sign-up">
              <button className="bg-white hover:bg-slate-100 text-[#18223b] font-bold text-xs tracking-wider uppercase px-5 py-2.5 rounded transition shadow-sm">
                Get Started
              </button>
            </Link>
          </div>
        )}
      </div>
    </>
  );
};