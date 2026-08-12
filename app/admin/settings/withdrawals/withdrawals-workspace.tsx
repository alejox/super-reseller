import { getScope } from "@/modules/identity/application/dal";
import { WALLET_CURRENCY } from "@/modules/wallet/application/admin/top-up-balance";
import { walletBalance } from "@/modules/wallet/domain/wallet-entry";
import { DrizzleWalletRepository } from "@/modules/wallet/infrastructure/drizzle-wallet-repository";
import { getDb } from "@/shared/db/client";
import {
  fetchWithdrawalMethodsAction,
  fetchWithdrawalSettingsAction,
} from "@/modules/wallet/application/reseller/withdrawals.actions";
import WithdrawalsClient from "./WithdrawalsClient";

/**
 * Every uncached read for this route lives here, INSIDE the route's
 * `<Suspense>` boundary — same split as `orders-workspace.tsx`. Awaiting in
 * `page.tsx` instead puts the database on the critical path of the whole
 * document, which Cache Components rejects outright at build time.
 */
export async function WithdrawalsWorkspace() {
  const [methods, settings, scope] = await Promise.all([
    fetchWithdrawalMethodsAction(),
    fetchWithdrawalSettingsAction(),
    getScope(),
  ]);

  // The balance is READ HERE, never passed in from the browser: it is the
  // number a reseller decides how much to withdraw against, and a figure the
  // client could set is not a balance. `fetchWithdrawalMethodsAction` has
  // already established that the scope is a reseller one.
  if (scope.kind !== "reseller") throw new Error("Expected reseller scope");
  const entries = await new DrizzleWalletRepository(getDb(), scope).listEntries(scope.resellerId);
  const balanceMinor = walletBalance(entries, WALLET_CURRENCY).amountMinor;

  return (
    <WithdrawalsClient
      initialMethods={methods}
      initialSettings={settings}
      balanceMinor={balanceMinor}
    />
  );
}
