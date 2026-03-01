'use server'; 
// The 'use server' tag guarantees this code NEVER touches the user's browser.
// It runs strictly on your secure backend.

export async function triggerAuditAction() {
    // We safely pull the hidden secrets directly from the server environment
    const CRON_KEY = process.env.CRON_KEY;
    
    // Fallback to localhost if testing locally, otherwise use your live URL
    const SITE_URL = process.env.PRODUCTION_SITE_URL || 'http://localhost:3000';

    try {
        const res = await fetch(`${SITE_URL}/api/admin/run-audit?key=${CRON_KEY}`, {
            cache: 'no-store'
        });
        
        const data = await res.json();
        
        if (!res.ok) {
            return { success: false, error: data.error || "Unauthorized or failed." };
        }
        
        return { success: true, message: data.message };
    } catch (error: any) {
        return { success: false, error: error.message || "Failed to reach the audit server." };
    }
}