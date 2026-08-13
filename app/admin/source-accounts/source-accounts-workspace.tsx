import { AlertTriangle, Coins, PlugZap } from "lucide-react";

import {
  FAILURE_ALERT_THRESHOLD,
  LOW_CREDIT_THRESHOLD,
  loadSourceAccountBoard,
} from "@/modules/source-accounts/application/admin/manage-source-accounts";
import type { CreditBalance } from "@/modules/source-accounts/domain/source-account";

import { adminSourceAccountsDeps } from "./admin-source-accounts";
import { CONNECTION_CLASSES, CONNECTION_LABELS, PERIOD_LABELS } from "./source-account-labels";
import { ArchiveSourceAccountButton, RegisterSourceAccountForm } from "./source-account-forms";

const LOCALE = "es-CO";

function displayDate(date: Date | null): string {
  if (!date) return "Nunca";

  return date.toLocaleString(LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function bucketLabel(balance: CreditBalance): string {
  return `${balance.plan} · ${PERIOD_LABELS[balance.period]}`;
}

/**
 * The worker already trims what it stores, but rows written before it learned
 * to do that are still in the table — a full Playwright stack trace, escape
 * codes included, in a banner meant for somebody deciding whether to go log in
 * again. Truncating here fixes the history too.
 */
function shortError(detail: string): string {
  const cleaned = detail.replace(/\[[0-9;]*[A-Za-z]/g, "").trim();

  return cleaned.length > 160 ? `${cleaned.slice(0, 159)}…` : cleaned;
}

/**
 * The source-accounts screen.
 *
 * These are the platform's logins on its SUPPLIER's panel — where every
 * recharge is drawn from — and they live on their own screen rather than
 * inside Account Inventory because that screen holds the opposite thing:
 * precreated accounts that get handed to a customer.
 *
 * The balances shown here are a MIRROR of the supplier's own numbers as of
 * each account's last sync. They are not a ledger this platform keeps, which
 * is why every one of them is stamped with when it was read.
 */
export async function SourceAccountsWorkspace() {
  const deps = await adminSourceAccountsDeps();
  const board = await loadSourceAccountBoard(deps);

  const connected = board.counts.get("CONNECTED") ?? 0;
  const totalPoints = board.accounts.reduce(
    (total, account) =>
      total + account.credits.reduce((sum, balance) => sum + balance.points, 0),
    0,
  );

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 p-10">
      <header className="flex flex-col gap-2">
        <h2 className="text-3xl font-semibold text-[#dae2fd]">Cuentas fuente</h2>
        <p className="max-w-3xl text-base text-[#cbc3d7]">
          Los accesos de la plataforma al panel del proveedor: de acá salen los puntos con los que
          se recarga. No son las cuentas del inventario, que se entregan al cliente.
        </p>
      </header>

      {/* Two alerts, never merged: una sesión rota se arregla entrando de nuevo,
          un bucket vacío se arregla comprándole al proveedor. */}
      {board.alerting.length > 0 && (
        <section className="flex flex-col gap-3 rounded-xl border border-[#ffb4ab]/40 bg-[#93000a]/20 p-6">
          <div className="flex items-center gap-2 text-[#ffb4ab]">
            <AlertTriangle className="h-5 w-5" />
            <h3 className="text-sm font-bold uppercase tracking-wider">
              {board.alerting.length === 1
                ? "1 sesión necesita atención"
                : `${board.alerting.length} sesiones necesitan atención`}
            </h3>
          </div>
          <ul className="flex flex-col gap-2">
            {board.alerting.map((account) => (
              <li className="text-sm text-[#dae2fd]" key={account.id}>
                <span className="font-semibold">{account.panelUsername}</span>{" "}
                <span className="text-[#cbc3d7]">
                  ({account.panelUrl}) — {CONNECTION_LABELS[account.connectionStatus]}
                  {account.connectionStatus !== "BLOCKED" &&
                    ` tras ${account.consecutiveFailures} intentos fallidos`}
                  {account.lastSyncError && `: ${shortError(account.lastSyncError)}`}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-[#cbc3d7]">
            Se avisa a partir de {FAILURE_ALERT_THRESHOLD} fallos seguidos, o al primero si el
            proveedor bloqueó la cuenta. Volver a entrar al panel a mano reactiva la sesión.
          </p>
        </section>
      )}

      {board.lowStock.length > 0 && (
        <section className="flex flex-col gap-3 rounded-xl border border-[#f3ba2f]/40 bg-[#f3ba2f]/10 p-6">
          <div className="flex items-center gap-2 text-[#f3ba2f]">
            <Coins className="h-5 w-5" />
            <h3 className="text-sm font-bold uppercase tracking-wider">Puntos por agotarse</h3>
          </div>
          <ul className="flex flex-col gap-2">
            {board.lowStock.map((entry) => (
              <li
                className="text-sm text-[#dae2fd]"
                key={`${entry.account.id}-${entry.balance.plan}-${entry.balance.period}`}
              >
                <span className="font-semibold">{bucketLabel(entry.balance)}</span>{" "}
                <span className="text-[#cbc3d7]">
                  en {entry.account.panelUsername}: quedan{" "}
                  <span className="font-semibold text-[#f3ba2f]">{entry.balance.points}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-[#cbc3d7]">
            Se avisa por debajo de {LOW_CREDIT_THRESHOLD} puntos. En cero, las recargas se detienen
            sin importar cuánto saldo tengan los revendedores.
          </p>
        </section>
      )}

      <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="flex flex-col gap-4 rounded-xl border-t border-[#4cd7f6]/30 bg-[#171f33] p-6">
          <div className="flex items-center justify-between text-[#cbc3d7]">
            <span className="text-xs font-semibold uppercase tracking-wider">Sesiones activas</span>
            <PlugZap className="h-5 w-5" />
          </div>
          <p className="text-4xl font-bold text-[#dae2fd]">{connected}</p>
          <p className="text-sm text-[#cbc3d7]">de {board.accounts.length} registradas</p>
        </div>

        <div className="flex flex-col gap-4 rounded-xl border-t border-[#494454]/30 bg-[#171f33] p-6">
          <div className="flex items-center justify-between text-[#cbc3d7]">
            <span className="text-xs font-semibold uppercase tracking-wider">Puntos totales</span>
            <Coins className="h-5 w-5" />
          </div>
          <p className="text-4xl font-bold text-[#dae2fd]">{totalPoints}</p>
          <p className="text-sm text-[#cbc3d7]">según el último sync de cada cuenta</p>
        </div>

        <div className="flex flex-col gap-4 rounded-xl border-t border-[#f3ba2f]/30 bg-[#171f33] p-6">
          <div className="flex items-center justify-between text-[#cbc3d7]">
            <span className="text-xs font-semibold uppercase tracking-wider">Avisos abiertos</span>
            <AlertTriangle className="h-5 w-5" />
          </div>
          <p className="text-4xl font-bold text-[#dae2fd]">
            {board.alerting.length + board.lowStock.length}
          </p>
          <p className="text-sm text-[#cbc3d7]">sesiones + puntos por agotarse</p>
        </div>
      </section>

      <section className="flex flex-col overflow-hidden rounded-xl border border-[#494454] bg-[#171f33]">
        <div className="border-b border-[#494454] p-6">
          <h3 className="text-xl font-semibold text-[#dae2fd]">Registrar acceso al proveedor</h3>
        </div>
        <RegisterSourceAccountForm />
      </section>

      <section className="flex flex-col overflow-hidden rounded-xl border border-[#494454] bg-[#171f33]">
        <div className="border-b border-[#494454] p-6">
          <h3 className="text-xl font-semibold text-[#dae2fd]">Accesos registrados</h3>
        </div>

        {board.accounts.length === 0 ? (
          <p className="p-12 text-center text-sm text-[#cbc3d7]">
            Todavía no hay accesos registrados.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#494454] bg-[#2d3449]">
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-[#cbc3d7]">
                    Cuenta
                  </th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-[#cbc3d7]">
                    Estado
                  </th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-[#cbc3d7]">
                    Último intento
                  </th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-[#cbc3d7]">
                    Puntos disponibles
                  </th>
                  <th className="p-4 text-right text-xs font-semibold uppercase tracking-wider text-[#cbc3d7]">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {board.accounts.map((account) => (
                  <tr className="border-b border-[#494454] last:border-b-0" key={account.id}>
                    <td className="p-4">
                      <p className="text-sm font-medium text-[#dae2fd]">{account.panelUsername}</p>
                      <p className="text-xs text-[#958ea0]">{account.panelUrl}</p>
                      {account.label && (
                        <p className="text-xs text-[#958ea0]">{account.label}</p>
                      )}
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-block rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${CONNECTION_CLASSES[account.connectionStatus]}`}
                      >
                        {CONNECTION_LABELS[account.connectionStatus]}
                      </span>
                      {account.consecutiveFailures > 0 && (
                        <p className="mt-1 text-xs text-[#ffb4ab]">
                          {account.consecutiveFailures}{" "}
                          {account.consecutiveFailures === 1 ? "fallo" : "fallos"} seguidos
                        </p>
                      )}
                    </td>
                    <td className="p-4">
                      <p className="text-sm text-[#cbc3d7]">{displayDate(account.lastSyncAt)}</p>
                      {account.lastSyncError && (
                        <p className="max-w-xs truncate text-xs text-[#958ea0]">
                          {shortError(account.lastSyncError)}
                        </p>
                      )}
                    </td>
                    <td className="p-4">
                      {account.credits.length === 0 ? (
                        // Not "0 puntos": nobody has read this panel yet, and
                        // the two are different facts.
                        <p className="text-sm text-[#958ea0]">Sin leer</p>
                      ) : (
                        <ul className="flex flex-col gap-1">
                          {account.credits.map((balance) => (
                            <li
                              className="text-sm text-[#cbc3d7]"
                              key={`${balance.plan}-${balance.period}`}
                            >
                              {bucketLabel(balance)}:{" "}
                              <span
                                className={
                                  balance.points <= LOW_CREDIT_THRESHOLD
                                    ? "font-semibold text-[#f3ba2f]"
                                    : "font-semibold text-[#dae2fd]"
                                }
                              >
                                {balance.points}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end">
                        <ArchiveSourceAccountButton
                          accountId={account.id}
                          panelUsername={account.panelUsername}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export function SourceAccountsWorkspaceFallback() {
  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 p-10">
      <div className="h-9 w-64 animate-pulse rounded-lg bg-[#2d3449]" />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="h-36 animate-pulse rounded-xl bg-[#171f33]" />
        <div className="h-36 animate-pulse rounded-xl bg-[#171f33]" />
        <div className="h-36 animate-pulse rounded-xl bg-[#171f33]" />
      </div>
      <div className="h-96 animate-pulse rounded-xl bg-[#171f33]" />
    </div>
  );
}
