'use server';

import { getSupabaseAdmin } from '@/app/lib/supabase/admin';
import { authorizeAdminAction, unlockAdminVault } from '@/app/lib/admin/authorization';

export async function triggerAuditAction() {
  try {
    const authorization = await authorizeAdminAction();
    if (!authorization.ok) return { success: false, error: authorization.error };
    const supabase = getSupabaseAdmin();

    const { data: settings } = await supabase.from('site_settings')
      .select('target_exact_scores, min_points_floor').limit(1).single();
    const targetCS = settings?.target_exact_scores || 4;
    const floorPts = settings?.min_points_floor || 100;
    const { data: topUsers } = await supabase.from('profiles')
      .select('id, full_name, is_vip, eligible_monthly_points, eligible_monthly_correct_scores')
      .order('eligible_monthly_points', { ascending: false }).limit(5);
    if (!topUsers || topUsers.length === 0) return { success: false, error: 'No eligible users found.' };

    const currentMonthYear = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    const { error: deleteError } = await supabase.from('monthly_winners').delete()
      .eq('month_year', currentMonthYear).eq('is_approved', false);
    if (deleteError) throw deleteError;

    for (let i = 0; i < topUsers.length; i++) {
      const user = topUsers[i];
      const { data: preds, error: predictionError } = await supabase.from('user_predictions')
        .select('predicted_home_score, predicted_away_score, created_at, matches(league)')
        .eq('user_id', user.id).gte('points_awarded', 10);
      if (predictionError) throw predictionError;
      const exactScores = preds || [];
      const hasPredictions = exactScores.length > 0;
      const vipAndFloor = user.is_vip && user.eligible_monthly_points >= floorPts;
      const weeksPlayed = new Set(exactScores.map(p => {
        const date = new Date(p.created_at);
        const firstDay = new Date(date.getFullYear(), 0, 1);
        const days = (date.getTime() - firstDay.getTime()) / 86400000;
        return Math.ceil((days + firstDay.getDay() + 1) / 7);
      }));
      const isActivePlayer = hasPredictions && weeksPlayed.size >= 3;
      const uniqueLeagues = new Set(exactScores.map(p => (p.matches)?.league));
      const fourLeagues = hasPredictions && uniqueLeagues.size >= targetCS;
      const perfectMix = hasPredictions &&
        exactScores.some(p => p.predicted_home_score > p.predicted_away_score) &&
        exactScores.some(p => p.predicted_home_score < p.predicted_away_score) &&
        exactScores.some(p => p.predicted_home_score === p.predicted_away_score);
      const scoreStrings = exactScores.map(p => `${p.predicted_home_score}-${p.predicted_away_score}`);
      const uniqueScoreStrings = new Set(scoreStrings);
      const zeroZeroCount = scoreStrings.filter(value => value === '0-0').length;
      const scoreVariety = hasPredictions && uniqueScoreStrings.size > 1 && zeroZeroCount <= 1;
      const isPassed = vipAndFloor && isActivePlayer && fourLeagues && perfectMix && scoreVariety;
      const { error: insertError } = await supabase.from('monthly_winners').insert({
        user_id: user.id, month_year: currentMonthYear, points: user.eligible_monthly_points,
        rank: i + 1, prize_amount: i === 0 ? '$500 Cash' : i === 1 ? '$200 Cash' : 'Free VIP',
        is_approved: false,
        audit_report: {
          vip_and_floor: vipAndFloor, active_player: isActivePlayer, four_leagues: fourLeagues,
          perfect_mix: perfectMix, score_variety: scoreVariety, is_passed: isPassed,
        },
      });
      if (insertError) throw insertError;
    }
    return { success: true, message: 'Audit generated successfully! Check the dashboard.' };
  } catch (error) {
    console.error('Audit Execution Error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to execute the audit engine.' };
  }
}

export async function verifyAdminPin(pin: string) {
  return unlockAdminVault(pin);
}
