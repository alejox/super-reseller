"use client";

import { User, Mail, Lock, KeyRound, ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function RegisterForm() {
  const [pending, setPending] = useState(false);

  // For demonstration, since there's no actual backend action yet, we just prevent default.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setTimeout(() => setPending(false), 2000); // Fake delay
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Full Name Field */}
      <div className="space-y-1">
        <label htmlFor="fullName" className="text-xs font-semibold tracking-wider text-[#cbc3d7] ml-1">Nombre Completo</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#958ea0]">
            <User className="h-5 w-5" />
          </div>
          <input 
            type="text" 
            id="fullName" 
            name="fullName" 
            placeholder="Ej. Juan Pérez" 
            required 
            disabled={pending}
            className="block w-full pl-10 pr-3 py-3 bg-[#060e20] border border-[#494454] rounded-lg text-[#dae2fd] placeholder:text-[#958ea0]/50 focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff]/50 transition-all duration-200 outline-none text-sm disabled:opacity-60"
          />
        </div>
      </div>

      {/* Email Field */}
      <div className="space-y-1">
        <label htmlFor="email" className="text-xs font-semibold tracking-wider text-[#cbc3d7] ml-1">Correo Electrónico</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#958ea0]">
            <Mail className="h-5 w-5" />
          </div>
          <input 
            type="email" 
            id="email" 
            name="email" 
            placeholder="tu@correo.com" 
            required 
            disabled={pending}
            className="block w-full pl-10 pr-3 py-3 bg-[#060e20] border border-[#494454] rounded-lg text-[#dae2fd] placeholder:text-[#958ea0]/50 focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff]/50 transition-all duration-200 outline-none text-sm disabled:opacity-60"
          />
        </div>
      </div>

      {/* Grid for Passwords */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Password Field */}
        <div className="space-y-1">
          <label htmlFor="password" className="text-xs font-semibold tracking-wider text-[#cbc3d7] ml-1">Contraseña</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#958ea0]">
              <Lock className="h-5 w-5" />
            </div>
            <input 
              type="password" 
              id="password" 
              name="password" 
              placeholder="••••••••" 
              required 
              disabled={pending}
              className="block w-full pl-10 pr-3 py-3 bg-[#060e20] border border-[#494454] rounded-lg text-[#dae2fd] placeholder:text-[#958ea0]/50 focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff]/50 transition-all duration-200 outline-none text-sm disabled:opacity-60"
            />
          </div>
        </div>

        {/* Confirm Password Field */}
        <div className="space-y-1">
          <label htmlFor="confirmPassword" className="text-xs font-semibold tracking-wider text-[#cbc3d7] ml-1">Confirmar</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#958ea0]">
              <KeyRound className="h-5 w-5" />
            </div>
            <input 
              type="password" 
              id="confirmPassword" 
              name="confirmPassword" 
              placeholder="••••••••" 
              required 
              disabled={pending}
              className="block w-full pl-10 pr-3 py-3 bg-[#060e20] border border-[#494454] rounded-lg text-[#dae2fd] placeholder:text-[#958ea0]/50 focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff]/50 transition-all duration-200 outline-none text-sm disabled:opacity-60"
            />
          </div>
        </div>
      </div>

      {/* Terms & Conditions */}
      <div className="flex items-start mt-4">
        <div className="flex items-center h-5">
          <input 
            id="terms" 
            name="terms" 
            type="checkbox" 
            required 
            disabled={pending}
            className="w-4 h-4 rounded bg-[#060e20] border-[#494454] text-[#d0bcff] focus:ring-[#d0bcff]/50 focus:ring-offset-0 cursor-pointer disabled:opacity-60"
          />
        </div>
        <div className="ml-3 text-sm">
          <label htmlFor="terms" className="text-sm text-[#cbc3d7] cursor-pointer">
            Acepto los <Link href="#" className="text-[#d0bcff] hover:text-[#e9ddff] underline transition-colors">Términos y Condiciones</Link> y la Política de Privacidad.
          </label>
        </div>
      </div>

      {/* Submit Button */}
      <div className="pt-4">
        <button 
          type="submit" 
          disabled={pending}
          className="w-full flex justify-center items-center gap-2 bg-gradient-to-r from-[#8B5CF6] to-[#6d3bd7] text-white py-3 px-4 rounded-lg text-xs font-semibold uppercase tracking-wider hover:opacity-90 active:scale-[0.98] transition-all shadow-[0_0_15px_rgba(139,92,246,0.3)] hover:shadow-[0_0_25px_rgba(139,92,246,0.5)] disabled:opacity-60 disabled:active:scale-100"
        >
          {pending ? "Creando Cuenta..." : "Crear Cuenta"}
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>

      {/* Security Indicator */}
      <div className="flex items-center justify-center gap-2 mt-2 text-[#958ea0]/60">
        <ShieldCheck className="h-4 w-4" />
        <span className="text-[10px] font-semibold uppercase">Encriptación Bancaria Activa</span>
      </div>
    </form>
  );
}
