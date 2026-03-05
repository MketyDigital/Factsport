import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // 🔒 SECURITY CHECK
    const key = searchParams.get('key');
    if (key !== process.env.CRON_KEY) {
      return new Response('Unauthorized Image Generation', { status: 401 });
    }

    const type = searchParams.get('type') || 'versus'; 

    // ==========================================
    // 🎨 MODE 1: THE "VERSUS / RESULT" GRAPHIC
    // ==========================================
    if (type === 'versus') {
      const home = searchParams.get('home') || 'Home Team';
      const away = searchParams.get('away') || 'Away Team';
      const homeLogo = searchParams.get('homeLogo');
      const awayLogo = searchParams.get('awayLogo');
      const hScore = searchParams.get('hScore');
      const aScore = searchParams.get('aScore');
      const label = searchParams.get('label') || 'MATCHDAY LIVE';

      const isResult = hScore !== null && aScore !== null;

      return new ImageResponse(
        (
          <div
            style={{
              height: '100%', width: '100%', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(to bottom right, #0f172a, #020617)',
              fontFamily: 'sans-serif',
            }}
          >
            <div
              style={{
                position: 'absolute', top: 60, display: 'flex',
                background: 'rgba(220, 38, 38, 0.9)', color: 'white',
                padding: '10px 30px', borderRadius: '8px',
                fontSize: 32, fontWeight: 'bold', letterSpacing: '4px', textTransform: 'uppercase',
              }}
            >
              {label}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '80px', marginTop: '40px' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '350px' }}>
                {homeLogo ? (
                  <img src={homeLogo} alt={home} width={250} height={250} style={{ objectFit: 'contain' }} />
                ) : (
                  <div style={{ fontSize: 40, color: 'white', fontWeight: 'bold' }}>{home}</div>
                )}
                {isResult && <span style={{ fontSize: 90, color: 'white', fontWeight: 'bold', marginTop: '20px' }}>{hScore}</span>}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {!isResult && <span style={{ fontSize: 40, color: '#facc15', fontWeight: '900', letterSpacing: '4px' }}>VS</span>}
                {isResult && <span style={{ fontSize: 80, color: '#94a3b8', fontWeight: '900' }}>-</span>}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '350px' }}>
                {awayLogo ? (
                  <img src={awayLogo} alt={away} width={250} height={250} style={{ objectFit: 'contain' }} />
                ) : (
                  <div style={{ fontSize: 40, color: 'white', fontWeight: 'bold' }}>{away}</div>
                )}
                {isResult && <span style={{ fontSize: 90, color: 'white', fontWeight: 'bold', marginTop: '20px' }}>{aScore}</span>}
              </div>

            </div>

            <div
              style={{
                position: 'absolute', bottom: 40, fontSize: 28,
                color: 'rgba(255, 255, 255, 0.5)', fontWeight: 'bold',
                letterSpacing: '6px', textTransform: 'uppercase',
              }}
            >
              FACTSPORT.COM
            </div>
          </div>
        ),
        { width: 1200, height: 630 }
      );
    }

    // ==========================================
    // 📅 MODE 2: THE "DAILY SCHEDULE" GRAPHIC
    // ==========================================
    if (type === 'schedule') {
      const matchesStr = searchParams.get('matches') || '';
      const matchArray = matchesStr.split('|').filter(Boolean).map(m => {
        const parts = m.split('_');
        return { home: parts[0], away: parts[1], time: parts[2] };
      });

      const useTwoColumns = matchArray.length > 8;
      const col1 = useTwoColumns ? matchArray.slice(0, Math.ceil(matchArray.length / 2)) : matchArray;
      const col2 = useTwoColumns ? matchArray.slice(Math.ceil(matchArray.length / 2)) : [];

      const fontSize = matchArray.length > 12 ? 24 : 32;
      const rowPadding = matchArray.length > 12 ? '10px 0' : '15px 0';

      const renderMatchRow = (match: { home: string, away: string, time: string }, index: number) => (
        <div key={index} style={{ display: 'flex', width: '100%', justifyContent: 'space-between', padding: rowPadding, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <span style={{ color: 'white', fontWeight: 'bold', fontSize, width: '40%', textAlign: 'right' }}>{match.home}</span>
          <span style={{ color: '#facc15', fontWeight: 'bold', fontSize, width: '20%', textAlign: 'center' }}>{match.time}</span>
          <span style={{ color: 'white', fontWeight: 'bold', fontSize, width: '40%', textAlign: 'left' }}>{match.away}</span>
        </div>
      );

      return new ImageResponse(
        (
          <div
            style={{
              height: '100%', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
              background: 'linear-gradient(to bottom right, #0f172a, #020617)', fontFamily: 'sans-serif', padding: '60px 80px',
            }}
          >
            <div style={{ fontSize: 50, color: '#facc15', fontWeight: '900', letterSpacing: '4px', marginBottom: '40px', textTransform: 'uppercase' }}>
              TODAY'S SCHEDULE
            </div>

            <div style={{ display: 'flex', flexDirection: 'row', width: '100%', justifyContent: 'space-between', gap: '40px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', width: useTwoColumns ? '48%' : '100%' }}>
                {col1.map(renderMatchRow)}
              </div>
              {useTwoColumns && (
                <div style={{ display: 'flex', flexDirection: 'column', width: '48%' }}>
                  {col2.map(renderMatchRow)}
                </div>
              )}
            </div>
            
            <div style={{ position: 'absolute', bottom: 30, fontSize: 24, color: 'rgba(255, 255, 255, 0.4)', fontWeight: 'bold', letterSpacing: '4px' }}>
              FACTSPORT.COM
            </div>
          </div>
        ),
        { width: 1200, height: 630 }
      );
    }

    return new Response('Invalid Type', { status: 400 });

  } catch (error) {
    console.error("OG Image Generation Error:", error);
    return new Response('Failed to generate image', { status: 500 });
  }
}