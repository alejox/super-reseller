import type { ComponentPropsWithoutRef } from "react";

/**
 * Replaces the `TH_CLASS`/`TD_CLASS` pair (and the `overflow-x-auto` +
 * `border-collapse` wrapper markup) that every table in the app redeclared.
 * `Table` owns the scroll wrapper so a narrow viewport scrolls the table
 * inside its own box instead of widening the page — every call site already
 * did this by hand, just with copy-pasted classes.
 */

const MIN_WIDTH_CLASS = {
  none: "",
  md: "min-w-md",
  lg: "min-w-lg",
  "2xl": "min-w-2xl",
} as const;

export type TableMinWidth = keyof typeof MIN_WIDTH_CLASS;

type TableProps = Readonly<{ minWidth?: TableMinWidth }> & ComponentPropsWithoutRef<"table">;

export function Table({ minWidth = "md", className = "", children, ...props }: TableProps) {
  return (
    <div className="overflow-x-auto">
      <table
        className={["w-full border-collapse", MIN_WIDTH_CLASS[minWidth], className]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

/** Header row: slightly darker divider than a body row. */
export function Tr({
  head = false,
  className = "",
  ...props
}: Readonly<{ head?: boolean }> & ComponentPropsWithoutRef<"tr">) {
  const base = head
    ? "border-b border-zinc-200 dark:border-zinc-800"
    : "border-b border-zinc-100 last:border-b-0 dark:border-zinc-800";
  return <tr className={[base, className].filter(Boolean).join(" ")} {...props} />;
}

export function Th({ className = "", ...props }: ComponentPropsWithoutRef<"th">) {
  return (
    <th
      className={[
        "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}

export function Td({ className = "", ...props }: ComponentPropsWithoutRef<"td">) {
  return (
    <td
      className={["px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200", className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
