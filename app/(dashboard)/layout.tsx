import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Navbar } from "./_components/navbar";
import { Sidebar } from "./_components/sidebar";

const DashboardLayout = async ({
  children
}: {
  children: React.ReactNode;
}) => {
  const user = await getCurrentUser();

  if (user && (!user.legal_name || user.legal_name.trim() === "")) {
    return redirect("/confirm-profile");
  }

  return ( 
    <div className="h-full">
      <div className="h-[80px] fixed inset-x-0 top-0 z-50">
        <Navbar />
      </div>
      <div className="hidden md:flex h-[calc(100vh-80px)] w-56 flex-col fixed top-20 left-0 z-50">
        <Sidebar />
      </div>
      <main className="md:pl-56 pt-[80px] h-full">
        {children}
      </main>
    </div>
   );
}
 
export default DashboardLayout;