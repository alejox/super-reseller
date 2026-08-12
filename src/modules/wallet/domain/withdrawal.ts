import type { ResellerId } from "./ids";

export type WithdrawalMethodType = "BANK_TRANSFER" | "CRYPTO" | "PAYPAL";

export type WithdrawalMethod = Readonly<{
  id: string;
  resellerId: ResellerId;
  type: WithdrawalMethodType;
  details: string; // JSON string or text depending on how we handle it
  isPrimary: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}>;

export type NewWithdrawalMethodInput = Readonly<{
  resellerId: ResellerId;
  type: WithdrawalMethodType;
  details: string;
  isPrimary?: boolean;
}>;

export type WithdrawalSettings = Readonly<{
  resellerId: ResellerId;
  autoWithdraw: boolean;
  condition: "SCHEDULED" | "THRESHOLD";
  thresholdAmountMinor: number;
  scheduleFrequency: "WEEKLY" | "BIWEEKLY" | "MONTHLY";
  minWithdrawalMinor: number;
  maxDailyWithdrawalMinor: number;
  createdAt: Date;
  updatedAt: Date;
}>;

/**
 * What applies to a reseller that never saved its settings.
 *
 * These MUST stay identical to the column defaults in
 * `infrastructure/wallet.schema.ts`. Absent settings and saved-but-untouched
 * settings are the same reseller as far as limits go; if these two lists
 * drift, the first save silently changes limits nobody edited.
 */
export const DEFAULT_WITHDRAWAL_SETTINGS = Object.freeze({
  autoWithdraw: false,
  condition: "THRESHOLD",
  thresholdAmountMinor: 5000,
  scheduleFrequency: "MONTHLY",
  minWithdrawalMinor: 5000,
  maxDailyWithdrawalMinor: 500000,
} as const satisfies Omit<WithdrawalSettings, "resellerId" | "createdAt" | "updatedAt">);

export type UpdateWithdrawalSettingsInput = Readonly<{
  resellerId: ResellerId;
  autoWithdraw?: boolean;
  condition?: "SCHEDULED" | "THRESHOLD";
  thresholdAmountMinor?: number;
  scheduleFrequency?: "WEEKLY" | "BIWEEKLY" | "MONTHLY";
  minWithdrawalMinor?: number;
  maxDailyWithdrawalMinor?: number;
}>;

export interface WithdrawalRepository {
  // Methods
  getMethods(resellerId: ResellerId): Promise<readonly WithdrawalMethod[]>;
  addMethod(input: NewWithdrawalMethodInput): Promise<WithdrawalMethod>;
  setPrimaryMethod(resellerId: ResellerId, methodId: string): Promise<void>;
  deactivateMethod(resellerId: ResellerId, methodId: string): Promise<void>;

  // Settings
  getSettings(resellerId: ResellerId): Promise<WithdrawalSettings | null>;
  upsertSettings(input: UpdateWithdrawalSettingsInput): Promise<WithdrawalSettings>;
}
