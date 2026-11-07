export const PUBLIC_MEDIA_POLICY_VERSION = '2026-11-07.1';

const BOOKMAKER_LINK_HOST = /(?:^|[./-])(?:1xbet|1x-bet|melbet|bet9ja|betway|sportybet|betking|parimatch|22bet|stake|bet365|betano|1win|msport|hollywoodbets|888sport|refpa\d+)(?:[./:-]|$)/i;
const PROMOTIONAL_COPY = [
  /\buse (?:our |the )?(?:promo|bonus) code\b/i,
  /\bpromo code\s*[:#]/i,
  /\bclaim (?:your |the )?(?:welcome )?bonus\b/i,
  /\b\d{2,4}%\s+(?:welcome )?bonus\b/i,
  /\bdeposit (?:now|bonus|to claim)\b/i,
  /\bbet now\b/i,
  /\bplace (?:your )?bet now\b/i,
  /\bfree bets?\b/i,
  /\bboost your odds\b/i,
  /\bjoin (?:now|today)\s+and\s+(?:bet|win)\b/i,
];
const PRIVATE_PRODUCT_PROMOTION = [
  /\bVIP members?\b.{0,80}\b(?:cash|prize|payout|winnings)\b/i,
  /\b(?:win|claim)\s+(?:a |your )?monthly cash prize\b/i,
  /\bupgrade to VIP\b/i,
  /\bVIP betting slips\b/i,
  /\bpaid[- ]entry\s+(?:contest|competition|tournament)\b/i,
];

export type PublicMediaArticleContent = {
  title?: unknown;
  excerpt?: unknown;
  body_markdown?: unknown;
  seo_title?: unknown;
  seo_description?: unknown;
  canonical_url?: unknown;
  tags?: unknown;
};

export function inspectPublicMediaArticle(input: PublicMediaArticleContent): { eligible: boolean; reasons: string[] } {
  const fields = [
    input.title, input.excerpt, input.body_markdown,
    input.seo_title, input.seo_description,
    Array.isArray(input.tags) ? input.tags.join(' ') : input.tags,
  ];
  const text = fields.filter(value => typeof value === 'string').join('\n').slice(0, 250_000);
  const urls = text.match(/https?:\/\/[^\s)\]}>"']+/gi) || [];
  const reasons: string[] = [];

  for (const rawUrl of [...urls, ...(typeof input.canonical_url === 'string' ? [input.canonical_url] : [])]) {
    try {
      const host = new URL(rawUrl).hostname.toLowerCase();
      if (BOOKMAKER_LINK_HOST.test(host) || /refpa\d+/i.test(host)) {
        reasons.push('bookmaker_or_affiliate_link');
        break;
      }
    } catch {
      // Invalid URLs are handled by the existing editorial URL sanitizer.
    }
  }

  if (PROMOTIONAL_COPY.some(pattern => pattern.test(text))) reasons.push('betting_promotional_copy');
  if (PRIVATE_PRODUCT_PROMOTION.some(pattern => pattern.test(text))) reasons.push('private_prediction_promotion');

  return { eligible: reasons.length === 0, reasons };
}
