'use client';

import { useState } from 'react';
import { avatarById } from '@/lib/shared/classes';
import { LocationIcon } from '../art/Icons';
import { AvatarSprite } from '../art/Sprite';
import { useRoomApi } from '../RoomContext';

/** Location 0: the party gathers. The host starts when everyone is in. */
export function LobbyStage() {
  const { view, send } = useRoomApi();
  const [copied, setCopied] = useState(false);
  const link = typeof window !== 'undefined' ? `${window.location.origin}/${view.code}` : `/${view.code}`;
  const party = view.players.filter((p) => p.plays);

  return (
    <section aria-labelledby="stage-title">
      <div className="stage-head">
        <LocationIcon phase="lobby" size={40} />
        <div>
          <h1 id="stage-title" className="stage-title pixel">
            The Town Gate
          </h1>
          <p className="stage-sub" style={{ margin: 0 }}>
            The party gathers. Share the code in your call chat.
          </p>
        </div>
      </div>

      <div className="parchment panel stack" style={{ maxWidth: 760 }}>
        <div className="row">
          <span className="code-chip" aria-label={`Room code ${view.code.split('').join(' ')}`}>
            {view.code}
          </span>
          <code style={{ fontSize: 15, overflowWrap: 'anywhere' }}>{link}</code>
          <button
            className="btn small secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {}
            }}
          >
            {copied ? 'Copied!' : 'Copy link'}
          </button>
        </div>
        <h2 className="pixel" style={{ fontSize: 11 }}>
          Adventurers ({party.length})
        </h2>
        <div className="reveal-grid">
          {party.map((p) => (
            <div key={p.id} className="row" style={{ flexWrap: 'nowrap' }}>
              <AvatarSprite avatarId={p.avatarId} size={48} />
              <div>
                <strong>{p.name}</strong>
                {p.id === view.me.id && <span className="hint"> (you)</span>}
                <div className="hint">
                  {avatarById(p.avatarId)?.name} · {p.online ? 'online' : 'offline'}
                  {p.isHost ? ' · host' : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
        {party.length < 4 && <p className="hint">Retro Quest works best with 4 or more players.</p>}
        {view.isHost ? (
          <div className="row">
            <button className="btn" onClick={() => send({ type: 'phase:set', phase: 'tavern', subPhase: 'writing' })}>
              Start the quest →
            </button>
            <span className="hint">Everyone in? The party travels to the Tavern first.</span>
          </div>
        ) : (
          <p style={{ margin: 0 }}>Waiting for the host to start the quest…</p>
        )}
      </div>
    </section>
  );
}
