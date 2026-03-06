// 🟢 THE VIP LIST
const VIP_DB_NAMES = [
  'Arsenal', 'Chelsea', 'Liverpool', 'Man City', 'Man United', 'Tottenham', 'Spurs',
  'Barcelona', 'Barça', 'Atlético', 'Atleti', 'Real Madrid',
  'Bayern', 'Dortmund', 'Leverkusen',
  'Juventus', 'Inter', 'Inter Milan', 'Milan', 'Roma', 'AS Roma', 'Napoli',
  'PSG'
];

export const isBigTeamMatch = (homeTeam: string, awayTeam: string) => {
  // Uses OR (||) so it fires if AT LEAST ONE team is a VIP. This is perfect.
  return VIP_DB_NAMES.includes(homeTeam) || VIP_DB_NAMES.includes(awayTeam);
};

export interface SocialPayload {
  fb1Message?: string | null;
  fb2Message?: string | null;
  xMessage?: string | null;
  xImageUrl?: string | null;
  link?: string;
}

// 🟢 THE POSTER
export async function postToSocials({ fb1Message, fb2Message, xMessage, xImageUrl, link }: SocialPayload) {
  
  // -- 1. FACEBOOK PAGE 1 (DIRECT API - LIVE UPDATES) --
  if (fb1Message) {
    try {
        const fullFb1Message = link ? `${fb1Message}\n\n👇\n${link}` : fb1Message;
        
        if (!process.env.FB_PAGE_ID || !process.env.FB_PAGE_ACCESS_TOKEN) {
            console.log("⚠️ FB1 skipped: Missing FB_PAGE_ID or FB_PAGE_ACCESS_TOKEN.");
        } else {
            const fbUrl = `https://graph.facebook.com/v19.0/${process.env.FB_PAGE_ID}/feed`;
            const fbResponse = await fetch(fbUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: fullFb1Message,
                    access_token: process.env.FB_PAGE_ACCESS_TOKEN
                })
            });
            const fbData = await fbResponse.json();
            if (!fbResponse.ok) console.error("❌ FB1 Error:", fbData);
            else console.log("✅ FB1 Post Success!");
        }
    } catch (error) {
        console.error("❌ FB1 Network Error:", error);
    }
  }

  // -- 2. MAKE.COM ROUTER (X & FACEBOOK PAGE 2 VIA BUFFER) --
  if (fb2Message || xMessage) {
    try {
        if (!process.env.MAKE_WEBHOOK_URL) {
            console.log("⚠️ Make.com skipped: Missing MAKE_WEBHOOK_URL.");
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
            else console.log("✅ Sent to Make/Buffer Successfully!");
        }
    } catch (error) {
        console.error("❌ Make/Buffer Network Error:", error);
    }
  }
}