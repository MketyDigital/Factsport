// app/components/GroupStandingsClient.tsx

'use client';

import { useEffect, useState } from 'react';
import GroupStageTable from '@/app/components/GroupStageTable';

export default function GroupStandingsClient({ leagueName, season }: { leagueName: string; season?: string }) {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leagueName) return;

    const params = new URLSearchParams();
    params.set('league', leagueName);

    if (season) {
      params.set('season', season);
    }

    fetch(`/api/cache/group-standings?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const grouped = data.reduce((acc: any, row: any) => {
            const groupName = row.group_name || 'Group';

            if (!acc[groupName]) {
              acc[groupName] = {
                name: groupName,
                group_name: groupName,
                teams: []
              };
            }

            acc[groupName].teams.push(row);
            return acc;
          }, {});

          setGroups(Object.values(grouped));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [leagueName, season]);

  if (loading) {
    return (
      <div className="w-full bg-white border border-slate-200 rounded-2xl shadow-sm p-6 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
        Loading group table...
      </div>
    );
  }

  return <GroupStageTable groups={groups} />;
}