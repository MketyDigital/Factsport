export interface SocialPayload {
    fb1Message?: string | null;
    fb2Message?: string | null;
    xMessage?: string | null;
    xImageUrl?: string | null;
    fb1ImageUrl?: string | null; 
    link?: string;
    credentials?: any;
}

// 🟢 THE POSTER (Dynamic Delivery Engine)
export async function postToSocials({ fb1Message, fb2Message, xMessage, xImageUrl, fb1ImageUrl, link, credentials = {} }: SocialPayload) {
    
    // Fallback to ENV if DB is empty for a seamless transition
    const fb1Id = credentials.fb1_id || process.env.FB_PAGE_ID;
    const fb1Token = credentials.fb1_token || process.env.FB_PAGE_ACCESS_TOKEN;
    
    const fb2Id = credentials.fb2_id; // Secondary Direct Facebook Page
    const fb2Token = credentials.fb2_token;

    const makeWebhook1 = credentials.make_webhook_1 || process.env.MAKE_WEBHOOK_URL;
    const makeWebhook2 = credentials.make_webhook_2; // Secondary Make Router (For extra X/FB accounts)

    // Helper function for Direct Facebook Graph API Posting
    const postDirectToFacebook = async (pageId: string, token: string, message: string, imageUrl?: string | null) => {
        try {
            const endpoint = imageUrl ? 'photos' : 'feed';
            const fbUrl = `https://graph.facebook.com/v19.0/${pageId}/${endpoint}`;
            
            const fbPayload: any = {
                message: message,
                access_token: token
            };

            if (imageUrl) fbPayload.url = imageUrl;

            const fbResponse = await fetch(fbUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fbPayload)
            });
            
            if (!fbResponse.ok) console.error(`❌ FB API Error (${pageId}):`, await fbResponse.json());
        } catch (error) {
            console.error(`❌ FB Network Error (${pageId}):`, error);
        }
    };

    // Helper function for Make.com Webhook Posting
    const postToMakeRouter = async (webhookUrl: string, fbText: string | null, xText: string | null, xImg: string | null) => {
        try {
            const makeResponse = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fb2_text: fbText || null,
                    x_text: xText || null,
                    x_image_url: xImg || null
                })
            });
            if (!makeResponse.ok) console.error("❌ Make.com Error:", await makeResponse.text());
        } catch (error) {
            console.error("❌ Make Network Error:", error);
        }
    };

    // ---------------------------------------------------------
    // 🚀 EXECUTE POSTS
    // ---------------------------------------------------------
    
    // 1. DIRECT FACEBOOK POSTS
    if (fb1Message) {
        const fullFb1Message = link ? `${fb1Message}\n\n👇\n${link}` : fb1Message;
        
        if (fb1Id && fb1Token) {
            await postDirectToFacebook(fb1Id, fb1Token, fullFb1Message, fb1ImageUrl);
        } else {
            console.log("⚠️ FB1 skipped: Missing credentials.");
        }

        // If a second direct FB page is configured, blast it there too!
        if (fb2Id && fb2Token) {
            await postDirectToFacebook(fb2Id, fb2Token, fullFb1Message, fb1ImageUrl);
        }
    }

    // 2. MAKE.COM ROUTERS (For X / Twitter and Extra Facebooks)
    if (fb2Message || xMessage) {
        const fullFb2Message = fb2Message && link ? `${fb2Message}\n\n👇\n${link}` : fb2Message;
        const fullXMessage = xMessage && link ? `${xMessage}\n\n👇\n${link}` : xMessage;

        if (makeWebhook1) {
            await postToMakeRouter(makeWebhook1, fullFb2Message || null, fullXMessage || null, xImageUrl || null);
        } else {
            console.log("⚠️ Make.com 1 skipped: Missing URL.");
        }

        if (makeWebhook2) {
            await postToMakeRouter(makeWebhook2, fullFb2Message || null, fullXMessage || null, xImageUrl || null);
        }
    }
}