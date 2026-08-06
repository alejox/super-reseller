import { getScope } from "@/modules/identity/application/dal";
import { WALLET_CURRENCY } from "@/modules/wallet/application/admin/top-up-balance";
import { walletBalance } from "@/modules/wallet/domain/wallet-entry";
import { DrizzleWalletRepository } from "@/modules/wallet/infrastructure/drizzle-wallet-repository";
import { formatMoney } from "@/shared/money/money";
import { getDb } from "@/shared/db/client";

/**
 * The reseller's balance and statement.
 *
 * The balance is SUMMED from the movements shown right below it, by the same
 * `walletBalance` the tests pin — so the headline figure and the list can
 * never disagree. There is no stored balance to drift from them.
 */

const KIND_LABELS: Readonly<Record<string, string>> = {
  TOPUP: "Recarga",
  ADJUSTMENT: "Ajuste",
};

const TH_CLASS = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500";
const TD_CLASS = "px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200";

const dateFormat = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" });

export async function ResellerWallet() {
  const scope = await getScope();

  if (scope.kind !== "reseller") {
    // Narrowed BEFORE the repository is built, for the same reason the
    // catalog view narrows first: an ADMIN has no wallet of their own.
    return null;
  }

  const wallet = new DrizzleWalletRepository(getDb(), scope);
  const entries = await wallet.listEntries(scope.resellerId);
  const balance = walletBalance(entries, WALLET_CURRENCY);

  return (
    <section aria-labelledby="wallet-heading" className="space-y-4">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100" id="wallet-heading">
        Saldo
      </h2>

      <p className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        {formatMoney(balance, "es-CO")}
      </p>

      {entries.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Todavía no hay movimientos. El administrador registra las recargas.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-md border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className={TH_CLASS} scope="col">Fecha</th>
                <th className={TH_CLASS} scope="col">Concepto</th>
                <th className={TH_CLASS} scope="col">Referencia</th>
                <th className={TH_CLASS} scope="col">Monto</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800"
                  key={entry.id}
                >
                  <td className={TD_CLASS}>{dateFormat.format(entry.createdAt)}</td>
                  <td className={TD_CLASS}>{KIND_LABELS[entry.kind] ?? entry.kind}</td>
                  <td className={TD_CLASS}>{entry.memo ?? "—"}</td>
                  <td
                    className={`${TD_CLASS} font-semibold ${
                      entry.amountMinor < 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-emerald-700 dark:text-emerald-400"
                    }`}
                  >
                    {/* The sign is spelled out rather than left to the
                        formatter: on a statement, "did this add or remove
                        money" is the first thing read and the worst thing to
                        get wrong. */}
                    {entry.amountMinor > 0 ? "+" : "−"}
                    {formatMoney(
                      { amountMinor: Math.abs(entry.amountMinor), currency: entry.currency },
                      "es-CO",
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
