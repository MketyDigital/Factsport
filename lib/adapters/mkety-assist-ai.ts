import type { AiDraft, AiProvider, AiRequest } from '../ports/contracts';

/**
 * Mkety Assist Standalone RAW MODEL API adapter.
 * Verified against MketyDigital/mksaas branch
 * plan/assist-api-approval-routing-20261003, customer-apps/assist/src/runtime.ts.
 * Requires a customer-scoped inference key in raw_model mode, enabled model alias
 * in BOTH customer and key allowlists, commercial credits, and provider routing.
 * Not the configured-assistant API mode.
 */
export interface AssistRawModelConfig {
  baseUrl: string; // trusted server-only Assist origin, without /v1 suffix
  apiKey: string;
  modelAlias: string;
  timeoutMs?: number;
}
type AssistResponse = {
  model?: string;
  choices?: Array<{message?: {content?: string | null}}>;
};

export class MketyAssistRawModelAdapter implements AiProvider {
  constructor(private readonly config: AssistRawModelConfig) {}
  async generateDraft(request: AiRequest): Promise<AiDraft> {
    const { baseUrl, apiKey, modelAlias } = this.config;
    if (!baseUrl.startsWith('https://')) throw new Error('assist_ai_https_required');
    if (!apiKey || !modelAlias) throw new Error('assist_ai_not_configured');
    if (!request.sourceIds.length || !request.promptVersion) throw new Error('assist_ai_source_provenance_required');
    const stableKey = String((request.input as Record<string,unknown>).jobRunKey ?? '');
    if (!stableKey || stableKey.length > 160) throw new Error('assist_ai_stable_run_key_required');
    const response = await fetch(new URL('/v1/chat/completions', baseUrl), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': stableKey
      },
      body: JSON.stringify({
        model: modelAlias,
        stream: false,
        messages: [
          { role: 'system', content: 'Draft factual football editorial content from supplied source data only; mark uncertainties and do not invent match facts.' },
          { role: 'user', content: JSON.stringify({ task: request.task, version: request.promptVersion, facts: request.input, sourceIds: request.sourceIds }) }
        ]
      }),
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 45000)
    });
    if (!response.ok) {
      // The upstream request may already have spent credits; reconcile before retry.
      throw new Error(`assist_ai_http_${response.status}_review_before_retry`);
    }
    const data = await response.json() as AssistResponse;
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('assist_ai_empty_draft');
    return {
      task: request.task,
      content: text,
      sourceIds: [...request.sourceIds],
      modelRef: data.model ?? modelAlias,
      requiresEditorialReview: true
    };
  }
}
