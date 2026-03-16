import { google } from 'googleapis';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs'; // 🟢 Must be Node.js for Google Auth Library

export async function POST(request: Request) {
    // 🛡️ SECURITY: Only YOU or your internal webhooks can trigger this
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.CRON_KEY}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 🟢 FAIL-SAFE: If keys aren't added to Vercel yet, just return success so the webhook doesn't crash
    if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
        return NextResponse.json({ success: true, message: 'Skipped: Google keys not yet configured in Vercel.' });
    }

    try {
        const { url, type = 'URL_UPDATED' } = await request.json();

        if (!url) return NextResponse.json({ error: 'Missing URL' }, { status: 400 });

        // Format the private key to fix Vercel environment variable line breaks
        const privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

        // Authenticate the Service Account
        const jwtClient = new google.auth.JWT(
            process.env.GOOGLE_CLIENT_EMAIL,
            undefined,
            privateKey,
            ['https://www.googleapis.com/auth/indexing'],
            undefined
        );

        await jwtClient.authorize();

        // Send the ping to Google
        const response = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwtClient.credentials.access_token}`,
            },
            body: JSON.stringify({ url: url, type: type }),
        });

        const data = await response.json();

        if (!response.ok) throw new Error(data.error?.message || 'Google Indexing API failed');

        return NextResponse.json({ success: true, message: `Successfully pinged Google to index: ${url}`, data });

    } catch (error: any) {
        console.error('Indexing API Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}