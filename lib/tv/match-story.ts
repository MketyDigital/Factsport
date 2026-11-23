/** Deterministic offline TV planning primitives; no upstream calls or rendering. */
export type MatchFact = {
  id: string;
  kind: 'score' | 'goal' | 'card' | 'substitution' | 'lineup' | 'stat';
  text: string;
  source: string;
  observedAt: string;
  sourceUpdatedAt?: string;
  verified: boolean;
  minute?: number;
  addedTime?: number;
  homeScore?: number;
  awayScore?: number;
};

export type MatchStoryInput = {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  finalScore: { home: number; away: number };
  finishedVerifiedAt: string;
  facts: MatchFact[];
  rights: { dataCleared: boolean; assetsCleared: boolean };
};

export type MatchStoryScene = {
  id: string;
  kind: 'opening_3d' | 'lineups_2d' | 'event_illustration_3d' | 'statistics_2d' | 'closing_2d';
  label: string;
  factIds: string[];
  disclosure?: string;
};

export type MatchStoryPlan = {
  status: 'draft' | 'blocked_rights' | 'needs_data';
  rights: { dataCleared: boolean; assetsCleared: boolean };
  matchId: string;
  title: string;
  score: string | null;
  scenes: MatchStoryScene[];
  facts: MatchFact[];
  durationTargetSeconds: number;
  sourceDigest: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T/;

/** Create a stable plan from verified, rights-cleared facts only. */
export async function planMatchStory(input: MatchStoryInput): Promise<MatchStoryPlan> {
  if (!UUID.test(input.matchId)) throw new Error('match_id_invalid');
  if (!input.homeTeam.trim() || !input.awayTeam.trim() || !input.competition.trim()) throw new Error('match_identity_incomplete');
  if (!ISO_DATE.test(input.finishedVerifiedAt) || !Number.isFinite(Date.parse(input.finishedVerifiedAt))) throw new Error('finish_verification_missing');
  if (!Number.isSafeInteger(input.finalScore.home) || input.finalScore.home < 0 ||
      !Number.isSafeInteger(input.finalScore.away) || input.finalScore.away < 0) throw new Error('final_score_invalid');

  const unique = new Map<string, MatchFact>();
  for (const fact of input.facts) {
    if (!fact.verified || !fact.id.trim() || !fact.source.trim() || !fact.text.trim() || !ISO_DATE.test(fact.observedAt) || !Number.isFinite(Date.parse(fact.observedAt))) continue;
    if (fact.sourceUpdatedAt && (!ISO_DATE.test(fact.sourceUpdatedAt) || !Number.isFinite(Date.parse(fact.sourceUpdatedAt)))) continue;
    if (fact.kind !== 'score' && fact.kind !== 'goal' && fact.kind !== 'card' && fact.kind !== 'substitution' && fact.kind !== 'lineup' && fact.kind !== 'stat') continue;
    unique.set(fact.id, { ...fact, text: fact.text.trim() });
  }
  const facts = Array.from(unique.values()).sort((a, b) =>
    (a.minute ?? -1) - (b.minute ?? -1) || (a.addedTime ?? 0) - (b.addedTime ?? 0) || a.id.localeCompare(b.id)
  );
  const goals = facts.filter(fact => fact.kind === 'goal');
  const lineupFacts = facts.filter(fact => fact.kind === 'lineup');
  const statFacts = facts.filter(fact => fact.kind === 'stat');
  const verifiedScore = facts.find(fact => fact.kind === 'score' && fact.homeScore === input.finalScore.home && fact.awayScore === input.finalScore.away);
  const scenes: MatchStoryScene[] = [
    { id: 'opening', kind: 'opening_3d', label: `${input.homeTeam} vs ${input.awayTeam}`, factIds: [] },
  ];
  if (lineupFacts.length) scenes.push({ id: 'lineups', kind: 'lineups_2d', label: 'Verified starting lineups', factIds: lineupFacts.map(fact => fact.id) });
  goals.forEach((fact, index) => {
    scenes.push({ id: `goal-${index + 1}`, kind: 'event_illustration_3d', label: fact.text, factIds: [fact.id], disclosure: 'Illustrative visualization — not actual match footage.' });
  });
  if (statFacts.length) scenes.push({ id: 'stats', kind: 'statistics_2d', label: 'Verified match statistics', factIds: statFacts.map(fact => fact.id) });
  scenes.push({ id: 'closing', kind: 'closing_2d', label: verifiedScore ? `${input.finalScore.home}–${input.finalScore.away} full-time` : 'Full-time result pending verification', factIds: verifiedScore ? [verifiedScore.id] : [] });

  const snapshot = JSON.stringify({
    matchId: input.matchId,
    homeTeam: input.homeTeam,
    awayTeam: input.awayTeam,
    competition: input.competition,
    finalScore: input.finalScore,
    finishedVerifiedAt: input.finishedVerifiedAt,
    facts,
    rights: input.rights,
  });
  const digestBytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(snapshot)));
  const sourceDigest = Array.from(digestBytes, byte => byte.toString(16).padStart(2, '0')).join('');
  const dataComplete = Boolean(verifiedScore);

  return {
    status: !input.rights.dataCleared || !input.rights.assetsCleared ? 'blocked_rights' : dataComplete ? 'draft' : 'needs_data',
    rights: { ...input.rights },
    matchId: input.matchId,
    title: `${input.homeTeam} vs ${input.awayTeam} | Factsport Match Story`,
    score: verifiedScore ? `${input.finalScore.home}–${input.finalScore.away}` : null,
    scenes,
    facts,
    durationTargetSeconds: 240,
    sourceDigest,
  };
}

export type SocialVideoDraft = {
  episodeId: string;
  videoObjectKey: string;
  title: string;
  description: string;
  captionsObjectKey: string;
  platforms: Array<'youtube' | 'instagram' | 'facebook' | 'tiktok'>;
  rightsReference: string;
  humanApproved: boolean;
  status: 'draft' | 'review_required' | 'approved_for_dispatch';
};

/** Package approved metadata for human review; this function never uploads. */
export function prepareSocialVideoDraft(input: Omit<SocialVideoDraft, 'status'>): SocialVideoDraft {
  if (!UUID.test(input.episodeId)) throw new Error('episode_id_invalid');
  if (!/^tv\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\.mp4$/.test(input.videoObjectKey)) throw new Error('video_asset_key_invalid');
  if (!/^tv\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\.(vtt|srt)$/.test(input.captionsObjectKey)) throw new Error('captions_asset_key_invalid');
  if (!input.title.trim() || !input.description.trim() || !input.rightsReference.trim()) throw new Error('publishing_metadata_incomplete');
  if (!input.platforms.length || input.platforms.some(platform => !['youtube', 'instagram', 'facebook', 'tiktok'].includes(platform))) throw new Error('platform_not_supported');
  return { ...input, status: input.humanApproved ? 'approved_for_dispatch' : 'review_required' };
}
