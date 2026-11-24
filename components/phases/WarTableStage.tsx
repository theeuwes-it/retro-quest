'use client';

import { useEffect, useRef, useState } from 'react';
import { play } from '@/lib/client/sound';
import { COINS_PER_PLAYER, GROUP_TITLE_MAX } from '@/lib/shared/config';
import type { Group, ViewCard } from '@/lib/shared/types';
import { CoinIcon, LocationIcon } from '../art/Icons';
import { Author, TypeTag } from '../CardView';
import { useRoomApi } from '../RoomContext';

type Visible = Extract<ViewCard, { hidden: false }>;
type Target = { kind: 'group'; id: string; group: Group; cards: Visible[] } | { kind: 'card'; id: string; card: Visible };

/** Group duplicate Monsters, then everyone spends 3 gold coins. */
export function WarTableStage() {
  const { view, send } = useRoomApi();
  const [selected, setSelected] = useState<string[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
  const monsters = view.cards.filter((c): c is Visible => !c.hidden && c.type === 'monster');
  const sub = view.subPhase;
  const votesRevealed = view.revealed.votes;
  const canGroup = !votesRevealed && view.phase === 'warTable';
  const voting = sub === 'voting' && !view.votes.locked && view.me.plays;
  const totals = view.votes.totals;

  const wasRevealed = useRef(votesRevealed);
  useEffect(() => {
    if (votesRevealed && !wasRevealed.current) play('coin');
    wasRevealed.current = votesRevealed;
  }, [votesRevealed]);

  let targets: Target[] = [
    ...view.groups.map((g) => ({
      kind: 'group' as const,
      id: g.id,
      group: g,
      cards: g.cardIds.map((id) => monsters.find((c) => c.id === id)).filter(Boolean) as Visible[],
    })),
    ...monsters.filter((c) => !c.groupId).map((c) => ({ kind: 'card' as const, id: c.id, card: c })),
  ];
  if (totals) targets = [...targets].sort((a, b) => (totals[b.id] ?? 0) - (totals[a.id] ?? 0));
  const topTotal = totals ? Math.max(0, ...Object.values(totals)) : 0;
  const topCount = totals ? Object.values(totals).filter((t) => t === topTotal && t > 0).length : 0;

  const cardIdsOf = (targetId: string) => {
    const g = view.groups.find((x) => x.id === targetId);
    return g ? g.cardIds.slice(0, 1) : [targetId];
  };
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function merge() {
    const cardIds = selected.flatMap(cardIdsOf);
    const ok = await send(view.isHost ? { type: 'group:create', cardIds } : { type: 'group:suggest', cardIds });
    if (ok) setSelected([]);
  }

  function onDrop(targetId: string) {
    if (!dragging || dragging === targetId) return;
    void send({ type: 'group:create', cardIds: [...cardIdsOf(dragging), ...cardIdsOf(targetId)] });
    setDragging(null);
  }

  const heading =
    votesRevealed ? 'The votes are in' : sub === 'voting' ? (view.votes.locked ? 'Voting is locked' : 'Spend your gold') : 'Group the Monsters';
  const help = votesRevealed
    ? topCount > 1
      ? 'It is a tie! The host picks the Boss in the Boss Lair.'
      : 'The top Monster becomes the Boss.'
    : sub === 'voting'
      ? `Put your ${COINS_PER_PLAYER} gold coins on the Monsters you most want to defeat. You can stack them. Nobody sees where coins go until the reveal.`
      : view.isHost
        ? 'Drag a Monster onto another to group duplicates, or tick cards and press "Merge selected".'
        : 'Spot duplicates? Tick them and suggest a merge to the host.';

  return (
    <section aria-labelledby="stage-title">
      <div className="stage-head">
        <LocationIcon phase="warTable" size={40} />
        <div>
          <h1 id="stage-title" className="stage-title pixel">
            The War Table
          </h1>
          <p className="stage-sub" style={{ margin: 0 }}>
            <strong>{heading}.</strong> {help}
          </p>
        </div>
      </div>

      {sub === 'voting' && view.me.plays && !votesRevealed && (
        <div className="banner" role="status">
          <span className="coin-purse" aria-label={`${view.votes.coinsLeft} of ${COINS_PER_PLAYER} coins left`}>
            {Array.from({ length: COINS_PER_PLAYER }, (_, i) => (
              <span key={i} className={i < view.votes.coinsLeft ? '' : 'empty'}>
                <CoinIcon size={24} />
              </span>
            ))}
          </span>
          <span>{view.votes.coinsLeft} coins left</span>
          <span className="spacer" />
          <span className="hint on-dark">
            Coins spent: {view.players.filter((p) => p.plays).map((p) => `${p.name} ${p.coinsSpent}/${COINS_PER_PLAYER}`).join(' · ')}
          </span>
        </div>
      )}

      {canGroup && (
        <div className="row" style={{ marginBottom: 12 }}>
          <button className="btn small" disabled={selected.length < 2} onClick={merge}>
            {view.isHost ? 'Merge selected' : 'Suggest merge'} ({selected.length})
          </button>
          {selected.length > 0 && (
            <button className="btn small ghost" onClick={() => setSelected([])}>
              Clear selection
            </button>
          )}
        </div>
      )}

      {canGroup && <Suggestions monsters={monsters} />}

      {targets.length === 0 && <p className="muted">No Monsters were written, so there is nothing to vote on.</p>}

      <div className="grid-cards">
        {targets.map((t, idx) => {
          const total = totals?.[t.id] ?? 0;
          const isTop = totals && total === topTotal && total > 0;
          const body = (
            <>
              {totals && (
                <div className="row">
                  <span className="total-badge">
                    <CoinIcon size={18} /> {total}
                  </span>
                  <span className="pile row" style={{ gap: 2 }} aria-hidden="true">
                    {Array.from({ length: Math.min(total, 12) }, (_, i) => (
                      <span key={i} className="coin-drop" style={{ animationDelay: `${Math.min(idx * 60 + i * 30, 280)}ms` }}>
                        <CoinIcon size={16} />
                      </span>
                    ))}
                  </span>
                  {isTop && topCount > 1 && <span className="tie-badge">Tie</span>}
                  {isTop && topCount === 1 && <span className="tie-badge" style={{ background: 'var(--ok)' }}>Top</span>}
                </div>
              )}
              {sub === 'voting' && !votesRevealed && view.me.plays && <CoinControl targetId={t.id} disabled={!voting} />}
              {canGroup && (
                <label className="selectable">
                  <input type="checkbox" checked={selected.includes(t.id)} onChange={() => toggle(t.id)} />
                  Select{t.kind === 'group' ? ' group' : ''}
                </label>
              )}
            </>
          );
          const dropProps =
            view.isHost && canGroup
              ? {
                  draggable: true,
                  onDragStart: (e: React.DragEvent) => {
                    setDragging(t.id);
                    e.dataTransfer.effectAllowed = 'move';
                  },
                  onDragEnd: () => setDragging(null),
                  onDragOver: (e: React.DragEvent) => {
                    if (dragging && dragging !== t.id) e.preventDefault();
                  },
                  onDrop: (e: React.DragEvent) => {
                    e.preventDefault();
                    onDrop(t.id);
                  },
                }
              : {};
          return t.kind === 'group' ? (
            <GroupBox key={t.id} t={t} canGroup={canGroup} dropProps={dropProps}>
              {body}
            </GroupBox>
          ) : (
            <article key={t.id} className="card monster target" aria-label="Monster card" {...dropProps}>
              <TypeTag type="monster" />
              <p className="text" style={{ margin: 0 }}>
                {t.card.text}
              </p>
              <div className="meta">
                <Author card={t.card} />
              </div>
              {body}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function GroupBox({
  t,
  canGroup,
  dropProps,
  children,
}: {
  t: Extract<Target, { kind: 'group' }>;
  canGroup: boolean;
  dropProps: object;
  children: React.ReactNode;
}) {
  const { view, send } = useRoomApi();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(t.group.title);
  return (
    <article className="group-box target" aria-label={`Group: ${t.group.title}`} {...dropProps}>
      <TypeTag type="monster" />
      {editing ? (
        <form
          className="row"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await send({ type: 'group:rename', id: t.id, title })) setEditing(false);
          }}
        >
          <label className="sr-only" htmlFor={`gt-${t.id}`}>
            Group title
          </label>
          <input id={`gt-${t.id}`} className="input" value={title} maxLength={GROUP_TITLE_MAX} onChange={(e) => setTitle(e.target.value)} autoFocus />
          <button className="btn tiny" type="submit">
            Save
          </button>
          <button className="btn tiny secondary" type="button" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <div className="group-title">{t.group.title}</div>
      )}
      <div className="stack" style={{ gap: 6 }}>
        {t.cards.map((c) => (
          <div className="member" key={c.id}>
            {c.text} <Author card={c} />
          </div>
        ))}
      </div>
      {children}
      {view.isHost && view.phase !== 'ended' && !editing && (
        <div className="actions row">
          <button
            className="btn tiny secondary"
            onClick={() => {
              setTitle(t.group.title);
              setEditing(true);
            }}
          >
            Rename
          </button>
          {canGroup && (
            <button className="btn tiny secondary" onClick={() => send({ type: 'group:ungroup', id: t.id })}>
              Ungroup
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function CoinControl({ targetId, disabled }: { targetId: string; disabled: boolean }) {
  const { view, send } = useRoomApi();
  const mine = view.votes.mine[targetId] ?? 0;
  const set = async (coins: number) => {
    if (await send({ type: 'vote:set', targetId, coins })) {
      if (coins > mine) play('coin');
    }
  };
  return (
    <div className="coin-ctrl" role="group" aria-label="Your coins on this Monster">
      <button className="btn small secondary" aria-label="Remove a coin" disabled={disabled || mine === 0} onClick={() => set(mine - 1)}>
        −
      </button>
      <span className="pile" aria-live="polite" aria-label={`${mine} of your coins here`}>
        {Array.from({ length: mine }, (_, i) => (
          <span key={i} className="coin-drop">
            <CoinIcon size={22} />
          </span>
        ))}
        {mine === 0 && <span className="hint">0</span>}
      </span>
      <button
        className="btn small"
        aria-label="Add a coin"
        disabled={disabled || view.votes.coinsLeft === 0 || mine >= COINS_PER_PLAYER}
        onClick={() => set(mine + 1)}
      >
        +
      </button>
    </div>
  );
}

function Suggestions({ monsters }: { monsters: Visible[] }) {
  const { view, send, nameOf } = useRoomApi();
  const list = view.isHost ? view.suggestions : view.suggestions.filter((s) => s.byPlayerId === view.me.id);
  if (list.length === 0) return null;
  const text = (id: string) => monsters.find((c) => c.id === id)?.text ?? '…';
  return (
    <div className="parchment panel stack" style={{ marginBottom: 16, gap: 8 }}>
      <h2 className="pixel" style={{ fontSize: 11 }}>
        {view.isHost ? 'Merge suggestions' : 'Your suggestions (waiting for the host)'}
      </h2>
      {list.map((s) => (
        <div key={s.id} className="row" style={{ justifyContent: 'space-between' }}>
          <span>
            {view.isHost && <strong>{nameOf(s.byPlayerId)}: </strong>}
            {s.cardIds.map(text).join('  +  ')}
          </span>
          {view.isHost && (
            <span className="row">
              <button className="btn tiny" onClick={() => send({ type: 'group:create', cardIds: s.cardIds, suggestionId: s.id })}>
                Accept
              </button>
              <button className="btn tiny secondary" onClick={() => send({ type: 'group:dismiss', id: s.id })}>
                Dismiss
              </button>
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
