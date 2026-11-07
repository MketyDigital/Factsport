'use server';

export async function triggerAuditAction() {
  return { success: false, error: 'Prediction monthly prize audit is not provisioned in the V2 Prediction administration service.' };
}

export async function verifyAdminPin(_pin: string) {
  return { success: false, error: 'The legacy shared admin PIN has been retired. V2 uses Factsport-owned system roles.' };
}
