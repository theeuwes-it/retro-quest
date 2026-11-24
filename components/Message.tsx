import Link from 'next/link';

export function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="landing">
      <div className="parchment landing-card center">
        <h1 className="pixel" style={{ fontSize: 16 }}>
          {title}
        </h1>
        <div>{children}</div>
        <div>
          <Link className="btn" href="/">
            Back to the start
          </Link>
        </div>
      </div>
    </main>
  );
}
