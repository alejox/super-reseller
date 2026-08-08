import type { ComponentPropsWithoutRef, ElementType } from "react";

/**
 * Replaces the `SECTION_CLASS` constant that ~9 workspace/detail files each
 * redeclared verbatim. Exported as a class string too, because the loading
 * fallbacks (`*WorkspaceFallback`) need `${CARD_CLASS} animate-pulse` rather
 * than a real `<Card>` around skeleton bars.
 */
export const CARD_CLASS =
  "rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8";

type CardProps<T extends ElementType> = Readonly<{
  as?: T;
  className?: string;
}> &
  Omit<ComponentPropsWithoutRef<T>, "as" | "className">;

/**
 * Polymorphic only so call sites that need `<section aria-labelledby=…>`
 * (every workspace heading) and call sites that just need a `<div>`
 * (skeletons, the purchase/on-behalf sub-sections) can both use it without
 * an extra wrapper element.
 */
export function Card<T extends ElementType = "div">({
  as,
  className = "",
  ...props
}: CardProps<T>) {
  const Component = (as ?? "div") as ElementType;
  return <Component className={[CARD_CLASS, className].filter(Boolean).join(" ")} {...props} />;
}
