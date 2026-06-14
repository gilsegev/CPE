import { SidebarRoutes } from "./sidebar-routes"

export const Sidebar = () => {
  return (
    <div className="h-full border-r flex flex-col overflow-y-auto bg-white shadow-sm">
      <div className="flex flex-col w-full pt-4">
        <SidebarRoutes />
      </div>
    </div>
  )
}