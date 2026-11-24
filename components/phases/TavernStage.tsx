'use client';

import { useEffect, useRef, useState } from 'react';
import { play } from '@/lib/client/sound';
import { CLASSES, classById } from '@/lib/shared/classes';
import { TAVERN_COMMENT_MAX } from '@/lib/shared/config';
import { LocationIcon } from '../art/Icons';
import { AvatarSprite, PixelSprite } from '../art/Sprite';
import { useRoomApi } from '../RoomContext';

/** Check-in: everyone picks a class for how the sprint felt; picks reveal together. */
export function TavernStage() {
  const { view } = useRoomApi();
  const revealed = view.revealed.tavern;
  const wasRevealed = useRef(revealed);
  useEffect(() => {
    if (revealed && !wasRevealed.current) play('reveal');
    wasRevealed.current = revealed;
  }, [revealed]);

  const playing = view.players.filter((p) => p.plays);

  return (
    <section aria-labelledby="stage-title">
      <div className="stage-head">
        <LocationIcon phase="tavern" size={40} />
        <div>
          <h1 id="stage-title" className="stage-title pixel">
            The Tavern
          </h1>
          <p className="stage-sub" style={{ margin: 0 }}>
            Check-in: which class matches how this sprint felt?
          </p>
        </div>
      </div>

      {view.me.plays && <ClassPicker key={revealed ? 'r' : 'w'} />}

      <h2 className="section-title pixel">
        {revealed ? 'The party' : `${view.tavernPickedCount} of ${playing.length} have chosen`}
      </h2>
      <div className="reveal-grid">
        {playing.map((p) => {
          const pick = view.tavernPicks.find((t) => t.playerId === p.id);
          const cls = classById(p.classId);
          return (
            <div key={p.id} className={`parchment hero-card ${revealed && cls ? 'flip-in' : ''}`}>
              <AvatarSprite avatarId={p.avatarId} classId={revealed ? p.classId : undefined} size={56} />
              <div>
                <strong>{p.name}</strong>
                {revealed ? (
                  cls ? (
                    <>
                      <div style={{ fontWeight: 700, color: 'var(--ink-soft)' }}>{cls.name}</div>
                      {pick?.comment && <div style={{ fontStyle: 'italic' }}>“{pick.comment}”</div>}
                    </>
                  ) : (
                    <div className="hint">No class picked</div>
                  )
                ) : (
                  <div className="hint">{p.id === view.me.id ? (cls ? `You picked ${cls.name}` : 'Choosing…') : 'Hidden until the reveal'}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ClassPicker() {
  const { view, send } = useRoomApi();
  const mine = view.tavernPicks.find((t) => t.playerId === view.me.id);
  const [comment, setComment] = useState(mine?.comment ?? '');
  const [saved, setSaved] = useState(false);
  const selected = mine?.classId;
  if (view.phase === 'ended') return null;

  async function pick(classId: string) {
    await send({ type: 'tavern:pick', classId, comment: comment.trim() || undefined });
  }

  return (
    <div className="stack">
      <div className="class-grid" role="group" aria-label="Choose your class">
        {CLASSES.map((c) => (
          <button key={c.id} className="class-option" aria-pressed={selected === c.id} onClick={() => pick(c.id)}>
            <PixelSprite id={`class-${c.id}`} size={48} />
            <span>
              <span className="name">{c.name}</span>
              <br />
              <span className="desc">{c.description}</span>
            </span>
          </button>
        ))}
      </div>
      <form
        className="parchment panel row"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!selected) return;
          const ok = await send({ type: 'tavern:pick', classId: selected, comment: comment.trim() || undefined });
          if (ok) {
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          }
        }}
      >
        <div className="field" style={{ flex: '1 1 320px' }}>
          <label htmlFor="tavern-comment">One-line comment (optional)</label>
          <input
            id="tavern-comment"
            className="input"
            value={comment}
            maxLength={TAVERN_COMMENT_MAX}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Anything you want to add?"
          />
        </div>
        <button className="btn secondary" type="submit" disabled={!selected} style={{ alignSelf: 'end' }}>
          {saved ? 'Saved!' : 'Save comment'}
        </button>
        {!selected && <span className="hint">Pick a class first.</span>}
      </form>
    </div>
  );
}
