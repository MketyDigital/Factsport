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
            while(rowPlayers.length < count) rowPlayers.push(''); 
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

// 🟢 EDGE SAFE TEXT CLEANER (Removes accents like 'é' that crash Cloudflare fonts)
function cleanText(str: string) {
    if (!str) return '';
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

// Fallback Player SVG Icon
const PlayerIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
    </svg>
);

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

            const renderHomeRows = [...homeRows].reverse();
            const renderAwayRows = [...awayRows].reverse();

            return new ImageResponse(
                (
                    <div style={{ display: 'flex', flexDirection: 'column', width: 1200, height: 630, backgroundColor: '#0a1428', color: 'white', fontFamily: 'sans-serif' }}>
                        
                        {/* HEADER */}
                        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 100, backgroundColor: '#0f1c3a', borderBottomWidth: 2, borderBottomStyle: 'solid', borderBottomColor: '#1e293b', paddingLeft: 40, paddingRight: 40 }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', fontSize: 20, color: '#facc15', fontWeight: 900, letterSpacing: '2px' }}>
                                    {cleanText(parsedData.label || 'STARTING XI')}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', fontSize: 36, fontWeight: 900, marginTop: 4 }}>
                                    <div style={{ display: 'flex', color: 'white' }}>{cleanText(parsedData.home)}</div>
                                    <div style={{ display: 'flex', color: '#64748b', marginLeft: 12, marginRight: 12 }}>VS</div>
                                    <div style={{ display: 'flex', color: 'white' }}>{cleanText(parsedData.away)}</div>
                                </div>
                            </div>
                            <img src="https://factsport.com/logo.png" style={{ display: 'flex', width: 40, height: 40 }} />
                        </div>

                        {/* PITCH AREA */}
                        <div style={{ display: 'flex', flexDirection: 'row', width: 1200, height: 530, paddingTop: 20, paddingBottom: 20, paddingLeft: 20, paddingRight: 20 }}>
                            
                            {/* HOME TEAM */}
                            <div style={{ display: 'flex', flexDirection: 'column', width: '48%', height: '100%', backgroundColor: '#2E8B57', borderRadius: 16, borderWidth: 4, borderStyle: 'solid', borderColor: '#ffffff33', paddingTop: 15, paddingBottom: 15 }}>
                                <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: 40, marginBottom: 10 }}>
                                    <div style={{ display: 'flex', fontSize: 20, fontWeight: 900, color: 'white' }}>
                                        {cleanText(parsedData.home)} 
                                    </div>
                                    <div style={{ display: 'flex', fontSize: 16, color: '#94a3b8', marginLeft: 8 }}>
                                        ({parsedData.homeFormation})
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between', width: '100%' }}>
                                    {renderHomeRows.map((row, i) => (
                                        <div key={i} style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-around', width: '100%' }}>
                                            {(row || []).map((player: string, j: number) => {
                                                const playerStr = player ? String(player).trim() : '';
                                                const numberMatch = playerStr.match(/\b(\d{1,2})\b/);
                                                const playerNumber = numberMatch ? numberMatch[0] : '';
                                                const nameCleaned = playerStr.replace(/\b\d{1,2}\b/g, '').replace(/[()]/g, '').trim();
                                                const lastName = nameCleaned ? nameCleaned.split(' ').pop() : '';

                                                return (
                                                    <div key={j} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 17, backgroundColor: '#2563eb', borderWidth: 3, borderStyle: 'solid', borderColor: '#ffffff' }}>
                                                            {playerNumber ? (
                                                                <span style={{ fontSize: 14, fontWeight: 900, color: 'white', marginTop: 2 }}>{playerNumber}</span>
                                                            ) : (
                                                                <PlayerIcon />
                                                            )}
                                                        </div>
                                                        {lastName ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 6, backgroundColor: '#00000099', paddingTop: 2, paddingBottom: 2, paddingLeft: 6, paddingRight: 6, borderRadius: 4 }}>
                                                                <div style={{ display: 'flex', fontSize: 13, fontWeight: 800, color: 'white' }}>
                                                                    {cleanText(lastName)}
                                                                </div>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* SPACING */}
                            <div style={{ display: 'flex', width: '4%' }}></div>

                            {/* AWAY TEAM */}
                            <div style={{ display: 'flex', flexDirection: 'column', width: '48%', height: '100%', backgroundColor: '#2E8B57', borderRadius: 16, borderWidth: 4, borderStyle: 'solid', borderColor: '#ffffff33', paddingTop: 15, paddingBottom: 15 }}>
                                <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: 40, marginBottom: 10 }}>
                                    <div style={{ display: 'flex', fontSize: 20, fontWeight: 900, color: 'white' }}>
                                        {cleanText(parsedData.away)} 
                                    </div>
                                    <div style={{ display: 'flex', fontSize: 16, color: '#94a3b8', marginLeft: 8 }}>
                                        ({parsedData.awayFormation})
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between', width: '100%' }}>
                                    {renderAwayRows.map((row, i) => (
                                        <div key={i} style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-around', width: '100%' }}>
                                            {(row || []).map((player: string, j: number) => {
                                                const playerStr = player ? String(player).trim() : '';
                                                const numberMatch = playerStr.match(/\b(\d{1,2})\b/);
                                                const playerNumber = numberMatch ? numberMatch[0] : '';
                                                const nameCleaned = playerStr.replace(/\b\d{1,2}\b/g, '').replace(/[()]/g, '').trim();
                                                const lastName = nameCleaned ? nameCleaned.split(' ').pop() : '';

                                                return (
                                                    <div key={j} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 17, backgroundColor: '#dc2626', borderWidth: 3, borderStyle: 'solid', borderColor: '#ffffff' }}>
                                                            {playerNumber ? (
                                                                <span style={{ fontSize: 14, fontWeight: 900, color: 'white', marginTop: 2 }}>{playerNumber}</span>
                                                            ) : (
                                                                <PlayerIcon />
                                                            )}
                                                        </div>
                                                        {lastName ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 6, backgroundColor: '#00000099', paddingTop: 2, paddingBottom: 2, paddingLeft: 6, paddingRight: 6, borderRadius: 4 }}>
                                                                <div style={{ display: 'flex', fontSize: 13, fontWeight: 800, color: 'white' }}>
                                                                    {cleanText(lastName)}
                                                                </div>
                                                            </div>
                                                        ) : null}
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

        // 3. SCHEDULE/RESULTS GRID TEMPLATE
        return new ImageResponse(
            (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 1200, height: 630, backgroundColor: '#0a1428', color: 'white', fontFamily: 'sans-serif', paddingTop: 40, paddingBottom: 40, paddingLeft: 40, paddingRight: 40 }}>
                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', borderBottomWidth: 2, borderBottomStyle: 'solid', borderBottomColor: '#1e293b', paddingBottom: 20, marginBottom: 30 }}>
                        <img src="https://factsport.com/logo.png" style={{ display: 'flex', height: 60 }} />
                        <div style={{ display: 'flex', fontSize: 32, color: '#facc15', fontWeight: 900, letterSpacing: '4px' }}>
                            {cleanText(parsedData.label)}
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '20px', width: '100%', justifyContent: 'center' }}>
                        {parsedData.matches && parsedData.matches.length > 0 ? (
                            parsedData.matches.slice(0, 10).map((m: any, i: number) => (
                                <div key={i} style={{ display: 'flex', flexDirection: 'row', width: '45%', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0f1c3a', paddingTop: 15, paddingBottom: 15, paddingLeft: 25, paddingRight: 25, borderRadius: 15, borderWidth: 2, borderStyle: 'solid', borderColor: '#1e293b' }}>
                                    <div style={{ display: 'flex', width: '40%', justifyContent: 'flex-end' }}>
                                        <div style={{ display: 'flex', fontSize: 24, fontWeight: 900 }}>{cleanText((m.home || '').substring(0, 14))}</div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'center', marginLeft: 15, marginRight: 15 }}>
                                        <div style={{ display: 'flex', fontSize: 22, fontWeight: 900, color: m.score ? '#4ade80' : '#facc15' }}>{m.score || m.time}</div>
                                    </div>
                                    <div style={{ display: 'flex', width: '40%', justifyContent: 'flex-start' }}>
                                        <div style={{ display: 'flex', fontSize: 24, fontWeight: 900 }}>{cleanText((m.away || '').substring(0, 14))}</div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div style={{ display: 'flex', fontSize: 48, fontWeight: 900 }}>MATCHDAY LIVE</div>
                        )}
                    </div>
                </div>
            ),
            { width: 1200, height: 630 }
        );

    } catch (e) {
        return new ImageResponse(
            (<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 1200, height: 630, backgroundColor: '#0a1428', color: 'white' }}><div style={{ display: 'flex', fontSize: 40 }}>FACTSPORT</div></div>), 
            { width: 1200, height: 630 }
        );
    }
}