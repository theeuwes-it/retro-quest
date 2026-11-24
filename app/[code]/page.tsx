import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import { Game } from '@/components/Game';
import { normalizeCode } from '@/lib/shared/code';

export default function RoomPage({ params }: PageProps<'/[code]'>) {
  return (
    <Suspense
      fallback={
        <main className="landing">
          <p className="pixel muted" style={{ fontSize: 12 }}>
            Opening the gate…
          </p>
        </main>
      }
    >
      <ResolvedRoom params={params} />
    </Suspense>
  );
}

async function ResolvedRoom({ params }: { params: PageProps<'/[code]'>['params'] }) {
  const { code: raw } = await params;
  const code = normalizeCode(raw);
  if (!code) notFound();
  if (code !== raw) redirect(`/${code}`);
  return <Game code={code} />;
}
