'use server';

type Result = { success: false; error: string; code: string };

const unavailable = (): Result => ({
  success: false,
  error: 'The V2 Media broadcast control plane is not provisioned. No legacy Supabase writes are permitted.',
  code: 'V2_BROADCAST_ADMIN_NOT_PROVISIONED',
});

export async function updateStudioSettings() { return unavailable(); }
export async function createBroadcastInvite() { return unavailable(); }
export async function revokeBroadcastInvite() { return unavailable(); }
export async function updateBroadcastRoom() { return unavailable(); }
export async function grantBroadcastRole() { return unavailable(); }
export async function revokeBroadcastRole() { return unavailable(); }
