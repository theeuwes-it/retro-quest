'use client';

import { useEffect, useMemo, useState } from 'react';
import { play } from '@/lib/client/sound';
import { classById } from '@/lib/shared/classes';
import { CARD_TYPE_INFO, ROOM_TTL_SEC } from '@/lib/shared/config';
import { buildMarkdown, exportFileName } from '@/lib/shared/export';
import type { CardType, ViewCard } from '@/lib/shared/types';
import { CoinIcon, LocationIcon } from '../art/Icons';
import { Author, TypeTag } from '../CardView';
import { useRoomApi } from '../RoomContext';

type Visible = Extract<ViewCard, { hidden: false }>;

/** Wrap-up: everything on one page, plus the Markdown export. */
export function LootStage() {
  const { view, nameOf } = useRoomApi();
  const [copied, setCopied] = useState(false);
  const md = useMemo(() => buildMarkdown(view), [view]);
  const ended = view.phase === 'ended';
  const visible = view.cards.filter((c): c is Visible => !c.hidden);
  const totals = view.votes.totals;

  useEffect(() => {
    play('victory');
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function download() {
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportFileName(view.createdAt);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const voteRows = totals
    ? Object.entries(totals)
        .map(([id, total]) => ({
          id,
          total,
          title: view.groups.find((g) => g.id === id)?.title ?? visible.find((c) => c.id === id)?.text ?? '…',
        }))
        .sort((a, b) => b.total - a.total)
    : [];
  const attacks = view.bosses.flatMap((b) => b.attacks.map((a) => ({ a, b })));

  return (
    <section aria-labelledby="stage-title">
      <Confetti />
      <div className="stage-head">
        <LocationIcon phase="loot" size={40} />
        <div>
          <h1 id="stage-title" className="stage-title pixel">
            Loot Room
          </h1>
          <p className="stage-sub" style={{ margin: 0 }}>
            Quest complete! Party level {view.xp.level}. Here is everything the party found.
          </p>
        </div>
      </div>

      {ended && (
        <div className="banner" role="status">
          This retro has ended and is read-only. The room is deleted on{' '}
          {new Date((view.endedAt ?? view.serverNow) + ROOM_TTL_SEC * 1000).toLocaleDateString()}.
        </div>
      )}

      <div className="row" style={{ marginBottom: 16 }}>
        <button className="btn" onClick={copy}>
          {copied ? 'Copied!' : 'Copy as Markdown'}
        </button>
        <button className="btn secondary" onClick={download}>
          Download {exportFileName(view.createdAt)}
        </button>
        <span className="hint on-dark" aria-live="polite">
          {copied ? 'Paste it into Confluence or a Jira ticket.' : 'Markdown works in Confluence and Jira.'}
        </span>
      </div>

      <div className="loot-grid">
        <div className="parchment loot-section">
          <h3>Action items</h3>
          {attacks.length === 0 ? (
            <p className="hint">No action items.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Action</th>
                  <th scope="col">Owner</th>
                  <th scope="col">Due</th>
                </tr>
              </thead>
              <tbody>
                {attacks.map(({ a, b }) => (
                  <tr key={a.id}>
                    <td>
                      {a.text}
                      <div className="hint">vs. {b.name}</div>
                    </td>
                    <td>{a.ownerId ? nameOf(a.ownerId) : <span className="needs-hero">needs a hero</span>}</td>
                    <td>{a.dueDate ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="parchment loot-section">
          <h3>Vote results</h3>
          {!totals ? (
            <p className="hint">Votes were not revealed.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Monster</th>
                  <th scope="col">Coins</th>
                </tr>
              </thead>
              <tbody>
                {voteRows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.title}</td>
                    <td>
                      <span className="row" style={{ gap: 4 }}>
                        <CoinIcon size={16} /> {r.total}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="parchment loot-section">
          <h3>Check-in</h3>
          {view.tavernPicks.length === 0 ? (
            <p className="hint">No class picks.</p>
          ) : (
            <ul>
              {view.tavernPicks.map((t) => (
                <li key={t.playerId}>
                  <strong>{nameOf(t.playerId)}</strong>: {classById(t.classId)?.name}
                  {t.comment && <> — “{t.comment}”</>}
                </li>
              ))}
            </ul>
          )}
        </div>

        {(['monster', 'treasure', 'potion'] as CardType[]).map((type) => {
          const cards = visible.filter((c) => c.type === type);
          return (
            <div className="parchment loot-section" key={type}>
              <h3 className="row">
                <TypeTag type={type} /> {CARD_TYPE_INFO[type].plural}
              </h3>
              {cards.length === 0 ? (
                <p className="hint">None.</p>
              ) : (
                <ul>
                  {cards.map((c) => (
                    <li key={c.id}>
                      {c.text} <Author card={c} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

const COLORS = ['#e2b33c', '#6b3fa0', '#0b6363', '#c94a3a', '#f5e8c8', '#4cd964'];

function Confetti() {
  const [pieces] = useState(() =>
    Array.from({ length: 48 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 250,
      color: COLORS[i % COLORS.length],
      rotate: Math.random() * 360,
    })),
  );
  const [show, setShow] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setShow(false), 1200);
    return () => clearTimeout(id);
  }, []);
  if (!show) return null;
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <i key={i} style={{ left: `${p.left}%`, background: p.color, animationDelay: `${p.delay}ms`, transform: `rotate(${p.rotate}deg)` }} />
      ))}
    </div>
  );
}
