// Shared browser in-flight dedupe for the fast ESPN read path.
// The original external Worker is retained only as a temporary read fallback
// while the same-origin PostgreSQL-resolved path is verified in staging.
const activeRequests = new Map<string, Promise<any>>();
const MATCH_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const fetchLiveMatchDeduplicated = async (espnId: string, matchId?: string | null) => {
    const useV2FastReader = process.env.NEXT_PUBLIC_FACTSPORT_FAST_LIVE_BACKEND === 'postgres';
    if (useV2FastReader && (!matchId || !MATCH_UUID.test(matchId))) {
        return { error: 'A canonical match identity is required for V2 fast live scores.' };
    }

    const key = useV2FastReader ? 'match:' + matchId : 'espn:' + espnId;
    if (activeRequests.has(key)) return activeRequests.get(key);

    const url = useV2FastReader
        ? '/api/media/live/matches/' + encodeURIComponent(matchId!)
        : `https://live-api.factsport.com/?espn_id=${encodeURIComponent(espnId)}&_t=${Date.now()}`;

    const fetchPromise = fetch(url, { cache: 'no-store', credentials: useV2FastReader ? 'same-origin' : 'omit' })
        .then(async response => {
            if (!response.ok) return { error: 'Live summary temporarily unavailable.' };
            return response.json();
        })
        .catch(() => ({ error: 'Live summary temporarily unavailable.' }))
        .finally(() => activeRequests.delete(key));

    activeRequests.set(key, fetchPromise);
    return fetchPromise;
};
