/**
 * Factsport v2 provider-neutral ports (design contract).
 *
 * Do not import Azure, Cloudflare, Supabase, Gemini or Mkety AI SDKs here.
 * These types do not replace live implementation until adapter/integration tests pass.
 * Every method is server-side only. No credentials, account data or API URLs.
 */

export type ProviderId = 'azure-postgres' | 'mkety-postgres' | 'postgres-test';
export type SchedulerId = 'azure-logic-apps' | 'cloudflare';
export type AiProviderId = 'mkety-ai' | 'test-stub';

export interface MatchRecord {
  id: string; // stable Factsport internal ID; never a provider ID
  competitionId: string;
  kickoffAt: string;
  homeTeamId: string;
  awayTeamId: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  version: number;
}

export interface MatchRepository {
  getById(matchId: string): Promise<MatchRecord | null>;
  // A version check prevents older provider data from overwriting newer results.
  updateIfVersion(match: MatchRecord, expectedVersion: number): Promise<boolean>;
}

export interface JobEnvelope<Payload = Record<string, unknown>> {
  id: string; // stable domain job type e.g. "verify-final-scores"
  runKey: string; // deterministic key: job + period/fixture; unique for retries
  schemaVersion: 1;
  requestedAt: string; // ISO 8601
  payload: Payload;
}

export type JobOutcome =
  | { status: 'completed'; runKey: string }
  | { status: 'already-completed'; runKey: string }
  | { status: 'retryable-failure'; runKey: string; errorCode: string }
  | { status: 'permanent-failure'; runKey: string; errorCode: string };

export interface JobRunner {
  // Domain code owns job logic and durable idempotency, not the scheduler.
  run(envelope: JobEnvelope): Promise<JobOutcome>;
}

export interface JobScheduler {
  // Infrastructure-only adapter: Azure Logic Apps, Cloudflare, etc.
  dispatch(envelope: JobEnvelope): Promise<void>;
}

export type AiTask = 'editorial-preview' | 'match-analysis' | 'results-roundup';

export interface AiRequest {
  task: AiTask;
  promptVersion: string;
  input: Record<string, unknown>; // validated public sports facts, not user secrets
  sourceIds: string[];
}

export interface AiDraft {
  task: AiTask;
  content: string;
  sourceIds: string[];
  modelRef: string;
  requiresEditorialReview: true;
}

export interface AiProvider {
  generateDraft(request: AiRequest): Promise<AiDraft>;
}

export interface MediaObject {
  key: string;
  publicUrl: string;
  contentType: string;
}

export interface MediaStore {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<MediaObject>;
  getPublicUrl(key: string): Promise<string | null>;
}

/**
 * New adapters should be tested with the same contract suite before
 * changing DATABASE_URL, scheduler ownership, or AI provider configuration.
 * No application layer should branch on provider names.
 */
