import { getScope } from "@/modules/identity/application/dal";
import { WALLET_CURRENCY } from "@/modules/wallet/application/admin/top-up-balance";
import { walletBalance } from "@/modules/wallet/domain/wallet-entry";
import { DrizzleWalletRepository } from "@/modules/wallet/infrastructure/drizzle-wallet-repository";
import { formatMoney } from "@/shared/money/money";
import { getDb } from "@/shared/db/client";
import { PlusCircle } from "lucide-react";

export async function ResellerWallet() {
  const scope = await getScope();

  if (scope.kind !== "reseller") {
    return null;
  }

  const wallet = new DrizzleWalletRepository(getDb(), scope);
  const entries = await wallet.listEntries(scope.resellerId);
  const balance = walletBalance(entries, WALLET_CURRENCY);

  return (
    <div className="bg-[#222a3d] rounded-xl p-6 flex items-center gap-8 border border-[#494454] border-t-white/10 w-full md:w-auto">
      <div>
        <p className="text-xs font-semibold text-[#cbc3d7] uppercase tracking-wider mb-1">Current Balance</p>
        <p className="text-5xl text-[#e9ddff] font-bold">{formatMoney(balance, "es-CO")}</p>
      </div>
      <div className="h-12 w-px bg-[#494454] hidden md:block"></div>
      <button className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#d0bcff] to-[#a078ff] text-[#3c0091] rounded-lg text-xs font-bold shadow-[0_0_15px_2px_rgba(139,92,246,0.3)] hover:opacity-90 transition-all active:scale-95 ml-auto md:ml-0">
        <PlusCircle className="h-5 w-5" />
        Recharge
      </button>
    </div>
  );
}
