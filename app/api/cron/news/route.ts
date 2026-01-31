import { createClient } from '@supabase/supabase-js'; 
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const RSS_FEED = 'https://talksport.com/football/feed/'; 

// 🧹 CLEANER: Removes ads, betting terms, and weird symbols
function cleanText(text: string) {
    if (!text) return "";
    return text
        .replace(/&amp;/g, '&')
        .replace(/&#8211;/g, '-')
        .replace(/&#8217;/g, "'")
        .replace(/(GET UP TO|18\+|New customers only|BeGambleAware|T&Cs apply|bet365|Betfair|William Hill).*/gi, '') 
        .trim();
}

// 🕵️‍♀️ SCRAPER: Extracts full text from TalkSport
async function scrapeFullArticle(url: string) {
  try {
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
        }
    });
    
    if (!res.ok) return null;
    const html = await res.text();

    const bodyMatch = html.match(/<div class="[^"]*(article__content|article-body|contextual-body)[^"]*">([\s\S]*?)<\/div>/);
    
    // Fallback if main div missing
    if (!bodyMatch) {
       const pMatches = html.match(/<p>([\s\S]*?)<\/p>/g);
       if(pMatches && pMatches.length > 3) {
           return pMatches.join(' ').replace(/<[^>]+>/g, ' ').trim().slice(0, 3000);
       }
       return null;
    }

    let rawText = bodyMatch[0]
      .replace(/<script[^>]*>([\s\S]*?)<\/script>/g, '') 
      .replace(/<style[^>]*>([\s\S]*?)<\/style>/g, '')   
      .replace(/<a[^>]*>([\s\S]*?)<\/a>/g, '$1') 
      .replace(/<[^>]+>/g, ' ')                  
      .replace(/\s+/g, ' ')                      
      .trim();

    return cleanText(rawText).length > 200 ? cleanText(rawText).slice(0, 3000) : null;

  } catch (e) {
    console.error("Scrape Failed:", e);
    return null;
  }
}

// 🧠 AI WRITER: Skips Betting Articles
async function rewriteWithAI(originalTitle: string, content: string, isFullText: boolean) {
  const apiKey = process.env.GEMINI_API_KEY;
  const cleanTitle = cleanText(originalTitle);

  // 🚫 STRICT FILTER: If it's purely a betting article, SKIP IT.
  const lowerTitle = cleanTitle.toLowerCase();
  if (lowerTitle.includes('betting') || lowerTitle.includes('tips') || lowerTitle.includes('odds') || lowerTitle.includes('boost')) {
      return null; 
  }

  if (!apiKey) return { title: cleanTitle, body: content };

  let prompt = "";
  if (isFullText) {
      prompt = `
        Act as a FactSport journalist. Rewrite this football news.
        Source: "${content}"
        RULES: 
        - REMOVE all betting promotions.
        - Headline: Catchy, non-clickbait.
        - JSON Output: { "title": "...", "body": "..." }
      `;
  } else {
      prompt = `
        Act as a FactSport analyst. Write a 150-word update.
        Fact: "${cleanTitle} - ${content}"
        RULES: Remove betting talk. Focus on football.
        JSON Output: { "title": "...", "body": "..." }
      `;
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    const cleanJson = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanJson);

  } catch (e) {
    return { title: cleanTitle, body: content };
  }
}

async function fetchRSS() {
  try {
    const res = await fetch(RSS_FEED, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const text = await res.text();
    const items = [];
    const rawItems = text.split('<item>').slice(1); 

    for (const raw of rawItems) {
      const title = raw.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] || raw.match(/<title>(.*?)<\/title>/)?.[1];
      const link = raw.match(/<link>(.*?)<\/link>/)?.[1];
      const desc = raw.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1] || raw.match(/<description>(.*?)<\/description>/)?.[1];
      const imgMatch = raw.match(/url="([^"]+)"/);

      if (title && link) {
        items.push({ 
            title: title.trim(), 
            link: link.trim(),
            summary: desc?.replace(/<[^>]*>?/gm, '').trim() || '',
            image: imgMatch?.[1] || null 
        });
      }
    }
    return items.slice(0, 3); 
  } catch (e) {
    console.error("RSS Fetch Error:", e);
    return [];
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const urlKey = request.nextUrl.searchParams.get('key');
  const validKey = process.env.CRON_KEY;

  if ((authHeader !== `Bearer ${validKey}`) && (urlKey !== validKey)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! 
  );

  try {
    const articles = await fetchRSS();
    let addedCount = 0;

    // ✅ FIX 1: Fetch 1000 matches to ensure we find "Real Betis" or "Liverpool"
    const { data: knownTeams } = await supabase.from('matches').select('home_team, home_logo, away_team, away_logo').limit(1000);

    for (const item of articles) {
      const { data: existing } = await supabase.from('news').select('id').eq('original_source_id', item.link).single();
      if (existing) continue;

      let textToRewrite = item.summary;
      let isFullText = false;
      const scrapedText = await scrapeFullArticle(item.link);
      
      if (scrapedText && scrapedText.length > 200) {
          textToRewrite = scrapedText;
          isFullText = true;
      }

      const aiResult = await rewriteWithAI(item.title, textToRewrite, isFullText);
      if (!aiResult) continue; // Skip betting articles

      // ✅ FIX 2: Check BOTH Title AND Body for team names
      let team1Logo = null;
      let team2Logo = null;
      const titleLower = aiResult.title.toLowerCase(); 
      const bodyLower = aiResult.body.toLowerCase(); // Check the text too!

      if (knownTeams) {
        for (const match of knownTeams) {
          // Check Title FIRST
          if (titleLower.includes(match.home_team.toLowerCase())) {
            if (!team1Logo) team1Logo = match.home_logo;
            else if (team1Logo !== match.home_logo) team2Logo = match.home_logo;
          }
          if (titleLower.includes(match.away_team.toLowerCase())) {
             if (!team1Logo) team1Logo = match.away_logo;
             else if (team1Logo !== match.away_logo && team1Logo !== match.home_logo) team2Logo = match.away_logo;
          }
          
          // If no logos found in title, check BODY
          if (!team1Logo || !team2Logo) {
               if (bodyLower.includes(match.home_team.toLowerCase())) {
                    if (!team1Logo) team1Logo = match.home_logo;
               }
               if (bodyLower.includes(match.away_team.toLowerCase())) {
                    if (!team1Logo) team1Logo = match.away_logo;
                    else if (team1Logo !== match.away_logo) team2Logo = match.away_logo;
               }
          }

          if (team1Logo && team2Logo) break;
        }
      }

      let finalImage = item.image;
      if (team1Logo || team2Logo) finalImage = null; // Prefer Logo Graphic

      const slug = aiResult.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      
      const { error } = await supabase.from('news').insert({
        title: aiResult.title, 
        body: aiResult.body,   
        image_url: finalImage,
        team_1_logo: team1Logo,
        team_2_logo: team2Logo,
        is_breaking: false,
        is_headline: false,
        slug: slug,
        original_source_id: item.link 
      });

      if (!error) addedCount++;
    }

    return NextResponse.json({ success: true, message: `Bot Finished. Added: ${addedCount}.` });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}