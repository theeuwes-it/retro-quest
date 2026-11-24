'use client';

import { useEffect, useState } from 'react';
import type { Membership } from '@/lib/client/storage';
import { AvatarPicker } from './AvatarPicker';
import { NameField } from './NameField';
import { LocationIcon } from './art/Icons';
import { Message } from './Message';

interface Info {
  ended: boolean;
  memberCount: number;
  freeAvatars: string[];
}

/** Location 0: players enter a name and pick an avatar. */
export function TownGate({ code, notice, onJoined }: { code: string; notice: string | null; onJoined: (m: Membership) => void }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [loadError, setLoadError] = useState<{ status: number; message: string } | null>(null);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/rooms/${code}`, { cache: 'no-store' })
      .then(async (res) => {
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) return setLoadError({ status: res.status, message: body.error ?? 'Could not open this room' });
        setInfo(body);
        // A random free avatar, so people joining at the same moment rarely collide.
        const free: string[] = body.freeAvatars;
        setAvatar((a) => (a && free.includes(a) ? a : (free[Math.floor(Math.random() * free.length)] ?? null)));
      })
      .catch(() => {
        if (!cancelled) setLoadError({ status: 0, message: 'Could not reach the server' });
      });
    return () => {
      cancelled = true;
    };
  }, [code, reloadKey]);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Enter your name');
    if (!avatar) return setError('Pick an avatar');
    setBusy(true);
    try {
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, avatarId: avatar }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? 'Could not join');
        if (res.status === 409) setReloadKey((k) => k + 1); // avatar taken: refresh the list
        setBusy(false);
        return;
      }
      onJoined({ token: body.token });
    } catch {
      setError('Could not reach the server');
      setBusy(false);
    }
  }

  if (loadError) {
    if (loadError.status === 404) {
      return (
        <Message title="No such room">
          <p>
            There is no room <strong>{code}</strong>. Check the code, or the room may have expired.
          </p>
        </Message>
      );
    }
    return (
      <Message title="The gate is stuck">
        <p>{loadError.message}</p>
      </Message>
    );
  }

  if (info?.ended) {
    return (
      <Message title="This quest is over">
        <p>Room {code} has ended. Ask your host for the summary.</p>
      </Message>
    );
  }

  return (
    <main className="landing">
      <form className="parchment landing-card" onSubmit={join} aria-labelledby="gate-title">
        <div className="row">
          <LocationIcon phase="lobby" size={40} />
          <div>
            <h1 id="gate-title" className="pixel" style={{ fontSize: 16 }}>
              The Town Gate
            </h1>
            <p className="hint">
              Joining room <strong>{code}</strong>
              {info ? ` · ${info.memberCount} already inside` : ''}
            </p>
          </div>
        </div>
        {notice && (
          <p className="error-text" role="status">
            {notice}
          </p>
        )}
        <div className="field">
          <span className="label">Choose your avatar</span>
          {info ? <AvatarPicker value={avatar} onChange={setAvatar} available={info.freeAvatars} /> : <p className="hint">Loading…</p>}
        </div>
        <NameField id="player-name" value={name} onChange={setName} placeholder="e.g. Robin" autoFocus avatarId={avatar} />
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div>
          <button className="btn" type="submit" disabled={busy || !info}>
            {busy ? 'Entering…' : 'Enter the town'}
          </button>
        </div>
      </form>
    </main>
  );
}
