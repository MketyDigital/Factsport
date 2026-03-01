'use server'; 

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