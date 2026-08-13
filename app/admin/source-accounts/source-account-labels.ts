import type {
  CreditPeriod,
  SourceConnectionStatus,
} from "@/modules/source-accounts/domain/source-account";

/** The panel states these two meanings itself: "1 punto = 1 mes" / "= 12 meses". */
export const PERIOD_LABELS: Readonly<Record<CreditPeriod, string>> = {
  MONTHLY: "mensual",
  ANNUAL: "anual",
};

/**
 * One place where a connection status becomes words and colours, shared by the
 * table and the alert banner so the two can never disagree about what
 * `REQUIRES_2FA` looks like.
 */

export const CONNECTION_LABELS: Readonly<Record<SourceConnectionStatus, string>> = {
  NEVER_CONNECTED: "Sin conectar",
  CONNECTED: "Conectada",
  LOGIN_ERROR: "Error de acceso",
  REQUIRES_2FA: "Requiere 2FA",
  BLOCKED: "Bloqueada",
};

export const CONNECTION_CLASSES: Readonly<Record<SourceConnectionStatus, string>> = {
  NEVER_CONNECTED: "border-[#494454] bg-[#2d3449] text-[#cbc3d7]",
  CONNECTED: "border-[#4cd7f6]/30 bg-[#009eb9]/20 text-[#4cd7f6]",
  LOGIN_ERROR: "border-[#ffb4ab]/30 bg-[#93000a]/20 text-[#ffb4ab]",
  REQUIRES_2FA: "border-[#f3ba2f]/30 bg-[#f3ba2f]/10 text-[#f3ba2f]",
  BLOCKED: "border-[#ffb4ab]/40 bg-[#93000a]/40 text-[#ffb4ab]",
};
