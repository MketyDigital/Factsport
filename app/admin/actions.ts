'use server'; 

import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

// ====================================================
// ACTION 1: THE BULLETPROOF AUDIT TRIGGER
// ====================================================
export async function triggerAuditAction() {
    // Uses Service Role to bypass RLS for administrative backend tasks
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!, 
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    try {
        const { data: settings } = await supabase.from('site_settings').select('target_exact_scores, min_points_floor').limit(1).single();
        const targetCS = settings?.target_exact_scores || 4;
        const floorPts = settings?.min_points_floor || 100;

        const { data: topUsers } = await supabase
            .from('profiles')
            .select('id, full_name, is_vip, eligible_monthly_points, eligible_monthly_correct_scores')
            .order('eligible_monthly_points', { ascending: false })
            .limit(5);

        if (!topUsers || topUsers.length === 0) return { success: false, error: "No eligible users found." };

        const currentMonthYear = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
        await supabase.from('monthly_winners').delete().eq('month_year', currentMonthYear).eq('is_approved', false);

        for (let i = 0; i < topUsers.length; i++) {
            const user = topUsers[i];
            
            const { data: preds } = await supabase
                .from('user_predictions')
                .select('predicted_home_score, predicted_away_score, created_at, matches(league)')
                .eq('user_id', user.id)
                .gte('points_awarded', 10); 

            const exactScores = preds || [];
            
            // 🚨 ZERO PREDICTIONS = INSTANT FAIL
            const hasPredictions = exactScores.length > 0;

            const vipAndFloor = user.is_vip && user.eligible_monthly_points >= floorPts;

            const weeksPlayed = new Set(exactScores.map(p => {
                const d = new Date(p.created_at);
                const firstDayOfYear = new Date(d.getFullYear(), 0, 1);
                const pastDaysOfYear = (d.getTime() - firstDayOfYear.getTime()) / 86400000;
                return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
            }));
            const isActivePlayer = hasPredictions && weeksPlayed.size >= 3;

            const uniqueLeagues = new Set(exactScores.map(p => (p.matches as any)?.league));
            const fourLeagues = hasPredictions && uniqueLeagues.size >= targetCS;

            const perfectMix = hasPredictions && 
                exactScores.some(p => p.predicted_home_score > p.predicted_away_score) && 
                exactScores.some(p => p.predicted_home_score < p.predicted_away_score) && 
                exactScores.some(p => p.predicted_home_score === p.predicted_away_score); 

            const scoreStrings = exactScores.map(p => `${p.predicted_home_score}-${p.predicted_away_score}`);
            const uniqueScoreStrings = new Set(scoreStrings);
            const zeroZeroCount = scoreStrings.filter(s => s === '0-0').length;
            
            const scoreVariety = hasPredictions && uniqueScoreStrings.size > 1 && zeroZeroCount <= 1;

            const isPassed = vipAndFloor && isActivePlayer && fourLeagues && perfectMix && scoreVariety;

            await supabase.from('monthly_winners').insert({
                user_id: user.id,
                month_year: currentMonthYear,
                points: user.eligible_monthly_points,
                rank: i + 1,
                prize_amount: i === 0 ? '$500 Cash' : i === 1 ? '$200 Cash' : 'Free VIP',
                is_approved: false,
                audit_report: {
                    vip_and_floor: vipAndFloor,
                    active_player: isActivePlayer,
                    four_leagues: fourLeagues,
                    perfect_mix: perfectMix,
                    score_variety: scoreVariety,
                    is_passed: isPassed
                }
            });
        }

        return { success: true, message: "Audit generated successfully! Check the dashboard." };
    } catch (error: any) {
        console.error("Audit Execution Error:", error);
        return { success: false, error: error.message || "Failed to execute the audit engine." };
    }
}

// ====================================================
// ACTION 2: THE GLOBAL VAULT UNLOCKER
// ====================================================
export async function verifyAdminPin(pin: string) {
    const correctPin = process.env.ADMIN_PIN;

    if (!correctPin) {
        return { success: false, error: 'System configuration error. Vault sealed.' };
    }

    if (pin === correctPin) {
        cookies().set('admin_vault_unlocked', 'true', {
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
            path: '/admin',
            maxAge: 60 * 60 * 12 
        });
        
        return { success: true };
    }

    return { success: false, error: 'Incorrect PIN.' };
}