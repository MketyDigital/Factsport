export interface SocialPayload {
    fb1Message?: string | null;
    fb2Message?: string | null;
    xMessage?: string | null;
    xImageUrl?: string | null;
    fb1ImageUrl?: string | null; 
    link?: string;
}

// 🟢 THE POSTER (Pure Delivery)
export async function postToSocials({ fb1Message, fb2Message, xMessage, xImageUrl, fb1ImageUrl, link }: SocialPayload) {
    
    // -- 1. FACEBOOK PAGE 1 (DIRECT API) --
    if (fb1Message) {
        try {
            const fullFb1Message = link ? `${fb1Message}\n\n👇\n${link}` : fb1Message;
            
            if (!process.env.FB_PAGE_ID || !process.env.FB_PAGE_ACCESS_TOKEN) {
                console.log("⚠️ FB1 skipped: Missing credentials.");
            } else {
                const endpoint = fb1ImageUrl ? 'photos' : 'feed';
                const fbUrl = `https://graph.facebook.com/v19.0/${process.env.FB_PAGE_ID}/${endpoint}`;
                
                const fbPayload: any = {
                    message: fullFb1Message,
                    access_token: process.env.FB_PAGE_ACCESS_TOKEN
                };

                if (fb1ImageUrl) fbPayload.url = fb1ImageUrl;

                const fbResponse = await fetch(fbUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(fbPayload)
                });
                
                if (!fbResponse.ok) console.error("❌ FB1 Error:", await fbResponse.json());
            }
        } catch (error) {
            console.error("❌ FB1 Network Error:", error);
        }
    }

    // -- 2. MAKE.COM ROUTER (X & FB PAGE 2) --
    if (fb2Message || xMessage) {
        try {
            if (!process.env.MAKE_WEBHOOK_URL) {
                console.log("⚠️ Make.com skipped: Missing URL.");
            } else {
                const fullFb2Message = fb2Message && link ? `${fb2Message}\n\n👇\n${link}` : fb2Message;
                const fullXMessage = xMessage && link ? `${xMessage}\n\n👇\n${link}` : xMessage;

                const makeResponse = await fetch(process.env.MAKE_WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fb2_text: fullFb2Message || null,
                        x_text: fullXMessage || null,
                        x_image_url: xImageUrl || null
                    })
                });
                if (!makeResponse.ok) console.error("❌ Make.com Error:", await makeResponse.text());
            }
        } catch (error) {
            console.error("❌ Make/Buffer Network Error:", error);
        }
    }
}