'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { saveMembership } from '@/lib/client/storage';
import { normalizeCode } from '@/lib/shared/code';
import { NAME_MAX } from '@/lib/shared/config';
import { AvatarPicker } from './AvatarPicker';
import { LocationIcon } from './art/Icons';

export function CreateRoom() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [plays, setPlays] = useState(true);
  const [avatar, setAvatar] = useState<string | null>('knight');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Enter your name');
    setBusy(true);
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ hostName: name, hostPlays: plays, avatarId: avatar }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Could not create a room');
      saveMembership(body.code, { token: body.token, hostToken: body.hostToken });
      router.push(`/${body.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create a room');
      setBusy(false);
    }
  }

  function join(e: React.FormEvent) {
    e.preventDefault();
    const code = normalizeCode(joinCode.trim());
    if (!code) return setJoinError('Room codes are 4 letters');
    router.push(`/${code}`);
  }

  return (
    <main className="landing">
      <div className="stack" style={{ width: 'min(720px, 100%)', gap: 24 }}>
        <header className="center">
          <div className="row" style={{ justifyContent: 'center' }}>
            <LocationIcon phase="lobby" size={48} />
          </div>
          <h1 className="landing-title pixel">Retro Quest</h1>
          <p className="landing-sub">A sprint retrospective as a cosy fantasy adventure. No accounts needed.</p>
        </header>

        <form className="parchment landing-card" onSubmit={create} aria-labelledby="create-title">
          <h2 id="create-title" className="pixel" style={{ fontSize: 14 }}>
            Host a new quest
          </h2>
          <div className="field">
            <label htmlFor="host-name">Your name</label>
            <input
              id="host-name"
              className="input"
              value={name}
              maxLength={NAME_MAX}
              autoComplete="nickname"
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sam"
            />
          </div>
          <label className="toggle">
            <input type="checkbox" checked={plays} onChange={(e) => setPlays(e.target.checked)} />
            Host also plays (adds cards, votes and picks a class)
          </label>
          {plays && (
            <div className="field">
              <span className="label">Choose your avatar</span>
              <AvatarPicker value={avatar} onChange={setAvatar} />
            </div>
          )}
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <div className="row">
            <button className="btn" type="submit" disabled={busy}>
              {busy ? 'Opening the gate…' : 'Create room'}
            </button>
            <span className="hint">You get a 4-letter code and a link to share in your call.</span>
          </div>
        </form>

        <form className="parchment landing-card" onSubmit={join} aria-labelledby="join-title">
          <h2 id="join-title" className="pixel" style={{ fontSize: 14 }}>
            Join a quest
          </h2>
          <div className="row" style={{ alignItems: 'end' }}>
            <div className="field" style={{ flex: '1 1 200px' }}>
              <label htmlFor="join-code">Room code</label>
              <input
                id="join-code"
                className="input"
                value={joinCode}
                maxLength={4}
                autoCapitalize="characters"
                autoComplete="off"
                style={{ textTransform: 'uppercase', letterSpacing: '0.2em' }}
                onChange={(e) => {
                  setJoinCode(e.target.value);
                  setJoinError(null);
                }}
                placeholder="ABCD"
              />
            </div>
            <button className="btn secondary" type="submit">
              Go to the gate
            </button>
          </div>
          {joinError && (
            <p className="error-text" role="alert">
              {joinError}
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
