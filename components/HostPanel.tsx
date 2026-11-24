'use client';

import { useState } from 'react';
import { LOCATIONS, STEPS, locationIndexOf } from '@/lib/shared/config';
import { useRoomApi } from './RoomContext';
import { formatSec } from './Timer';

/** Collapsible drawer, host only: Next/Back, Reveal, timer, Lock voting, End session. */
export function HostPanel({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { view, send } = useRoomApi();
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [minutes, setMinutes] = useState('');
  const idx = view.stepIndex;
  const step = STEPS[idx];
  const prev = STEPS[idx - 1];
  const next = STEPS[idx + 1];
  const ended = view.phase === 'ended';
  const t = view.timer;
  const running = t.endsAt !== null;
  const paused = t.pausedRemainingSec !== null;

  const canReveal =
    !ended && (view.subPhase === 'writing' || (view.phase === 'warTable' && view.subPhase === 'voting'));
  const revealLabel =
    view.phase === 'tavern' ? 'Reveal class picks' : view.phase === 'warTable' ? 'Reveal votes' : 'Reveal cards';

  const go = (s: (typeof STEPS)[number]) => send({ type: 'phase:set', phase: s.phase, subPhase: s.subPhase });
  const nextLabel = (() => {
    if (!next) return 'Next';
    if (next.phase === step.phase) {
      if (next.subPhase === 'revealed') return step.phase === 'warTable' ? 'Next: reveal votes' : 'Next: reveal';
      if (next.subPhase === 'voting') return 'Next: open voting';
    }
    if (step.phase === 'lobby') return 'Start the quest';
    return `Travel to ${LOCATIONS[locationIndexOf(next.phase)].name}`;
  })();

  if (!open) {
    return (
      <aside className="host collapsed" aria-label="Host controls">
        <button className="btn" onClick={onToggle} aria-expanded="false">
          Host controls
        </button>
      </aside>
    );
  }

  return (
    <aside className="host parchment" aria-label="Host controls">
      <div className="host-inner">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 className="pixel">Host controls</h2>
          <button className="btn tiny secondary" onClick={onToggle} aria-expanded="true">
            Hide
          </button>
        </div>
        <div>
          <div className="hint">Now</div>
          <div className="step-now">
            {ended ? 'Session ended' : `${LOCATIONS[locationIndexOf(view.phase)].name}: ${step?.label}`}
          </div>
        </div>

        {!ended && (
          <>
            <div className="row">
              <button className="btn secondary" disabled={!prev} onClick={() => prev && go(prev)}>
                ← Back
              </button>
              <button className="btn" disabled={!next} onClick={() => next && go(next)}>
                {nextLabel} →
              </button>
            </div>
            {canReveal && (
              <button className="btn" onClick={() => send({ type: 'reveal' })}>
                {revealLabel}
              </button>
            )}
            {view.phase === 'warTable' && view.subPhase === 'voting' && (
              <button className="btn secondary" disabled={view.votes.locked} onClick={() => send({ type: 'vote:lock' })}>
                {view.votes.locked ? 'Voting locked' : 'Lock voting'}
              </button>
            )}
            <hr />
            <div className="stack" style={{ gap: 8 }}>
              <h2 className="pixel">Timer</h2>
              <div className="row">
                {!running && !paused && (
                  <button className="btn small" onClick={() => send({ type: 'timer:start' })} disabled={t.durationSec < 1}>
                    Start {t.durationSec > 0 ? formatSec(t.durationSec) : ''}
                  </button>
                )}
                {running && (
                  <button className="btn small" onClick={() => send({ type: 'timer:pause' })}>
                    Pause
                  </button>
                )}
                {paused && (
                  <button className="btn small" onClick={() => send({ type: 'timer:resume' })}>
                    Resume
                  </button>
                )}
                <button className="btn small secondary" onClick={() => send({ type: 'timer:add' })}>
                  +1 min
                </button>
                <button className="btn small secondary" onClick={() => send({ type: 'timer:reset' })}>
                  Reset
                </button>
              </div>
              <form
                className="row"
                onSubmit={(e) => {
                  e.preventDefault();
                  const m = Number(minutes);
                  if (!Number.isFinite(m) || m <= 0) return;
                  void send({ type: 'timer:reset', durationSec: Math.round(m * 60) });
                  setMinutes('');
                }}
              >
                <label className="sr-only" htmlFor="timer-min">
                  Set timer minutes
                </label>
                <input
                  id="timer-min"
                  className="input"
                  style={{ width: 90 }}
                  inputMode="decimal"
                  placeholder="min"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                />
                <button className="btn small secondary" type="submit">
                  Set
                </button>
              </form>
            </div>
            <hr />
            <PartyManager />
            <hr />
            {!confirmEnd ? (
              <button className="btn danger" onClick={() => setConfirmEnd(true)}>
                End session
              </button>
            ) : (
              <div className="stack" style={{ gap: 8 }} role="alertdialog" aria-label="Confirm end session">
                <p style={{ margin: 0 }}>End the session? The room becomes read-only and is deleted after 7 days.</p>
                <div className="row">
                  <button
                    className="btn danger"
                    onClick={async () => {
                      await send({ type: 'session:end' });
                      setConfirmEnd(false);
                    }}
                  >
                    Yes, end it
                  </button>
                  <button className="btn secondary" onClick={() => setConfirmEnd(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}
        {ended && <p style={{ margin: 0 }}>The room is read-only now. Everyone can still copy or download the summary.</p>}
      </div>
    </aside>
  );
}

function PartyManager() {
  const { view, send } = useRoomApi();
  const [removing, setRemoving] = useState<string | null>(null);
  const others = view.players.filter((p) => p.id !== view.me.id);
  const share = typeof window !== 'undefined' ? `${window.location.origin}/${view.code}` : `/${view.code}`;
  const [copied, setCopied] = useState(false);
  return (
    <div className="stack" style={{ gap: 8 }}>
      <h2 className="pixel">Party ({view.players.filter((p) => p.plays).length} playing)</h2>
      <button
        className="btn small secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(share);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {}
        }}
      >
        {copied ? 'Link copied!' : 'Copy join link'}
      </button>
      {others.length === 0 && <p className="hint">Nobody else has joined yet.</p>}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
        {others.map((p) => (
          <li key={p.id} className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
            <span>
              {p.name} <span className="hint">{p.online ? 'online' : 'offline'}</span>
            </span>
            {removing === p.id ? (
              <span className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                <button
                  className="btn tiny danger"
                  onClick={async () => {
                    await send({ type: 'player:remove', playerId: p.id });
                    setRemoving(null);
                  }}
                >
                  Remove
                </button>
                <button className="btn tiny secondary" onClick={() => setRemoving(null)}>
                  Keep
                </button>
              </span>
            ) : (
              <button className="btn tiny secondary" onClick={() => setRemoving(p.id)} aria-label={`Remove ${p.name}`}>
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
