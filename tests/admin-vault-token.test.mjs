import test from 'node:test';
import assert from 'node:assert/strict';
import { issueAdminVaultToken, verifyAdminVaultToken } from '../lib/admin-vault-token.mjs';

const secret = 'factsport-v2-admin-vault-test-secret-'.repeat(2);
const userId = 'd4e4a2f0-5c31-4a3a-a1f5-0fd30f64c2a9';

test('vault token is valid only for its authenticated admin subject', async () => {
  const token = await issueAdminVaultToken(userId, secret, 1_800_000_000_000, 3600);
  assert.equal(await verifyAdminVaultToken(token, userId, secret, 1_800_000_001_000), true);
  assert.equal(await verifyAdminVaultToken(token, 'another-user', secret, 1_800_000_001_000), false);
});

test('vault token rejects expiry, tampering, and a different signing secret', async () => {
  const issuedAt = 1_800_000_000_000;
  const token = await issueAdminVaultToken(userId, secret, issuedAt, 60);
  assert.equal(await verifyAdminVaultToken(token, userId, secret, issuedAt + 61_000), false);
  assert.equal(await verifyAdminVaultToken(token + 'x', userId, secret, issuedAt + 1_000), false);
  assert.equal(await verifyAdminVaultToken(token, userId, secret + 'wrong', issuedAt + 1_000), false);
});

test('vault token refuses malformed inputs and weak signing keys', async () => {
  assert.equal(await verifyAdminVaultToken('not-a-token', userId, secret), false);
  await assert.rejects(() => issueAdminVaultToken(userId, 'short-key'));
  await assert.rejects(() => issueAdminVaultToken('', secret));
});
