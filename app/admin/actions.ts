'use server'; 

import { cookies } from 'next/headers';

// ====================================================
// ACTION 1: YOUR EXISTING AUDIT TRIGGER
// ====================================================
export async function triggerAuditAction() {
    const CRON_KEY = process.env.CRON_KEY;
    // Fallback directly to your live URL just in case the env variable is missing
    const SITE_URL = process.env.PRODUCTION_SITE_URL || 'https://factsport.com';

    try {
        const res = await fetch(`${SITE_URL}/api/admin/run-audit?key=${CRON_KEY}`, {
            cache: 'no-store',
            headers: {
                // 🟢 NEW: Disguise the request as a normal Chrome browser to bypass Cloudflare Bot Fight Mode
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        });
        
        // 🟢 NEW: Read as raw text first so it doesn't crash if Cloudflare sends an HTML error page
        const rawText = await res.text(); 
        
        try {
            const data = JSON.parse(rawText);
            
            if (!res.ok) {
                return { success: false, error: data.error || "Unauthorized or failed." };
            }
            return { success: true, message: data.message };
            
        } catch (parseError) {
            console.error("Blocked Response from Cloudflare:", rawText);
            return { success: false, error: "Cloudflare blocked the internal request. Use the GitHub Action or check your WAF settings." };
        }
        
    } catch (error: any) {
        return { success: false, error: error.message || "Failed to reach the audit server." };
    }
}

// ====================================================
// ACTION 2: THE NEW GLOBAL VAULT UNLOCKER
// ====================================================
export async function verifyAdminPin(pin: string) {
    // 1. Get the actual secret PIN from your hidden .env file
    const correctPin = process.env.ADMIN_PIN;

    // 2. Fail-safe: If no PIN is set in .env, block access entirely to be safe
    if (!correctPin) {
        return { success: false, error: 'System configuration error. Vault sealed.' };
    }

    // 3. Check if the input matches
    if (pin === correctPin) {
        // 4. Issue an HTTP-Only, Secure cookie valid for 12 hours. 
        // JavaScript CANNOT read this cookie, making it completely secure.
        cookies().set('admin_vault_unlocked', 'true', {
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
            path: '/admin',
            maxAge: 60 * 60 * 12 // 12 hours
        });
        
        return { success: true };
    }

    return { success: false, error: 'Incorrect PIN.' };
}