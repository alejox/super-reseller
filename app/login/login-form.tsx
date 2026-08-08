"use client";

import { useActionState, useState } from "react";
import { Mail, Lock, EyeOff, Eye, ArrowRight } from "lucide-react";
import Link from "next/link";
import { login, type LoginFormState } from "@/modules/identity/application/actions";

const INITIAL_STATE: LoginFormState = undefined;

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, INITIAL_STATE);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {/* Email Input */}
      <div className="space-y-2">
        <label htmlFor="email" className="text-xs font-semibold tracking-wider text-[#dae2fd] block">
          Correo Electrónico
        </label>
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#494454]" />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            disabled={pending}
            placeholder="admin@empresa.com"
            aria-describedby={state?.error ? "login-error" : undefined}
            className="w-full bg-[#060e20] text-[#dae2fd] text-base rounded-lg py-3 pl-12 pr-4 border border-[#494454]/30 focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff] focus:outline-none transition-all placeholder:text-[#958ea0]/50"
          />
        </div>
      </div>

      {/* Password Input */}
      <div className="space-y-2">
        <label htmlFor="password" className="text-xs font-semibold tracking-wider text-[#dae2fd] block">
          Contraseña
        </label>
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#494454]" />
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            disabled={pending}
            placeholder="••••••••"
            aria-describedby={state?.error ? "login-error" : undefined}
            className="w-full bg-[#060e20] text-[#dae2fd] text-base rounded-lg py-3 pl-12 pr-12 border border-[#494454]/30 focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff] focus:outline-none transition-all placeholder:text-[#958ea0]/50"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#494454] hover:text-[#d0bcff] transition-colors focus:outline-none"
          >
            {showPassword ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {state?.error ? (
        <p
          id="login-error"
          role="alert"
          className="rounded-lg border border-red-900/50 bg-red-950/40 px-3.5 py-2.5 text-sm text-red-300"
        >
          {state.error}
        </p>
      ) : null}

      {/* Options Row */}
      <div className="flex items-center justify-between pt-2">
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="checkbox"
            className="rounded bg-[#060e20] border-[#494454] text-[#d0bcff] focus:ring-[#d0bcff] focus:ring-offset-[#171f33] w-4 h-4 transition-colors"
          />
          <span className="text-sm text-[#cbc3d7] group-hover:text-[#dae2fd] transition-colors">Recordarme</span>
        </label>
        <Link href="#" className="text-xs font-semibold tracking-wider text-[#d0bcff] hover:text-[#4cd7f6] transition-colors">
          ¿Olvidaste tu contraseña?
        </Link>
      </div>

      {/* Submit Button */}
      <div className="pt-4">
        <button
          type="submit"
          disabled={pending}
          className="w-full bg-gradient-to-r from-[#d0bcff] to-[#6d3bd7] text-[#3c0091] text-xs font-semibold tracking-wider py-4 rounded-lg shadow-[0_4px_20px_rgba(208,188,255,0.15)] hover:shadow-[0_4px_25px_rgba(208,188,255,0.25)] hover:opacity-90 active:scale-[0.98] transition-all flex justify-center items-center gap-2 relative overflow-hidden group disabled:opacity-60 disabled:active:scale-100"
        >
          <span className="relative z-10">{pending ? "Iniciando Sesión..." : "Iniciar Sesión"}</span>
          <ArrowRight className="relative z-10 h-5 w-5" />
          {/* Hover sheen */}
          <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out"></div>
        </button>
      </div>
    </form>
  );
}
