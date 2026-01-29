import { createClient } from '@supabase/supabase-js'; 
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const RSS_FEED = 'https://www.skysports.com/rss/12040'; 

async function fetchRSS() {
  try {
    const res = await fetch(RSS_FEED);
    const text = await res.text();
    const items = [];
    const rawItems = text.split('<item>').slice(1); 

    for (const raw of rawItems) {
      const title = raw.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] || raw.match(/<title>(.*?)<\/title>/)?.[1];
      const link = raw.match(/<link>(.*?)<\/link>/)?.[1];
      const desc = raw.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1] || raw.match(/<description>(.*?)<\/description>/)?.[1];
      const imgMatch = raw.match(/url="(https:\/\/[^"]+jpg|[^"]+png|[^"]+jpeg)"/);

      if (title && link) {
        items.push({
          title: title.trim(),
          link: link.trim(),
          content: desc?.replace(/<[^>]*>?/gm, '').trim() || '',
          image: imgMatch?.[1] || null 
        });
      }
    }
    return items.slice(0, 10);
  } catch (e) {
    console.error("RSS Fetch Error:", e);
    return [];
  }
}

export async function GET(request: NextRequest) {
  
  // 🔒 SECURITY CHECK: Verify CRON_KEY
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_KEY}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! 
  );

  try {
    const articles = await fetchRSS();
    let newCount = 0;

    for (const item of articles) {
      const { data: existing } = await supabase.from('news').select('id').eq('title', item.title).single();
      if (existing) continue;

      let team1Logo = null;
      let team2Logo = null;
      const titleLower = item.title.toLowerCase();

      const { data: knownTeams } = await supabase.from('matches').select('home_team, home_logo, away_team, away_logo').limit(50);

      if (knownTeams) {
        for (const match of knownTeams) {
          if (titleLower.includes(match.home_team.toLowerCase())) {
            if (!team1Logo) team1Logo = match.home_logo;
            else if (team1Logo !== match.home_logo) team2Logo = match.home_logo;
          }
          if (titleLower.includes(match.away_team.toLowerCase())) {
             if (!team1Logo) team1Logo = match.away_logo;
             else if (team1Logo !== match.away_logo && team1Logo !== match.home_logo) team2Logo = match.away_logo;
          }
          if (team1Logo && team2Logo) break;
        }
      }

      const slug = item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      
      const { error } = await supabase.from('news').insert({
        title: item.title,
        body: item.content || "Read full story on SkySports.",
        image_url: item.image, 
        team_1_logo: team1Logo,
        team_2_logo: team2Logo,
        is_breaking: false,
        is_headline: false,
        category: 'Football',
        slug: slug,
      });

      if (!error) newCount++;
    }

    return NextResponse.json({ 
      success: true, 
      message: `Bot finished. Added ${newCount} new articles.` 
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}