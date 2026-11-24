'use client';

import { useEffect } from 'react';
import { CardView } from './CardView';
import { useRoomApi } from './RoomContext';

/** When the host spotlights a card, it enlarges for everyone. */
export function Spotlight() {
  const { view, send } = useRoomApi();
  const card = view.cards.find(
    (c): c is Extract<typeof c, { hidden: false }> => c.id === view.spotlightCardId && !c.hidden,
  );

  useEffect(() => {
    if (!card || !view.isHost) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void send({ type: 'card:spotlight', id: card.id });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [card, view.isHost, send]);

  if (!card) return null;
  return (
    <div className="spotlight" role="dialog" aria-modal="false" aria-label="Spotlighted card">
      <div className="stack" style={{ justifyItems: 'center', width: '100%' }}>
        <CardView card={card} spotlight />
        {view.isHost && (
          <button className="btn" onClick={() => send({ type: 'card:spotlight', id: card.id })} autoFocus>
            Close spotlight
          </button>
        )}
      </div>
    </div>
  );
}
