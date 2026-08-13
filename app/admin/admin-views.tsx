"use client";

import Link from "next/link";

import {
  LayoutDashboard,
  Users,
  MonitorPlay,
  Wallet,
  Headset,
  Settings,
  ShieldCheck,
  Tags
} from "lucide-react";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Reseller Network", href: "/admin/resellers", icon: Users },
  { name: "Pagos por validar", href: "/admin/payments", icon: ShieldCheck },
  // Restored: `/admin/catalog` spent the redesign as a live route with no way
  // to reach it. It sits above Account Inventory because it is what inventory
  // is stocked AGAINST — services, plans and prices are defined here first.
  { name: "Catálogo", href: "/admin/catalog", icon: Tags },
  { name: "Account Inventory", href: "/admin/inventory", icon: MonitorPlay },
  { name: "Financials", href: "/admin/orders", icon: Wallet },
  { name: "Support", href: "/admin/support", icon: Headset },
  { name: "Settings", href: "/admin/settings", icon: Settings },
] as const;

/**
 * Whether `href` is the section the current path belongs to.
 *
 * A prefix match, so a sub-route highlights its own section: `/admin/orders/
 * <id>` lights up Financials, `/admin/inventory/upload` lights up Account
 * Inventory, `/admin/settings/topups` lights up Settings. All three were dark
 * before, because the old check was an exact `===` — the nav simply stopped
 * highlighting anything the moment you clicked into a detail page.
 *
 * `/admin` is the one exception and has to be: as a prefix it matches every
 * route in the panel, so Dashboard would be permanently active.
 */
function isSectionActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNavigation() {
  // `?? ""` because `usePathname()` is typed `string` but really can return
  // null — outside a router context, and during the brief window before the
  // client router mounts. The `startsWith` above would throw on it, taking
  // the whole admin shell down with it rather than just losing a highlight.
  const pathname = usePathname() ?? "";

  return (
    <ul className="flex flex-col gap-2">
      {NAV_ITEMS.map((item) => {
        const isActive = isSectionActive(pathname, item.href);
        const Icon = item.icon;

        return (
          <li key={item.name}>
            <Link
              // The active item was marked by colour alone, which says nothing
              // to a screen reader — and nothing to a test either, unless it
              // asserts Tailwind classes, which is how the last one rotted.
              aria-current={isActive ? "page" : undefined}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-base transition-colors active:scale-95 duration-150 ${
                isActive 
                  ? "text-primary font-bold border-r-4 border-primary bg-primary-container/10" 
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-semibold text-sm">{item.name}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

import { Plus, Banknote, Store, Users as UsersIcon, Ticket, MoreVertical, CheckCircle2 } from "lucide-react";

export function AdminDashboardView() {
  return (
    <div className="mx-auto flex w-full flex-col p-6 lg:p-10 gap-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-semibold text-on-surface">Overview</h2>
          <p className="text-sm text-on-surface-variant mt-1">Global statistics and recent network activity.</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-container-high border border-outline-variant text-on-surface text-xs font-semibold tracking-wide hover:bg-surface-container-highest transition-colors">
            <Plus className="w-[18px] h-[18px]" />
            Add New Service
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary-container text-on-secondary-container text-xs font-semibold tracking-wide hover:bg-secondary-fixed transition-colors">
            <ShieldCheck className="w-[18px] h-[18px]" />
            Verify Payment
          </button>
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Stat Card 1 */}
        <div className="bg-surface-container-high/60 backdrop-blur-md rounded-xl p-6 border-t border-t-tertiary-fixed-dim/30 flex flex-col justify-between h-32 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/10 rounded-full blur-xl group-hover:bg-primary/20 transition-all"></div>
          <div className="flex justify-between items-start z-10">
            <p className="text-xs font-semibold tracking-wider text-on-surface-variant">Total Revenue</p>
            <Banknote className="w-5 h-5 text-tertiary" />
          </div>
          <div className="z-10">
            <h3 className="text-3xl font-bold text-on-surface">$124,592.00</h3>
            <p className="text-sm text-tertiary flex items-center gap-1 mt-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              +14.5% from last month
            </p>
          </div>
        </div>

        {/* Stat Card 2 */}
        <div className="bg-surface-container-high/60 backdrop-blur-md rounded-xl p-6 border-t border-t-primary/30 flex flex-col justify-between h-32 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/10 rounded-full blur-xl group-hover:bg-primary/20 transition-all"></div>
          <div className="flex justify-between items-start z-10">
            <p className="text-xs font-semibold tracking-wider text-on-surface-variant">Active Resellers</p>
            <Store className="w-5 h-5 text-primary" />
          </div>
          <div className="z-10">
            <h3 className="text-3xl font-bold text-on-surface">3,204</h3>
            <p className="text-sm text-primary flex items-center gap-1 mt-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              +2.1% this week
            </p>
          </div>
        </div>

        {/* Stat Card 3 */}
        <div className="bg-surface-container-high/60 backdrop-blur-md rounded-xl p-6 border-t border-t-secondary/30 flex flex-col justify-between h-32 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-secondary/10 rounded-full blur-xl group-hover:bg-secondary/20 transition-all"></div>
          <div className="flex justify-between items-start z-10">
            <p className="text-xs font-semibold tracking-wider text-on-surface-variant">Total Clients</p>
            <UsersIcon className="w-5 h-5 text-secondary" />
          </div>
          <div className="z-10">
            <h3 className="text-3xl font-bold text-on-surface">45,892</h3>
            <p className="text-sm text-on-surface-variant mt-1">Across all networks</p>
          </div>
        </div>

        {/* Stat Card 4 */}
        <div className="bg-surface-container-high/60 backdrop-blur-md rounded-xl p-6 border-t border-t-error/30 flex flex-col justify-between h-32 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-error/10 rounded-full blur-xl group-hover:bg-error/20 transition-all"></div>
          <div className="flex justify-between items-start z-10">
            <p className="text-xs font-semibold tracking-wider text-on-surface-variant">Pending Tickets</p>
            <Ticket className="w-5 h-5 text-error" />
          </div>
          <div className="z-10">
            <h3 className="text-3xl font-bold text-on-surface">18</h3>
            <p className="text-sm text-error flex items-center gap-1 mt-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              3 high priority
            </p>
          </div>
        </div>
      </div>

      {/* Lower Section Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Area (Spans 2 cols) */}
        <div className="lg:col-span-2 bg-surface-container-high/60 backdrop-blur-md rounded-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-semibold text-on-surface">Monthly Sales Growth</h3>
            <button className="p-2 rounded-lg hover:bg-surface-container-highest transition-colors text-on-surface-variant">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
          {/* Placeholder for Chart */}
          <div className="w-full h-64 bg-surface-container-low rounded-lg border border-outline-variant flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent"></div>
            <div className="absolute bottom-0 left-0 right-0 h-32 opacity-50" style={{ backgroundImage: "url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIHByZXNlcnZlQXNwZWN0UmF0aW89Im5vbmUiPjxwYXRoIGQ9Ik0wLDEwMCBDMjAsNTAgNTAsODAgMTAwLDIwIEwxMDAsMTAwIFoiIGZpbGw9InJnYmEoMjA4LCAxODgsIDI1NSwgMC4yKSIvPjwvc3ZnPg==')", backgroundRepeat: 'no-repeat', backgroundSize: 'cover', backgroundPosition: 'bottom' }}></div>
            <p className="text-sm text-on-surface-variant z-10">[Chart Visualization Area]</p>
          </div>
        </div>

        {/* Activity Table (Spans 1 col) */}
        <div className="bg-surface-container-high/60 backdrop-blur-md rounded-xl p-0 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-outline-variant flex justify-between items-center bg-surface-container/50">
            <h3 className="text-2xl font-semibold text-on-surface">Recent Reseller Activity</h3>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[300px]">
            <table className="w-full text-left border-collapse">
              <tbody>
                <tr className="border-b border-outline-variant hover:bg-surface-container-highest/50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-tertiary-container flex items-center justify-center text-on-tertiary-container text-xs font-bold">JD</div>
                      <div>
                        <p className="text-base text-on-surface">John Doe</p>
                        <p className="text-xs font-semibold tracking-wider text-on-surface-variant">Purchased 50 Credits</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <p className="text-sm text-tertiary">+$250.00</p>
                    <p className="text-xs font-semibold tracking-wider text-on-surface-variant">2 mins ago</p>
                  </td>
                </tr>
                <tr className="border-b border-outline-variant hover:bg-surface-container-highest/50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container text-xs font-bold">AS</div>
                      <div>
                        <p className="text-base text-on-surface">Alpha Streams</p>
                        <p className="text-xs font-semibold tracking-wider text-on-surface-variant">New Account Created</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <span className="inline-block px-2 py-1 rounded bg-secondary/15 text-secondary text-xs font-bold">Active</span>
                    <p className="text-xs font-semibold tracking-wider text-on-surface-variant mt-1">15 mins ago</p>
                  </td>
                </tr>
                <tr className="border-b border-outline-variant hover:bg-surface-container-highest/50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-error-container flex items-center justify-center text-on-error-container text-xs font-bold">TS</div>
                      <div>
                        <p className="text-base text-on-surface">Tech Support</p>
                        <p className="text-xs font-semibold tracking-wider text-on-surface-variant">Ticket #492 Closed</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-right flex flex-col items-end">
                    <CheckCircle2 className="w-[18px] h-[18px] text-on-surface-variant" />
                    <p className="text-xs font-semibold tracking-wider text-on-surface-variant mt-1">1 hr ago</p>
                  </td>
                </tr>
                <tr className="hover:bg-surface-container-highest/50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container text-xs font-bold">MR</div>
                      <div>
                        <p className="text-base text-on-surface">Media Resell</p>
                        <p className="text-xs font-semibold tracking-wider text-on-surface-variant">Service Renewed</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <p className="text-sm text-tertiary">+$120.00</p>
                    <p className="text-xs font-semibold tracking-wider text-on-surface-variant">3 hrs ago</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The static half of the catalog screen. Kept free of session and database
 * reads so it can prerender while the workspace streams in behind Suspense.
 */
export function AdminCatalogHeader() {
  return (
    <header className="space-y-2">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#9D72FF]">
        Catálogo
      </p>
      <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        Gestión del catálogo
      </h1>
      <p className="max-w-2xl text-slate-400">
        Defina los niveles de precio y los servicios antes de cargar los planes.
      </p>
    </header>
  );
}
