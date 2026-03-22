export const runtime = 'edge';
import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

const parseFormationRows = (players: string[], formationStr: string) => {
    const counts = (formationStr || '4-3-3').split('-').map(Number);
    const rows = [];
    rows.push([players[0] || 'GK']); 
    let curr = 1;
    counts.forEach(count => {
        rows.push(players.slice(curr, curr + count));
        curr += count;
    });
    return rows;
};

// 🟢 CLOUDFLARE EDGE-SAFE DECODER (Zero Node.js Buffers)
function decodeBase64Safe(safeBase64: string) {
    try {
        let base64 = safeBase64.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) base64 += '=';
        
        const binaryStr = atob(base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
        }
        return new TextDecoder('utf-8').decode(bytes);
    } catch (e) {
        return "{}"; 
    }
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const dataParam = searchParams.get('data');
        
        if (!dataParam) return new Response('Missing data', { status: 400 });

        const jsonStr = decodeBase64Safe(dataParam);
        const parsedData = JSON.parse(jsonStr);

        // 🟢 1. PITCH LINEUP TEMPLATE
        if (parsedData.type === 'pitch') {
            const homeRows = parseFormationRows(parsedData.homeXI || [], parsedData.homeFormation);
            const awayRows = parseFormationRows(parsedData.awayXI || [], parsedData.awayFormation);

            return new ImageResponse(
                (
                    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', backgroundColor: '#0a1428', color: 'white', fontFamily: 'sans-serif' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 40px', backgroundColor: '#0f1c3a', borderBottom: '2px solid #1e293b' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: 20, color: '#facc15', fontWeight: 900, letterSpacing: '2px' }}>{parsedData.label}</span>
                                <span style={{ fontSize: 36, fontWeight: 900, marginTop: '4px' }}>{parsedData.home} <span style={{ color: '#64748b' }}>vs</span> {parsedData.away}</span>
                            </div>
                            <img src="https://factsport.com/logo.png" style={{ height: 40 }} />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'row', flex: 1, padding: '20px' }}>
                            {/* HOME TEAM */}
                            <div style={{ display: 'flex', flex: 1, flexDirection: 'column', backgroundColor: '#2E8B57', borderRadius: '16px', border: '4px solid rgba(255,255,255,0.2)', padding: '15px', marginRight: '10px' }}>
                                <div style={{ fontSize: 20, fontWeight: 900, textAlign: 'center', marginBottom: 10, color: 'white', textTransform: 'uppercase' }}>
                                    {parsedData.home} <span style={{ color: '#94a3b8', fontSize: 16 }}>({parsedData.homeFormation})</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column-reverse', flex: 1, justifyContent: 'space-between' }}>
                                    {homeRows.map((row, i) => (
                                        <div key={i} style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-around', width: '100%' }}>
                                            {row.map((player: string, j: number) => (
                                                <div key={j} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                    <div style={{ width: 34, height: 34, borderRadius: '50%', backgroundColor: '#2563eb', border: '3px solid white', display: 'flex' }}></div>
                                                    <span style={{ fontSize: 13, fontWeight: 800, marginTop: 6, backgroundColor: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: 4, color: 'white', textTransform: 'uppercase' }}>
                                                        {player?.split(' ').pop()}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* AWAY TEAM */}
                            <div style={{ display: 'flex', flex: 1, flexDirection: 'column', backgroundColor: '#2E8B57', borderRadius: '16px', border: '4px solid rgba(255,255,255,0.2)', padding: '15px', marginLeft: '10px' }}>
                                <div style={{ fontSize: 20, fontWeight: 900, textAlign: 'center', marginBottom: 10, color: 'white', textTransform: 'uppercase' }}>
                                    {parsedData.away} <span style={{ color: '#94a3b8', fontSize: 16 }}>({parsedData.awayFormation})</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column-reverse', flex: 1, justifyContent: 'space-between' }}>
                                    {awayRows.map((row, i) => (
                                        <div key={i} style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-around', width: '100%' }}>
                                            {row.map((player: string, j: number) => (
                                                <div key={j} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                    <div style={{ width: 34, height: 34, borderRadius: '50%', backgroundColor: '#dc2626', border: '3px solid white', display: 'flex' }}></div>
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

        // 🟢 2. VERSUS TEMPLATE (Used for Kickoff, Goals, and Full Time)
        if (parsedData.type === 'versus') {
            const isGoal = parsedData.label.includes('GOAL');
            return new ImageResponse(
                (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', backgroundColor: '#0a1428', color: 'white', fontFamily: 'sans-serif' }}>
                        <img src="https://factsport.com/logo.png" style={{ height: 60, position: 'absolute', top: 40, left: 40 }} />
                        <span style={{ fontSize: 32, color: isGoal ? '#ef4444' : '#facc15', fontWeight: 900, letterSpacing: '4px', marginBottom: 40 }}>{parsedData.label}</span>
                        
                        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', width: '90%', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '35%' }}>
                                {parsedData.homeLogo ? (
                                    <img src={parsedData.homeLogo} style={{ width: 180, height: 180, objectFit: 'contain', marginBottom: 20 }} />
                                ) : (
                                    <div style={{ width: 180, height: 180, backgroundColor: '#1e293b', borderRadius: '50%', marginBottom: 20 }}></div>
                                )}
                                <span style={{ fontSize: 42, fontWeight: 900, textAlign: 'center', textTransform: 'uppercase' }}>{parsedData.home}</span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#1e293b', padding: '20px 40px', borderRadius: '20px', border: '2px solid #334155' }}>
                                <span style={{ fontSize: 110, fontWeight: 900, color: '#4ade80' }}>{parsedData.hScore}</span>
                                <span style={{ fontSize: 60, color: '#64748b', margin: '0 30px' }}>-</span>
                                <span style={{ fontSize: 110, fontWeight: 900, color: '#4ade80' }}>{parsedData.aScore}</span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '35%' }}>
                                {parsedData.awayLogo ? (
                                    <img src={parsedData.awayLogo} style={{ width: 180, height: 180, objectFit: 'contain', marginBottom: 20 }} />
                                ) : (
                                    <div style={{ width: 180, height: 180, backgroundColor: '#1e293b', borderRadius: '50%', marginBottom: 20 }}></div>
                                )}
                                <span style={{ fontSize: 42, fontWeight: 900, textAlign: 'center', textTransform: 'uppercase' }}>{parsedData.away}</span>
                            </div>
                        </div>
                    </div>
                ),
                { width: 1200, height: 630 }
            );
        }

        // 🟢 3. SCHEDULE/RESULTS GRID TEMPLATE (For Morning & Evening Crons)
        return new ImageResponse(
            (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', height: '100%', backgroundColor: '#0a1428', color: 'white', fontFamily: 'sans-serif', padding: '40px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', borderBottom: '2px solid #1e293b', paddingBottom: '20px', marginBottom: '30px' }}>
                        <img src="https://factsport.com/logo.png" style={{ height: 60 }} />
                        <span style={{ fontSize: 32, color: '#facc15', fontWeight: 900, letterSpacing: '4px', textTransform: 'uppercase' }}>{parsedData.label}</span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', width: '100%', justifyContent: 'center' }}>
                        {parsedData.matches && parsedData.matches.length > 0 ? (
                            parsedData.matches.slice(0, 10).map((m: any, i: number) => (
                                <div key={i} style={{ display: 'flex', width: '45%', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0f1c3a', padding: '15px 25px', borderRadius: '15px', border: '2px solid #1e293b' }}>
                                    <span style={{ fontSize: 24, fontWeight: 900, width: '40%', textAlign: 'right' }}>{m.home.substring(0, 14)}</span>
                                    <span style={{ fontSize: 22, fontWeight: 900, color: m.score ? '#4ade80' : '#facc15', margin: '0 15px' }}>{m.score || m.time}</span>
                                    <span style={{ fontSize: 24, fontWeight: 900, width: '40%', textAlign: 'left' }}>{m.away.substring(0, 14)}</span>
                                </div>
                            ))
                        ) : (
                            <span style={{ fontSize: 48, fontWeight: 900 }}>Matchday Live</span>
                        )}
                    </div>
                </div>
            ),
            { width: 1200, height: 630 }
        );

    } catch (e) {
        return new ImageResponse(
            (<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', backgroundColor: '#0a1428', color: 'white' }}><h1>FactSport</h1></div>), 
            { width: 1200, height: 630 }
        );
    }
}