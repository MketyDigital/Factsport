export const runtime = 'edge';
import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

type ParsedData = Record<string, any>;

const cleanText = (str: unknown) => {
  if (str === null || str === undefined) return '';

  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
};

const decodeBase64Safe = (safeBase64: string): ParsedData => {
  try {
    if (!safeBase64) return {};

    let base64 = safeBase64.replace(/-/g, '+').replace(/_/g, '/');

    while (base64.length % 4) {
      base64 += '=';
    }

    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);

    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const jsonStr = new TextDecoder('utf-8').decode(bytes);
    const parsed = JSON.parse(jsonStr);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    return parsed;
  } catch {
    return {};
  }
};

const normalizeFormation = (formationStr: unknown): number[] => {
  const fallback: number[] = [4, 3, 3];

  if (formationStr === null || formationStr === undefined) {
    return fallback;
  }

  const raw = String(formationStr).trim();

  if (!raw) {
    return fallback;
  }

  let tokens: string[] = [];

  const separatedMatch = raw.match(/\d{1,2}(?:[,\s.-]\d{1,2})+/);

  if (separatedMatch) {
    tokens = separatedMatch[0].split(/[\s,.-]+/);
  } else {
    const compactMatch = raw.match(/\d{3,4}/);

    if (compactMatch) {
      tokens = compactMatch[0].split('');
    }
  }

  const counts = tokens
    .map((token) => parseInt(token, 10))
    .filter((count) => Number.isFinite(count) && count > 0);

  if (!counts.length) {
    return fallback;
  }

  const total = counts.reduce((sum, count) => sum + count, 0);

  if (total === 10) {
    return counts;
  }

  if (total < 10) {
    return fallback;
  }

  const normalized = [...counts];
  let diff = total - 10;

  for (let i = normalized.length - 1; i >= 0 && diff > 0; i--) {
    const canRemove = normalized[i] - 1;

    if (canRemove <= 0) continue;

    const remove = Math.min(canRemove, diff);
    normalized[i] -= remove;
    diff -= remove;
  }

  if (diff > 0) {
    return fallback;
  }

  return normalized.filter((count) => count > 0);
};

const getPlayerName = (player: any): string => {
  if (typeof player === 'string') {
    return player.trim();
  }

  if (!player || typeof player !== 'object') {
    return '';
  }

  const candidates = [
    player.name,
    player.playerName,
    player.fullName,
    player.player?.name,
    player.player?.fullName
  ];

  const found = candidates.find((value) => {
    if (value === null || value === undefined) return false;
    return String(value).trim() !== '';
  });

  return found ? String(found).trim() : '';
};

const getValidPlayers = (players: any): string[] => {
  if (!Array.isArray(players)) return [];

  return players.map(getPlayerName).filter((name) => name.length > 0);
};

const padPlayers = (players: string[], count: number, fallbackPrefix: string) => {
  const safePrefix = fallbackPrefix.trim() || 'PLAYER';
  const safePlayers = [...players];

  while (safePlayers.length < count) {
    const index = safePlayers.length + 1;
    safePlayers.push(`${safePrefix} ${index}`);
  }

  return safePlayers.slice(0, count);
};

const parseFormationRows = (
  players: string[],
  formationStr: unknown,
  fallbackPrefix: string
): string[][] => {
  const counts: number[] = normalizeFormation(formationStr);
  const safePlayers = padPlayers(players, 11, fallbackPrefix);
  const rows: string[][] = [];

  rows.push([safePlayers[0] || `${fallbackPrefix} 1`]);

  let curr = 1;

  counts.forEach((count) => {
    if (count <= 0) return;

    const rowPlayers = safePlayers.slice(curr, curr + count);

    while (rowPlayers.length < count) {
      rowPlayers.push(`${fallbackPrefix} ${curr + rowPlayers.length}`);
    }

    rows.push(rowPlayers);
    curr += count;
  });

  return rows;
};

const shortTeamName = (name: unknown, fallback: string) => {
  const clean = cleanText(name);

  if (!clean) return fallback;

  const words = clean.split(/\s+/).filter(Boolean);

  if (words.length >= 2) {
    const first = words[0].length > 14 ? `${words[0].slice(0, 13)}...` : words[0];
    const lastWord = words[words.length - 1];
    const last = lastWord.length > 14 ? `${lastWord.slice(0, 13)}...` : lastWord;

    return `${first} ${last}`;
  }

  return clean.length > 18 ? `${clean.slice(0, 17)}...` : clean;
};

