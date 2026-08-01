import { logout } from "@/modules/identity/application/actions";

/**
 * A plain form, not an onClick handler: logging out is a mutation, and a
 * form POST keeps it working without JavaScript.
 */
export function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        Cerrar sesión
      </button>
    </form>
  );
}
