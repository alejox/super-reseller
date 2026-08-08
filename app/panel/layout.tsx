import { ReactNode } from "react";
import { PlaySquare, LayoutDashboard, Users, Wallet, Headset, Settings, LogOut, Search, Bell, UserCircle } from "lucide-react";
import Link from "next/link";
import { LogoutButton } from "../logout-button"; 

export default function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <div className="antialiased flex bg-[#0b1326] min-h-screen font-sans text-base text-[#dae2fd]">
      {/* SideNavBar */}
      <nav className="w-64 h-full fixed left-0 top-0 bg-[#171f33] flex flex-col p-6 border-r border-[#494454] z-50">
        {/* Header */}
        <div className="mb-12 flex items-center gap-2">
          <PlaySquare className="text-[#d0bcff] h-8 w-8" />
          <div>
            <h1 className="text-2xl font-bold text-[#d0bcff]">StreamPanel</h1>
            <p className="text-xs font-semibold tracking-wider text-[#cbc3d7]">Management Suite</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <ul className="flex flex-col gap-2 flex-grow">
          <li>
            <Link href="#" className="flex items-center gap-4 px-4 py-3 rounded-lg text-[#cbc3d7] hover:text-[#dae2fd] hover:bg-[#2d3449] transition-colors active:scale-95 duration-150 text-base">
              <LayoutDashboard className="h-5 w-5" />
              Dashboard
            </Link>
          </li>
          <li>
            <Link href="#" className="flex items-center gap-4 px-4 py-3 rounded-lg text-[#cbc3d7] hover:text-[#dae2fd] hover:bg-[#2d3449] transition-colors active:scale-95 duration-150 text-base">
              <Users className="h-5 w-5" />
              Reseller Network
            </Link>
          </li>
          <li>
            <Link href="/panel" className="flex items-center gap-4 px-4 py-3 rounded-lg text-[#d0bcff] font-bold border-r-4 border-[#d0bcff] bg-[#a078ff]/10 active:scale-95 duration-150 text-base">
              <PlaySquare className="h-5 w-5 fill-current" />
              Account Inventory
            </Link>
          </li>
          <li>
            <Link href="#" className="flex items-center gap-4 px-4 py-3 rounded-lg text-[#cbc3d7] hover:text-[#dae2fd] hover:bg-[#2d3449] transition-colors active:scale-95 duration-150 text-base">
              <Wallet className="h-5 w-5" />
              Financials
            </Link>
          </li>
          <li>
            <Link href="#" className="flex items-center gap-4 px-4 py-3 rounded-lg text-[#cbc3d7] hover:text-[#dae2fd] hover:bg-[#2d3449] transition-colors active:scale-95 duration-150 text-base">
              <Headset className="h-5 w-5" />
              Support
            </Link>
          </li>
          <li>
            <Link href="#" className="flex items-center gap-4 px-4 py-3 rounded-lg text-[#cbc3d7] hover:text-[#dae2fd] hover:bg-[#2d3449] transition-colors active:scale-95 duration-150 text-base">
              <Settings className="h-5 w-5" />
              Settings
            </Link>
          </li>
        </ul>

        {/* Footer / CTA */}
        <div className="mt-auto flex flex-col gap-4">
          <button className="w-full py-3 bg-gradient-to-r from-[#d0bcff] to-[#a078ff] text-[#3c0091] rounded-lg text-xs font-bold uppercase tracking-wider shadow-[0_0_15px_2px_rgba(139,92,246,0.3)] hover:opacity-90 transition-opacity active:scale-95 duration-150">
            Recharge Credits
          </button>
          
          <div className="flex items-center gap-4 px-4 py-3 rounded-lg text-[#cbc3d7] hover:text-[#dae2fd] hover:bg-[#2d3449] transition-colors active:scale-95 duration-150">
             <LogOut className="h-5 w-5" />
             <LogoutButton />
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="ml-64 flex-1 flex flex-col min-h-screen relative">
        {/* TopNavBar */}
        <header className="bg-[#0b1326] flex justify-between items-center w-full px-10 py-2 sticky top-0 z-40 border-b border-[#494454]">
          <div className="flex-1 flex items-center gap-8">
            <h2 className="text-2xl font-extrabold text-[#d0bcff] md:hidden">StreamPanel</h2>
            <div className="relative w-64 hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#cbc3d7]" />
              <input 
                type="text"
                placeholder="Search services..."
                className="w-full bg-[#2d3449] border border-[#494454] rounded-full py-2 pl-10 pr-4 text-sm text-[#dae2fd] placeholder:text-[#cbc3d7] focus:outline-none focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff] transition-colors"
              />
            </div>
            <nav className="hidden md:flex gap-6 text-xs font-semibold">
              <Link href="#" className="text-[#d0bcff] border-b-2 border-[#d0bcff] pb-1 active:scale-95 duration-200">Overview</Link>
              <Link href="#" className="text-[#cbc3d7] hover:text-[#d0bcff] transition-all active:scale-95 duration-200">History</Link>
              <Link href="#" className="text-[#cbc3d7] hover:text-[#d0bcff] transition-all active:scale-95 duration-200">Analytics</Link>
            </nav>
          </div>
          
          <div className="flex items-center gap-6">
            <button className="hidden md:block px-4 py-2 bg-gradient-to-r from-[#d0bcff] to-[#a078ff] text-[#3c0091] rounded-full text-xs font-bold shadow-[0_0_15px_2px_rgba(139,92,246,0.3)] hover:opacity-90 transition-opacity">
              Add Funds
            </button>
            <button className="hidden md:block px-4 py-2 border border-[#494454] text-[#dae2fd] rounded-full text-xs font-semibold hover:bg-[#2d3449] transition-colors">
              Support
            </button>
            <div className="flex gap-2">
              <button className="p-2 text-[#cbc3d7] hover:text-[#d0bcff] transition-colors rounded-full hover:bg-[#2d3449]">
                <Bell className="h-6 w-6" />
              </button>
              <button className="p-2 text-[#cbc3d7] hover:text-[#d0bcff] transition-colors rounded-full hover:bg-[#2d3449]">
                <UserCircle className="h-6 w-6" />
              </button>
            </div>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}
