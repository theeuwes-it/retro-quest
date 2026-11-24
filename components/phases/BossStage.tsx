'use client';

import { useEffect, useRef, useState } from 'react';
import { play } from '@/lib/client/sound';
import { ATTACK_TEXT_MAX, BOSS_NAME_MAX } from '@/lib/shared/config';
import type { Attack, ViewBoss } from '@/lib/shared/types';
import { BossCreature, CoinIcon, LocationIcon, creatureFor } from '../art/Icons';
import { useRoomApi } from '../RoomContext';

/** Action items: the top Monster becomes a Boss, Attacks with an owner damage it. */
export function BossStage() {
  const { view } = useRoomApi();
  const boss = view.bosses[view.bosses.length - 1];
  const earlier = view.bosses.slice(0, -1);

  return (
    <section aria-labelledby="stage-title">
      <div className="stage-head">
        <LocationIcon phase="boss" size={40} />
        <div>
          <h1 id="stage-title" className="stage-title pixel">
            Boss Lair
          </h1>
          <p className="stage-sub" style={{ margin: 0 }}>
            Write Attacks (action items) and give each one a hero. 1 to 3 good actions beat many.
          </p>
        </div>
      </div>

      {!boss ? <ChooseBoss /> : <Battle boss={boss} key={boss.targetId} />}

      {earlier.length > 0 && (
        <>
          <h2 className="section-title pixel">Bosses already fought</h2>
          <div className="stack">
            {earlier.map((b) => (
              <div key={b.targetId} className="parchment panel">
                <strong>{b.name}</strong> — {b.title} {b.defeated && <span className="hint">(defeated)</span>}
                <AttackList boss={b} readOnly />
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function candidates(view: ReturnType<typeof useRoomApi>['view']) {
  const totals = view.votes.totals ?? {};
  const list = [
    ...view.groups.map((g) => ({ id: g.id, title: g.title })),
    ...view.cards.filter((c) => !c.hidden && c.type === 'monster' && !c.groupId).map((c) => ({ id: c.id, title: (c as { text: string }).text })),
  ].map((t) => ({ ...t, total: totals[t.id] ?? 0 }));
  return list.sort((a, b) => b.total - a.total);
}

function ChooseBoss({ replacing }: { replacing?: boolean }) {
  const { view, send } = useRoomApi();
  const fought = new Set(view.bosses.map((b) => b.targetId));
  const list = candidates(view).filter((c) => !fought.has(c.id) || replacing);
  const top = list[0]?.total ?? 0;
  if (!view.isHost) {
    return (
      <div className="parchment panel">
        <p style={{ margin: 0 }}>The host is choosing which Monster becomes the Boss…</p>
      </div>
    );
  }
  if (list.length === 0) {
    return (
      <div className="parchment panel">
        <p style={{ margin: 0 }}>There are no Monsters to fight. Travel back to Monster Woods to add some, or continue to the Loot Room.</p>
      </div>
    );
  }
  return (
    <div className="parchment panel stack">
      <p style={{ margin: 0 }}>
        {top > 0 && list.filter((c) => c.total === top).length > 1
          ? 'It is a tie! Choose which Monster becomes the Boss.'
          : 'Choose which Monster becomes the Boss.'}
      </p>
      {list.map((c) => (
        <div key={c.id} className="row" style={{ justifyContent: 'space-between' }}>
          <span>
            <span className="total-badge">
              <CoinIcon size={16} /> {c.total}
            </span>{' '}
            {c.title}
          </span>
          <button className="btn small" onClick={() => send({ type: 'boss:select', targetId: c.id })}>
            Make this the Boss
          </button>
        </div>
      ))}
    </div>
  );
}

function Battle({ boss }: { boss: ViewBoss }) {
  const { view, send } = useRoomApi();
  const [shake, setShake] = useState(0);
  const prevHp = useRef(boss.hp);
  const prevDefeated = useRef(boss.defeated);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(boss.name);
  const [repick, setRepick] = useState(false);
  const owned = boss.attacks.filter((a) => a.ownerId).length;

  useEffect(() => {
    if (boss.hp < prevHp.current) {
      setShake((n) => n + 1);
      play('hit');
    }
    prevHp.current = boss.hp;
  }, [boss.hp]);
  useEffect(() => {
    if (boss.defeated && !prevDefeated.current) play('victory');
    prevDefeated.current = boss.defeated;
  }, [boss.defeated]);

  const isMini = view.bosses.length > 1;
  return (
    <div className="boss-layout">
      <div className="parchment boss-card">
        <div className="pixel hint">{isMini ? 'Mini-boss' : 'The Boss'}</div>
        <div key={shake} className={shake ? 'shake' : ''}>
          <BossCreature creature={creatureFor(boss.name)} defeated={boss.defeated} size={200} />
        </div>
        {renaming ? (
          <form
            className="row"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await send({ type: 'boss:rename', name })) setRenaming(false);
            }}
          >
            <label className="sr-only" htmlFor="boss-name">
              Boss name
            </label>
            <input id="boss-name" className="input" value={name} maxLength={BOSS_NAME_MAX} onChange={(e) => setName(e.target.value)} autoFocus />
            <button className="btn tiny" type="submit">
              Save
            </button>
            <button className="btn tiny secondary" type="button" onClick={() => setRenaming(false)}>
              Cancel
            </button>
          </form>
        ) : (
          <h2 className="boss-name pixel">{boss.name}</h2>
        )}
        <div className="boss-banner">{boss.title}</div>
        <div className="hp" aria-label={`Boss HP ${boss.hp} of ${boss.maxHp}`} role="meter" aria-valuenow={boss.hp} aria-valuemin={0} aria-valuemax={boss.maxHp}>
          <div className="hp-label pixel" aria-hidden="true">
            <span>HP</span>
            <span>
              {boss.hp}/{boss.maxHp}
            </span>
          </div>
          <div className="bar" aria-hidden="true">
            <span style={{ width: `${(boss.hp / boss.maxHp) * 100}%` }} />
          </div>
        </div>
        {boss.defeated && (
          <p className="victory pixel" role="status">
            Victory! The Boss is defeated.
          </p>
        )}
        {view.isHost && view.phase !== 'ended' && (
          <div className="stack" style={{ width: '100%', gap: 8 }}>
            {!boss.defeated && (
              <button className="btn" disabled={owned === 0} onClick={() => send({ type: 'boss:defeat' })}>
                Defeat the Boss
              </button>
            )}
            {!boss.defeated && owned === 0 && <span className="hint">Needs at least one Attack with an owner.</span>}
            {boss.defeated && (
              <button className="btn secondary" onClick={() => send({ type: 'boss:next' })}>
                Fight next Monster (mini-boss)
              </button>
            )}
            {!renaming && (
              <button
                className="btn small secondary"
                onClick={() => {
                  setName(boss.name);
                  setRenaming(true);
                }}
              >
                Rename Boss
              </button>
            )}
            {!boss.defeated && boss.attacks.length === 0 && (
              <button className="btn small secondary" onClick={() => setRepick((r) => !r)}>
                {repick ? 'Keep this Boss' : 'Choose a different Monster'}
              </button>
            )}
          </div>
        )}
      </div>
      <div className="stack">
        {repick && view.isHost && boss.attacks.length === 0 && <ChooseBoss replacing />}
        <div className="parchment panel stack">
          <h2 className="pixel" style={{ fontSize: 12 }}>
            Attacks ({boss.attacks.length})
          </h2>
          <AttackList boss={boss} readOnly={boss.defeated} />
          {!boss.defeated && view.phase !== 'ended' && <AttackForm />}
        </div>
      </div>
    </div>
  );
}

function OwnerSelect({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  const { view } = useRoomApi();
  return (
    <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— needs a hero —</option>
      {view.players.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

export function AttackList({ boss, readOnly }: { boss: ViewBoss; readOnly?: boolean }) {
  if (boss.attacks.length === 0) return <p className="hint">No Attacks yet.</p>;
  return (
    <div className="stack" style={{ gap: 8 }}>
      {boss.attacks.map((a) => (
        <AttackRow key={a.id} attack={a} readOnly={readOnly} />
      ))}
    </div>
  );
}

function AttackRow({ attack, readOnly }: { attack: Attack; readOnly?: boolean }) {
  const { view, send, nameOf } = useRoomApi();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(attack.text);
  const canEdit = !readOnly && view.phase !== 'ended';
  if (!canEdit) {
    return (
      <div className="attack">
        <span>{attack.text}</span>
        <span>{attack.ownerId ? nameOf(attack.ownerId) : <span className="needs-hero">needs a hero</span>}</span>
        <span>{attack.dueDate ?? '—'}</span>
        <span />
      </div>
    );
  }
  return (
    <div className="attack">
      {editing ? (
        <form
          className="row"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await send({ type: 'attack:edit', id: attack.id, text })) setEditing(false);
          }}
        >
          <label className="sr-only" htmlFor={`at-${attack.id}`}>
            Attack text
          </label>
          <input id={`at-${attack.id}`} className="input" value={text} maxLength={ATTACK_TEXT_MAX} onChange={(e) => setText(e.target.value)} autoFocus />
          <button className="btn tiny" type="submit">
            Save
          </button>
        </form>
      ) : (
        <span>
          {attack.text} {!attack.ownerId && <span className="needs-hero">needs a hero</span>}
        </span>
      )}
      <span>
        <label className="sr-only" htmlFor={`owner-${attack.id}`}>
          Owner
        </label>
        <OwnerSelect
          id={`owner-${attack.id}`}
          value={attack.ownerId ?? ''}
          onChange={(v) => send({ type: 'attack:edit', id: attack.id, ownerId: v || null })}
        />
      </span>
      <span>
        <label className="sr-only" htmlFor={`due-${attack.id}`}>
          Due date
        </label>
        <input
          id={`due-${attack.id}`}
          type="date"
          className="input"
          value={attack.dueDate ?? ''}
          onChange={(e) => send({ type: 'attack:edit', id: attack.id, dueDate: e.target.value || null })}
        />
      </span>
      <span className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
        {!editing && (
          <button
            className="btn tiny secondary"
            onClick={() => {
              setText(attack.text);
              setEditing(true);
            }}
          >
            Edit
          </button>
        )}
        {view.phase === 'boss' && (
          <button className="btn tiny secondary" onClick={() => send({ type: 'attack:delete', id: attack.id })} aria-label={`Delete attack ${attack.text}`}>
            Delete
          </button>
        )}
      </span>
    </div>
  );
}

function AttackForm() {
  const { send } = useRoomApi();
  const [text, setText] = useState('');
  const [owner, setOwner] = useState('');
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="stack"
      style={{ gap: 8 }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!text.trim() || busy) return;
        setBusy(true);
        const ok = await send({ type: 'attack:add', text, ownerId: owner || undefined, dueDate: due || undefined });
        setBusy(false);
        if (ok) {
          setText('');
          setOwner('');
          setDue('');
        }
      }}
    >
      <div className="field">
        <label htmlFor="attack-text">New Attack (action item)</label>
        <input
          id="attack-text"
          className="input"
          value={text}
          maxLength={ATTACK_TEXT_MAX}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Quarantine the flaky tests by Friday"
        />
      </div>
      <div className="row" style={{ alignItems: 'end' }}>
        <div className="field" style={{ flex: '1 1 180px' }}>
          <label htmlFor="attack-owner">Hero (owner)</label>
          <OwnerSelect id="attack-owner" value={owner} onChange={setOwner} />
        </div>
        <div className="field" style={{ flex: '1 1 160px' }}>
          <label htmlFor="attack-due">Due date (optional)</label>
          <input id="attack-due" type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
        <button className="btn" type="submit" disabled={!text.trim() || busy}>
          Attack!
        </button>
      </div>
      <span className="hint">Only Attacks with a hero damage the Boss.</span>
    </form>
  );
}
