// Shared browser in-flight dedupe for the V2 canonical-match fast ESPN path.
// The original external Worker is archived for parity evidence only.
// The V2 browser never queries the old Worker or its D1-backed MOTM service.
const activeRequests = new Map<string, Promise<any>>();
const MATCH_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const fetchLiveMatchDeduplicated = async (_espnId: string, matchId?: string | null) => {
    if (process.env.NEXT_PUBLIC_FACTSPORT_FAST_LIVE_BACKEND !== 'postgres') {
        return { error: 'V2 fast live reader is not enabled.' };
    }
    if (!matchId || !MATCH_UUID.test(matchId)) {
        return { error: 'A canonical match identity is required for V2 fast live scores.' };
    }
    const key = 'match:' + matchId;
    if (activeRequests.has(key)) return activeRequests.get(key);

    const url = '/api/media/live/matches/' + encodeURIComponent(matchId);
    const fetchPromise = fetch(url, { cache: 'no-store', credentials: 'same-origin' })
        .then(async response => {
            if (!response.ok) return { error: 'Live summary temporarily unavailable.' };
            return response.json();
        })
        .catch(() => ({ error: 'Live summary temporarily unavailable.' }))
        .finally(() => activeRequests.delete(key));

    activeRequests.set(key, fetchPromise);
    return fetchPromise;
};
