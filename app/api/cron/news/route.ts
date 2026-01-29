import { createClient } from '@supabase/supabase-js'; 
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const RSS_FEED = 'https://www.skysports.com/rss/12040'; 

async function fetchRSS() {
  try {
    // ✅ FIX 1: Add User-Agent so SkySports thinks we are a real browser
    const res = await fetch(RSS_FEED, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    });

    if (!res.ok) throw new Error(`RSS Source returned ${res.status}`);
    
    const text = await res.text();
    const items = [];
    const rawItems = text.split('<item>').slice(1); 

    for (const raw of rawItems) {
      const title = raw.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] || raw.match(/<title>(.*?)<\/title>/)?.[1];
      const link = raw.match(/<link>(.*?)<\/link>/)?.[1];
      const desc = raw.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1] || raw.match(/<description>(.*?)<\/description>/)?.[1];
      
      // ✅ FIX 2: Relaxed Image Regex (Captures any URL inside url="")
      const imgMatch = raw.match(/url="([^"]+)"/);

      if (title && link) {
        items.push({
          title: title.trim(),
          link: link.trim(),
          content: desc?.replace(/<[^>]*>?/gm, '').trim() || '',
          image: imgMatch?.[1] || null 
        });
      }
    }
    return items.slice(0, 15); // Check top 15 items
  } catch (e: any) {
    console.error("RSS Fetch Error:", e);
    return []; // Return empty if failed
  }
}

export async function GET(request: NextRequest) {
  
  // 🔒 SECURITY CHECK
  const authHeader = request.headers.get('authorization');
  const urlKey = request.nextUrl.searchParams.get('key');
  const validKey = process.env.CRON_KEY;

  const isValidHeader = authHeader === `Bearer ${validKey}`;
  const isValidParam = urlKey === validKey;

  if (!isValidHeader && !isValidParam) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! 
  );

  try {
    const articles = await fetchRSS();
    let addedCount = 0;
    let duplicateCount = 0;

    // Log what we found to help debug
    if (articles.length === 0) {
        return NextResponse.json({ success: false, message: "Bot ran but found 0 articles in RSS Feed. Source might be blocking us." });
    }

    for (const item of articles) {
      const { data: existing } = await supabase.from('news').select('id').eq('title', item.title).single();
      
      if (existing) {
          duplicateCount++;
          continue;
      }

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

      if (!error) addedCount++;
    }

    // ✅ FIX 3: Detailed Status Report
    return NextResponse.json({ 
      success: true, 
      message: `Scan Complete. Found ${articles.length} items. Added: ${addedCount}. Duplicates: ${duplicateCount}.` 
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}