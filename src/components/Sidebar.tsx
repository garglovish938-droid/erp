"use client";

import { 
  LayoutDashboard, PackageSearch, FolderKanban, ShoppingCart, Users, 
  Settings, LogOut, ArrowLeftRight, Smile, Truck, FileText, BarChart3,
  ClipboardCheck, Receipt, ChevronLeft, ChevronRight, X, Archive, Landmark, IndianRupee
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (t: string) => void;
  userRole: string;
  onLogout: () => void;
  collapsed: boolean;
  setCollapsed: (c: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (o: boolean) => void;
}

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  userRole, 
  onLogout,
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen
}: SidebarProps) {
  // All known roles grouped
  const adminRoles = ["admin"];
  const managerRoles = ["admin", "manager", "hr_manager", "factory_manager", "project_manager"];
  const storeRoles = ["admin", "manager", "store", "store_assistant", "inventory_manager"];
  const accountantRoles = ["admin", "manager", "accountant", "accounts_manager", "purchase_manager"];
  const workerRoles = ["admin", "manager", "store", "accountant", "worker", "operator", "carpenter",
    "hr_manager", "factory_manager", "project_manager", "inventory_manager",
    "purchase_manager", "accounts_manager", "quality_inspector", "store_assistant", "machine_operator"];

  const allMenu = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, roles: workerRoles },
    { id: "inventory", label: "Inventory", icon: PackageSearch, roles: [...storeRoles, ...accountantRoles] },
    { id: "requests", label: "Material Request", icon: ArrowLeftRight, roles: [...storeRoles, ...managerRoles] },
    { id: "purchasing", label: "Purchase Management", icon: ShoppingCart, roles: [...storeRoles, ...accountantRoles] },
    { id: "daily-expenses", label: "Daily Expenses", icon: Receipt, roles: workerRoles },
    { id: "factory-fund", label: "Factory Fund", icon: Landmark, roles: accountantRoles },
    { id: "project-payments", label: "Project Payments", icon: IndianRupee, roles: accountantRoles },
    { id: "projects", label: "Projects", icon: FolderKanban, roles: [...managerRoles, "store", "worker", "operator", "carpenter", "quality_inspector", "machine_operator"] },
    { id: "attendance", label: "Attendance", icon: ClipboardCheck, roles: workerRoles },
    { id: "team", label: "Employees", icon: Users, roles: workerRoles },
    { id: "crm", label: "Clients", icon: Smile, roles: [...managerRoles, ...accountantRoles] },
    { id: "reports", label: "Reports", icon: FileText, roles: [...managerRoles, ...accountantRoles] },
    { id: "archive", label: "Archive Registry", icon: Archive, roles: managerRoles },
    { id: "settings", label: "Settings", icon: Settings, roles: adminRoles },
  ];

  // Filter menu items by user's role
  const menu = allMenu.filter(item => item.roles.includes(userRole));

  return (
    <aside className={cn(
      "h-full glass border-r border-slate-200 dark:border-slate-800/80 flex flex-col justify-between py-6 transition-all duration-300 relative z-50",
      "fixed inset-y-0 left-0 lg:static lg:translate-x-0",
      mobileOpen ? "translate-x-0 w-64 shadow-2xl" : "-translate-x-full w-64 lg:w-auto",
      collapsed ? "lg:w-20" : "lg:w-64"
    )}>
      {/* Collapse Toggle Button for Desktop */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hidden lg:flex items-center justify-center w-6 h-6 rounded-full border border-slate-200 dark:border-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 absolute -right-3 top-20 bg-white dark:bg-slate-900 z-50 shadow-md focus:outline-none"
        title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>

      {/* Close Button for Mobile Drawer */}
      <button
        onClick={() => setMobileOpen(false)}
        className="lg:hidden flex items-center justify-center p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 absolute right-4 top-5 focus:outline-none"
        aria-label="Close Sidebar"
      >
        <X className="w-5 h-5" />
      </button>

      <div>
        <div className={cn(
          "flex items-center mb-10 px-6",
          collapsed ? "lg:justify-center lg:px-0" : "justify-start"
        )}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-lg flex-shrink-0">
            A
          </div>
          <h1 className={cn(
            "ml-3 font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 transition-opacity duration-200",
            collapsed ? "lg:hidden" : "block"
          )}>
            Allure Living
          </h1>
        </div>
        
        <div className={cn("px-6 mb-4", collapsed ? "lg:hidden" : "block")}>
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Logged as: <span className="text-indigo-600 dark:text-indigo-400">{userRole}</span>
          </div>
        </div>

        <nav className="flex flex-col gap-1 px-3 max-h-[70vh] overflow-y-auto">
          {menu.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex items-center py-2.5 rounded-2xl transition-all duration-200 group relative w-full",
                  collapsed ? "lg:justify-center lg:px-0" : "justify-start px-3",
                  isActive
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-indigo-900/20"
                    : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50 dark:text-slate-400"
                )}
              >
                <Icon className={cn("w-5 h-5 flex-shrink-0", isActive ? "text-white" : "group-hover:text-indigo-600")} />
                <span className={cn("ml-3 font-medium text-[14px] transition-opacity duration-200", collapsed ? "lg:hidden" : "block")}>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="px-3">
        <button 
          onClick={onLogout}
          className={cn(
            "w-full flex items-center py-3 rounded-2xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors",
            collapsed ? "lg:justify-center lg:px-0" : "justify-start px-3"
          )}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <span className={cn("ml-3 font-medium text-[14px]", collapsed ? "lg:hidden" : "block")}>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
