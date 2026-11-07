import { evaluateMonthlyPrizeCandidate } from '@/lib/prize-qualification.cjs';

const PAGE_SIZE = 100;
const PRIZES = ['$500', '$300', '$200'];

export async function runMonthlyPrizeAudit(supabase: any, now = new Date()) {
  const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const previousMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const monthYear = previousMonthStart.toLocaleString('en-US', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  });

  const { data: settings, error: settingsError } = await supabase.from('site_settings')
    .select('target_exact_scores, min_points_floor').limit(1).maybeSingle();
  if (settingsError) throw settingsError;
  const targetExactScores = Number.isSafeInteger(settings?.target_exact_scores) && settings.target_exact_scores > 0
    ? settings.target_exact_scores : 4;
  const minPointsFloor = Number.isFinite(settings?.min_points_floor) && settings.min_points_floor >= 0
    ? settings.min_points_floor : 100;

  const drafts: any[] = [];
  let offset = 0;
  while (drafts.length < 3) {
    const { data: users, error: usersError } = await supabase.from('profiles')
      .select('id, is_vip, eligible_monthly_points')
      .eq('is_vip', true)
      .gte('eligible_monthly_points', minPointsFloor)
      .order('eligible_monthly_points', { ascending: false })
      .order('id', { ascending: true }) // deterministic tie-break for equal point totals
      .range(offset, offset + PAGE_SIZE - 1);
    if (usersError) throw usersError;
    if (!users?.length) break;

    for (const user of users) {
      const { data: predictions, error: predictionsError } = await supabase.from('user_predictions')
        .select('predicted_home_score, predicted_away_score, created_at, match:matches(league,status,home_score,away_score)')
        .eq('user_id', user.id)
        .eq('is_eligible_for_prize', true)
        .gte('created_at', previousMonthStart.toISOString())
        .lt('created_at', currentMonthStart.toISOString());
      if (predictionsError) throw predictionsError;

      const evaluation = evaluateMonthlyPrizeCandidate(user, predictions || [], {
        targetExactScores, minPointsFloor,
      });
      if (!evaluation.isQualified) continue;
      const rank = drafts.length + 1;
      drafts.push({
        month_year: monthYear,
        user_id: user.id,
        rank,
        points: evaluation.points,
        prize_amount: PRIZES[rank - 1],
        is_approved: false,
        audit_report: evaluation.reportCard,
      });
      if (drafts.length === 3) break;
    }

    offset += users.length;
    if (users.length < PAGE_SIZE) break;
  }

  const { error: deleteError } = await supabase.from('monthly_winners').delete()
    .eq('month_year', monthYear).eq('is_approved', false);
  if (deleteError) throw deleteError;
  if (drafts.length) {
    const { error: insertError } = await supabase.from('monthly_winners').insert(drafts);
    if (insertError) throw insertError;
  }

  return { monthYear, drafted: drafts.length };
}
