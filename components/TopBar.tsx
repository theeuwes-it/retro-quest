'use client';

import { useSyncExternalStore } from 'react';
import { onSoundChange, setSoundEnabled, soundEnabled } from '@/lib/client/sound';
import type { Connection } from '@/lib/client/useRoom';
import { avatarById, classById } from '@/lib/shared/classes';
import { NAME_TAG_COLORS } from '@/lib/shared/config';
import type { ViewPlayer } from '@/lib/shared/types';
import { CrownIcon } from './art/Icons';
import { AvatarSprite } from './art/Sprite';
import { useRoomApi } from './RoomContext';
import { Timer } from './Timer';

export function TopBar({ connection }: { connection: Connection }) {
  const { view } = useRoomApi();
  const writing = view.subPhase === 'writing';
  const members = view.players.filter((p) => p.plays || p.isHost);

  return (
    <header className="topbar">
      <span className="brand pixel" aria-label={`Retro Quest, room ${view.code}`}>
        RQ · {view.code}
      </span>
      <ul className="party" aria-label="Party">
        {members.map((p) => (
          <PartyMember key={p.id} p={p} me={p.id === view.me.id} showDone={writing} />
        ))}
      </ul>
      <PartyXp />
      <Timer />
      <SoundToggle />
      <span className="conn" title="Connection">
        {connection === 'live' ? '● live' : connection === 'polling' ? '◐ syncing' : '○ offline'}
      </span>
    </header>
  );
}

export function PartyMember({ p, me, showDone }: { p: ViewPlayer; me: boolean; showDone: boolean }) {
  const cls = classById(p.classId);
  const label = [
    p.name,
    me ? '(you)' : '',
    p.isHost ? 'host' : '',
    p.online ? 'online' : 'offline',
    cls ? `class ${cls.name}` : `avatar ${avatarById(p.avatarId)?.name ?? ''}`,
    showDone && p.doneWriting ? 'done writing' : '',
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <li className={`party-member ${me ? 'me' : ''} ${p.online ? '' : 'offline'}`} aria-label={label} title={label}>
      {p.isHost && (
        <span className="host-crown">
          <CrownIcon size={16} />
        </span>
      )}
      <span className={`status-dot ${p.online ? 'online' : 'offline'}`} aria-hidden="true" />
      {showDone && p.doneWriting && (
        <span className="done-check" aria-hidden="true">
          ✓
        </span>
      )}
      <AvatarSprite avatarId={p.avatarId} classId={p.classId} size={34} />
      <span className="name-tag" style={{ background: NAME_TAG_COLORS[p.color % NAME_TAG_COLORS.length] }} aria-hidden="true">
        {p.name}
      </span>
    </li>
  );
}

function PartyXp() {
  const { view } = useRoomApi();
  const { level, intoLevel, perLevel, total } = view.xp;
  const pct = Math.round((intoLevel / perLevel) * 100);
  return (
    <div className="xp" aria-label={`Party level ${level}, ${intoLevel} of ${perLevel} XP to the next level`}>
      <div className="xp-label pixel" aria-hidden="true">
        <span>Party Lv {level}</span>
        <span>{total} XP</span>
      </div>
      <div className="bar" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SoundToggle() {
  const on = useSyncExternalStore(
    (cb) => {
      const off = onSoundChange(cb);
      return () => {
        off();
      };
    },
    soundEnabled,
    () => false,
  );
  return (
    <button
      className="icon-btn"
      aria-pressed={on}
      aria-label={on ? 'Sound on. Click to mute' : 'Sound off. Click to turn on'}
      title={on ? 'Mute sounds' : 'Turn sounds on'}
      onClick={() => setSoundEnabled(!on)}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
        {on ? (
          <path d="M16 8a5 5 0 0 1 0 8M18.5 5.5a8.5 8.5 0 0 1 0 13" stroke="currentColor" strokeWidth="2" fill="none" />
        ) : (
          <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="2" />
        )}
      </svg>
    </button>
  );
}
