/**
 * Replaces the `FIELD_CLASS` constant duplicated across every form file
 * (catalog, resellers, customers, the customer detail on-behalf form, and
 * the account provider-account form). `/account` and `/admin` had zero
 * `dark:` variants on this class before this refactor.
 */
export const FIELD_CLASS =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-emerald-400 dark:focus:ring-emerald-900/40";

/**
 * The compact variant for controls rendered inline in a table row/cell
 * (price, top-up amount, memo, fulfilment note) — same behavior, smaller
 * footprint, no focus ring (the row is already the visual unit).
 */
export const COMPACT_FIELD_CLASS =
  "rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-950 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-emerald-400";

/**
 * Label + control wrapper. The control is passed as `children` rather than
 * rendered by `Field` itself, because every call site's `<input>`/`<select>`
 * carries its own `name`, `required`, `type`, etc. that a generic wrapper
 * would have to re-forward anyway — nesting keeps the exact same implicit
 * label association (`<label><span/>{control}</label>`) every call site
 * already relied on, with no `htmlFor`/`id` pair to keep in sync.
 */
export function Field({
  label,
  className = "",
  children,
}: Readonly<{ label: string; className?: string; children: React.ReactNode }>) {
  return (
    <label className={["block", className].filter(Boolean).join(" ")}>
      <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {label}
      </span>
      {children}
    </label>
  );
}
