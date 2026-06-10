import { NavbarRoutes } from "@/components/navbar-routes"
import { getCurrentUser } from "@/lib/auth"
import { MobileSidebar } from "./mobile-sidebar"

export const Navbar = async () => {
  const user = await getCurrentUser();

  return (
    <div className="p-4 border-b h-full flex items-center bg-white shadow-sm">
      <MobileSidebar />
      <NavbarRoutes 
        userId={user?.id}
        userName={user?.first_name || user?.legal_name}
      />
    </div>
  )
}