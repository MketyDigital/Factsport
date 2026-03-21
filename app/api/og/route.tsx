export const runtime = 'edge';
import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

// Helper to split a formation string (e.g., '4-3-3') into rows for the pitch
const parseFormationRows = (players: string[], formationStr: string) => {
    const counts = (formationStr || '4-3-3').split('-').map(Number);
    const rows = [];
    rows.push([players[0] || 'GK']); // Goalkeeper is always the first player
    let curr = 1;
    counts.forEach(count => {
        rows.push(players.slice(curr, curr + count));
        curr += count;
    });
    return rows;
};

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const dataParam = searchParams.get('data');
        if (!dataParam) {
            return new Response('Missing data parameter', { status: 400 });
        }

        // Decode the base64 payload from the webhook
        const decodedString = Buffer.from(dataParam, 'base64').toString('utf-8');
        const parsedData = JSON.parse(decodedString);

        // ==========================================
        // 🟢 TYPE 1: THE VISUAL 2D PITCH (STARTING XI)
        // ==========================================
        if (parsedData.type === 'pitch') {
            const homeRows = parseFormationRows(parsedData.homeXI, parsedData.homeFormation);
            const awayRows = parseFormationRows(parsedData.awayXI, parsedData.awayFormation);

            return new ImageResponse(
                (
                    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', backgroundColor: '#0a1428', color: 'white', fontFamily: 'sans-serif' }}>
                        {/* Header Banner */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 40px', backgroundColor: '#0f1c3a', borderBottom: '2px solid #1e293b' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: 20, color: '#facc15', fontWeight: 900, letterSpacing: '2px' }}>{parsedData.label}</span>
                                <span style={{ fontSize: 36, fontWeight: 900, marginTop: '4px' }}>{parsedData.home} <span style={{ color: '#64748b' }}>vs</span> {parsedData.away}</span>
                            </div>
                            <img src="https://factsport.com/logo.png" style={{ height: 40 }} />
                        </div>

                        {/* The Two Pitches Container */}
                        <div style={{ display: 'flex', flexDirection: 'row', flex: 1, padding: '20px', gap: '20px' }}>
                            
                            {/* HOME TEAM PITCH (Left Side) */}
                            <div style={{ display: 'flex', flex: 1, flexDirection: 'column', backgroundColor: '#2E8B57', borderRadius: '16px', border: '4px solid rgba(255,255,255,0.2)', padding: '15px' }}>
                                <div style={{ fontSize: 20, fontWeight: 900, textAlign: 'center', marginBottom: 10, color: 'white', textTransform: 'uppercase' }}>
                                    {parsedData.home} <span style={{ color: '#94a3b8', fontSize: 16 }}>({parsedData.homeFormation})</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column-reverse', flex: 1, justifyContent: 'space-between' }}>
                                    {homeRows.map((row, i) => (
                                        <div key={i} style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-around', width: '100%' }}>
                                            {row.map((player: string, j: number) => (
                                                <div key={j} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                    <div style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#2563eb', border: '3px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.5)' }}></div>
                                                    <span style={{ fontSize: 13, fontWeight: 800, marginTop: 6, backgroundColor: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: 4, color: 'white', textTransform: 'uppercase' }}>
                                                        {player?.split(' ').pop()}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* AWAY TEAM PITCH (Right Side) */}
                            <div style={{ display: 'flex', flex: 1, flexDirection: 'column', backgroundColor: '#2E8B57', borderRadius: '16px', border: '4px solid rgba(255,255,255,0.2)', padding: '15px' }}>
                                <div style={{ fontSize: 20, fontWeight: 900, textAlign: 'center', marginBottom: 10, color: 'white', textTransform: 'uppercase' }}>
                                    {parsedData.away} <span style={{ color: '#94a3b8', fontSize: 16 }}>({parsedData.awayFormation})</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column-reverse', flex: 1, justifyContent: 'space-between' }}>
                                    {awayRows.map((row, i) => (
                                        <div key={i} style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-around', width: '100%' }}>
                                            {row.map((player: string, j: number) => (
                                                <div key={j} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                    <div style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#dc2626', border: '3px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.5)' }}></div>
                                                    <span style={{ fontSize: 13, fontWeight: 800, marginTop: 6, backgroundColor: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: 4, color: 'white', textTransform: 'uppercase' }}>
                                                        {player?.split(' ').pop()}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>
                    </div>
                ),
                { width: 1200, height: 630 }
            );
        }

        // ==========================================
        // 🟢 TYPE 2: THE VERSUS SCORECARD (FULL TIME/HT)
        // ==========================================
        return new ImageResponse(
            (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', backgroundColor: '#0a1428', color: 'white', fontFamily: 'sans-serif' }}>
                    <img src="https://factsport.com/logo.png" style={{ height: 60, position: 'absolute', top: 40, left: 40 }} />
                    <span style={{ fontSize: 28, color: '#facc15', fontWeight: 900, letterSpacing: '4px', marginBottom: 20 }}>{parsedData.label}</span>
                    
                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '40px' }}>
                        <span style={{ fontSize: 72, fontWeight: 900 }}>{parsedData.home}</span>
                        <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#1e293b', padding: '20px 40px', borderRadius: '20px' }}>
                            <span style={{ fontSize: 90, fontWeight: 900 }}>{parsedData.hScore}</span>
                            <span style={{ fontSize: 50, color: '#64748b', margin: '0 20px' }}>-</span>
                            <span style={{ fontSize: 90, fontWeight: 900 }}>{parsedData.aScore}</span>
                        </div>
                        <span style={{ fontSize: 72, fontWeight: 900 }}>{parsedData.away}</span>
                    </div>
                </div>
            ),
            { width: 1200, height: 630 }
        );

    } catch (e) {
        return new Response(`Failed to generate image`, { status: 500 });
    }
}