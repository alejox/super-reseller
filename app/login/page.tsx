import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import Link from "next/link";
import { BarChart2, HelpCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "StreamPanel - Iniciar Sesión",
  description: "Acceso al panel de revendedores.",
};

export default function LoginPage() {
  return (
    <div className="bg-[#0b1326] text-[#dae2fd] min-h-screen flex flex-col relative font-sans overflow-x-hidden selection:bg-[#a078ff] selection:text-[#340080]">
      {/* Ambient Background Gradient */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#d0bcff]/5 blur-[120px] rounded-full mix-blend-screen"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-[#4cd7f6]/5 blur-[120px] rounded-full mix-blend-screen"></div>
      </div>

      {/* TopAppBar */}
      <header className="bg-transparent w-full top-0 relative z-20 flex justify-center items-center py-8 px-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-center w-full">
          <div className="flex items-center gap-2">
            <BarChart2 className="text-[#d0bcff] h-8 w-8" />
            <span className="text-4xl font-bold tracking-tighter text-[#d0bcff]">
              StreamPanel
            </span>
          </div>
          <div className="flex items-center">
            <button className="text-sm font-semibold tracking-wider text-[#d0bcff] hover:text-[#e9ddff] transition-colors flex items-center gap-2 px-4 py-2 rounded-full border border-[#d0bcff]/20 hover:bg-[#d0bcff]/10">
              <HelpCircle className="h-5 w-5" />
              Support
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Canvas */}
      <main className="flex-grow flex items-center justify-center p-6 relative z-10 w-full">
        {/* Login Card */}
        <div className="bg-[#171f33] w-full max-w-md rounded-xl border-t border-[#4cd7f6]/20 border border-[#494454]/30 p-12 shadow-2xl relative overflow-hidden backdrop-blur-sm">
          {/* Subtle internal card sheen */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#4cd7f6]/30 to-transparent"></div>
          
          <div className="text-center mb-8">
            <h1 className="text-3xl font-semibold text-[#dae2fd] mb-2">Bienvenido de nuevo</h1>
            <p className="text-sm text-[#cbc3d7]">
              Ingresa tus credenciales para acceder al panel.
            </p>
          </div>

          <LoginForm />

          <div className="mt-12 text-center border-t border-[#494454]/20 pt-8">
            <p className="text-sm text-[#cbc3d7]">
              ¿No tienes cuenta? 
              <Link href="#" className="text-xs font-semibold tracking-wider text-[#d0bcff] hover:text-[#4cd7f6] transition-colors ml-1">
                Regístrate
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-transparent w-full bottom-0 z-20 mt-auto">
        <div className="flex flex-col md:flex-row justify-between items-center w-full py-6 px-6 gap-4 border-t border-[#494454]/10">
          <div className="text-xs font-semibold tracking-wider text-[#dae2fd] flex items-center gap-2 opacity-80">
            <BarChart2 className="h-4 w-4" />
            StreamPanel
          </div>
          <div className="text-sm text-[#958ea0]">
            © 2024 StreamPanel. Secure B2B Streaming Solutions.
          </div>
          <nav className="flex items-center gap-6">
            <Link href="#" className="text-sm text-[#958ea0] hover:text-[#c4c1fb] transition-colors opacity-80 hover:opacity-100">Privacy Policy</Link>
            <Link href="#" className="text-sm text-[#958ea0] hover:text-[#c4c1fb] transition-colors opacity-80 hover:opacity-100">Terms of Service</Link>
            <Link href="#" className="text-sm text-[#958ea0] hover:text-[#c4c1fb] transition-colors opacity-80 hover:opacity-100">Help Center</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
