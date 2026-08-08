"use client";

import { Search, Filter, MoreVertical, Edit, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { InventoryActions } from "./inventory-actions";
import { useState } from "react";
import type { InventoryAccountRow } from "@/modules/inventory/infrastructure/drizzle-inventory-repository";

type EnrichedAccount = InventoryAccountRow & {
  service: any;
  assignedUser: any;
};

export function AccountInventoryClient({ 
  accounts,
  services
}: { 
  accounts: EnrichedAccount[];
  services: readonly { id: string; name: string }[];
}) {
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const togglePassword = (id: string) => {
    setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="p-10 max-w-[1440px] mx-auto w-full space-y-12">
      {/* Header Section */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-bold text-[#dae2fd]">Account Inventory</h2>
          <p className="text-lg text-[#cbc3d7] mt-2">Manage your streaming service stock and assigned accounts.</p>
        </div>
        <InventoryActions services={services} />
      </div>

      {/* Stock Overview Bento Grid */}
      <div>
        <h3 className="text-2xl font-semibold text-[#dae2fd] mb-6 flex items-center gap-2">
          <svg className="w-6 h-6 text-[#d0bcff]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          Stock Overview
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Netflix Card */}
          <div className="bg-[#171f33] rounded-xl p-6 border-t border-[#4cd7f6] relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-red-600/10 rounded-full blur-xl group-hover:bg-red-600/20 transition-all"></div>
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="text-[32px] leading-10 font-bold text-red-500">N</div>
              <span className="px-2 py-1 bg-[#4cd7f6]/10 text-[#4cd7f6] rounded text-[12px] font-semibold tracking-wider">High Demand</span>
            </div>
            <h4 className="text-lg text-[#dae2fd] mb-1">Netflix Premium</h4>
            <div className="flex items-end gap-4 mt-4 relative z-10">
              <div>
                <div className="text-[12px] font-semibold tracking-wider text-[#cbc3d7] uppercase">Available</div>
                <div className="text-[32px] leading-10 font-semibold text-[#4cd7f6]">142</div>
              </div>
              <div className="w-px h-8 bg-[#494454]"></div>
              <div>
                <div className="text-[12px] font-semibold tracking-wider text-[#cbc3d7] uppercase">Sold</div>
                <div className="text-[32px] leading-10 font-semibold text-[#dae2fd]">854</div>
              </div>
            </div>
          </div>

          {/* Disney+ Card */}
          <div className="bg-[#171f33] rounded-xl p-6 border-t border-[#4cd7f6] relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-600/10 rounded-full blur-xl group-hover:bg-blue-600/20 transition-all"></div>
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="text-[32px] leading-10 font-bold text-blue-500">D+</div>
              <span className="px-2 py-1 bg-[#2d3449] text-[#cbc3d7] rounded text-[12px] font-semibold tracking-wider">Stable</span>
            </div>
            <h4 className="text-lg text-[#dae2fd] mb-1">Disney+</h4>
            <div className="flex items-end gap-4 mt-4 relative z-10">
              <div>
                <div className="text-[12px] font-semibold tracking-wider text-[#cbc3d7] uppercase">Available</div>
                <div className="text-[32px] leading-10 font-semibold text-[#4cd7f6]">56</div>
              </div>
              <div className="w-px h-8 bg-[#494454]"></div>
              <div>
                <div className="text-[12px] font-semibold tracking-wider text-[#cbc3d7] uppercase">Sold</div>
                <div className="text-[32px] leading-10 font-semibold text-[#dae2fd]">320</div>
              </div>
            </div>
          </div>

          {/* Spotify Card */}
          <div className="bg-[#171f33] rounded-xl p-6 border-t border-[#4cd7f6] relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-green-500/10 rounded-full blur-xl group-hover:bg-green-500/20 transition-all"></div>
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="text-[32px] leading-10 font-bold text-green-500">Sp</div>
            </div>
            <h4 className="text-lg text-[#dae2fd] mb-1">Spotify Family</h4>
            <div className="flex items-end gap-4 mt-4 relative z-10">
              <div>
                <div className="text-[12px] font-semibold tracking-wider text-[#cbc3d7] uppercase">Available</div>
                <div className="text-[32px] leading-10 font-semibold text-[#4cd7f6]">89</div>
              </div>
              <div className="w-px h-8 bg-[#494454]"></div>
              <div>
                <div className="text-[12px] font-semibold tracking-wider text-[#cbc3d7] uppercase">Sold</div>
                <div className="text-[32px] leading-10 font-semibold text-[#dae2fd]">412</div>
              </div>
            </div>
          </div>

          {/* HBO Max Card */}
          <div className="bg-[#171f33] rounded-xl p-6 border-t border-[#4cd7f6] relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-600/10 rounded-full blur-xl group-hover:bg-purple-600/20 transition-all"></div>
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="text-[32px] leading-10 font-bold text-purple-500">M</div>
              <span className="px-2 py-1 bg-[#ffb4ab]/10 text-[#ffb4ab] rounded text-[12px] font-semibold tracking-wider flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Low Stock
              </span>
            </div>
            <h4 className="text-lg text-[#dae2fd] mb-1">Max Premium</h4>
            <div className="flex items-end gap-4 mt-4 relative z-10">
              <div>
                <div className="text-[12px] font-semibold tracking-wider text-[#cbc3d7] uppercase">Available</div>
                <div className="text-[32px] leading-10 font-semibold text-[#ffb4ab]">12</div>
              </div>
              <div className="w-px h-8 bg-[#494454]"></div>
              <div>
                <div className="text-[12px] font-semibold tracking-wider text-[#cbc3d7] uppercase">Sold</div>
                <div className="text-[32px] leading-10 font-semibold text-[#dae2fd]">198</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Inventory Table Section */}
      <div className="bg-[#131b2e] border border-[#494454] rounded-xl overflow-hidden shadow-lg">
        {/* Table Controls */}
        <div className="p-6 border-b border-[#494454] flex justify-between items-center bg-[#171f33]">
          <div className="flex gap-4">
            <select className="bg-[#0b1326] border border-[#494454] rounded-lg py-2 px-4 text-sm text-[#dae2fd] focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff] outline-none">
              <option value="">All Services</option>
              <option value="netflix">Netflix</option>
              <option value="disney">Disney+</option>
              <option value="spotify">Spotify</option>
              <option value="max">Max</option>
            </select>
            <select className="bg-[#0b1326] border border-[#494454] rounded-lg py-2 px-4 text-sm text-[#dae2fd] focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff] outline-none">
              <option value="">All Statuses</option>
              <option value="available">Available</option>
              <option value="assigned">Assigned</option>
              <option value="expired">Expired</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg text-[#cbc3d7] hover:bg-[#2d3449] transition-colors">
              <Filter className="w-5 h-5" />
            </button>
            <button className="p-2 rounded-lg text-[#cbc3d7] hover:bg-[#2d3449] transition-colors">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#494454] bg-[#060e20]">
                <th className="py-4 px-6 text-[12px] font-semibold text-[#cbc3d7] uppercase tracking-wider">Service</th>
                <th className="py-4 px-6 text-[12px] font-semibold text-[#cbc3d7] uppercase tracking-wider">Email / User</th>
                <th className="py-4 px-6 text-[12px] font-semibold text-[#cbc3d7] uppercase tracking-wider">Password</th>
                <th className="py-4 px-6 text-[12px] font-semibold text-[#cbc3d7] uppercase tracking-wider">Profile Slot</th>
                <th className="py-4 px-6 text-[12px] font-semibold text-[#cbc3d7] uppercase tracking-wider">Expiration</th>
                <th className="py-4 px-6 text-[12px] font-semibold text-[#cbc3d7] uppercase tracking-wider">Status</th>
                <th className="py-4 px-6 text-[12px] font-semibold text-[#cbc3d7] uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#494454]/50 bg-[#131b2e]">
              
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#cbc3d7]">
                    No inventory accounts found.
                  </td>
                </tr>
              ) : (
                accounts.map(acc => (
                  <tr key={acc.id} className="hover:bg-[#171f33] transition-colors group">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-[#494454]/20 text-[#dae2fd] flex items-center justify-center font-bold text-sm">
                          {acc.service?.name?.charAt(0) || '?'}
                        </div>
                        <span className="text-sm text-[#dae2fd] font-medium">{acc.service?.name || "Unknown Service"}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-[#cbc3d7]">
                      {acc.email}
                      {acc.assignedUser && (
                        <div className="text-[10px] text-green-400 mt-1">
                          Assigned to: {acc.assignedUser.email}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6 text-sm text-[#cbc3d7]">
                      <div className="flex items-center gap-2">
                        {visiblePasswords[acc.id] ? acc.password : "••••••••"}
                        <button 
                          onClick={() => togglePassword(acc.id)}
                          className="text-[#d0bcff] hover:text-[#e9ddff] opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          {visiblePasswords[acc.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-[#cbc3d7]">{acc.profileSlot || "-"}</td>
                    <td className="py-4 px-6 text-sm text-[#cbc3d7]">
                      {acc.expiresAt ? new Date(acc.expiresAt).toLocaleDateString() : "-"}
                    </td>
                    <td className="py-4 px-6">
                      {acc.status === "AVAILABLE" && (
                        <span className="px-3 py-1 rounded-full bg-green-500/15 text-green-400 text-[10px] font-semibold uppercase tracking-wider inline-flex items-center gap-1 border border-green-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span> Available
                        </span>
                      )}
                      {acc.status === "ASSIGNED" && (
                        <span className="px-3 py-1 rounded-full bg-[#d0bcff]/15 text-[#d0bcff] text-[10px] font-semibold uppercase tracking-wider inline-flex items-center gap-1 border border-[#d0bcff]/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#d0bcff]"></span> Assigned
                        </span>
                      )}
                      {acc.status === "EXPIRED" && (
                        <span className="px-3 py-1 rounded-full bg-[#ffb4ab]/15 text-[#ffb4ab] text-[10px] font-semibold uppercase tracking-wider inline-flex items-center gap-1 border border-[#ffb4ab]/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#ffb4ab]"></span> Expired
                        </span>
                      )}
                      {acc.status === "CANCELLED" && (
                        <span className="px-3 py-1 rounded-full bg-[#494454]/50 text-[#cbc3d7] text-[10px] font-semibold uppercase tracking-wider inline-flex items-center gap-1 border border-[#494454]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#cbc3d7]"></span> Cancelled
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button className="text-[#cbc3d7] hover:text-[#d0bcff] transition-colors">
                        <Edit className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-[#494454] bg-[#171f33] flex items-center justify-between">
          <span className="text-sm text-[#cbc3d7]">Showing {accounts.length} entries</span>
          <div className="flex gap-2">
            <button className="px-3 py-1 rounded border border-[#494454] text-[#cbc3d7] hover:bg-[#2d3449] disabled:opacity-50" disabled>Previous</button>
            <button className="px-3 py-1 rounded bg-[#d0bcff]/20 text-[#d0bcff] border border-[#d0bcff]/30">1</button>
            <button className="px-3 py-1 rounded border border-[#494454] text-[#cbc3d7] hover:bg-[#2d3449]" disabled>Next</button>
          </div>
        </div>
      </div>
      
      <div className="h-8"></div>
    </div>
  );
}
