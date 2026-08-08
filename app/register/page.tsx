import type { Metadata } from "next";
import Link from "next/link";
import { Activity, HelpCircle, Zap } from "lucide-react";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "StreamPanel - Crea tu cuenta",
  description: "Únete a la red de reventa de streaming más grande",
};

export default function RegisterPage() {
  return (
    <div 
      className="min-h-screen flex flex-col font-sans antialiased text-[#dae2fd] selection:bg-[#a078ff] selection:text-[#340080]"
      style={{
        backgroundColor: "#0b1326",
        backgroundImage: "radial-gradient(at 0% 0%, rgba(139, 92, 246, 0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(76, 215, 246, 0.1) 0px, transparent 50%)"
      }}
    >
      {/* TopAppBar */}
      <header className="bg-transparent w-full top-0 z-50">
        <div className="flex justify-between items-center w-full py-8 px-6 max-w-7xl mx-auto">
          {/* Brand Logo */}
          <Link href="/" className="text-4xl font-bold tracking-tighter text-[#d0bcff] flex items-center gap-2 hover:opacity-90 transition-opacity">
            <Activity className="h-9 w-9" />
            StreamPanel
          </Link>
          {/* Trailing Action */}
          <Link href="#" className="text-xs font-semibold tracking-wider text-[#d0bcff] hover:text-[#e9ddff] transition-colors flex items-center gap-1 bg-[#171f33] py-2 px-4 rounded-full border border-[#494454]/30 hover:border-[#d0bcff]/50">
            <HelpCircle className="h-4 w-4" />
            Support
          </Link>
        </div>
      </header>

      {/* Main Content Canvas */}
      <main className="flex-grow flex items-center justify-center p-6 relative z-10">
        {/* Glassmorphism Card */}
        <div className="w-full max-w-[480px] bg-[#171f33] rounded-xl border border-[#494454] border-t-[#4cd7f6]/30 shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-12 relative overflow-hidden backdrop-blur-md">
          {/* Ambient Card Glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#d0bcff]/20 rounded-full blur-[64px] pointer-events-none"></div>
          
          {/* Header Section */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-semibold text-[#dae2fd] mb-2">Crea tu cuenta</h1>
            <p className="text-base text-[#cbc3d7]">Únete a la red de reventa de streaming más grande</p>
          </div>

          {/* Signup Form */}
          <RegisterForm />

          {/* Login Link */}
          <div className="mt-8 text-center border-t border-[#494454]/30 pt-6">
            <Link href="/login" className="text-sm text-[#cbc3d7] hover:text-[#d0bcff] transition-colors flex items-center justify-center gap-2">
              ¿Ya tienes cuenta? <span className="text-[#d0bcff] font-semibold">Inicia sesión</span>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-transparent w-full bottom-0 border-t border-[#494454]/10 mt-auto">
        <div className="flex flex-col md:flex-row justify-between items-center w-full py-6 px-6 max-w-7xl mx-auto gap-4">
          {/* Copyright */}
          <div className="text-sm text-[#958ea0]">
            © 2024 StreamPanel. Secure B2B Streaming Solutions.
          </div>
          {/* Links */}
          <nav className="flex gap-6">
            <Link href="#" className="text-sm text-[#958ea0] hover:text-[#c4c1fb] transition-colors opacity-80 hover:opacity-100">Privacy Policy</Link>
            <Link href="#" className="text-sm text-[#958ea0] hover:text-[#c4c1fb] transition-colors opacity-80 hover:opacity-100">Terms of Service</Link>
            <Link href="#" className="text-sm text-[#958ea0] hover:text-[#c4c1fb] transition-colors opacity-80 hover:opacity-100">Help Center</Link>
          </nav>
          {/* Brand Small */}
          <div className="text-xs font-semibold tracking-wider text-[#dae2fd] flex items-center gap-1 opacity-50">
            <Zap className="h-4 w-4" />
            StreamPanel
          </div>
        </div>
      </footer>
    </div>
  );
}
