// app/lib/league-assets.ts

// This points directly to the image you will upload to public/tournaments/
const DEFAULT_BG = '/tournaments/default-bg.jpg'; 

export const getLeagueAssets = (leagueName: string | undefined) => {
  // No matter what league is passed, we return the unified premium background
  // and pass null for the watermark so the frontend knows to skip it.
  return { 
    bg: DEFAULT_BG, 
    watermark: null 
  };
};