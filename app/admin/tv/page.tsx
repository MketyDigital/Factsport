export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import TVStoryboardPreview from './TVStoryboardPreview';

export const metadata: Metadata = {
  title: 'Factsport TV | Media workspace',
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminTVPage() {
  return <TVStoryboardPreview />;
}
