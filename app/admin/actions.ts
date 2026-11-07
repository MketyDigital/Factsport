'use server';

import { getSupabaseAdmin } from '@/app/lib/supabase/admin';
import { authorizeAdminAction, unlockAdminVault } from '@/app/lib/admin/authorization';
import { runMonthlyPrizeAudit } from '@/app/lib/admin/monthly-prize-audit';

export type AuditActionResult = {
  success: boolean;
  message?: string;
  error?: string;
  monthYear?: string;
  drafted?: number;
};

export async function triggerAuditAction(): Promise<AuditActionResult> {
  try {
    const authorization = await authorizeAdminAction();
    if (!authorization.ok) return { success: false, error: authorization.error };
    const result = await runMonthlyPrizeAudit(getSupabaseAdmin());
    return {
      success: true,
      message: `Audit for ${result.monthYear} complete. Saved ${result.drafted} qualified drafts.`,
      ...result,
    };
  } catch (error) {
    console.error('Audit Execution Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute the audit engine.',
    };
  }
}

export async function verifyAdminPin(pin: string) {
  return unlockAdminVault(pin);
}
