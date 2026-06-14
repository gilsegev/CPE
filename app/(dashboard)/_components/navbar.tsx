import { NavbarRoutes } from "@/components/navbar-routes"
import { getCurrentUser } from "@/lib/auth"
import { MobileSidebar } from "./mobile-sidebar"
import { Logo } from "./logo"
import Link from "next/link"

export const Navbar = async () => {
  const user = await getCurrentUser();

  return (
    <div className="px-6 border-b border-[#2d3a5a] h-full flex items-center bg-[#18223b] text-white shadow-md justify-between">
      {/* Left: Mobile trigger & Logo */}
      <div className="flex items-center gap-x-4">
        <MobileSidebar />
        <Link href="/" className="hover:opacity-90 transition flex items-center">
          <Logo />
        </Link>
      </div>

      {/* Middle: Squarespace Navigation Links (hidden on mobile/tablet) */}
      <div className="hidden lg:flex items-center gap-x-8 text-sm font-medium">
        <a 
          href="https://www.guidingdiversity.com/about" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-[#e2e7f2] hover:text-white transition font-sans uppercase tracking-wider text-xs font-semibold"
        >
          About
        </a>
        <a 
          href="https://www.guidingdiversity.com/services" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-[#e2e7f2] hover:text-white transition font-sans uppercase tracking-wider text-xs font-semibold"
        >
          Services
        </a>
        <a 
          href="https://www.guidingdiversity.com/blog" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-[#e2e7f2] hover:text-white transition font-sans uppercase tracking-wider text-xs font-semibold"
        >
          Blog
        </a>
        <a 
          href="https://www.guidingdiversity.com/contact" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-[#e2e7f2] hover:text-white transition font-sans uppercase tracking-wider text-xs font-semibold"
        >
          Contact
        </a>
        <Link 
          href="/search" 
          className="text-white border-b-2 border-sky-400 pb-1 font-sans uppercase tracking-wider text-xs font-bold"
        >
          CPE Courses
        </Link>
      </div>

      {/* Right: User actions & Login */}
      <div className="flex items-center gap-x-4">
        <NavbarRoutes 
          userId={user?.id}
          userName={user?.first_name || user?.legal_name}
        />
      </div>
    </div>
  )
}