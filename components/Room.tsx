'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRoom } from '@/lib/client/useRoom';
import type { ViewPlayer } from '@/lib/shared/types';
import { HostPanel } from './HostPanel';
import { Message } from './Message';
import { RoomContext, useRoomApi, type RoomApi } from './RoomContext';
import { Spotlight } from './Spotlight';
import { TopBar } from './TopBar';
import { WorldMap } from './WorldMap';
import { BossStage } from './phases/BossStage';
import { CardStage } from './phases/CardStage';
import { LobbyStage } from './phases/LobbyStage';
import { LootStage } from './phases/LootStage';
import { TavernStage } from './phases/TavernStage';
import { WarTableStage } from './phases/WarTableStage';

export function Room({ code, token, onLostSeat }: { code: string; token: string; onLostSeat: (message: string) => void }) {
  const { view, status, connection, send, toast, clearToast, now } = useRoom(code, token);
  const [hostOpen, setHostOpen] = useState(true);

  useEffect(() => {
    if (status === 'unauthorized') onLostSeat('We could not find your seat in this party. Please join again.');
  }, [status, onLostSeat]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(clearToast, 5000);
    return () => window.clearTimeout(id);
  }, [toast, clearToast]);

  const api = useMemo<RoomApi | null>(() => {
    if (!view) return null;
    const byId = new Map<string, ViewPlayer>(view.players.map((p) => [p.id, p]));
    return {
      view,
      send,
      now,
      player: (id) => (id ? byId.get(id) : undefined),
      nameOf: (id) => (id ? (byId.get(id)?.name ?? 'Former adventurer') : 'Mysterious Stranger'),
    };
  }, [view, send, now]);

  if (status === 'removed') {
    return (
      <Message title="You left the party">
        <p>The host removed you from room {code}.</p>
      </Message>
    );
  }
  if (status === 'notfound') {
    return (
      <Message title="No such room">
        <p>Room {code} does not exist anymore. Rooms are kept for 7 days.</p>
      </Message>
    );
  }
  if (!api) {
    return (
      <main className="landing">
        <p className="pixel muted" style={{ fontSize: 12 }} role="status">
          {status === 'error' ? 'Trouble reaching the server, retrying…' : 'Rejoining the party…'}
        </p>
      </main>
    );
  }

  const v = api.view;
  return (
    <RoomContext.Provider value={api}>
      <div className={`shell ${v.isHost ? 'with-host' : ''}`}>
        <TopBar connection={connection} />
        <aside className="rail" aria-label="World map">
          <WorldMap />
        </aside>
        <main className="stage" id="stage">
          {v.hostAway && <HostAwayBanner />}
          <Stage />
        </main>
        {v.isHost && <HostPanel open={hostOpen} onToggle={() => setHostOpen((o) => !o)} />}
      </div>
      <Spotlight />
      {toast && (
        <div className="toast" role="alert">
          <span>{toast}</span>
          <button className="btn tiny secondary" onClick={clearToast}>
            OK
          </button>
        </div>
      )}
    </RoomContext.Provider>
  );
}

function Stage() {
  const { view } = useRoomApi();
  switch (view.phase) {
    case 'lobby':
      return <LobbyStage />;
    case 'tavern':
      return <TavernStage />;
    case 'monster':
    case 'treasure':
    case 'potion':
      return <CardStage type={view.phase} key={view.phase} />;
    case 'warTable':
      return <WarTableStage />;
    case 'boss':
      return <BossStage />;
    case 'loot':
    case 'ended':
      return <LootStage />;
  }
}

function HostAwayBanner() {
  const { view, send } = useRoomApi();
  const host = view.players.find((p) => p.id === view.hostPlayerId);
  return (
    <div className="banner warn" role="status">
      <strong>The host ({host?.name ?? 'host'}) has lost their connection.</strong>
      <span>The session is paused until they return.</span>
      {view.canClaimHost && (
        <button className="btn small" onClick={() => send({ type: 'host:claim' })}>
          Claim host
        </button>
      )}
      {!view.canClaimHost && <span className="hint on-dark">After 2 minutes, anyone can claim host.</span>}
    </div>
  );
}
