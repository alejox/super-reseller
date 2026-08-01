import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Ingresar",
  description: "Acceso al panel de revendedores.",
};

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-black">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span
            aria-hidden="true"
            className="flex size-11 items-center justify-center rounded-xl bg-zinc-900 text-lg font-semibold text-white dark:bg-zinc-50 dark:text-zinc-900"
          >
            R
          </span>
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Ingresa a tu panel
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Usa las credenciales que te entregó el administrador.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-zinc-500 dark:text-zinc-500">
          ¿Olvidaste tu contraseña? Escríbele al administrador.
        </p>
      </div>
    </main>
  );
}
