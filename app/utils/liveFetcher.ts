// src/app/utils/liveFetcher.ts

const activeRequests = new Map<string, Promise<any>>();

export const fetchLiveMatchDeduplicated = async (espnId: string) => {
    // If a request for this match is already in flight, return the existing promise!
    if (activeRequests.has(espnId)) {
        return activeRequests.get(espnId);
    }

    // Otherwise, create a new fetch request (bypassing browser cache)
    const fetchPromise = fetch(`https://live-api.factsport.com/?espn_id=${espnId}`, { cache: 'no-store' })
        .then(res => res.json())
        .catch(err => ({ error: err.message }))
        .finally(() => {
            // Remove it from the active list once finished so the next poll can run
            activeRequests.delete(espnId);
        });

    activeRequests.set(espnId, fetchPromise);

    return fetchPromise;
};