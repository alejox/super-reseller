"use client";

import Link from "next/link";
import { 
  ArrowLeft, 
  Download, 
  RotateCcw, 
  CreditCard, 
  Building2, 
  ExternalLink, 
  Film, 
  Headphones, 
  Headset, 
  Mail,
  FileText,
  Edit,
  PlusCircle
} from "lucide-react";

export default function TransactionDetailsPage({ params }: { params: { id: string } }) {
  // Use params.id if dynamic, but hardcoding for the mockup
  const transactionId = "TX-98234-A";

  return (
    <div className="w-full max-w-[1440px] mx-auto p-10 flex flex-col">
      {/* Page Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <Link href="/admin/orders" className="text-[#cbc3d7] hover:text-[#d0bcff] transition-colors flex items-center">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <span className="text-xs font-semibold text-[#cbc3d7] uppercase tracking-wider">Financials / History</span>
          </div>
          <div className="flex items-center gap-6">
            <h2 className="text-3xl font-semibold text-[#dae2fd]">Transaction Details</h2>
            <span className="px-2 py-1 rounded bg-[#4cd7f6]/15 text-[#4cd7f6] text-xs font-bold border border-[#4cd7f6]/30">COMPLETED</span>
          </div>
          <p className="text-base text-[#cbc3d7] mt-1">ID: {transactionId}</p>
        </div>
        
        <div className="flex gap-4 mt-4 md:mt-0">
          <button className="flex items-center gap-2 px-4 py-2 rounded border border-[#494454] text-[#dae2fd] hover:bg-[#2d3449] transition-colors text-xs font-bold uppercase tracking-wider">
            <Download className="w-[18px] h-[18px]" />
            Receipt
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded border border-[#ffb4ab]/50 text-[#ffb4ab] hover:bg-[#ffb4ab]/10 transition-colors text-xs font-bold uppercase tracking-wider">
            <RotateCcw className="w-[18px] h-[18px]" />
            Refund
          </button>
        </div>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (Summary & Billing) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Summary Card (Glassmorphism-lite) */}
          <div className="bg-[#171f33] rounded-xl p-6 border-t border-[#c4c1fb]/20 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-[#d0bcff]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 relative z-10">
              <div>
                <p className="text-xs font-semibold text-[#cbc3d7] mb-1 uppercase tracking-wider">Amount</p>
                <p className="text-2xl font-semibold text-[#4cd7f6]">+$1,500.00</p>
                <p className="text-sm text-[#cbc3d7] mt-1">USD</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#cbc3d7] mb-1 uppercase tracking-wider">Date & Time</p>
                <p className="text-lg text-[#dae2fd] font-medium">Oct 24, 2023</p>
                <p className="text-sm text-[#cbc3d7] mt-1">14:32:01 UTC</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#cbc3d7] mb-1 uppercase tracking-wider">Payment Method</p>
                <div className="flex items-center gap-2 mt-1">
                  <CreditCard className="text-[#cbc3d7] w-5 h-5" />
                  <p className="text-lg text-[#dae2fd] font-medium">Stripe</p>
                </div>
                <p className="text-sm text-[#cbc3d7] mt-1">**** 4242</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#cbc3d7] mb-1 uppercase tracking-wider">Customer</p>
                <div className="flex items-center gap-2 mt-1">
                  <Building2 className="text-[#d0bcff] w-5 h-5" />
                  <p className="text-lg text-[#dae2fd] font-medium truncate">Alpha Streams Inc.</p>
                </div>
                <button className="text-xs font-bold text-[#d0bcff] hover:text-[#e9ddff] transition-colors mt-1 flex items-center gap-1">
                  View Profile <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Billing Information Card */}
          <div className="bg-[#171f33] rounded-xl p-6 border border-[#494454]/30 flex flex-col h-full">
            <h3 className="text-2xl font-semibold text-[#dae2fd] mb-6">Purchase Details</h3>
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#494454]/50">
                    <th className="pb-2 text-xs font-semibold text-[#cbc3d7] uppercase tracking-wider">Item</th>
                    <th className="pb-2 text-xs font-semibold text-[#cbc3d7] uppercase tracking-wider text-right">Qty</th>
                    <th className="pb-2 text-xs font-semibold text-[#cbc3d7] uppercase tracking-wider text-right">Unit Price</th>
                    <th className="pb-2 text-xs font-semibold text-[#cbc3d7] uppercase tracking-wider text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="text-base text-[#dae2fd]">
                  <tr className="border-b border-[#494454]/20 hover:bg-[#2d3449] transition-colors">
                    <td className="py-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded bg-[#222a3d] flex items-center justify-center shrink-0 border border-[#494454]/30">
                        <Film className="text-[#d0bcff] w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium text-[#dae2fd]">Netflix Premium Accounts</p>
                        <p className="text-sm text-[#cbc3d7]">Batch delivery (API)</p>
                      </div>
                    </td>
                    <td className="py-4 text-right">50</td>
                    <td className="py-4 text-right">$25.00</td>
                    <td className="py-4 text-right font-medium">$1,250.00</td>
                  </tr>
                  <tr className="border-b border-[#494454]/20 hover:bg-[#2d3449] transition-colors">
                    <td className="py-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded bg-[#222a3d] flex items-center justify-center shrink-0 border border-[#494454]/30">
                        <Headphones className="text-[#d0bcff] w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium text-[#dae2fd]">Spotify Family Plans</p>
                        <p className="text-sm text-[#cbc3d7]">Auto-renewal disabled</p>
                      </div>
                    </td>
                    <td className="py-4 text-right">10</td>
                    <td className="py-4 text-right">$25.00</td>
                    <td className="py-4 text-right font-medium">$250.00</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Subtotal Section */}
            <div className="mt-6 pt-6 border-t border-[#494454]/50 flex flex-col gap-2 w-full md:w-1/2 ml-auto">
              <div className="flex justify-between text-sm text-[#cbc3d7]">
                <span>Subtotal</span>
                <span>$1,500.00</span>
              </div>
              <div className="flex justify-between text-sm text-[#cbc3d7]">
                <span>Platform Fee (0%)</span>
                <span>$0.00</span>
              </div>
              <div className="flex justify-between text-sm text-[#cbc3d7]">
                <span>Tax</span>
                <span>$0.00</span>
              </div>
              <div className="flex justify-between text-2xl font-semibold text-[#dae2fd] mt-2 pt-2 border-t border-[#494454]/30">
                <span>Total</span>
                <span className="text-[#4cd7f6]">$1,500.00</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (Timeline & Actions) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Timeline Card */}
          <div className="bg-[#171f33] rounded-xl p-6 border border-[#494454]/30 flex-1">
            <h3 className="text-2xl font-semibold text-[#dae2fd] mb-6">Transaction Timeline</h3>
            <div className="relative pl-6 border-l-2 border-[#2d3449] space-y-6">
              
              {/* Event 1 (Completed) */}
              <div className="relative">
                <div className="absolute -left-[31px] bg-[#171f33] p-1 rounded-full">
                  <div className="w-3 h-3 rounded-full bg-[#4cd7f6] ring-4 ring-[#4cd7f6]/20"></div>
                </div>
                <p className="text-xs font-semibold text-[#cbc3d7] mb-1">Oct 24, 14:32:01 UTC</p>
                <p className="text-base text-[#dae2fd] font-medium">Inventory Released</p>
                <p className="text-sm text-[#cbc3d7] mt-1">API credentials dispatched securely.</p>
              </div>
              
              {/* Event 2 (Completed) */}
              <div className="relative">
                <div className="absolute -left-[31px] bg-[#171f33] p-1 rounded-full">
                  <div className="w-3 h-3 rounded-full bg-[#d0bcff] ring-4 ring-[#d0bcff]/20"></div>
                </div>
                <p className="text-xs font-semibold text-[#cbc3d7] mb-1">Oct 24, 14:31:45 UTC</p>
                <p className="text-base text-[#dae2fd] font-medium">Payment Received</p>
                <p className="text-sm text-[#cbc3d7] mt-1">Funds settled via Stripe gateway.</p>
              </div>
              
              {/* Event 3 (Completed) */}
              <div className="relative">
                <div className="absolute -left-[31px] bg-[#171f33] p-1 rounded-full">
                  <div className="w-3 h-3 rounded-full bg-[#cbc3d7] border-2 border-[#171f33]"></div>
                </div>
                <p className="text-xs font-semibold text-[#cbc3d7] mb-1">Oct 24, 14:31:30 UTC</p>
                <p className="text-base text-[#dae2fd] font-medium">Verification in Progress</p>
                <p className="text-sm text-[#cbc3d7] mt-1">Anti-fraud checks passed.</p>
              </div>
              
              {/* Event 4 (Completed) */}
              <div className="relative">
                <div className="absolute -left-[31px] bg-[#171f33] p-1 rounded-full">
                  <div className="w-3 h-3 rounded-full bg-[#cbc3d7] border-2 border-[#171f33]"></div>
                </div>
                <p className="text-xs font-semibold text-[#cbc3d7] mb-1">Oct 24, 14:31:22 UTC</p>
                <p className="text-base text-[#dae2fd] font-medium">Payment Initiated</p>
                <p className="text-sm text-[#cbc3d7] mt-1">Customer confirmed checkout.</p>
              </div>
            </div>
          </div>

          {/* Internal Notes */}
          <div className="bg-[#171f33] rounded-xl p-6 border border-[#494454]/30 flex flex-col gap-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileText className="text-[#d0bcff] w-5 h-5" />
                <h3 className="text-2xl font-semibold text-[#dae2fd]">Internal Notes</h3>
              </div>
              <button className="text-[#cbc3d7] hover:text-[#d0bcff] transition-colors">
                <Edit className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-[#131b2e] p-4 rounded border border-[#494454]/20">
              <p className="text-sm text-[#dae2fd]">Customer requested a change in the delivery email. Verified and updated on Oct 24.</p>
            </div>
            <div className="mt-2">
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Add a note..."
                  className="w-full bg-[#2d3449] border border-[#494454] rounded py-2 px-4 text-sm text-[#dae2fd] placeholder-[#cbc3d7] focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff] outline-none transition-colors" 
                />
                <button className="absolute right-2 top-1/2 -translate-y-1/2 text-[#d0bcff] hover:text-[#e9ddff]">
                  <PlusCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Contact Action */}
          <div className="bg-[#222a3d] rounded-xl p-6 border border-[#494454]/20">
            <div className="flex items-center gap-4 mb-4">
              <Headset className="text-[#d0bcff] w-6 h-6" />
              <h4 className="text-lg text-[#dae2fd] font-medium">Need Assistance?</h4>
            </div>
            <p className="text-sm text-[#cbc3d7] mb-6">Reach out to the customer directly regarding this transaction.</p>
            <button className="w-full py-2 rounded bg-[#2d3449] text-[#dae2fd] hover:bg-[#31394d] transition-colors text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2">
              <Mail className="w-[18px] h-[18px]" />
              Contact Customer
            </button>
          </div>
          
        </div>
      </div>
    </div>
  );
}
