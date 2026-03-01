export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    
    if (searchParams.get('key') !== process.env.CRON_KEY) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const now = new Date();
        const firstDayOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDayOfPreviousMonth = new Date(firstDayOfCurrentMonth.getTime() - 1);
        const firstDayOfPreviousMonth = new Date(lastDayOfPreviousMonth.getFullYear(), lastDayOfPreviousMonth.getMonth(), 1);
        
        const targetMonthYear = firstDayOfPreviousMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

        const { data: topUsers } = await supabase
            .from('profiles')
            .select('id, full_name, is_vip, eligible_monthly_points, eligible_monthly_correct_scores')
            .order('eligible_monthly_points', { ascending: false })
            .limit(15);

        if (!topUsers) return NextResponse.json({ message: "No users found" });

        let draftWinners = [];
        let currentRank = 1;

        for (const user of topUsers) {
            if (currentRank > 3) break; 

            const { data: preds } = await supabase
                .from('user_predictions')
                .select(`predicted_home_score, predicted_away_score, points_awarded, created_at, match:matches(league)`)
                .eq('user_id', user.id)
                .eq('is_eligible_for_prize', true)
                .gte('created_at', firstDayOfPreviousMonth.toISOString())
                .lte('created_at', lastDayOfPreviousMonth.toISOString());

            const predictions = preds || [];
            const exactScores = predictions.filter(p => p.points_awarded === 10);
            
            const weeksActive = new Set(predictions.map(p => {
                const date = new Date(p.created_at);
                const start = new Date(date.getFullYear(), 0, 0);
                const diff = date.getTime() - start.getTime();
                return Math.floor(diff / (1000 * 60 * 60 * 24 * 7));
            })).size;
            const passActive = weeksActive >= 3;

            const leagues = new Set(exactScores.map(p => p.match?.league)).size;
            const passLeagues = leagues >= 4;

            let hasHome = false, hasAway = false, hasDraw = false;
            exactScores.forEach(p => {
                if (p.predicted_home_score > p.predicted_away_score) hasHome = true;
                if (p.predicted_away_score > p.predicted_home_score) hasAway = true;
                if (p.predicted_home_score === p.predicted_away_score) hasDraw = true;
            });
            const passMix = hasHome && hasAway && hasDraw;

            const scoreStrings = exactScores.map(p => `${p.predicted_home_score}-${p.predicted_away_score}`);
            const uniqueScores = new Set(scoreStrings).size;
            const zeroZeroCount = scoreStrings.filter(s => s === '0-0').length;
            const passVariety = (exactScores.length > 0 ? uniqueScores > 1 : true) && zeroZeroCount <= 1;

            const passVip = user.is_vip;
            const passFloor = user.eligible_monthly_points >= 100;
            const passExactCount = user.eligible_monthly_correct_scores >= 4;

            const isFullyQualified = passActive && passLeagues && passMix && passVariety && passVip && passFloor && passExactCount;

            const reportCard = {
                vip_and_floor: passVip && passFloor && passExactCount,
                active_player: passActive,
                four_leagues: passLeagues,
                perfect_mix: passMix,
                score_variety: passVariety,
                is_passed: isFullyQualified
            };

            draftWinners.push({
                month_year: targetMonthYear,
                user_id: user.id,
                rank: currentRank,
                points: user.eligible_monthly_points,
                prize_amount: currentRank === 1 ? '$500' : currentRank === 2 ? '$300' : '$200',
                is_approved: false,
                audit_report: reportCard
            });
            
            if (isFullyQualified) currentRank++;
        }

        if (draftWinners.length > 0) {
            await supabase.from('monthly_winners').delete().eq('month_year', targetMonthYear).eq('is_approved', false);
            await supabase.from('monthly_winners').insert(draftWinners);
        }

        return NextResponse.json({ success: true, message: `Audit for ${targetMonthYear} complete! Saved ${draftWinners.length} drafts.` });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}