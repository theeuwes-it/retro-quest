'use client';

import { useEffect, useRef, useState } from 'react';
import { play } from '@/lib/client/sound';
import { CARD_TEXT_MAX, CARD_TYPE_INFO, LOCATIONS, STEPS, locationIndexOf } from '@/lib/shared/config';
import type { CardType, ViewCard } from '@/lib/shared/types';
import { LocationIcon } from '../art/Icons';
import { AvatarSprite } from '../art/Sprite';
import { CardView, FaceDown } from '../CardView';
import { useRoomApi } from '../RoomContext';

type Visible = Extract<ViewCard, { hidden: false }>;

/** Monster Woods, Treasure Cave and Potion Shop: writing round, then reveal and discussion. */
export function CardStage({ type }: { type: CardType }) {
  const { view } = useRoomApi();
  const revealed = view.revealed[type];
  const info = CARD_TYPE_INFO[type];
  const loc = LOCATIONS[locationIndexOf(view.phase)];
  const cards = view.cards.filter((c) => c.type === type);
  const visible = cards.filter((c): c is Visible => !c.hidden);
  const mine = visible.filter((c) => c.mine);

  // Flip animation for cards that were face-down on the previous render.
  const hiddenIds = cards
    .filter((c) => c.hidden)
    .map((c) => c.id)
    .join(',');
  const [flips, setFlips] = useState<{ hidden: string; delays: Record<string, number> }>({ hidden: hiddenIds, delays: {} });
  if (flips.hidden !== hiddenIds) {
    const before = new Set(flips.hidden.split(',').filter(Boolean));
    const delays: Record<string, number> = {};
    let order = 0;
    for (const c of cards) if (!c.hidden && before.has(c.id)) delays[c.id] = Math.min(order++ * 45, 280);
    setFlips({ hidden: hiddenIds, delays });
  }
  const wasRevealed = useRef(revealed);
  useEffect(() => {
    if (revealed && !wasRevealed.current) play('reveal');
    wasRevealed.current = revealed;
  }, [revealed]);

  return (
    <section aria-labelledby="stage-title">
      <div className="stage-head">
        <LocationIcon phase={view.phase} size={40} />
        <div>
          <h1 id="stage-title" className="stage-title pixel">
            {loc.name}
          </h1>
          <p className="stage-sub" style={{ margin: 0 }}>
            {info.prompt} · <strong>{STEPS[view.stepIndex]?.label}</strong>
          </p>
        </div>
      </div>

      {!revealed ? (
        <div className="writing-layout">
          <div>
            <h2 className="section-title pixel">Your {info.plural.toLowerCase()} (only you can see these)</h2>
            {mine.length === 0 && <p className="muted">No cards yet. Write one below — one idea per card works best.</p>}
            <div className="grid-cards">
              {mine.map((c) => (
                <CardView key={c.id} card={c} allowDelete />
              ))}
            </div>
            {view.me.plays ? <Composer type={type} /> : <p className="muted">You are hosting without playing, so you don&apos;t add cards.</p>}
          </div>
          <AroundTheTable type={type} cards={cards} />
        </div>
      ) : (
        <>
          {visible.length === 0 && <p className="muted">No {info.plural.toLowerCase()} were written.</p>}
          <div className="grid-cards">
            {visible.map((c) => (
              <CardView key={c.id} card={c} flipDelayMs={flips.delays[c.id]} />
            ))}
          </div>
          {view.me.plays && view.phase !== 'ended' && <Composer type={type} late />}
        </>
      )}
    </section>
  );
}

function AroundTheTable({ type, cards }: { type: CardType; cards: ViewCard[] }) {
  const { view, send } = useRoomApi();
  const playing = view.players.filter((p) => p.plays);
  const anonymousHidden = cards.filter((c) => c.hidden && c.anonymous).length;
  return (
    <aside className="parchment table-list" aria-label="Cards around the table">
      <h2 className="pixel" style={{ fontSize: 11 }}>
        Around the table
      </h2>
      {playing.map((p) => {
        const count = cards.filter((c) => c.authorId === p.id).length;
        return (
          <div className="table-row" key={p.id}>
            <span className="who">
              <AvatarSprite avatarId={p.avatarId} classId={p.classId} size={28} />
              {p.name}
              {p.doneWriting && (
                <span className="hint" aria-label="done writing">
                  ✓ done
                </span>
              )}
            </span>
            <span className="piles" aria-label={`${count} card${count === 1 ? '' : 's'}`}>
              {Array.from({ length: count }, (_, i) => (
                <FaceDown key={i} type={type} />
              ))}
            </span>
          </div>
        );
      })}
      {anonymousHidden > 0 && (
        <div className="table-row">
          <span className="who">
            <span className="stranger">? Mysterious Stranger</span>
          </span>
          <span className="piles" aria-label={`${anonymousHidden} anonymous cards`}>
            {Array.from({ length: anonymousHidden }, (_, i) => (
              <FaceDown key={i} type={type} />
            ))}
          </span>
        </div>
      )}
      {view.me.plays && (
        <label className="toggle" style={{ marginTop: 8 }}>
          <input
            type="checkbox"
            checked={view.me.doneWriting}
            onChange={(e) => send({ type: 'player:doneWriting', done: e.target.checked })}
          />
          I&apos;m done writing
        </label>
      )}
      <p className="hint" style={{ margin: 0 }}>
        Cards stay face-down until the host reveals them.
      </p>
    </aside>
  );
}

function Composer({ type, late }: { type: CardType; late?: boolean }) {
  const { send } = useRoomApi();
  const [text, setText] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  const info = CARD_TYPE_INFO[type];
  const id = `composer-${type}`;

  async function add(e?: React.FormEvent) {
    e?.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    const ok = await send({ type: 'card:add', cardType: type, text, anonymous });
    setBusy(false);
    if (ok) setText('');
  }

  return (
    <form className="parchment composer" onSubmit={add} aria-label={`Add a ${info.label} card`}>
      <label htmlFor={id} className="label">
        {late ? `Add a late ${info.label} card` : `New ${info.label} card`}
      </label>
      <textarea
        id={id}
        className="textarea"
        value={text}
        maxLength={CARD_TEXT_MAX}
        placeholder={info.prompt}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void add();
        }}
      />
      <div className="composer-row">
        <label className="toggle">
          <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
          Post anonymously
        </label>
        <span className="row">
          <span className={`counter ${text.length >= CARD_TEXT_MAX ? 'over' : ''}`} aria-live="polite">
            {text.length}/{CARD_TEXT_MAX}
          </span>
          <button className="btn" type="submit" disabled={!text.trim() || busy}>
            Add card
          </button>
        </span>
      </div>
      <span className="hint">Tip: Ctrl/⌘ + Enter adds the card.</span>
    </form>
  );
}
