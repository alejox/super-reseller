/**
 * Presentational shell for the two placeholder panels. Split out because
 * Cache Components prerenders the STATIC part of a route and streams the
 * rest: this grid is the static half, and the session data that fills it
 * arrives from a `<Suspense>`-wrapped child.
 */
export function PanelGrid({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 text-sm dark:border-zinc-800 dark:bg-zinc-800 sm:grid-cols-2">
      {children}
    </dl>
  );
}

export function PanelField({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white p-4 dark:bg-zinc-950">
      <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="mt-1 font-mono text-xs break-all text-zinc-900 dark:text-zinc-50">{value}</dd>
    </div>
  );
}

/** Placeholder shown while the session is verified against the database. */
export function PanelSkeleton() {
  return (
    <PanelGrid>
      {["", ""].map((_, index) => (
        <div key={index} className="bg-white p-4 dark:bg-zinc-950">
          <div className="h-4 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="mt-2 h-4 w-40 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
        </div>
      ))}
    </PanelGrid>
  );
}
