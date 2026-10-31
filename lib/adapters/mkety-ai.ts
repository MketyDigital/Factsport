import type { AiDraft, AiProvider, AiRequest } from '../ports/contracts';

/**
 * Mkety SaaS API adapter. Server-side only.
 * Source: MketyDigital/mksaas/main src/app/api/v1/ai/chat/completions/route.ts
 * API requires ai:chat scoped Bearer credentials, enterprise access and a stable
 * Idempotency-Key for each logical request. Never blindly retry ambiguous 5xx.
 */
export interface MketyAiConfig {
  baseUrl: string;
  apiKey: string;
  model: string; // resolved from tenant's GET /api/v1/ai/models capability
  projectId?: string;
  timeoutMs?: number;
}

type CompletionResponse = {
  model?: string;
  choices?: Array<{ message?: { content?: string | null } }>;
};

export class MketyAiAdapter implements AiProvider {
  constructor(private readonly config: MketyAiConfig) {}

  async generateDraft(request: AiRequest): Promise<AiDraft> {
    if (!this.config.baseUrl.startsWith('https://')) throw new Error('mkety_ai_https_required');
    if (!this.config.apiKey || !this.config.model) throw new Error('mkety_ai_not_configured');
    if (!request.promptVersion || !request.sourceIds.length) {
      throw new Error('mkety_ai_sources_and_prompt_version_required');
    }
    // The job runner must persist the same key across retries to protect credits.
    // It must not change for the same logical request.
    const stableKey = String((request.input as Record<string, unknown>).jobRunKey ?? '');
    if (!stableKey || stableKey.length > 160) throw new Error('mkety_ai_job_run_key_required');
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': stableKey
    };
    if (this.config.projectId) headers['x-mkety-project-id'] = this.config.projectId;
    const endpoint = new URL('/api/v1/ai/chat/completions', this.config.baseUrl).toString();
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.config.model,
        stream: false,
        messages: [
          { role: 'system', content: 'Create a factual sports editorial draft. Use only the supplied verified facts, identify uncertainty, and never invent a score, quotation or source.' },
          { role: 'user', content: JSON.stringify({ task: request.task, promptVersion: request.promptVersion, facts: request.input, sourceIds: request.sourceIds }) }
        ]
      }),
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 45000)
    });
    if (!response.ok) {
      // Do not echo body to logs: it may include sensitive billing/runtime metadata.
      throw new Error(`mkety_ai_http_${response.status}_review_before_retry`);
    }
    const data = await response.json() as CompletionResponse;
    const output = data.choices?.[0]?.message?.content?.trim();
    if (!output) throw new Error('mkety_ai_empty_draft');
    return {
      task: request.task,
      content: output,
      sourceIds: [...request.sourceIds],
      modelRef: data.model ?? this.config.model,
      requiresEditorialReview: true
    };
  }
}
