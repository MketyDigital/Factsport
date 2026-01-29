import { createClient } from '@supabase/supabase-js'; 
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge'; // Cloudflare compatible
export const dynamic = 'force-dynamic';

const RSS_FEED = 'https://www.skysports.com/rss/12040'; 

// 1. 🕵️‍♀️ DEEP SCRAPER: Visits the link and extracts FULL text
async function scrapeFullArticle(url: string) {
  try {
    const res = await fetch(url, {
        headers: {
            // Fake a real Chrome browser to avoid being blocked
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    });
    
    if (!res.ok) return null;
    const html = await res.text();

    // 🎯 TARGET: SkySports stores text in <div class="sdc-article-body">
    // We use Regex to find everything between the body tags
    const bodyMatch = html.match(/<div class="sdc-article-body[^>]*>([\s\S]*?)<\/div>/);
    
    if (!bodyMatch) return null;

    // Clean up HTML tags (remove <p>, <strong>, etc) to get raw text
    let rawText = bodyMatch[1]
      .replace(/<script[^>]*>([\s\S]*?)<\/script>/g, '') // Remove scripts
      .replace(/<style[^>]*>([\s\S]*?)<\/style>/g, '')   // Remove styles
      .replace(/<[^>]+>/g, ' ')                           // Remove HTML tags
      .replace(/\s+/g, ' ')                               // Fix spaces
      .trim();

    // Limit to 2500 characters so we don't crash the AI with too much text
    return rawText.slice(0, 2500);

  } catch (e) {
    console.error("Scrape Failed:", e);
    return null;
  }
}

// 2. 🤖 AI REWRITER (Now works with FULL FACTS)
async function rewriteWithAI(originalTitle: string, fullText: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { title: originalTitle, body: "API Key missing." };

  const prompt = `
    Act as a senior football journalist for "FactSport". 
    Rewrite the following scraped news report into a unique, high-quality article.
    
    Source Text: "${fullText}"

    RULES:
    1. WRITE A FULL ARTICLE (200-250 words). Do not summarize.
    2. Include the specific QUOTES, STATS, and NAMES found in the source text.
    3. Make it unique (plagiarism-free).
    4. Headline: Click-worthy and exciting.
    5. No "SkySports" mentions.
    6. Return JSON: { "title": "...", "body": "..." }
  `;

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
    console.error("AI Rewrite Failed:", e);
    // Fallback: Use the scraped text but cut it short if AI fails
    return { title: originalTitle, body: fullText.slice(0, 500) + "..." };
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
      const imgMatch = raw.match(/url="([^"]+)"/);

      if (title && link) {
        items.push({ 
            title: title.trim(), 
            link: link.trim(), 
            image: imgMatch?.[1] || null 
        });
      }
    }
    // ⚠️ Process ONLY 2 items per run because Scraping + AI is slow/heavy
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

    for (const item of articles) {
      // Check duplicate
      const { data: existing } = await supabase.from('news').select('id').eq('original_source_id', item.link).single();
      if (existing) continue;

      // 🕵️‍♀️ STEP 1: SCRAPE FULL CONTENT
      const scrapedText = await scrapeFullArticle(item.link);
      
      if (!scrapedText || scrapedText.length < 100) {
          console.log(`Skipping ${item.title} - Could not scrape text.`);
          continue; 
      }

      // 🧠 STEP 2: AI REWRITE (With Full Context)
      const aiResult = await rewriteWithAI(item.title, scrapedText);
      
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
      message: `Deep-Bot Finished. Added ${addedCount} FULL articles.` 
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}