'use client';

import { useState } from 'react';
import { CARD_TEXT_MAX, CARD_TYPE_INFO, NAME_TAG_COLORS } from '@/lib/shared/config';
import type { ViewCard } from '@/lib/shared/types';
import { CardTypeIcon } from './art/Icons';
import { useRoomApi } from './RoomContext';

type Visible = Extract<ViewCard, { hidden: false }>;

export function TypeTag({ type }: { type: Visible['type'] }) {
  return (
    <span className={`type-tag ${type}`}>
      <CardTypeIcon type={type} size={18} />
      {CARD_TYPE_INFO[type].label}
    </span>
  );
}

export function Author({ card }: { card: Visible }) {
  const { player } = useRoomApi();
  if (card.anonymous) {
    return (
      <span className="stranger" title={card.mine ? 'Anonymous (only you can see this is yours)' : 'Anonymous'}>
        <span aria-hidden="true">?</span> Mysterious Stranger{card.mine ? ' (you)' : ''}
      </span>
    );
  }
  const p = player(card.authorId);
  return (
    <span className="name-tag" style={{ background: NAME_TAG_COLORS[(p?.color ?? 0) % NAME_TAG_COLORS.length] }}>
      {p?.name ?? 'Former adventurer'}
    </span>
  );
}

export function CardView({
  card,
  flipDelayMs,
  spotlight,
  allowDelete,
  hostTools = true,
  children,
}: {
  card: Visible;
  flipDelayMs?: number;
  spotlight?: boolean;
  allowDelete?: boolean;
  hostTools?: boolean;
  children?: React.ReactNode;
}) {
  const { view, send } = useRoomApi();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(card.text);
  const ended = view.phase === 'ended';
  const spotlit = view.spotlightCardId === card.id;

  const classes = ['card', card.type, card.discussed ? 'discussed' : '', spotlit && !spotlight ? 'spotlit' : '', flipDelayMs !== undefined ? 'flip-in' : '']
    .filter(Boolean)
    .join(' ');

  async function save() {
    const ok = await send({ type: 'card:edit', id: card.id, text: draft });
    if (ok) setEditing(false);
  }

  return (
    <article
      className={classes}
      style={flipDelayMs !== undefined ? { animationDelay: `${flipDelayMs}ms` } : undefined}
      aria-label={`${CARD_TYPE_INFO[card.type].label} card${card.discussed ? ', discussed' : ''}`}
    >
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <TypeTag type={card.type} />
        {card.discussed && <span className="hint">Discussed</span>}
      </div>
      {editing ? (
        <div className="stack" style={{ gap: 6 }}>
          <label className="sr-only" htmlFor={`edit-${card.id}`}>
            Edit card text
          </label>
          <textarea
            id={`edit-${card.id}`}
            className="textarea"
            value={draft}
            maxLength={CARD_TEXT_MAX}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void save();
              if (e.key === 'Escape') setEditing(false);
            }}
            autoFocus
          />
          <div className="row">
            <button className="btn small" onClick={save} disabled={!draft.trim()}>
              Save
            </button>
            <button
              className="btn small secondary"
              onClick={() => {
                setDraft(card.text);
                setEditing(false);
              }}
            >
              Cancel
            </button>
            <span className="counter">
              {draft.length}/{CARD_TEXT_MAX}
            </span>
          </div>
        </div>
      ) : (
        <p className="text" style={{ margin: 0 }}>
          {card.text}
        </p>
      )}
      <div className="meta">
        <Author card={card} />
      </div>
      {children}
      {!spotlight && !ended && !editing && (
        <div className="actions">
          {card.mine && (
            <button
              className="btn tiny secondary"
              onClick={() => {
                setDraft(card.text);
                setEditing(true);
              }}
            >
              Edit
            </button>
          )}
          {card.mine && allowDelete && (
            <button className="btn tiny secondary" onClick={() => send({ type: 'card:delete', id: card.id })}>
              Delete
            </button>
          )}
          {view.isHost && hostTools && view.revealed[card.type] && (
            <>
              <button className="btn tiny secondary" aria-pressed={card.discussed} onClick={() => send({ type: 'card:discussed', id: card.id })}>
                {card.discussed ? 'Not discussed' : 'Mark discussed'}
              </button>
              <button className="btn tiny secondary" aria-pressed={spotlit} onClick={() => send({ type: 'card:spotlight', id: card.id })}>
                {spotlit ? 'Unspotlight' : 'Spotlight'}
              </button>
            </>
          )}
        </div>
      )}
    </article>
  );
}

export function FaceDown({ type, label }: { type: Visible['type']; label?: string }) {
  return <span className={`facedown ${type}`} role="img" aria-label={label ?? `Face-down ${CARD_TYPE_INFO[type].label} card`} />;
}
