import Link from "next/link";
import { Network, ShieldCheck, Wallet } from "lucide-react";

import { WALLET_CURRENCY } from "@/modules/wallet/domain/wallet-entry";
import { formatMoney, money } from "@/shared/money/money";

import { adminResellerDeps } from "./admin-resellers";

/**
 * The network's real numbers.
 *
 * BACKLOG A7 — "descontar del pool de créditos del admin al acreditar a un
 * revendedor" — is answered here, by its documented alternative: THERE IS NO
 * ADMIN CREDIT POOL, and these three figures replace the invented ones
 * ("14,250", "48", "3,492") that used to sit in this position.
 *
 * The platform MINTS credit rather than distributing a finite stock of it. The
 * ledger has said so since it was written: `wallet_entry` has no counterpart
 * row on the admin side, and an approved payment appends a single positive
 * entry with nothing debited anywhere. Giving the admin a finite pool would
 * mean a new balance that can run out mid-approval — a failure mode with its
 * own refill flow, its own reconciliation, and its own way of disagreeing with
 * the ledger. What an operator actually needs to see is how much credit is
 * OUTSTANDING, which is the first card below, and that is a fact the ledger
 * already knows.
 *
 * If the business ever does buy credit from upstream panels, that stock is a
 * provider-side concept and belongs with provider accounts, not here.
 */
export async function ResellersStats() {
  const deps = await adminResellerDeps();

  const [users, balances, paymentCounts] = await Promise.all([
    deps.users.listUsers(),
    deps.wallet.balancesByReseller(),
    deps.paymentRequests.countByStatus(),
  ]);

  const outstandingMinor = [...balances.values()].reduce((total, balance) => total + balance, 0);
  const activeResellers = users.filter(
    (user) => user.role === "RESELLER" && user.deactivatedAt === null,
  ).length;
  const pendingPayments = paymentCounts.get("PENDING") ?? 0;

  return (
    <section className="grid gap-6 sm:grid-cols-3">
      <div className="flex flex-col gap-4 rounded-xl border-t border-[#4cd7f6]/30 bg-[#444173]/20 p-6">
        <div className="flex items-center justify-between text-[#cbc3d7]">
          <span className="text-xs font-semibold uppercase tracking-wider">Saldo en Circulación</span>
          <Wallet className="h-5 w-5 text-[#d0bcff]" />
        </div>
        <p className="text-4xl font-bold text-[#dae2fd]">
          {formatMoney(money(outstandingMinor, WALLET_CURRENCY), "es-CO")}
        </p>
        <p className="text-sm text-[#cbc3d7]">Suma de todos los saldos de revendedores</p>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border-t border-[#494454]/30 bg-[#171f33] p-6">
        <div className="flex items-center justify-between text-[#cbc3d7]">
          <span className="text-xs font-semibold uppercase tracking-wider">Revendedores</span>
          <Network className="h-5 w-5" />
        </div>
        <p className="text-4xl font-bold text-[#dae2fd]">{activeResellers}</p>
        <p className="text-sm text-[#cbc3d7]">Activos</p>
      </div>

      <Link
        className="flex flex-col gap-4 rounded-xl border-t border-[#494454]/30 bg-[#171f33] p-6 transition-colors hover:bg-[#1d2740]"
        href="/admin/payments"
      >
        <div className="flex items-center justify-between text-[#cbc3d7]">
          <span className="text-xs font-semibold uppercase tracking-wider">Pagos por Validar</span>
          <ShieldCheck className="h-5 w-5" />
        </div>
        <p className="text-4xl font-bold text-[#dae2fd]">{pendingPayments}</p>
        <p className={`text-sm ${pendingPayments > 0 ? "text-[#f3ba2f]" : "text-[#cbc3d7]"}`}>
          {pendingPayments > 0 ? "Esperando aprobación" : "Nada pendiente"}
        </p>
      </Link>
    </section>
  );
}

export function ResellersStatsFallback() {
  return (
    <section className="grid animate-pulse gap-6 sm:grid-cols-3">
      <div className="h-40 rounded-xl bg-[#171f33]" />
      <div className="h-40 rounded-xl bg-[#171f33]" />
      <div className="h-40 rounded-xl bg-[#171f33]" />
    </section>
  );
}
