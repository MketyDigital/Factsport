import { createClient } from '@/app/lib/supabase/server';
import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const RSS_FEED = 'https://www.skysports.com/rss/12040'; // SkySports Football

// 🔧 CUSTOM HELPER: Reads RSS without needing 'npm install rss-parser'
async function fetchRSS() {
  const res = await fetch(RSS_FEED);
  const text = await res.text();
  
  const items = [];
  // Split by <item> tags to find articles
  const rawItems = text.split('<item>').slice(1); 

  for (const raw of rawItems) {
    const title = raw.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] || raw.match(/<title>(.*?)<\/title>/)?.[1];
    const link = raw.match(/<link>(.*?)<\/link>/)?.[1];
    const desc = raw.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1] || raw.match(/<description>(.*?)<\/description>/)?.[1];
    const imgMatch = raw.match(/enclosure url="(.*?)"/); // SkySports uses enclosure for images

    if (title && link) {
      items.push({
        title: title.trim(),
        link: link.trim(),
        content: desc?.replace(/<[^>]*>?/gm, '').trim() || '', // Remove HTML tags
        image: imgMatch?.[1] || null
      });
    }
  }
  return items.slice(0, 10); // Return top 10
}

export async function GET() {
  const supabase = createClient();

  try {
    // 1. Fetch Articles using our custom helper
    const articles = await fetchRSS();
    let newCount = 0;

    // 2. Loop through articles
    for (const item of articles) {
      // Check for duplicates
      const { data: existing } = await supabase.from('news').select('id').eq('title', item.title).single();
      if (existing) continue;

      // 3. 🧠 SMART LOGIC: Find Logos
      let team1Logo = null;
      let team2Logo = null;
      const titleLower = item.title.toLowerCase();

      // Scan last 50 matches to find matching team logos
      const { data: knownTeams } = await supabase.from('matches').select('home_team, home_logo, away_team, away_logo').limit(50);

      if (knownTeams) {
        for (const match of knownTeams) {
          // Check Home Team
          if (titleLower.includes(match.home_team.toLowerCase())) {
            if (!team1Logo) team1Logo = match.home_logo;
            else if (team1Logo !== match.home_logo) team2Logo = match.home_logo;
          }
          // Check Away Team
          if (titleLower.includes(match.away_team.toLowerCase())) {
             if (!team1Logo) team1Logo = match.away_logo;
             else if (team1Logo !== match.away_logo && team1Logo !== match.home_logo) team2Logo = match.away_logo;
          }
          if (team1Logo && team2Logo) break;
        }
      }

      // 4. Insert into Database
      const slug = item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      
      await supabase.from('news').insert({
        title: item.title,
        body: item.content || "Read full story on SkySports.",
        image_url: item.image, 
        team_1_logo: team1Logo,
        team_2_logo: team2Logo,
        is_breaking: false,
        is_headline: false,
        category: 'Football',
        slug: slug,
        created_at: new Date().toISOString()
      });

      newCount++;
    }

    return NextResponse.json({ 
      success: true, 
      message: `Bot finished. Added ${newCount} new articles.` 
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}