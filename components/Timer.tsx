'use client';

import { useEffect, useRef, useState } from 'react';
import { play } from '@/lib/client/sound';
import { useRoomApi } from './RoomContext';

export function remainingSec(timer: { durationSec: number; endsAt: number | null; pausedRemainingSec: number | null }, now: number) {
  if (timer.endsAt !== null) return Math.max(0, Math.ceil((timer.endsAt - now) / 1000));
  if (timer.pausedRemainingSec !== null) return timer.pausedRemainingSec;
  return timer.durationSec;
}

export function formatSec(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function Timer() {
  const { view, now } = useRoomApi();
  const { timer } = view;
  const [, force] = useState(0);
  const firedFor = useRef<number | null>(null);

  useEffect(() => {
    if (timer.endsAt === null) return;
    const id = window.setInterval(() => force((n) => n + 1), 250);
    return () => window.clearInterval(id);
  }, [timer.endsAt]);

  const sec = remainingSec(timer, now());
  const running = timer.endsAt !== null;
  const done = running && sec === 0;

  useEffect(() => {
    if (done && firedFor.current !== timer.endsAt) {
      firedFor.current = timer.endsAt;
      play('timer');
    }
  }, [done, timer.endsAt]);

  if (!running && timer.pausedRemainingSec === null && timer.durationSec === 0) return null;

  const state = done ? "Time's up" : running ? 'running' : timer.pausedRemainingSec !== null ? 'paused' : 'ready';
  return (
    <div className={`timer ${done ? 'done' : ''}`} role="timer" aria-label={`Timer ${formatSec(sec)}, ${state}`}>
      <span className="digits pixel" aria-hidden="true">
        {formatSec(sec)}
      </span>
      <span className="state">{state}</span>
    </div>
  );
}
