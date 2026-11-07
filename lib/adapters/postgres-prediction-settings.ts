/**
 * Public Prediction monetization settings. This adapter reads only the narrow
 * public affiliate projection; it does not expose payment credentials or Media settings.
 */
import 'server-only';
import { withFactsportPostgres } from '@/lib/adapters/postgres-client';

export async function getPublicPredictionAffiliateSettings() {
  return withFactsportPostgres(async sql => {
    const rows = await sql`
      SELECT link_1xbet, code_1xbet, link_melbet, code_melbet
      FROM public.public_prediction_affiliate_settings
      LIMIT 1
    `;
    return rows[0] ?? null;
  });
}
