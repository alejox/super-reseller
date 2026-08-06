import { logout } from "@/modules/identity/application/actions";
import { AdminNavigation } from "./admin-views";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950 lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="border-b border-zinc-200 bg-white px-5 py-4 lg:flex lg:min-h-screen lg:flex-col lg:border-b-0 lg:border-r lg:px-4 lg:py-6">
        <div className="flex items-center justify-between gap-4 lg:block">
          <Brand />
          <form action={logout} className="lg:hidden">
            <button className="text-sm font-medium text-zinc-600" type="submit">Cerrar sesión</button>
          </form>
        </div>
        <div className="mt-4 overflow-x-auto lg:mt-8"><AdminNavigation /></div>
        <form action={logout} className="mt-auto hidden pt-8 lg:block">
          <button className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-left text-sm font-medium text-zinc-600 hover:bg-zinc-50" type="submit">Cerrar sesión</button>
        </form>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Brand() {
  return <div><p className="text-lg font-semibold tracking-tight">Revendedores</p><p className="text-xs text-zinc-500">Administración</p></div>;
}
