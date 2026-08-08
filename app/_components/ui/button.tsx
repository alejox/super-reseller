import type { ButtonHTMLAttributes } from "react";

/**
 * The shared button look for all three panels. `primary` (solid emerald) is
 * the one true call-to-action color across `/panel`, `/account` and
 * `/admin` — previously emerald appeared on exactly one button in the whole
 * app. `secondary` keeps the solid zinc treatment for less prominent
 * create/manage actions (e.g. marking an order delivered). `outline` is the
 * small bordered control used inline in table rows (top-up, save price,
 * fulfil).
 *
 * `buttonVariants` is exported separately because several call sites must
 * stay a plain `<button type="submit">` inside a `useActionState` form with
 * `disabled={pending}` wired directly — swapping those to the `<Button>`
 * component would work too (it forwards every native prop, `disabled`
 * included), but the class-string escape hatch is here for wherever it reads
 * clearer to keep the raw element.
 */
export type ButtonVariant = "primary" | "secondary" | "outline";
export type ButtonSize = "md" | "sm";

const BASE_CLASS =
  "inline-flex items-center justify-center font-semibold transition disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:focus-visible:outline-emerald-400";

const SIZE_CLASS: Readonly<Record<ButtonSize, string>> = {
  md: "rounded-lg px-4 py-2 text-sm",
  sm: "rounded-md px-2.5 py-1 text-xs",
};

const VARIANT_CLASS: Readonly<Record<ButtonVariant, string>> = {
  primary:
    "bg-emerald-700 text-white hover:bg-emerald-800 disabled:bg-zinc-400 dark:bg-emerald-600 dark:hover:bg-emerald-500 dark:disabled:bg-zinc-700",
  secondary:
    "bg-zinc-950 text-white hover:bg-zinc-800 disabled:bg-zinc-400 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white dark:disabled:bg-zinc-700",
  outline:
    "border border-zinc-300 text-zinc-700 hover:bg-zinc-50 disabled:text-zinc-400 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:disabled:text-zinc-600",
};

export function buttonVariants({
  variant = "primary",
  size = "md",
  className = "",
}: Readonly<{ variant?: ButtonVariant; size?: ButtonSize; className?: string }> = {}): string {
  return [BASE_CLASS, SIZE_CLASS[size], VARIANT_CLASS[variant], className]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> &
  Readonly<{ variant?: ButtonVariant; size?: ButtonSize }>) {
  return <button className={buttonVariants({ variant, size, className })} {...props} />;
}
