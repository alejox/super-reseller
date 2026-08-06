import Link from "next/link";

export function AdminNavigation() {
  return (
    <nav aria-label="Navegación de administración" className="flex gap-1 lg:flex-col">
      <Link className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-zinc-100" href="/admin">
        Inicio
      </Link>
      <Link className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-zinc-100" href="/admin/catalog">
        Catálogo
      </Link>
      <Link className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-zinc-100" href="/admin/resellers">
        Revendedores
      </Link>
    </nav>
  );
}

export function AdminDashboardView() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-8 sm:px-8 sm:py-12">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Resumen</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">Panel de administración</h1>
        <p className="max-w-2xl text-zinc-600">Configure el catálogo de productos antes de incorporar revendedores.</p>
      </header>
      <section aria-labelledby="workspace-heading" className="space-y-4">
        <h2 id="workspace-heading" className="text-sm font-semibold text-zinc-500">Espacio de trabajo</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link className="group rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md" href="/admin/catalog">
            <span className="text-lg font-semibold text-zinc-950 group-hover:text-emerald-700">Catálogo</span>
            <p className="mt-2 text-sm leading-6 text-zinc-600">La configuración del catálogo está disponible</p>
            <span className="mt-6 inline-block text-sm font-semibold text-emerald-700">Abrir catálogo →</span>
          </Link>
          <Link className="group rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md" href="/admin/resellers">
            <span className="text-lg font-semibold text-zinc-950 group-hover:text-emerald-700">Revendedores</span>
            <p className="mt-2 text-sm leading-6 text-zinc-600">Cuentas y su nivel de precio</p>
            <span className="mt-6 inline-block text-sm font-semibold text-emerald-700">Abrir revendedores →</span>
          </Link>
        </div>
      </section>
    </main>
  );
}

/**
 * The static half of the catalog screen. Kept free of session and database
 * reads so it can prerender while the workspace streams in behind Suspense.
 */
export function AdminCatalogHeader() {
  return (
    <header className="space-y-2">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Catálogo</p>
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">Gestión del catálogo</h1>
      <p className="max-w-2xl text-zinc-600">Defina los niveles de precio y los servicios antes de cargar los planes.</p>
    </header>
  );
}
