'use client';

import { AVATARS } from '@/lib/shared/classes';
import { AvatarSprite } from './art/Sprite';

export function AvatarPicker({
  value,
  onChange,
  available,
}: {
  value: string | null;
  onChange: (id: string) => void;
  /** Avatar ids that may be picked; others show as taken. */
  available?: string[];
}) {
  return (
    <div className="avatar-grid" role="group" aria-label="Choose your avatar">
      {AVATARS.map((a) => {
        const taken = available ? !available.includes(a.id) : false;
        return (
          <button
            key={a.id}
            type="button"
            className="avatar-option"
            aria-pressed={value === a.id}
            disabled={taken}
            onClick={() => onChange(a.id)}
            title={taken ? `${a.name} (taken)` : a.name}
          >
            <AvatarSprite avatarId={a.id} size={44} />
            <span>{a.name}</span>
            {taken && <span className="sr-only">taken</span>}
          </button>
        );
      })}
    </div>
  );
}
