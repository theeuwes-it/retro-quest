'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import {
  clearMembership,
  membershipSnapshot,
  parseMembership,
  saveMembership,
  subscribeStorage,
} from '@/lib/client/storage';
import { TownGate } from './TownGate';
import { Room } from './Room';

const SERVER = '\u0000server';

export function Game({ code }: { code: string }) {
  // SERVER = rendering on the server, where there is no localStorage yet.
  const raw = useSyncExternalStore(
    subscribeStorage,
    () => membershipSnapshot(code),
    () => SERVER,
  );
  const membership = useMemo(() => (raw === SERVER ? undefined : parseMembership(raw)), [raw]);
  const [notice, setNotice] = useState<string | null>(null);

  if (membership === undefined) {
    return (
      <main className="landing">
        <p className="pixel muted" style={{ fontSize: 12 }}>
          Opening the gate…
        </p>
      </main>
    );
  }

  if (!membership) {
    return (
      <TownGate
        code={code}
        notice={notice}
        onJoined={(m) => {
          setNotice(null);
          saveMembership(code, m);
        }}
      />
    );
  }

  return (
    <Room
      code={code}
      token={membership.token}
      onLostSeat={(message) => {
        setNotice(message);
        clearMembership(code);
      }}
    />
  );
}
