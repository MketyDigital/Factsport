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

export async function postToSocials(fbMessage: string, xMessage: string | null, link: string) {
  // -- X / TWITTER POST (RapidAPI) --
  if (xMessage) {
      try {
          let safeXMessage = xMessage.length > 250 ? xMessage.substring(0, 247) + '...' : xMessage;
          const fullXMessage = `${safeXMessage}\n\n👇\n${link}`;

          if (!process.env.X_RAPIDAPI_KEY) {
              console.log("⚠️ X skipped: Missing X_RAPIDAPI_KEY.");
          } else {
              const xResponse = await fetch("https://twitter-x-full-api.p.rapidapi.com/api/v2/CreateTweet", {
                  method: 'POST',
                  headers: {
                      'x-rapidapi-key': process.env.X_RAPIDAPI_KEY,
                      'x-rapidapi-host': 'twitter-x-full-api.p.rapidapi.com',
                      'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ text: fullXMessage })
              });
              const xData = await xResponse.json();
              console.log("✅ X API Response:", JSON.stringify(xData));
          }
      } catch (error) {
          console.error("❌ X Network Error:", error);
      }
  }

  // -- FACEBOOK POST --
  try {
      const fullFbMessage = `${fbMessage}\n\n👇\n${link}`;
      
      if (!process.env.FB_PAGE_ID || !process.env.FB_PAGE_ACCESS_TOKEN) {
          console.log("⚠️ Facebook skipped: Missing Keys.");
      } else {
          const fbUrl = `https://graph.facebook.com/v19.0/${process.env.FB_PAGE_ID}/feed`;
          const fbResponse = await fetch(fbUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  message: fullFbMessage,
                  access_token: process.env.FB_PAGE_ACCESS_TOKEN
              })
          });
          const fbData = await fbResponse.json();
          console.log("✅ Facebook Response:", JSON.stringify(fbData));
      }
  } catch (error) {
      console.error("❌ Facebook Network Error:", error);
  }
}