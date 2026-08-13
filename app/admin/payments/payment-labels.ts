import type { PaymentMethod } from "@/modules/wallet/domain/payment-request";

/**
 * Operator-facing names for the payment rails.
 *
 * Kept out of the domain on purpose: `PAYMENT_METHODS` is a stored value that
 * outlives any wording, and this is Spanish UI copy. Shared by the claim form
 * and the validation inbox so the two screens can never call the same rail two
 * different things.
 */
export const METHOD_LABELS: Readonly<Record<PaymentMethod, string>> = {
  BANK_TRANSFER: "Transferencia bancaria",
  NEQUI: "Nequi",
  DAVIPLATA: "Daviplata",
  BINANCE_PAY: "Binance Pay",
  CASH: "Efectivo",
  OTHER: "Otro",
};
