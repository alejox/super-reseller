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
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6">
            <span className="text-lg font-semibold text-zinc-700">Revendedores</span>
            <p className="mt-2 text-sm leading-6 text-zinc-500">La gestión de cuentas llegará en una próxima etapa.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

export function AdminCatalogView() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-8 sm:px-8 sm:py-12">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Catálogo</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">Gestión del catálogo</h1>
        <p className="max-w-2xl text-zinc-600">Revise el espacio del catálogo antes de conectar los controles de gestión.</p>
      </header>
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-zinc-950">Los controles del catálogo aún no están disponibles</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600">Los controles de creación y edición aún no están disponibles. Esta pantalla no simula datos del catálogo.</p>
        <Link className="mt-6 inline-flex rounded-lg bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800" href="/admin">
          Volver al panel
        </Link>
      </section>
    </main>
  );
}
