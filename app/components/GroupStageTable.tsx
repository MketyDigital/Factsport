// app/components/GroupStageTable.tsx

'use client';

import { Trophy, CheckCircle, AlertTriangle } from 'lucide-react';

type GroupTeam = {
  name?: string;
  team_name?: string;
  team_short_name?: string;
  points?: number;
  played?: number;
  played_games?: number;
  goalDifference?: number;
  goal_difference?: number;
  qualification_status?: string;
  qualification_note?: string;
};

type Group = {
  name?: string;
  group_name?: string;
  teams?: GroupTeam[];
};

const getTeamName = (team: GroupTeam) => {
  return team.team_name || team.name || team.team_short_name || 'Unknown Team';
};

const getPoints = (team: GroupTeam) => {
  return Number(team.points ?? 0);
};

const getPlayed = (team: GroupTeam) => {
  return Number(team.played ?? team.played_games ?? 0);
};

const getGD = (team: GroupTeam) => {
  return Number(team.goalDifference ?? team.goal_difference ?? 0);
};

const getStatusText = (status?: string) => {
  if (!status) return '';
  if (status === 'LIKELY_QUALIFIED') return 'Likely Qualified';
  if (status === 'THIRD_PLACE_OR_PLAYOFF_POSSIBLE') return 'Third/Playoff Possible';
  if (status === 'OUTSIDE_TOP_TWO') return 'Outside Top Two';
  return status.replace(/_/g, ' ');
};

export default function GroupStageTable({ groups }: { groups?: Group[] }) {
  if (!groups || groups.length === 0) return null;

  return (
    <div className="w-full bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="bg-[#0a1428] px-4 py-3 flex items-center gap-2">
        <Trophy size={16} className="text-yellow-500" />
        <h3 className="text-white text-[10px] md:text-xs font-black uppercase tracking-widest">
          Group Standings
        </h3>
      </div>

      <div className="divide-y divide-slate-100">
        {groups.map((group, groupIndex) => {
          const groupName = group.group_name || group.name || `Group ${groupIndex + 1}`;
          const teams = group.teams || [];

          return (
            <div key={`${groupName}-${groupIndex}`} className="p-3 md:p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-black text-slate-800">{groupName}</h4>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  Projected
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[320px]">
                  <thead>
                    <tr className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50">
                      <th className="px-2 py-2 text-center">#</th>
                      <th className="px-2 py-2">Team</th>
                      <th className="px-2 py-2 text-center">P</th>
                      <th className="px-2 py-2 text-center">GD</th>
                      <th className="px-2 py-2 text-center">Pts</th>
                      <th className="px-2 py-2">Status</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 text-[10px] md:text-xs">
                    {teams.map((team, index) => {
                      const status = team.qualification_status;
                      const isLikely = status === 'LIKELY_QUALIFIED';
                      const isPossible = status === 'THIRD_PLACE_OR_PLAYOFF_POSSIBLE';

                      return (
                        <tr key={`${groupName}-${getTeamName(team)}-${index}`} className="hover:bg-slate-50">
                          <td className="px-2 py-2 text-center font-black text-slate-500">{index + 1}</td>
                          <td className="px-2 py-2 font-black text-slate-800 truncate max-w-[140px]">
                            {getTeamName(team)}
                          </td>
                          <td className="px-2 py-2 text-center text-slate-500">{getPlayed(team)}</td>
                          <td className="px-2 py-2 text-center text-slate-500">
                            {getGD(team) > 0 ? `+${getGD(team)}` : getGD(team)}
                          </td>
                          <td className="px-2 py-2 text-center font-black text-slate-900">{getPoints(team)}</td>
                          <td className="px-2 py-2">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-widest ${
                                isLikely
                                  ? 'bg-green-50 text-green-700'
                                  : isPossible
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {isLikely ? <CheckCircle size={10} /> : <AlertTriangle size={10} />}
                              {getStatusText(status)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {teams.some((t) => t.qualification_note) && (
                <div className="mt-2 text-[9px] md:text-[10px] font-bold text-slate-400 leading-relaxed">
                  {teams[0].qualification_note}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}