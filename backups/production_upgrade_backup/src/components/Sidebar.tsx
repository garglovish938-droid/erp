"use client";

import { 
  LayoutDashboard, PackageSearch, FolderKanban, ShoppingCart, Users, 
  Settings, LogOut, ArrowLeftRight, Smile, Truck, FileText, BarChart3,
  ClipboardCheck, Receipt, TrendingUp
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (t: string) => void;
  userRole: string;
  onLogout: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, userRole, onLogout }: SidebarProps) {
  // All known roles grouped
  const adminRoles = ["admin"];
  const managerRoles = ["admin", "manager", "hr_manager", "factory_manager", "project_manager"];
  const storeRoles = ["admin", "manager", "store", "store_assistant", "inventory_manager"];
  const accountantRoles = ["admin", "manager", "accountant", "accounts_manager", "purchase_manager"];
  const workerRoles = ["admin", "manager", "store", "accountant", "worker", "operator", "carpenter",
    "hr_manager", "factory_manager", "project_manager", "inventory_manager",
    "purchase_manager", "accounts_manager", "quality_inspector", "store_assistant", "machine_operator"];

  const allMenu = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard,
      roles: workerRoles },
    { id: "visualization", label: "Visualization Center", icon: BarChart3,
      roles: [...managerRoles, ...accountantRoles] },
    { id: "attendance", label: "Attendance", icon: ClipboardCheck,
      roles: workerRoles },
    { id: "inventory", label: "Inventory", icon: PackageSearch,
      roles: [...storeRoles, ...accountantRoles] },
    { id: "projects", label: "Projects", icon: FolderKanban,
      roles: [...managerRoles, "store", "worker", "operator", "carpenter", "quality_inspector", "machine_operator"] },
    { id: "project-progress", label: "Project Progress", icon: TrendingUp,
      roles: workerRoles },
    { id: "requests", label: "Material Requests", icon: ArrowLeftRight,
      roles: [...storeRoles, ...managerRoles] },
    { id: "purchasing", label: "Purchasing", icon: ShoppingCart,
      roles: [...storeRoles, ...accountantRoles] },
    { id: "expense-analytics", label: "Expense Analytics", icon: Receipt,
      roles: [...managerRoles, ...accountantRoles] },
    { id: "crm", label: "CRM (Clients)", icon: Smile,
      roles: [...managerRoles, ...accountantRoles] },
    { id: "suppliers", label: "Suppliers", icon: Truck,
      roles: [...storeRoles, ...managerRoles, ...accountantRoles] },
    { id: "team", label: "Team & HR", icon: Users,
      roles: workerRoles },
    { id: "reports", label: "Reports", icon: FileText,
      roles: [...managerRoles, ...accountantRoles] },
    { id: "settings", label: "Settings", icon: Settings,
      roles: adminRoles },
  ];

  // Filter menu items by user's role
  const menu = allMenu.filter(item => item.roles.includes(userRole));

  return (
    <aside className="w-20 md:w-64 h-full glass border-r border-slate-200 dark:border-slate-800/80 flex flex-col justify-between py-6 transition-all duration-300">
      <div>
        <div className="flex items-center justify-center md:justify-start md:px-6 mb-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
            A
          </div>
          <h1 className="hidden md:block ml-3 font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
            Allure Living
          </h1>
        </div>
        
        <div className="px-6 mb-4 hidden md:block">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Logged as: <span className="text-indigo-600 dark:text-indigo-400">{userRole}</span>
          </div>
        </div>

        <nav className="flex flex-col gap-1 px-3 md:px-4 max-h-[70vh] overflow-y-auto">
          {menu.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex items-center justify-center md:justify-start px-3 py-2.5 rounded-2xl transition-all duration-200 group relative",
                  isActive
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-indigo-900/20"
                    : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50 dark:text-slate-400"
                )}
              >
                <Icon className={cn("w-5 h-5", isActive ? "text-white" : "group-hover:text-indigo-600")} />
                <span className="hidden md:block ml-3 font-medium text-[14px]">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="px-3 md:px-4">
        <button 
          onClick={onLogout}
          className="w-full flex items-center justify-center md:justify-start px-3 py-3 rounded-2xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="hidden md:block ml-3 font-medium text-[14px]">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

