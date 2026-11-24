'use client';

import { useMemo, useState } from 'react';
import { avatarById } from '@/lib/shared/classes';
import { NAME_MAX } from '@/lib/shared/config';
import { suggestNames } from '@/lib/shared/fantasyNames';

/**
 * Name input that offers fantasy questing names based on what the player types
 * and the avatar they picked. Picking one fills the field; the suggestions stay
 * based on the typed name.
 */
export function NameField({
  id,
  value,
  onChange,
  placeholder,
  autoFocus,
  avatarId,
}: {
  id: string;
  value: string;
  onChange: (name: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** The picked avatar; names follow its style. */
  avatarId?: string | null;
}) {
  // What the player typed themselves; suggestions are based on this, not on a picked suggestion.
  const [typed, setTyped] = useState(value);
  const [round, setRound] = useState(0);
  const suggestions = useMemo(() => suggestNames(typed, round, avatarId), [typed, round, avatarId]);
  const avatar = avatarId ? avatarById(avatarId) : undefined;

  return (
    <div className="field">
      <label htmlFor={id}>Your name</label>
      <input
        id={id}
        className="input"
        value={value}
        maxLength={NAME_MAX}
        autoComplete="nickname"
        autoFocus={autoFocus}
        aria-describedby={`${id}-suggest`}
        onChange={(e) => {
          setTyped(e.target.value);
          setRound(0);
          onChange(e.target.value);
        }}
        placeholder={placeholder}
      />
      <div id={`${id}-suggest`} className="name-suggest" role="group" aria-label="Questing name suggestions">
        {suggestions.length === 0 ? (
          <span className="hint">Type your name and we&apos;ll suggest a questing name.</span>
        ) : (
          <>
            <span className="hint">{avatar ? `Questing names for your ${avatar.name}:` : 'Or go by a questing name:'}</span>
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                className="name-chip"
                aria-pressed={value === s}
                aria-label={`Use the name ${s}`}
                onClick={() => onChange(s)}
              >
                {s}
              </button>
            ))}
            <button type="button" className="btn tiny ghost-ink" onClick={() => setRound((r) => r + 1)}>
              <span aria-hidden="true">🎲</span> More names
            </button>
          </>
        )}
      </div>
    </div>
  );
}
