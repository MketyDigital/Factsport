export function issueAdminVaultToken(
  userId: string, secret: string, nowMs?: number, ttlSeconds?: number
): Promise<string>;
export function verifyAdminVaultToken(
  token: string, userId: string, secret: string, nowMs?: number
): Promise<boolean>;
