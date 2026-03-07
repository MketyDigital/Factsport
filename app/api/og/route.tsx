import { ImageResponse } from 'next/og';

export const runtime = 'edge';

// 🟢 THE FALLBACK: If anything breaks, Twitter gets this image instead of crashing!
const getFallbackImage = () => {
  return new ImageResponse(
    (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', fontSize: 80, fontWeight: 'bold', color: '#fbbf24', letterSpacing: '4px' }}>
          FACTSPORT
        </div>
        <div style={{ display: 'flex', fontSize: 40, color: '#f8fafc', marginTop: 20 }}>
          LIVE MATCH UPDATE
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dataParam = searchParams.get('data');

    if (!dataParam) return getFallbackImage();

    // 🔓 DECRYPT THE BASE64 DATA
    const decodedData = Buffer.from(dataParam, 'base64').toString('utf-8');
    const data = JSON.parse(decodedData);

    const type = data.type;
    const label = data.label || 'MATCHDAY';

    return new ImageResponse(
      (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', backgroundColor: '#0f172a', color: 'white', fontFamily: 'sans-serif', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: type === 'schedule' ? 15 : 30 }}>
            <div style={{ display: 'flex', fontSize: type === 'schedule' ? 40 : 60, fontWeight: 'bold', color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '4px' }}>
              {label}
            </div>
            {/* 🌍 GMT TIMEZONE BADGE FOR SCHEDULE */}
            {type === 'schedule' && (
              <div style={{ display: 'flex', fontSize: 16, fontWeight: 'bold', color: '#94a3b8', backgroundColor: 'rgba(255,255,255,0.1)', padding: '4px 12px', borderRadius: '20px', marginTop: '8px', letterSpacing: '2px' }}>
                ALL KICK-OFF TIMES IN GMT
              </div>
            )}
          </div>

          {/* 📅 CONDENSED SCHEDULE LAYOUT (Fits up to 14 Matches) */}
          {type === 'schedule' && data.matches && (
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', width: '100%', padding: '0 20px' }}>
              {data.matches.map((match: any, index: number) => (
                <div key={index} style={{ 
                  display: 'flex', 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  width: '46%', 
                  backgroundColor: '#1e293b', 
                  margin: '6px 15px', 
                  padding: '8px 12px', 
                  borderRadius: '8px', 
                  borderLeft: '4px solid #fbbf24' 
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', width: '75%' }}>
                    <div style={{ display: 'flex', fontSize: 18, fontWeight: 'bold', color: '#f8fafc', marginBottom: 2 }}>{match.home}</div>
                    <div style={{ display: 'flex', fontSize: 18, fontWeight: 'bold', color: '#f8fafc' }}>{match.away}</div>
                  </div>
                  <div style={{ display: 'flex', fontSize: 16, fontWeight: 'bold', color: '#94a3b8', backgroundColor: '#0f172a', padding: '6px 10px', borderRadius: '6px' }}>
                    {match.time}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ⚔️ VERSUS LAYOUT (Lineups & FT - Keeps the bigger fonts) */}
          {type === 'versus' && (
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%', padding: '0 80px' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '40%' }}>
                <div style={{ display: 'flex', fontSize: 48, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' }}>{data.home}</div>
                {data.hScore !== undefined && <div style={{ display: 'flex', fontSize: 80, fontWeight: 'bold', color: '#fbbf24', marginBottom: 10 }}>{data.hScore}</div>}
                {data.homeXI && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 15, fontSize: 22, color: '#e2e8f0', lineHeight: 1.3 }}>
                    {data.homeXI.split(',').map((player: string, index: number) => (
                      <div key={index} style={{ display: 'flex' }}>{player.trim()}</div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', fontSize: 40, fontWeight: 'bold', color: '#64748b', marginTop: 10 }}>VS</div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '40%' }}>
                <div style={{ display: 'flex', fontSize: 48, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' }}>{data.away}</div>
                {data.aScore !== undefined && <div style={{ display: 'flex', fontSize: 80, fontWeight: 'bold', color: '#fbbf24', marginBottom: 10 }}>{data.aScore}</div>}
                {data.awayXI && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 15, fontSize: 22, color: '#e2e8f0', lineHeight: 1.3 }}>
                    {data.awayXI.split(',').map((player: string, index: number) => (
                      <div key={index} style={{ display: 'flex' }}>{player.trim()}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', position: 'absolute', bottom: 20, fontSize: 20, fontWeight: 'bold', color: '#64748b', letterSpacing: '2px' }}>
            FACTSPORT.COM
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  } catch (e: any) {
    console.error("OG Image Error:", e);
    // 🚨 Return the safe fallback image instead of crashing!
    return getFallbackImage();
  }
}