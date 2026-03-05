import { TwitterApi } from 'twitter-api-v2';

// 🟢 THE VIP LIST
const VIP_DB_NAMES = [
  'Arsenal', 'Chelsea', 'Liverpool', 'Man City', 'Man United', 'Tottenham', 'Spurs',
  'Barcelona', 'Barça', 'Atlético', 'Atleti', 'Real Madrid',
  'Bayern', 'Dortmund', 'Leverkusen',
  'Juventus', 'Inter', 'Inter Milan', 'Milan', 'Roma', 'AS Roma', 'Napoli',
  'PSG'
];

export const isBigTeamMatch = (homeTeam: string, awayTeam: string) => {
  return VIP_DB_NAMES.includes(homeTeam) || VIP_DB_NAMES.includes(awayTeam);
};

// 🟢 THE POSTER
export async function postToSocials(message: string, link: string) {
  const fullMessage = `${message}\n\n👇\n${link}`;

  // -- X / TWITTER POST --
  try {
      if (process.env.TWITTER_API_KEY) {
          const twitterClient = new TwitterApi({
              appKey: process.env.TWITTER_API_KEY!,
              appSecret: process.env.TWITTER_API_SECRET!,
              accessToken: process.env.TWITTER_ACCESS_TOKEN!,
              accessSecret: process.env.TWITTER_ACCESS_SECRET!,
          });
          await twitterClient.v2.tweet(fullMessage);
      }
  } catch (error) {
      console.error("❌ X Post Failed:", error);
  }

  // -- FACEBOOK POST --
  try {
      if (!process.env.FB_PAGE_ID || !process.env.FB_PAGE_ACCESS_TOKEN) {
          console.log("⚠️ Facebook skipped: Missing FB_PAGE_ID or FB_PAGE_ACCESS_TOKEN in Vercel.");
      } else {
          const fbUrl = `https://graph.facebook.com/v19.0/${process.env.FB_PAGE_ID}/feed`;
          const fbResponse = await fetch(fbUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  message: fullMessage,
                  access_token: process.env.FB_PAGE_ACCESS_TOKEN
              })
          });

          // 🟢 NEW: Read Facebook's actual response
          const fbData = await fbResponse.json();

          if (!fbResponse.ok) {
              console.error("❌ Facebook API Error:", JSON.stringify(fbData));
          } else {
              console.log("✅ Facebook Post Success!", fbData);
          }
      }
  } catch (error) {
      console.error("❌ Facebook Network Error:", error);
  }
} // <--- This was the missing brace!