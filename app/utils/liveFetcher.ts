const activeRequests = new Map<string, Promise<any>>();

export const fetchLiveMatchDeduplicated = async (espnId: string) => {
    // If a request for this match is already in flight, return the existing promise!
    if (activeRequests.has(espnId)) {
        return activeRequests.get(espnId);
    }

    // 🟢 FIX: Append a timestamp to completely bust Safari/Chrome aggressive mobile caching 
    // This guarantees the browser asks Cloudflare, and Cloudflare handles the real caching.
    const url = `https://live-api.factsport.com/?espn_id=${espnId}&_t=${Date.now()}`;

    const fetchPromise = fetch(url, { cache: 'no-store' })
        .then(res => res.json())
        .catch(err => ({ error: err.message }))
        .finally(() => {
            // Remove it from the active list once finished so the next poll can run
            activeRequests.delete(espnId);
        });

    activeRequests.set(espnId, fetchPromise);

    return fetchPromise;
};