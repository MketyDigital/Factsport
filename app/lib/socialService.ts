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
              appKey: process.env.TWITTER_API_KEY,
              appSecret: process.env.TWITTER_API_SECRET,
              accessToken: process.env.TWITTER_ACCESS_TOKEN,
              accessSecret: process.env.TWITTER_ACCESS_SECRET,
          });
          await twitterClient.v2.tweet(fullMessage);
      }
  } catch (error) {
      console.error("❌ X Post Failed:", error);
  }

  // -- FACEBOOK POST (Using Edge-Native Fetch!) --
  try {
      if (process.env.FB_PAGE_ID && process.env.FB_PAGE_ACCESS_TOKEN) {
          const fbUrl = `https://graph.facebook.com/v19.0/${process.env.FB_PAGE_ID}/feed`;
          await fetch(fbUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  message: fullMessage,
                  access_token: process.env.FB_PAGE_ACCESS_TOKEN
              })
          });
      }
  } catch (error) {
      console.error("❌ Facebook Post Failed:", error);
  }
}