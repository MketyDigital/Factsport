export const runtime = 'edge';
import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

const parseFormationRows = (players: string[], formationStr: string) => {
    const counts = (formationStr || '4-3-3').split('-').map(n => parseInt(n) || 0);
    const rows = [];
    rows.push([players && players.length > 0 ? players[0] : 'GK']); 
    let curr = 1;
    counts.forEach(count => {
        if (count > 0) {
            const rowPlayers = (players || []).slice(curr, curr + count);
            while(rowPlayers.length < count) rowPlayers.push(''); // Pad safely
            rows.push(rowPlayers);
            curr += count;
        }
    });
    return rows;
};

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

        // 🟢 1. PITCH LINEUP TEMPLATE (100% Satori Safe)
        if (parsedData.type === 'pitch') {
            const homeRows = parseFormationRows(parsedData.homeXI || [], parsedData.homeFormation);
            const awayRows = parseFormationRows(parsedData.awayXI || [], parsedData.awayFormation);

            // SATORI FIX: Mathematically reverse the rows instead of using CSS column-reverse
            const renderHomeRows = [...homeRows].reverse();
            const renderAwayRows = [...awayRows].reverse();

            return new ImageResponse(
                (
                    <div style={{ display: 'flex', flexDirection: 'column', width: 1200, height: 630, backgroundColor: '#0a1428', color: 'white', fontFamily: 'sans-serif' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 40px', backgroundColor: '#0f1c3a', borderBottom: '2px solid #1e293b', height: 100 }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <div style={{ fontSize: 20, color: '#facc15', fontWeight: 900, letterSpacing: '2px', textTransform: 'uppercase' }}>{parsedData.label}</div>
                                <div style={{ display: 'flex', alignItems: 'center', fontSize: 36, fontWeight: 900, marginTop: '4px' }}>
                                    {parsedData.home} <span style={{ color: '#64748b', margin: '0 8px' }}>vs</span> {parsedData.away}
                                </div>
                            </div>
                            <img src="https://factsport.com/logo.png" style={{ height: 40 }} />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'row', flex: 1, padding: '20px' }}>
                            {/* HOME TEAM */}
                            <div style={{ display: 'flex', flex: 1, flexDirection: 'column', backgroundColor: '#2E8B57', borderRadius: 16, border: '4px solid rgba(255,255,255,0.2)', padding: '15px', marginRight: '10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 10 }}>
                                    <div style={{ fontSize: 20, fontWeight: 900, color: 'white', textTransform: 'uppercase' }}>
                                        {parsedData.home} <span style={{ color: '#94a3b8', fontSize: 16 }}>({parsedData.homeFormation})</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                                    {renderHomeRows.map((row, i) => (
                                        <div key={i} style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-around', width: '100%' }}>
                                            {row.map((player: string, j: number) => {
                                                // 🟢 GHOST FIX: Clean spaces so "Igor Jesus " doesn't crash Satori
                                                const cleanName = player ? player.trim() : '';
                                                const lastName = cleanName ? cleanName.split(' ').pop() : '';
                                                return (
                                                    <div key={j} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                        <div style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#2563eb', border: '3px solid white', display: 'flex' }}></div>
                                                        {lastName && lastName !== "" && (
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 6, backgroundColor: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: 4 }}>
                                                                <div style={{ fontSize: 13, fontWeight: 800, color: 'white', textTransform: 'uppercase' }}>
                                                                    {lastName}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* AWAY TEAM */}
                            <div style={{ display: 'flex', flex: 1, flexDirection: 'column', backgroundColor: '#2E8B57', borderRadius: 16, border: '4px solid rgba(255,255,255,0.2)', padding: '15px', marginLeft: '10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 10 }}>
                                    <div style={{ fontSize: 20, fontWeight: 900, color: 'white', textTransform: 'uppercase' }}>
                                        {parsedData.away} <span style={{ color: '#94a3b8', fontSize: 16 }}>({parsedData.awayFormation})</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                                    {renderAwayRows.map((row, i) => (
                                        <div key={i} style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-around', width: '100%' }}>
                                            {row.map((player: string, j: number) => {
                                                // 🟢 GHOST FIX: Clean spaces
                                                const cleanName = player ? player.trim() : '';
                                                const lastName = cleanName ? cleanName.split(' ').pop() : '';
                                                return (
                                                    <div key={j} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                        <div style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#dc2626', border: '3px solid white', display: 'flex' }}></div>
                                                        {lastName && lastName !== "" && (
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 6, backgroundColor: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: 4 }}>
                                                                <div style={{ fontSize: 13, fontWeight: 800, color: 'white', textTransform: 'uppercase' }}>
                                                                    {lastName}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
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

        // 🟢 2. VERSUS TEMPLATE
        if (parsedData.type === 'versus') {
            const isGoal = (parsedData.label || '').includes('GOAL');
            return new ImageResponse(
                (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 1200, height: 630, backgroundColor: '#0a1428', color: 'white', fontFamily: 'sans-serif' }}>
                        <img src="https://factsport.com/logo.png" style={{ height: 60, position: 'absolute', top: 40, left: 40 }} />
                        <div style={{ display: 'flex', fontSize: 32, color: isGoal ? '#ef4444' : '#facc15', fontWeight: 900, letterSpacing: '4px', marginBottom: 40, textTransform: 'uppercase' }}>
                            {parsedData.label}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', width: '90%', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '35%' }}>
                                {parsedData.homeLogo ? (
                                    <img src={parsedData.homeLogo} style={{ width: 180, height: 180, objectFit: 'contain', marginBottom: 20 }} />
                                ) : (
                                    <div style={{ width: 180, height: 180, backgroundColor: '#1e293b', borderRadius: 90, marginBottom: 20, display: 'flex' }}></div>
                                )}
                                <div style={{ display: 'flex', fontSize: 42, fontWeight: 900, textAlign: 'center', textTransform: 'uppercase' }}>{parsedData.home}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e293b', padding: '20px 40px', borderRadius: 20, border: '2px solid #334155' }}>
                                <div style={{ fontSize: 110, fontWeight: 900, color: '#4ade80' }}>{parsedData.hScore}</div>
                                <div style={{ fontSize: 60, color: '#64748b', margin: '0 30px' }}>-</div>
                                <div style={{ fontSize: 110, fontWeight: 900, color: '#4ade80' }}>{parsedData.aScore}</div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '35%' }}>
                                {parsedData.awayLogo ? (
                                    <img src={parsedData.awayLogo} style={{ width: 180, height: 180, objectFit: 'contain', marginBottom: 20 }} />
                                ) : (
                                    <div style={{ width: 180, height: 180, backgroundColor: '#1e293b', borderRadius: 90, marginBottom: 20, display: 'flex' }}></div>
                                )}
                                <div style={{ display: 'flex', fontSize: 42, fontWeight: 900, textAlign: 'center', textTransform: 'uppercase' }}>{parsedData.away}</div>
                            </div>
                        </div>
                    </div>
                ),
                { width: 1200, height: 630 }
            );
        }

        // 🟢 3. SCHEDULE/RESULTS GRID TEMPLATE
        return new ImageResponse(
            (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 1200, height: 630, backgroundColor: '#0a1428', color: 'white', fontFamily: 'sans-serif', padding: '40px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', borderBottom: '2px solid #1e293b', paddingBottom: '20px', marginBottom: '30px' }}>
                        <img src="https://factsport.com/logo.png" style={{ height: 60 }} />
                        <div style={{ display: 'flex', fontSize: 32, color: '#facc15', fontWeight: 900, letterSpacing: '4px', textTransform: 'uppercase' }}>
                            {parsedData.label}
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', width: '100%', justifyContent: 'center' }}>
                        {parsedData.matches && parsedData.matches.length > 0 ? (
                            parsedData.matches.slice(0, 10).map((m: any, i: number) => (
                                <div key={i} style={{ display: 'flex', width: '45%', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0f1c3a', padding: '15px 25px', borderRadius: 15, border: '2px solid #1e293b' }}>
                                    <div style={{ display: 'flex', width: '40%', justifyContent: 'flex-end' }}>
                                        <div style={{ fontSize: 24, fontWeight: 900 }}>{(m.home || '').substring(0, 14)}</div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'center', margin: '0 15px' }}>
                                        <div style={{ fontSize: 22, fontWeight: 900, color: m.score ? '#4ade80' : '#facc15' }}>{m.score || m.time}</div>
                                    </div>
                                    <div style={{ display: 'flex', width: '40%', justifyContent: 'flex-start' }}>
                                        <div style={{ fontSize: 24, fontWeight: 900 }}>{(m.away || '').substring(0, 14)}</div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div style={{ display: 'flex', fontSize: 48, fontWeight: 900 }}>Matchday Live</div>
                        )}
                    </div>
                </div>
            ),
            { width: 1200, height: 630 }
        );

    } catch (e) {
        return new ImageResponse(
            (<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 1200, height: 630, backgroundColor: '#0a1428', color: 'white' }}><h1>FactSport</h1></div>), 
            { width: 1200, height: 630 }
        );
    }
}