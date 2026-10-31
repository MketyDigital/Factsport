/** Factsport transactional delivery contract — no provider imports in app code. */
export interface TransactionalMail {
  send(message: { from: string; to: string; subject: string; text?: string; html?: string }): Promise<{ messageId: string }>;
}

export interface MketyMailConfig {
  baseUrl: string;
  apiKey: string; // mail:send scoped server secret, never exposed to browsers
  timeoutMs?: number;
}

/**
 * Server-only Mkety Mail integration from MketyDigital/mksaas:
 * POST /api/v1/mail/send => {ok:true,id,status:'queued'} (HTTP 202).
 * Requires an approved sender domain/mailbox and adequate send capacity.
 */
export class MketyMailAdapter implements TransactionalMail {
  constructor(private readonly config: MketyMailConfig) {}
  async send(message: { from: string; to: string; subject: string; text?: string; html?: string }): Promise<{ messageId: string }> {
    if (!this.config.baseUrl.startsWith('https://')) throw new Error('mkety_mail_https_required');
    if (!this.config.apiKey) throw new Error('mkety_mail_not_configured');
    if (!message.from || !message.to || !message.subject || (!message.text && !message.html)) {
      throw new Error('transactional_mail_invalid_input');
    }
    const response = await fetch(new URL('/api/v1/mail/send', this.config.baseUrl), {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 20000)
    });
    if (!response.ok) throw new Error(`mkety_mail_http_${response.status}`);
    const result = await response.json() as {ok?: boolean; id?: string; status?: string};
    if (response.status !== 202 || result.ok !== true || !result.id || result.status !== 'queued') {
      throw new Error('mkety_mail_unexpected_response');
    }
    // HTTP 202 means accepted/queued, not delivered. Delivery status is separate.
    return { messageId: result.id };
  }
}
