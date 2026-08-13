"use client";

import { useState } from "react";
import { 
  Key, 
  Eye, 
  EyeOff, 
  Link as LinkIcon, 
  Copy, 
  ChevronDown, 
  Sliders, 
  Save,
  Badge
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function GatewaysSettingsPage() {
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [activeGateway, setActiveGateway] = useState<string>("binance"); // defaulting to binance to match mockup

  return (
    <div className="w-full max-w-[1440px] mx-auto p-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-semibold text-[#dae2fd] mb-1">Configuración de Pasarelas de Pago</h2>
          <p className="text-sm text-[#cbc3d7]">Gestiona y configura los métodos de pago disponibles para tus revendedores.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/settings/topups"
            className="px-4 py-2 rounded-lg bg-[#222a3d] border border-[#494454] text-[#dae2fd] hover:bg-[#31394d] transition-colors text-xs font-bold uppercase tracking-wider"
          >
            Límites de Recarga
          </Link>
          <Link
            href="/admin/settings/withdrawals"
            className="px-4 py-2 rounded-lg bg-[#222a3d] border border-[#494454] text-[#dae2fd] hover:bg-[#31394d] transition-colors text-xs font-bold uppercase tracking-wider"
          >
            Configuración de Retiros
          </Link>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Gateways Grid (Left/Top) */}
        <div className="lg:col-span-4 space-y-4">
          <h3 className="text-2xl font-semibold text-[#dae2fd] mb-4">Proveedores</h3>
          
          {/* Stripe Card */}
          <div 
            onClick={() => setActiveGateway('stripe')}
            className={`border rounded-xl p-4 cursor-pointer transition-colors relative overflow-hidden group ${activeGateway === 'stripe' ? 'bg-[#444173]/20 border-[#d0bcff]' : 'bg-[#171f33] border-[#494454] hover:border-[#958ea0]'}`}
          >
            {activeGateway === 'stripe' && (
              <div className="absolute inset-0 bg-gradient-to-br from-[#d0bcff]/10 to-transparent opacity-50"></div>
            )}
            <div className="relative flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-lg bg-white flex items-center justify-center p-2 ${activeGateway !== 'stripe' ? 'opacity-70' : ''}`}>
                  <div className="text-[#6772E5] font-bold text-xl">S</div>
                </div>
                <div>
                  <h4 className={`text-lg font-semibold ${activeGateway === 'stripe' ? 'text-[#dae2fd]' : 'text-[#cbc3d7]'}`}>Stripe</h4>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${activeGateway === 'stripe' ? 'text-[#4cd7f6] bg-[#4cd7f6]/10' : 'text-[#cbc3d7] bg-[#222a3d]'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${activeGateway === 'stripe' ? 'bg-[#4cd7f6]' : 'bg-[#958ea0]'}`}></span> 
                    {activeGateway === 'stripe' ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={activeGateway === 'stripe'} readOnly />
                <div className={`w-11 h-6 bg-[#222a3d] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${activeGateway === 'stripe' ? 'peer-checked:bg-[#d0bcff] after:bg-white' : 'after:bg-[#958ea0]'}`}></div>
              </label>
            </div>
            <button className={`w-full py-2 rounded-lg text-xs font-bold transition-colors relative z-10 ${activeGateway === 'stripe' ? 'bg-[#d0bcff]/20 text-[#d0bcff] group-hover:bg-[#d0bcff]/30' : 'bg-[#222a3d] text-[#cbc3d7] hover:bg-[#31394d]'}`}>
              {activeGateway === 'stripe' ? 'Configurando' : 'Configurar'}
            </button>
          </div>
          
          {/* PayPal Card */}
          <div 
            onClick={() => setActiveGateway('paypal')}
            className={`border rounded-xl p-4 cursor-pointer transition-colors relative overflow-hidden group ${activeGateway === 'paypal' ? 'bg-[#444173]/20 border-[#d0bcff]' : 'bg-[#171f33] border-[#494454] hover:border-[#958ea0]'}`}
          >
            {activeGateway === 'paypal' && (
              <div className="absolute inset-0 bg-gradient-to-br from-[#d0bcff]/10 to-transparent opacity-50"></div>
            )}
            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-lg bg-white flex items-center justify-center p-2 ${activeGateway !== 'paypal' ? 'opacity-70' : ''}`}>
                  <div className="text-[#003087] font-bold text-xl italic">P</div>
                </div>
                <div>
                  <h4 className={`text-lg font-semibold ${activeGateway === 'paypal' ? 'text-[#dae2fd]' : 'text-[#cbc3d7]'}`}>PayPal</h4>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${activeGateway === 'paypal' ? 'text-[#4cd7f6] bg-[#4cd7f6]/10' : 'text-[#cbc3d7] bg-[#222a3d]'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${activeGateway === 'paypal' ? 'bg-[#4cd7f6]' : 'bg-[#958ea0]'}`}></span> 
                    {activeGateway === 'paypal' ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={activeGateway === 'paypal'} readOnly />
                <div className={`w-11 h-6 bg-[#222a3d] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${activeGateway === 'paypal' ? 'peer-checked:bg-[#d0bcff] after:bg-white' : 'after:bg-[#958ea0]'}`}></div>
              </label>
            </div>
            <button className={`w-full py-2 rounded-lg text-xs font-bold transition-colors relative z-10 ${activeGateway === 'paypal' ? 'bg-[#d0bcff]/20 text-[#d0bcff] group-hover:bg-[#d0bcff]/30' : 'bg-[#222a3d] text-[#cbc3d7] hover:bg-[#31394d]'}`}>
              {activeGateway === 'paypal' ? 'Configurando' : 'Configurar'}
            </button>
          </div>
          
          {/* Mercado Pago Card */}
          <div 
            onClick={() => setActiveGateway('mercadopago')}
            className={`border rounded-xl p-4 cursor-pointer transition-colors relative overflow-hidden group ${activeGateway === 'mercadopago' ? 'bg-[#444173]/20 border-[#d0bcff]' : 'bg-[#171f33] border-[#494454] hover:border-[#958ea0]'}`}
          >
            {activeGateway === 'mercadopago' && (
              <div className="absolute inset-0 bg-gradient-to-br from-[#d0bcff]/10 to-transparent opacity-50"></div>
            )}
            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-lg bg-white flex items-center justify-center p-2 ${activeGateway !== 'mercadopago' ? 'opacity-70' : ''}`}>
                  <div className="text-[#009EE3] font-bold text-xl">mp</div>
                </div>
                <div>
                  <h4 className={`text-lg font-semibold ${activeGateway === 'mercadopago' ? 'text-[#dae2fd]' : 'text-[#cbc3d7]'}`}>Mercado Pago</h4>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${activeGateway === 'mercadopago' ? 'text-[#4cd7f6] bg-[#4cd7f6]/10' : 'text-[#cbc3d7] bg-[#222a3d]'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${activeGateway === 'mercadopago' ? 'bg-[#4cd7f6]' : 'bg-[#958ea0]'}`}></span> 
                    {activeGateway === 'mercadopago' ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={activeGateway === 'mercadopago'} readOnly />
                <div className={`w-11 h-6 bg-[#222a3d] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${activeGateway === 'mercadopago' ? 'peer-checked:bg-[#d0bcff] after:bg-white' : 'after:bg-[#958ea0]'}`}></div>
              </label>
            </div>
            <button className={`w-full py-2 rounded-lg text-xs font-bold transition-colors relative z-10 ${activeGateway === 'mercadopago' ? 'bg-[#d0bcff]/20 text-[#d0bcff] group-hover:bg-[#d0bcff]/30' : 'bg-[#222a3d] text-[#cbc3d7] hover:bg-[#31394d]'}`}>
              {activeGateway === 'mercadopago' ? 'Configurando' : 'Configurar'}
            </button>
          </div>

          {/* Binance Pay Card */}
          <div 
            onClick={() => setActiveGateway('binance')}
            className={`border rounded-xl p-4 cursor-pointer transition-colors relative overflow-hidden group ${activeGateway === 'binance' ? 'bg-[#444173]/20 border-[#d0bcff]' : 'bg-[#171f33] border-[#494454] hover:border-[#958ea0]'}`}
          >
            {activeGateway === 'binance' && (
              <div className="absolute inset-0 bg-gradient-to-br from-[#d0bcff]/10 to-transparent opacity-50"></div>
            )}
            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-lg bg-white flex items-center justify-center p-2 ${activeGateway !== 'binance' ? 'opacity-70' : ''}`}>
                  <div className="w-full h-full bg-[#2d3449] rounded flex items-center justify-center text-[10px] text-[#cbc3d7] font-bold">BINANCE</div>
                </div>
                <div>
                  <h4 className={`text-lg font-semibold ${activeGateway === 'binance' ? 'text-[#dae2fd]' : 'text-[#cbc3d7]'}`}>Binance Pay</h4>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${activeGateway === 'binance' ? 'text-[#4cd7f6] bg-[#4cd7f6]/10' : 'text-[#cbc3d7] bg-[#222a3d]'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${activeGateway === 'binance' ? 'bg-[#4cd7f6]' : 'bg-[#958ea0]'}`}></span> 
                    {activeGateway === 'binance' ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={activeGateway === 'binance'} readOnly />
                <div className={`w-11 h-6 bg-[#222a3d] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${activeGateway === 'binance' ? 'peer-checked:bg-[#d0bcff] after:bg-white' : 'after:bg-[#958ea0]'}`}></div>
              </label>
            </div>
            <button className={`w-full py-2 rounded-lg text-xs font-bold transition-colors relative z-10 ${activeGateway === 'binance' ? 'bg-[#d0bcff]/20 text-[#d0bcff] group-hover:bg-[#d0bcff]/30' : 'bg-[#222a3d] text-[#cbc3d7] hover:bg-[#31394d]'}`}>
              {activeGateway === 'binance' ? 'Configurando' : 'Configurar'}
            </button>
          </div>

        </div>
        
        {/* Configuration Panel (Right/Bottom) */}
        <div className="lg:col-span-8">
          {activeGateway === 'stripe' ? (
            <div className="bg-[#0b1326] border-t border-[#4cd7f6]/30 rounded-xl p-6 md:p-8 shadow-2xl relative overflow-hidden backdrop-blur-sm bg-opacity-90">
              {/* Subtle decorative background element */}
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#d0bcff]/10 rounded-full blur-3xl pointer-events-none"></div>
              
              <div className="flex items-center justify-between border-b border-[#494454]/50 pb-4 mb-6 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center p-1">
                    <div className="text-[#6772E5] font-bold text-lg">S</div>
                  </div>
                  <h3 className="text-2xl font-semibold text-[#dae2fd]">Configuración de Stripe</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#4cd7f6] text-xs font-bold bg-[#4cd7f6]/10 px-3 py-1 rounded-full flex items-center gap-1 border border-[#4cd7f6]/20">
                    <span className="material-symbols-outlined text-[14px]">shield</span> Seguro
                  </span>
                </div>
              </div>
              
              <form className="space-y-6 relative z-10" onSubmit={(e) => e.preventDefault()}>
                
                {/* API Keys */}
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold text-[#cbc3d7] uppercase tracking-wider">Credenciales API</h4>
                  
                  <div>
                    <label className="block text-[#cbc3d7] text-xs font-bold mb-1.5">Clave Pública (Publishable Key)</label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-[#958ea0] w-4 h-4" />
                      <input 
                        type="text" 
                        defaultValue="pk_live_51*****************************************"
                        className="w-full bg-[#2d3449] border border-[#494454] rounded-lg py-2.5 pl-9 pr-4 text-[#dae2fd] text-sm focus:outline-none focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff] transition-colors font-mono" 
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-[#cbc3d7] text-xs font-bold mb-1.5">Clave Secreta (Secret Key)</label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-[#958ea0] w-4 h-4" />
                      <input 
                        type={showSecretKey ? "text" : "password"} 
                        defaultValue="sk_live_51*****************************************"
                        className="w-full bg-[#2d3449] border border-[#494454] rounded-lg py-2.5 pl-9 pr-10 text-[#dae2fd] text-sm focus:outline-none focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff] transition-colors font-mono" 
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowSecretKey(!showSecretKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#958ea0] hover:text-[#d0bcff] transition-colors"
                      >
                        {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-[#cbc3d7] text-xs font-bold mb-1.5">URL de Webhook (Endpoint)</label>
                    <div className="flex">
                      <div className="relative flex-1">
                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-[#958ea0] w-4 h-4" />
                        <input 
                          type="text" 
                          readOnly 
                          value="https://api.streampanel.io/v1/webhooks/stripe"
                          className="w-full bg-[#060e20] border border-[#494454] rounded-l-lg py-2.5 pl-9 pr-4 text-[#cbc3d7] text-sm focus:outline-none opacity-80 cursor-not-allowed" 
                        />
                      </div>
                      <button 
                        type="button" 
                        className="px-4 bg-[#222a3d] border-y border-r border-[#494454] rounded-r-lg text-[#dae2fd] hover:bg-[#31394d] transition-colors flex items-center justify-center"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-[#cbc3d7] text-[11px] mt-1 opacity-70">Añade esta URL en tu panel de desarrollador de Stripe para recibir eventos.</p>
                  </div>
                </div>
                
                <hr className="border-[#494454]/30" />
                
                {/* Settings */}
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold text-[#cbc3d7] uppercase tracking-wider">Ajustes Generales</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[#cbc3d7] text-xs font-bold mb-1.5">Moneda de Liquidación</label>
                      <div className="relative">
                        <select className="w-full bg-[#2d3449] border border-[#494454] rounded-lg py-2.5 pl-3 pr-8 text-[#dae2fd] text-sm focus:outline-none focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff] transition-colors appearance-none">
                          <option value="USD">USD - Dólar Estadounidense</option>
                          <option value="EUR">EUR - Euro</option>
                          <option value="MXN">MXN - Peso Mexicano</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-[#958ea0] w-4 h-4 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>
                
                <hr className="border-[#494454]/30" />
                
                {/* Advanced Settings */}
                <div className="space-y-4 bg-[#060e20]/50 p-4 rounded-xl border border-[#494454]/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Sliders className="text-[#d0bcff] w-4 h-4" />
                    <h4 className="text-[#d0bcff] font-semibold uppercase tracking-wider text-xs">Configuración Avanzada</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[#cbc3d7] text-xs font-bold mb-1.5">Comisión Transacción (%)</label>
                      <input 
                        type="number" 
                        step="0.1" 
                        defaultValue="2.9"
                        className="w-full bg-[#2d3449] border border-[#494454] rounded-lg py-2 pl-3 pr-3 text-[#dae2fd] text-sm focus:outline-none focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff] transition-colors" 
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[#cbc3d7] text-xs font-bold mb-1.5">Límites de recarga</label>
                      <Link
                        href="/admin/settings/topups"
                        className="flex items-center justify-between w-full bg-[#2d3449] border border-[#494454] rounded-lg py-2 px-3 text-[#dae2fd] text-sm hover:border-[#d0bcff] transition-colors"
                      >
                        <span>Configurar mínimo y máximo</span>
                        <span className="text-[11px] text-[#cbc3d7]">Se aplican en el servidor</span>
                      </Link>
                    </div>
                  </div>
                </div>
                
                <div className="pt-4 flex justify-end gap-3 border-t border-[#494454]/30 mt-6">
                  <button 
                    type="button" 
                    className="px-5 py-2.5 rounded-lg border border-[#494454] text-[#dae2fd] hover:bg-[#2d3449] transition-colors text-xs font-bold uppercase tracking-wider"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="button" 
                    className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-[#d0bcff] to-[#6d3bd7] text-[#3c0091] hover:opacity-90 transition-opacity shadow-[0_4px_14px_0_rgba(139,92,246,0.39)] text-xs font-bold uppercase tracking-wider flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Guardar Cambios
                  </button>
                </div>
              </form>
            </div>
          ) : activeGateway === 'binance' ? (
            <div className="bg-[#0b1326] border-t border-[#4cd7f6]/30 rounded-xl p-6 md:p-8 shadow-2xl relative overflow-hidden backdrop-blur-sm bg-opacity-90">
              {/* Subtle decorative background element */}
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#d0bcff]/10 rounded-full blur-3xl pointer-events-none"></div>
              
              <div className="flex items-center justify-between border-b border-[#494454]/50 pb-4 mb-6 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center p-1">
                    <div className="w-full h-full bg-[#2d3449] rounded flex items-center justify-center text-[8px] text-[#cbc3d7] font-bold">BINANCE</div>
                  </div>
                  <h3 className="text-2xl font-semibold text-[#dae2fd]">Configuración de Binance Pay</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#4cd7f6] text-xs font-bold bg-[#4cd7f6]/10 px-3 py-1 rounded-full flex items-center gap-1 border border-[#4cd7f6]/20">
                    <span className="material-symbols-outlined text-[14px]">shield</span> Seguro
                  </span>
                </div>
              </div>
              
              <form className="space-y-6 relative z-10" onSubmit={(e) => e.preventDefault()}>
                
                {/* API Keys */}
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold text-[#cbc3d7] uppercase tracking-wider">Credenciales de Binance</h4>
                  
                  <div>
                    <label className="block text-[#cbc3d7] text-xs font-bold mb-1.5">Binance API Key</label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-[#958ea0] w-4 h-4" />
                      <input 
                        type="text" 
                        placeholder="Introduce tu API Key"
                        className="w-full bg-[#2d3449] border border-[#494454] rounded-lg py-2.5 pl-9 pr-4 text-[#dae2fd] text-sm focus:outline-none focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff] transition-colors font-mono placeholder-[#958ea0]" 
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-[#cbc3d7] text-xs font-bold mb-1.5">Binance Secret Key</label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-[#958ea0] w-4 h-4" />
                      <input 
                        type={showSecretKey ? "text" : "password"} 
                        placeholder="••••••••••••••••"
                        className="w-full bg-[#2d3449] border border-[#494454] rounded-lg py-2.5 pl-9 pr-10 text-[#dae2fd] text-sm focus:outline-none focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff] transition-colors font-mono placeholder-[#958ea0]" 
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowSecretKey(!showSecretKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#958ea0] hover:text-[#d0bcff] transition-colors"
                      >
                        {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-[#cbc3d7] text-xs font-bold mb-1.5">Merchant ID</label>
                    <div className="relative">
                      <Badge className="absolute left-3 top-1/2 -translate-y-1/2 text-[#958ea0] w-4 h-4" />
                      <input 
                        type="text" 
                        placeholder="Introduce tu Merchant ID"
                        className="w-full bg-[#2d3449] border border-[#494454] rounded-lg py-2.5 pl-9 pr-4 text-[#dae2fd] text-sm focus:outline-none focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff] transition-colors font-mono placeholder-[#958ea0]" 
                      />
                    </div>
                  </div>
                </div>
                
                <hr className="border-[#494454]/30" />
                
                {/* Settings */}
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold text-[#cbc3d7] uppercase tracking-wider">Ajustes Generales</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[#cbc3d7] text-xs font-bold mb-1.5">Moneda de Liquidación</label>
                      <div className="relative">
                        <select className="w-full bg-[#2d3449] border border-[#494454] rounded-lg py-2.5 pl-3 pr-8 text-[#dae2fd] text-sm focus:outline-none focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff] transition-colors appearance-none">
                          <option value="USD">USD - Dólar Estadounidense</option>
                          <option value="EUR">EUR - Euro</option>
                          <option value="MXN">MXN - Peso Mexicano</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-[#958ea0] w-4 h-4 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>
                
                <hr className="border-[#494454]/30" />
                
                {/* Advanced Settings */}
                <div className="space-y-4 bg-[#060e20]/50 p-4 rounded-xl border border-[#494454]/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Sliders className="text-[#d0bcff] w-4 h-4" />
                    <h4 className="text-[#d0bcff] font-semibold uppercase tracking-wider text-xs">Configuración Avanzada</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[#cbc3d7] text-xs font-bold mb-1.5">Comisión Transacción (%)</label>
                      <input 
                        type="number" 
                        step="0.1" 
                        defaultValue="2.9"
                        className="w-full bg-[#2d3449] border border-[#494454] rounded-lg py-2 pl-3 pr-3 text-[#dae2fd] text-sm focus:outline-none focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff] transition-colors" 
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[#cbc3d7] text-xs font-bold mb-1.5">Límites de recarga</label>
                      <Link
                        href="/admin/settings/topups"
                        className="flex items-center justify-between w-full bg-[#2d3449] border border-[#494454] rounded-lg py-2 px-3 text-[#dae2fd] text-sm hover:border-[#d0bcff] transition-colors"
                      >
                        <span>Configurar mínimo y máximo</span>
                        <span className="text-[11px] text-[#cbc3d7]">Se aplican en el servidor</span>
                      </Link>
                    </div>
                  </div>
                </div>
                
                <div className="pt-4 flex justify-end gap-3 border-t border-[#494454]/30 mt-6">
                  <button 
                    type="button" 
                    className="px-5 py-2.5 rounded-lg border border-[#494454] text-[#dae2fd] hover:bg-[#2d3449] transition-colors text-xs font-bold uppercase tracking-wider"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="button" 
                    className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-[#d0bcff] to-[#6d3bd7] text-[#3c0091] hover:opacity-90 transition-opacity shadow-[0_4px_14px_0_rgba(139,92,246,0.39)] text-xs font-bold uppercase tracking-wider flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Guardar Cambios
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-[#0b1326] border border-[#494454] rounded-xl p-16 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-[#171f33] rounded-full flex items-center justify-center mb-6">
                <Sliders className="w-10 h-10 text-[#494454]" />
              </div>
              <h3 className="text-xl font-semibold text-[#dae2fd] mb-2">Configurar {activeGateway}</h3>
              <p className="text-[#cbc3d7] max-w-sm">
                Esta pasarela de pago actualmente no está configurada. Haz clic en el botón de abajo para comenzar.
              </p>
              <button className="mt-8 px-6 py-2.5 rounded-lg bg-[#222a3d] border border-[#494454] text-[#dae2fd] hover:bg-[#31394d] transition-colors text-xs font-bold uppercase tracking-wider">
                Iniciar Configuración
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