const cleanPlayerName = (player: string) => {
  const playerStr = player ? String(player).trim() : '';

  if (!playerStr) {
    return {
      number: '',
      name: 'PLAYER'
    };
  }

  const numberMatch = playerStr.match(/\b(\d{1,2})\b/);
  const playerNumber = numberMatch ? numberMatch[0] : '';

  const nameCleaned = playerStr
    .replace(/\b\d{1,2}\b/g, '')
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const parts = nameCleaned.split(' ').filter(Boolean);
  const lastName = parts.length > 1 ? parts[parts.length - 1] : nameCleaned;

  return {
    number: playerNumber,
    name: lastName ? lastName.slice(0, 10) : 'PLAYER'
  };
};

const PlayerIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="white"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);

const fallbackImage = (label = 'MATCH UPDATE') => {
  const safeLabel = cleanText(label).slice(0, 40) || 'MATCH UPDATE';

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 1200,
          height: 630,
          backgroundColor: '#0a1428',
          color: 'white',
          fontFamily: 'Arial, sans-serif'
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 54,
              fontWeight: 900,
              color: '#facc15',
              letterSpacing: '3px'
            }}
          >
            {safeLabel}
          </div>

          <div
            style={{
              display: 'flex',
              marginTop: 24,
              fontSize: 34,
              fontWeight: 800,
              color: '#e2e8f0'
            }}
          >
            FACTSPORT
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dataParam = searchParams.get('data');

    if (!dataParam) {
      return fallbackImage('MATCH UPDATE');
    }

    const parsedData = decodeBase64Safe(dataParam);

    // 📋 TEMPLATE 1: PITCH LINEUP INTERFACE
    if (parsedData.type === 'pitch') {
      const home = shortTeamName(parsedData.home, 'HOME');
      const away = shortTeamName(parsedData.away, 'AWAY');

      const homeFormationDisplay = normalizeFormation(
        parsedData.homeFormation
      ).join('-');

      const awayFormationDisplay = normalizeFormation(
        parsedData.awayFormation
      ).join('-');

      const homePlayers = getValidPlayers(parsedData.homeXI || []);
      const awayPlayers = getValidPlayers(parsedData.awayXI || []);

      const homeRows = parseFormationRows(
        homePlayers,
        homeFormationDisplay,
        home
      );

      const awayRows = parseFormationRows(
        awayPlayers,
        awayFormationDisplay,
        away
      );

      const renderHomeRows = [...homeRows].reverse();
      const renderAwayRows = [...awayRows].reverse();

      return new ImageResponse(
        (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              width: 1200,
              height: 630,
              backgroundColor: '#0a1428',
              color: 'white',
              fontFamily: 'Arial, sans-serif'
            }}
          >
            {/* HEADER */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: 1200,
                height: 105,
                backgroundColor: '#0f1c3a',
                borderBottomWidth: 2,
                borderBottomStyle: 'solid',
                borderBottomColor: '#1e293b',
                paddingLeft: 42,
                paddingRight: 42
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    fontSize: 20,
                    color: '#facc15',
                    fontWeight: 900,
                    letterSpacing: '2px'
                  }}
                >
                  {cleanText(parsedData.label || 'STARTING XI')}
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    fontSize: 34,
                    fontWeight: 900,
                    marginTop: 4
                  }}
                >
                  <div style={{ display: 'flex', color: 'white' }}>{home}</div>

                  <div
                    style={{
                      display: 'flex',
                      color: '#64748b',
                      marginLeft: 14,
                      marginRight: 14
                    }}
                  >
                    VS
                  </div>

                  <div style={{ display: 'flex', color: 'white' }}>{away}</div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  fontSize: 24,
                  fontWeight: 900,
                  color: '#facc15',
                  letterSpacing: '2px'
                }}
              >
                FACTSPORT
              </div>
            </div>

            {/* PITCH */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                width: 1200,
                height: 525,
                paddingTop: 22,
                paddingBottom: 22,
                paddingLeft: 22,
                paddingRight: 22,
                justifyContent: 'space-between'
              }}
            >
              {/* HOME TEAM */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  width: 560,
                  height: 485,
                  backgroundColor: '#2E8B57',
                  borderRadius: 18,
                  borderWidth: 4,
                  borderStyle: 'solid',
                  borderColor: 'rgba(255,255,255,0.2)',
                  paddingTop: 16,
                  paddingBottom: 16
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: 42,
                    marginBottom: 10
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      fontSize: 20,
                      fontWeight: 900,
                      color: 'white'
                    }}
                  >
                    {home}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      fontSize: 16,
                      color: '#bfdbfe',
                      marginLeft: 8
                    }}
                  >
                    ({homeFormationDisplay})
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: 425,
                    justifyContent: 'space-between',
                    width: 550
                  }}
                >
                  {renderHomeRows.map((row, rowIndex) => (
                    <div
                      key={rowIndex}
                      style={{
                        display: 'flex',
                        flexDirection: 'row',
                        justifyContent: 'space-around',
                        width: 550
                      }}
                    >
                      {(row || []).map((player: string, playerIndex: number) => {
                        const { number, name } = cleanPlayerName(player);

                        return (
                          <div
                            key={playerIndex}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              width: 104
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 36,
                                height: 36,
                                borderRadius: 18,
                                backgroundColor: '#2563eb',
                                borderWidth: 3,
                                borderStyle: 'solid',
                                borderColor: '#ffffff'
                              }}
                            >
                              {number ? (
                                <span
                                  style={{
                                    fontSize: 14,
                                    fontWeight: 900,
                                    color: 'white',
                                    marginTop: 2
                                  }}
                                >
                                  {number}
                                </span>
                              ) : (
                                <PlayerIcon />
                              )}
                            </div>

                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginTop: 6,
                                backgroundColor: '#00000099',
                                paddingTop: 3,
                                paddingBottom: 3,
                                paddingLeft: 7,
                                paddingRight: 7,
                                borderRadius: 5
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  fontSize: 13,
                                  fontWeight: 800,
                                  color: 'white'
                                }}
                              >
                                {name}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* AWAY TEAM */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  width: 560,
                  height: 485,
                  backgroundColor: '#2E8B57',
                  borderRadius: 18,
                  borderWidth: 4,
                  borderStyle: 'solid',
                  borderColor: 'rgba(255,255,255,0.2)',
                  paddingTop: 16,
                  paddingBottom: 16
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: 42,
                    marginBottom: 10
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      fontSize: 20,
                      fontWeight: 900,
                      color: 'white'
                    }}
                  >
                    {away}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      fontSize: 16,
                      color: '#fecaca',
                      marginLeft: 8
                    }}
                  >
                    ({awayFormationDisplay})
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: 425,
                    justifyContent: 'space-between',
                    width: 550
                  }}
                >
                  {renderAwayRows.map((row, rowIndex) => (
                    <div
                      key={rowIndex}
                      style={{
                        display: 'flex',
                        flexDirection: 'row',
                        justifyContent: 'space-around',
                        width: 550
                      }}
                    >
                      {(row || []).map((player: string, playerIndex: number) => {
                        const { number, name } = cleanPlayerName(player);

                        return (
                          <div
                            key={playerIndex}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              width: 104
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 36,
                                height: 36,
                                borderRadius: 18,
                                backgroundColor: '#dc2626',
                                borderWidth: 3,
                                borderStyle: 'solid',
                                borderColor: '#ffffff'
                              }}
                            >
                              {number ? (
                                <span
                                  style={{
                                    fontSize: 14,
                                    fontWeight: 900,
                                    color: 'white',
                                    marginTop: 2
                                  }}
                                >
                                  {number}
                                </span>
                              ) : (
                                <PlayerIcon />
                              )}
                            </div>

                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginTop: 6,
                                backgroundColor: '#00000099',
                                paddingTop: 3,
                                paddingBottom: 3,
                                paddingLeft: 7,
                                paddingRight: 7,
                                borderRadius: 5
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  fontSize: 13,
                                  fontWeight: 800,
                                  color: 'white'
                                }}
                              >
                                {name}
                              </div>
                            </div>
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

    // ⚔️ TEMPLATE 2: VERSUS INTERFACE
    if (parsedData.type === 'versus') {
      const hScore =
        parsedData.hScore !== null && parsedData.hScore !== undefined
          ? String(parsedData.hScore)
          : '';

      const aScore =
        parsedData.aScore !== null && parsedData.aScore !== undefined
          ? String(parsedData.aScore)
          : '';

      const hasScore = hScore !== '' && aScore !== '';

      return new ImageResponse(
        (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              width: 1200,
              height: 630,
              backgroundColor: '#0a1428',
              color: 'white',
              fontFamily: 'Arial, sans-serif'
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: 1200,
                height: 110,
                backgroundColor: '#0f1c3a',
                borderBottomWidth: 3,
                borderBottomStyle: 'solid',
                borderBottomColor: '#1e293b',
                paddingLeft: 50,
                paddingRight: 50
              }}
            >
              <div
                style={{
                  display: 'flex',
                  fontSize: 34,
                  color: '#facc15',
                  fontWeight: 900,
                  letterSpacing: '4px'
                }}
              >
                {cleanText(parsedData.label || 'MATCH UPDATE')}
              </div>

              <div
                style={{
                  display: 'flex',
                  fontSize: 24,
                  fontWeight: 900,
                  color: '#facc15',
                  letterSpacing: '2px'
                }}
              >
                FACTSPORT
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                width: 1200,
                height: 520,
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingLeft: 80,
                paddingRight: 80
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  width: 350,
                  justifyContent: 'center'
                }}
              >
                {parsedData.homeLogo ? (
                  <img
                    src={parsedData.homeLogo}
                    style={{
                      display: 'flex',
                      width: 190,
                      height: 190,
                      objectFit: 'contain'
                    }}
                  />
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      width: 190,
                      height: 190,
                      backgroundColor: '#1e293b',
                      borderRadius: 95,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 4,
                      borderStyle: 'solid',
                      borderColor: '#334155'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        fontSize: 60,
                        fontWeight: 900,
                        color: '#cbd5e1',
                        letterSpacing: '2px'
                      }}
                    >
                      {parsedData.homeTla || 'HOM'}
                    </div>
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    fontSize: 44,
                    fontWeight: 900,
                    marginTop: 25,
                    color: '#ffffff',
                    textAlign: 'center'
                  }}
                >
                  {cleanText(parsedData.home || 'HOME')}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  width: 300,
                  justifyContent: 'center'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    backgroundColor: '#0f1c3a',
                    paddingTop: 18,
                    paddingBottom: 18,
                    paddingLeft: 45,
                    paddingRight: 45,
                    borderRadius: 24,
                    borderWidth: 4,
                    borderStyle: 'solid',
                    borderColor: '#2563eb',
                    fontSize: 72,
                    fontWeight: 900,
                    color: hasScore ? '#4ade80' : '#94a3b8',
                    letterSpacing: '2px'
                  }}
                >
                  {hasScore ? `${hScore}-${aScore}` : 'VS'}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  width: 350,
                  justifyContent: 'center'
                }}
              >
                {parsedData.awayLogo ? (
                  <img
                    src={parsedData.awayLogo}
                    style={{
                      display: 'flex',
                      width: 190,
                      height: 190,
                      objectFit: 'contain'
                    }}
                  />
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      width: 190,
                      height: 190,
                      backgroundColor: '#1e293b',
                      borderRadius: 95,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 4,
                      borderStyle: 'solid',
                      borderColor: '#334155'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        fontSize: 60,
                        fontWeight: 900,
                        color: '#cbd5e1',
                        letterSpacing: '2px'
                      }}
                    >
                      {parsedData.awayTla || 'AWY'}
                    </div>
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    fontSize: 44,
                    fontWeight: 900,
                    marginTop: 25,
                    color: '#ffffff',
                    textAlign: 'center'
                  }}
                >
                  {cleanText(parsedData.away || 'AWAY')}
                </div>
              </div>
            </div>
          </div>
        ),
        { width: 1200, height: 630 }
      );
    }

    return fallbackImage(parsedData.label || 'MATCH UPDATE');
  } catch {
    return fallbackImage('MATCH UPDATE');
  }
}