'use client';
import { useRouter } from 'next/navigation';
import { useSmartInterval } from '@/app/hooks/useSmartInterval';

export default function AutoRefresh({ interval = 60000 }: { interval?: number }) {
  const router = useRouter();

  const fetchUpdates = () => {
      router.refresh();
  };

  // 🟢 CPU SHIELD: Uses our Smart Hook to only refresh when the user is actively looking at the screen!
  useSmartInterval(fetchUpdates, interval);

  return null; // This component is completely invisible
}