import { ReactNode, Suspense } from "react";
import { PlaySquare, LayoutDashboard, Users, MonitorPlay, Wallet, Headset, Settings, LogOut, Search, Bell, UserCircle, Plus } from "lucide-react";
import Link from "next/link";
import { logout } from "@/modules/identity/application/actions";
import { AdminNavigation } from "./admin-views"; 

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="antialiased flex bg-background h-screen overflow-hidden font-sans text-on-surface">
      {/* SideNavBar */}
      <nav className="w-64 h-full fixed left-0 top-0 bg-surface-container flex flex-col p-6 border-r border-outline-variant z-50">
        <div className="mb-12">
          <h1 className="text-[24px] leading-8 font-bold text-primary">StreamPanel</h1>
          <p className="text-[12px] leading-4 font-semibold text-on-surface-variant uppercase mt-1 tracking-wider">Management Suite</p>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <Suspense fallback={<div className="p-4 text-sm text-slate-400">Loading menu...</div>}>
            <AdminNavigation />
          </Suspense>
        </div>
        
        <div className="mt-auto pt-4 space-y-4">
          <button className="w-full py-2 px-4 rounded-lg bg-primary text-on-primary text-xs font-bold uppercase tracking-wider active:scale-95 transition-all duration-150 shadow-[0_0_15px_rgba(208,188,255,0.3)] hover:shadow-[0_0_20px_rgba(208,188,255,0.5)]">
            Recharge Credits
          </button>
          
          <form action={logout}>
            <button className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors active:scale-95 duration-150 text-base">
              <LogOut className="w-5 h-5" />
              <span className="font-semibold text-sm">Logout</span>
            </button>
          </form>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 ml-64 flex flex-col h-full bg-background relative overflow-y-auto">
        {/* TopNavBar */}
        <header className="sticky top-0 z-40 flex justify-between items-center w-full px-10 py-2 bg-surface-container-low border-b border-outline-variant shadow-sm h-16">
          <div className="flex items-center gap-12">
            <div className="relative flex items-center">
              <Search className="absolute left-3 w-5 h-5 text-on-surface-variant" />
              <input 
                className="bg-surface-container border border-outline-variant rounded-full py-1.5 pl-10 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-64 transition-all" 
                placeholder="Search accounts..." 
                type="text"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex space-x-6 h-full items-center hidden md:flex">
              <Link className="text-[12px] font-semibold text-on-surface-variant hover:text-primary transition-all tracking-wide" href="#">Overview</Link>
              <Link className="text-[12px] font-semibold text-on-surface-variant hover:text-primary transition-all tracking-wide" href="#">History</Link>
              <Link className="text-[12px] font-semibold text-on-surface-variant hover:text-primary transition-all tracking-wide" href="#">Analytics</Link>
            </div>
            
            <div className="flex items-center gap-4 ml-4 pl-4 border-l border-outline-variant">
              <button className="text-on-surface-variant hover:text-primary transition-all active:scale-95 duration-200">
                <Bell className="w-6 h-6" />
              </button>
              <button className="text-on-surface-variant hover:text-primary transition-all active:scale-95 duration-200">
                <UserCircle className="w-6 h-6" />
              </button>
              <button className="px-4 py-1.5 rounded-lg border border-primary text-primary text-xs font-bold hover:bg-primary/10 transition-colors active:scale-95 duration-200 hidden lg:block tracking-wide">
                Support
              </button>
              <button className="px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold active:scale-95 duration-200 hidden lg:block tracking-wide shadow-[0_0_15px_rgba(208,188,255,0.3)] hover:shadow-[0_0_20px_rgba(208,188,255,0.5)]">
                Add Funds
              </button>
            </div>
          </div>
        </header>

        {/* Page Content passed as children */}
        {children}
      </main>
    </div>
  );
}
