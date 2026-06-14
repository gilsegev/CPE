"use client";

import { BarChart, Compass, Layout, List, ExternalLink } from "lucide-react";
import { usePathname } from "next/navigation";

import { SidebarItem } from "./sidebar-item";

const guestRoutes = [
  {
    icon: Layout,
    label: "Dashboard",
    href: "/",
  },
  {
    icon: Compass,
    label: "Browse",
    href: "/search",
  },
];

const teacherRoutes = [
  {
    icon: List,
    label: "Courses",
    href: "/teacher/courses",
  },
  {
    icon: BarChart,
    label: "Analytics",
    href: "/teacher/analytics",
  },
]

export const SidebarRoutes = () => {
  const pathname = usePathname();

  const isTeacherPage = pathname?.includes("/teacher");

  const routes = isTeacherPage ? teacherRoutes : guestRoutes;

  return (
    <div className="flex flex-col w-full">
      {routes.map((route) => (
        <SidebarItem
          key={route.href}
          icon={route.icon}
          label={route.label}
          href={route.href}
        />
      ))}

      {/* External Squarespace Links for easy navigation on all devices (especially mobile) */}
      <div className="mt-4 pt-4 border-t border-slate-200">
        <p className="px-6 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Main Website
        </p>
        <a
          href="https://www.guidingdiversity.com/about"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-x-2 text-slate-500 text-sm font-[500] pl-6 py-3 transition-all hover:text-slate-700 hover:bg-slate-300/20"
        >
          <ExternalLink size={20} className="text-slate-400" />
          About
        </a>
        <a
          href="https://www.guidingdiversity.com/services"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-x-2 text-slate-500 text-sm font-[500] pl-6 py-3 transition-all hover:text-slate-700 hover:bg-slate-300/20"
        >
          <ExternalLink size={20} className="text-slate-400" />
          Services
        </a>
        <a
          href="https://www.guidingdiversity.com/blog"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-x-2 text-slate-500 text-sm font-[500] pl-6 py-3 transition-all hover:text-slate-700 hover:bg-slate-300/20"
        >
          <ExternalLink size={20} className="text-slate-400" />
          Blog
        </a>
        <a
          href="https://www.guidingdiversity.com/contact"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-x-2 text-slate-500 text-sm font-[500] pl-6 py-3 transition-all hover:text-slate-700 hover:bg-slate-300/20"
        >
          <ExternalLink size={20} className="text-slate-400" />
          Contact
        </a>
      </div>
    </div>
  )
}