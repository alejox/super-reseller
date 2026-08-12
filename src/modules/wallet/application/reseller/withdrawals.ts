import type { ResellerId } from "../../domain/ids";
import type { 
  WithdrawalRepository, 
  WithdrawalMethod, 
  WithdrawalSettings,
  NewWithdrawalMethodInput,
  UpdateWithdrawalSettingsInput
} from "../../domain/withdrawal";

export type WithdrawalsDeps = Readonly<{
  withdrawals: WithdrawalRepository;
  resellerExists: (resellerId: ResellerId) => Promise<boolean>;
}>;

export async function getWithdrawalMethods(
  deps: WithdrawalsDeps,
  resellerId: ResellerId
): Promise<readonly WithdrawalMethod[]> {
  return deps.withdrawals.getMethods(resellerId);
}

export async function addWithdrawalMethod(
  deps: WithdrawalsDeps,
  input: NewWithdrawalMethodInput
): Promise<{ ok: true; method: WithdrawalMethod } | { ok: false; reason: "reseller-unknown" }> {
  if (!(await deps.resellerExists(input.resellerId))) {
    return { ok: false, reason: "reseller-unknown" };
  }
  
  const method = await deps.withdrawals.addMethod(input);
  return { ok: true, method };
}

export async function getWithdrawalSettings(
  deps: WithdrawalsDeps,
  resellerId: ResellerId
): Promise<WithdrawalSettings | null> {
  return deps.withdrawals.getSettings(resellerId);
}

export async function updateWithdrawalSettings(
  deps: WithdrawalsDeps,
  input: UpdateWithdrawalSettingsInput
): Promise<{ ok: true; settings: WithdrawalSettings } | { ok: false; reason: "reseller-unknown" }> {
  if (!(await deps.resellerExists(input.resellerId))) {
    return { ok: false, reason: "reseller-unknown" };
  }
  
  const settings = await deps.withdrawals.upsertSettings(input);
  return { ok: true, settings };
}
