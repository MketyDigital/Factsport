import { createClient } from '@supabase/supabase-js'; 
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// 🔄 CHANGE SOURCE: TalkSport (Great for Transfer News & Rumors)
const RSS_FEED = 'https://talksport.com/football/feed/'; 

// 1. 🕵️‍♀️ DEEP SCRAPER (Tuned for TalkSport)
async function scrapeFullArticle(url: string) {
  try {
    const res = await fetch(url, {
        headers: {
            // Rotate User-Agents to look like different devices
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
    });
    
    if (!res.ok) return null;
    const html = await res.text();

    // 🎯 TARGET: TalkSport uses 'article__content' or 'article-body'
    // We look for the main content div
    const bodyMatch = html.match(/<div class="[^"]*(article__content|article-body|contextual-body)[^"]*">([\s\S]*?)<\/div>/);
    
    // If not found, try a generic paragraph grabber (backup plan)
    if (!bodyMatch) {
       // Look for long blocks of text inside <p> tags
       const pMatches = html.match(/<p>([\s\S]*?)<\/p>/g);
       if(pMatches && pMatches.length > 3) {
           return pMatches.join(' ').replace(/<[^>]+>/g, ' ').trim().slice(0, 3000);
       }
       return null;
    }

    // Clean up the specific match
    let rawText = bodyMatch[0]
      .replace(/<script[^>]*>([\s\S]*?)<\/script>/g, '') 
      .replace(/<style[^>]*>([\s\S]*?)<\/style>/g, '')   
      .replace(/<a[^>]*>([\s\S]*?)<\/a>/g, '$1') // Keep link text, remove tags
      .replace(/<[^>]+>/g, ' ')                  // Remove all other HTML
      .replace(/\s+/g, ' ')                      // Fix weird spaces
      .trim();

    return rawText.length > 200 ? rawText.slice(0, 3000) : null;

  } catch (e) {
    console.error("Scrape Failed:", e);
    return null;
  }
}

// 2. 🤖 AI REWRITER
async function rewriteWithAI(originalTitle: string, content: string, isFullText: boolean) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { title: originalTitle, body: content };

  let prompt = "";
  if (isFullText) {
      prompt = `
        Act as a FactSport journalist. Rewrite this scraped news into a unique, high-energy article.
        Source Text: "${content}"
        RULES: 
        - KEEP the quotes, player names, and transfer fees.
        - WRITE 200-300 words. (Full Article).
        - Headline: Catchy and exciting.
        - NO plagiarism. Unique phrasing only.
        - JSON Output: { "title": "...", "body": "..." }
      `;
  } else {
      // Fallback
      prompt = `
        Act as a FactSport analyst. Write a professional update (150 words) based on this news.
        Fact: "${originalTitle} - ${content}"
        RULES: Expand on the context. Make it sound authoritative.
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
    return { title: originalTitle, body: content };
  }
}

// 3. RSS FETCHER
async function fetchRSS() {
  try {
    const res = await fetch(RSS_FEED, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const text = await res.text();
    const items = [];
    const rawItems = text.split('<item>').slice(1); 

    for (const raw of rawItems) {
      const title = raw.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] || raw.match(/<title>(.*?)<\/title>/)?.[1];
      const link = raw.match(/<link>(.*?)<\/link>/)?.[1];
      const desc = raw.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1] || raw.match(/<description>(.*?)<\/description>/)?.[1];
      
      // TalkSport images often in <media:content> or enclosure
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
    return items.slice(0, 2); 
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
    let methodUsed = "None";

    for (const item of articles) {
      // Check duplicate
      const { data: existing } = await supabase.from('news').select('id').eq('original_source_id', item.link).single();
      if (existing) continue;

      // 🛡️ SCRAPE ATTEMPT
      let textToRewrite = "";
      let isFullText = false;

      const scrapedText = await scrapeFullArticle(item.link);
      
      if (scrapedText && scrapedText.length > 200) {
          textToRewrite = scrapedText;
          isFullText = true;
          methodUsed = "Full Scrape (TalkSport)";
      } else {
          // Fallback
          textToRewrite = item.summary;
          isFullText = false;
          methodUsed = "Summary Fallback";
      }

      // 🧠 AI REWRITE
      const aiResult = await rewriteWithAI(item.title, textToRewrite, isFullText);
      
      // LOGO DETECTION (Standard)
      let team1Logo = null;
      let team2Logo = null;
      const titleLower = aiResult.title.toLowerCase(); 
      const originalTitleLower = item.title.toLowerCase();

      const { data: knownTeams } = await supabase.from('matches').select('home_team, home_logo, away_team, away_logo').limit(50);
      if (knownTeams) {
        for (const match of knownTeams) {
          if (originalTitleLower.includes(match.home_team.toLowerCase())) {
            if (!team1Logo) team1Logo = match.home_logo;
            else if (team1Logo !== match.home_logo) team2Logo = match.home_logo;
          }
          if (originalTitleLower.includes(match.away_team.toLowerCase())) {
             if (!team1Logo) team1Logo = match.away_logo;
             else if (team1Logo !== match.away_logo && team1Logo !== match.home_logo) team2Logo = match.away_logo;
          }
          if (team1Logo && team2Logo) break;
        }
      }
      let finalImage = item.image;
      if (team1Logo || team2Logo) finalImage = null; 

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

    return NextResponse.json({ 
      success: true, 
      message: `Bot Finished. Added: ${addedCount}. Method: ${methodUsed}` 
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}