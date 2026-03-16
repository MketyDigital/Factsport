import { SignJWT, importPKCS8 } from 'jose';
import { NextResponse } from 'next/server';

export const runtime = 'edge'; // 🟢 100% Cloudflare Pages Compatible!

export async function POST(request: Request) {
    // 🛡️ SECURITY: Only YOU or your internal webhooks can trigger this
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.CRON_KEY}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 🟢 FAIL-SAFE: Skip if keys are not added to Vercel/Cloudflare yet
    if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
        return NextResponse.json({ success: true, message: 'Skipped: Google keys not configured.' });
    }

    try {
        const { url, type = 'URL_UPDATED' } = await request.json();

        if (!url) return NextResponse.json({ error: 'Missing URL' }, { status: 400 });

        // 1. Format the private key
        const privateKeyStr = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
        const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;

        // 2. Import the key using the edge-friendly 'jose' library
        const privateKey = await importPKCS8(privateKeyStr, 'RS256');

        // 3. Manually create and sign the Google Auth Token
        const jwt = await new SignJWT({
            iss: clientEmail,
            sub: clientEmail,
            aud: 'https://oauth2.googleapis.com/token',
            scope: 'https://www.googleapis.com/auth/indexing',
        })
            .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
            .setIssuedAt()
            .setExpirationTime('1h')
            .sign(privateKey);

        // 4. Exchange the JWT for an Access Token using pure fetch
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion: jwt,
            }),
        });

        const tokenData = await tokenRes.json();
        
        if (!tokenData.access_token) {
            throw new Error('Failed to retrieve Google Access Token');
        }

        // 5. Send the actual ping to the Indexing API
        const pingRes = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${tokenData.access_token}`,
            },
            body: JSON.stringify({ url, type }),
        });

        const data = await pingRes.json();

        if (!pingRes.ok) throw new Error(data.error?.message || 'Google Indexing API failed');

        return NextResponse.json({ success: true, message: `Successfully pinged Google: ${url}`, data });

    } catch (error: any) {
        console.error('Indexing API Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}