"use client";

import { useState, useEffect } from "react";
import { 
  CheckCircle, 
  Copy, 
  Eye, 
  EyeOff, 
  User, 
  ExternalLink, 
  Download, 
  HelpCircle 
} from "lucide-react";
import Image from "next/image";

export default function AccountDeliveryPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);

  const email = "user492@stream-resell.net";
  const password = "Str3amP@ss!99";

  // Simple confetti effect
  useEffect(() => {
    const container = document.getElementById('confetti-container');
    if (!container) return;
    
    const colors = ['#d0bcff', '#4cd7f6', '#c4c1fb'];
    
    for(let i = 0; i < 50; i++) {
      const conf = document.createElement('div');
      conf.style.position = 'absolute';
      conf.style.width = '10px';
      conf.style.height = '10px';
      conf.style.opacity = '0';
      conf.style.left = Math.random() * 100 + 'vw';
      conf.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      conf.style.animation = `fall ${Math.random() * 3 + 2}s linear forwards`;
      conf.style.animationDelay = `${Math.random() * 0.5}s`;
      container.appendChild(conf);
    }
  }, []);

  const handleCopy = (text: string, type: 'email' | 'pass') => {
    navigator.clipboard.writeText(text);
    if (type === 'email') {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } else {
      setCopiedPass(true);
      setTimeout(() => setCopiedPass(false), 2000);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center relative overflow-hidden min-h-[calc(100vh-80px)] p-6">
      {/* Confetti Container */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden" id="confetti-container"></div>
      
      <div className="w-full max-w-3xl z-10 relative">
        {/* Success Banner */}
        <div className="mb-8 bg-[#009eb9]/20 border border-[#4cd7f6]/30 rounded-lg p-4 flex items-center gap-4">
          <CheckCircle className="text-[#4cd7f6] w-6 h-6" />
          <div>
            <h3 className="text-xl font-semibold text-[#4cd7f6]">Purchase Successful</h3>
            <p className="text-sm text-[#cbc3d7]">Your new service credentials are ready to use.</p>
          </div>
        </div>
        
        {/* Main Card */}
        <div className="bg-[#171f33] rounded-xl border-t border-[#FFFFFF] border-opacity-10 shadow-lg overflow-hidden flex flex-col md:flex-row">
          
          {/* Service Branding Side */}
          <div className="md:w-1/3 bg-[#131b2e] p-8 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-[#494454] relative">
            <div 
              className="absolute inset-0 opacity-20 bg-cover bg-center" 
              style={{backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAN6WmLD9nsTYpBYzLRtqDSPtTH7Ki4FlNl09UsHDbXllZ9_pbVQj-es3qWI7kyVyEXLojSGDyI-iSiskcx1NZkw-ALjyeBjW6XKfGPtK8sTQfeaHQyUP4GK4k_EGKtjr04uGfs2DgmwQj4beH9Ne1b6X2DJ7Q-U_ULzg1YQyFjRipNci7VzKJARBc-BxfXREDGysmLue3E_DhzNeIs_NGEU8U5p0acoEMFTCXxVMrwgjb8Kf3-dix2')"}}
            ></div>
            <div className="w-24 h-24 mb-4 relative z-10 rounded-full border-2 border-[#494454] overflow-hidden bg-[#0b1326] flex items-center justify-center shadow-lg">
              {/* Fallback styling for image in case URL doesn't work */}
              <div className="text-[#4cd7f6] font-bold text-xl">PV</div>
            </div>
            <h2 className="text-2xl md:text-3xl font-semibold text-[#dae2fd] text-center relative z-10">Prime Video</h2>
            <span className="mt-2 inline-block px-2 py-1 bg-[#4cd7f6]/15 text-[#4cd7f6] text-xs font-bold rounded relative z-10">Premium Plan</span>
          </div>
          
          {/* Credentials Side */}
          <div className="md:w-2/3 p-8 flex flex-col justify-between">
            <div>
              <h3 className="text-2xl font-semibold text-[#dae2fd] mb-6">Access Credentials</h3>
              <div className="space-y-6">
                
                {/* Email */}
                <div className="bg-[#0b1326] p-4 rounded border border-[#494454] focus-within:border-[#d0bcff] focus-within:shadow-[0_0_10px_rgba(139,92,246,0.2)] transition-all">
                  <label className="text-xs font-bold text-[#cbc3d7] block mb-1 uppercase tracking-wider">Email / Username</label>
                  <div className="flex items-center justify-between">
                    <span className="text-base text-[#dae2fd] font-mono">{email}</span>
                    <button 
                      onClick={() => handleCopy(email, 'email')}
                      className={`${copiedEmail ? 'text-[#4cd7f6]' : 'text-[#d0bcff] hover:text-[#e9ddff]'} p-1 rounded hover:bg-[#171f33] transition-colors`} 
                      title="Copy Email"
                    >
                      {copiedEmail ? <CheckCircle className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                
                {/* Password */}
                <div className="bg-[#0b1326] p-4 rounded border border-[#494454] focus-within:border-[#d0bcff] focus-within:shadow-[0_0_10px_rgba(139,92,246,0.2)] transition-all">
                  <label className="text-xs font-bold text-[#cbc3d7] block mb-1 uppercase tracking-wider">Password</label>
                  <div className="flex items-center justify-between">
                    <span className="text-base text-[#dae2fd] font-mono tracking-widest">
                      {showPassword ? password : "••••••••••••"}
                    </span>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-[#cbc3d7] hover:text-[#dae2fd] p-1 rounded hover:bg-[#171f33] transition-colors" 
                        title="Toggle Visibility"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                      <button 
                        onClick={() => handleCopy(password, 'pass')}
                        className={`${copiedPass ? 'text-[#4cd7f6]' : 'text-[#d0bcff] hover:text-[#e9ddff]'} p-1 rounded hover:bg-[#171f33] transition-colors`} 
                        title="Copy Password"
                      >
                        {copiedPass ? <CheckCircle className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Profile */}
                <div className="bg-[#0b1326] p-4 rounded border border-[#494454] flex items-center gap-4">
                  <User className="text-[#c4c1fb] w-6 h-6" />
                  <div>
                    <label className="text-[10px] font-bold text-[#cbc3d7] block uppercase tracking-wider">Assigned Profile</label>
                    <span className="text-base text-[#c4c1fb] font-bold">Profile 3</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Security & Actions */}
            <div className="mt-8">
              <div className="bg-[#93000a]/10 border border-[#ffb4ab]/20 rounded p-4 mb-6">
                <ul className="text-sm text-[#ffb4ab]/90 space-y-1 list-disc pl-4">
                  <li>Do not change password or email.</li>
                  <li>Only use your assigned profile.</li>
                  <li>Warranty: 30 days.</li>
                </ul>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <button className="flex-1 bg-gradient-to-r from-[#8B5CF6] to-[#6d3bd7] text-[#dae2fd] text-xs font-bold py-4 px-6 rounded shadow-[0_0_15px_rgba(139,92,246,0.3)] hover:shadow-[0_0_20px_rgba(139,92,246,0.5)] transition-all flex justify-center items-center gap-2 uppercase tracking-wider">
                  <span>Go to Prime Video</span>
                  <ExternalLink className="w-4 h-4" />
                </button>
                <button className="flex-1 border border-[#494454] text-[#cbc3d7] text-xs font-bold py-4 px-6 rounded hover:bg-[#171f33] hover:text-[#dae2fd] transition-all flex justify-center items-center gap-2 uppercase tracking-wider">
                  <Download className="w-4 h-4" />
                  <span>Warranty PDF</span>
                </button>
                <button className="sm:flex-none border border-transparent text-[#cbc3d7] p-4 rounded hover:bg-[#171f33] hover:text-[#dae2fd] transition-all flex justify-center items-center" title="Contact Support">
                  <HelpCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
            
          </div>
        </div>
      </div>
      
      {/* Global CSS for the animation */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fall {
          0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
        }
      `}} />
    </div>
  );
}
