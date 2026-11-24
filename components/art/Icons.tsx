// Original flat SVG icons: locations, card types, coins and Boss creatures.
import type { CardType, Phase } from '@/lib/shared/types';

interface IconProps {
  size?: number;
  title?: string;
}

function Svg({ size = 24, title, children, viewBox = '0 0 24 24' }: IconProps & { children: React.ReactNode; viewBox?: string }) {
  return (
    <svg
      viewBox={viewBox}
      width={size}
      height={size}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className="icon"
    >
      {children}
    </svg>
  );
}

export function LocationIcon({ phase, ...p }: IconProps & { phase: Phase }) {
  switch (phase) {
    case 'lobby': // gate
      return (
        <Svg {...p}>
          <rect x="3" y="6" width="4" height="15" fill="#7a7f88" />
          <rect x="17" y="6" width="4" height="15" fill="#7a7f88" />
          <rect x="2" y="4" width="20" height="3" fill="#5a5f68" />
          <path d="M7 21V12a5 5 0 0 1 10 0v9z" fill="#6b4423" />
          <path d="M9 21v-8M12 21v-9M15 21v-8" stroke="#3a2614" strokeWidth="1" />
        </Svg>
      );
    case 'tavern': // mug
      return (
        <Svg {...p}>
          <rect x="5" y="7" width="11" height="14" rx="1" fill="#b07a3a" />
          <rect x="5" y="5" width="11" height="4" rx="2" fill="#f3ead2" />
          <path d="M16 10h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2" fill="none" stroke="#b07a3a" strokeWidth="2" />
          <path d="M8 11v8M11 11v8M14 11v8" stroke="#8a5a26" strokeWidth="1" />
        </Svg>
      );
    case 'monster': // trees with eyes
      return (
        <Svg {...p}>
          <path d="M8 3 3 14h10z" fill="#2f6b2f" />
          <path d="M16 5l-5 11h10z" fill="#3f7a3a" />
          <rect x="7" y="14" width="2" height="6" fill="#6b4423" />
          <rect x="15" y="16" width="2" height="5" fill="#6b4423" />
          <circle cx="6.5" cy="10" r="1" fill="#f2d24a" />
          <circle cx="9.5" cy="10" r="1" fill="#f2d24a" />
        </Svg>
      );
    case 'treasure':
      return <ChestIcon {...p} />;
    case 'potion':
      return <PotionIcon {...p} />;
    case 'warTable': // map with flag
      return (
        <Svg {...p}>
          <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" fill="#e8d5a8" stroke="#8a6a3a" strokeWidth="1" />
          <path d="M9 4v14M15 6v14" stroke="#8a6a3a" strokeWidth="1" />
          <path d="M12 9v6" stroke="#3a2614" strokeWidth="1.2" />
          <path d="M12 9h4l-1 1.5 1 1.5h-4z" fill="#a12a2a" />
        </Svg>
      );
    case 'boss': // skull
      return (
        <Svg {...p}>
          <path d="M12 3a8 8 0 0 0-8 8c0 3 1.5 4.5 3 5.5V20h10v-3.5c1.5-1 3-2.5 3-5.5a8 8 0 0 0-8-8z" fill="#e9e2d0" />
          <circle cx="9" cy="11" r="2" fill="#2a1c0c" />
          <circle cx="15" cy="11" r="2" fill="#2a1c0c" />
          <path d="M11 15l1-2 1 2z" fill="#2a1c0c" />
          <path d="M10 20v-2M12 20v-2M14 20v-2" stroke="#2a1c0c" strokeWidth="1" />
        </Svg>
      );
    case 'loot':
    case 'ended': // trophy
      return (
        <Svg {...p}>
          <path d="M7 4h10v5a5 5 0 0 1-10 0z" fill="#e2b33c" />
          <path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" fill="none" stroke="#e2b33c" strokeWidth="1.5" />
          <rect x="11" y="13" width="2" height="4" fill="#c9a227" />
          <rect x="8" y="17" width="8" height="3" fill="#8a6a1a" />
        </Svg>
      );
  }
}

function ChestIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 10a6 4 0 0 1 18 0v1H3z" fill="#9a6b2a" />
      <rect x="3" y="11" width="18" height="9" fill="#b07a3a" />
      <rect x="3" y="10" width="18" height="2" fill="#e2b33c" />
      <rect x="10" y="10" width="4" height="5" fill="#e2b33c" />
      <rect x="11.3" y="12" width="1.4" height="2" fill="#3a2614" />
      <path d="M3 20h18" stroke="#6b4423" strokeWidth="1" />
    </Svg>
  );
}

function PotionIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="10" y="2" width="4" height="2" fill="#8b5a2b" />
      <rect x="10.5" y="4" width="3" height="4" fill="#cfe7ef" />
      <path d="M10.5 8 5 15a5 5 0 0 0 4 6h6a5 5 0 0 0 4-6l-5.5-7z" fill="#cfe7ef" />
      <path d="M6.2 14h11.6l.7 1a4 4 0 0 1-3.5 5h-6a4 4 0 0 1-3.5-5z" fill="#1fa39a" />
      <circle cx="10" cy="17" r="1" fill="#bff3ec" />
      <circle cx="13.5" cy="15.5" r="0.7" fill="#bff3ec" />
    </Svg>
  );
}

function MonsterIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 20V11a8 8 0 0 1 16 0v9l-2.5-2-2.5 2-3-2-3 2-2.5-2z" fill="#7a4ab5" />
      <path d="M6 6 4 2l4 3M18 6l2-4-4 3" fill="#7a4ab5" />
      <circle cx="9" cy="10" r="2" fill="#fff" />
      <circle cx="15" cy="10" r="2" fill="#fff" />
      <circle cx="9.5" cy="10.5" r="1" fill="#1d140b" />
      <circle cx="14.5" cy="10.5" r="1" fill="#1d140b" />
      <path d="M9 14h6l-1 1.5-1-1-1 1-1-1-1 1z" fill="#fff" />
    </Svg>
  );
}

export function CardTypeIcon({ type, ...p }: IconProps & { type: CardType }) {
  if (type === 'monster') return <MonsterIcon {...p} />;
  if (type === 'treasure') return <ChestIcon {...p} />;
  return <PotionIcon {...p} />;
}

export function CoinIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" fill="#c9a227" />
      <circle cx="12" cy="12" r="7" fill="#e2b33c" />
      <path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4" stroke="#7a5600" strokeWidth="1.4" fill="none" />
    </Svg>
  );
}

export function FlagIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6 3v18" stroke="#3a2614" strokeWidth="2" />
      <path d="M7 4h11l-3 4 3 4H7z" fill="#a12a2a" />
    </Svg>
  );
}

export function CrownIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 18 4 7l5 5 3-7 3 7 5-5 1 11z" fill="#e2b33c" stroke="#7a5600" strokeWidth="1" />
    </Svg>
  );
}

export type Creature = 'slime' | 'hydra' | 'dragon';

export function creatureFor(name: string): Creature {
  if (/slime|golem|troll|kraken|basilisk/i.test(name)) return 'slime';
  if (/dragon|wyrm/i.test(name)) return 'dragon';
  return 'hydra';
}

function Eyes({ cx, cy, defeated }: { cx: number; cy: number; defeated?: boolean }) {
  if (defeated) return <path d={`M${cx - 4} ${cy - 4}l8 8M${cx + 4} ${cy - 4}l-8 8`} stroke="#1d140b" strokeWidth="2.5" />;
  return (
    <>
      <circle cx={cx} cy={cy} r="5" fill="#f2d24a" />
      <circle cx={cx + 1} cy={cy} r="2.2" fill="#1d140b" />
    </>
  );
}

/** Generic Boss creature: a slime, a hydra or a dragon. */
export function BossCreature({ creature, size = 160, defeated }: { creature: Creature; size?: number; defeated?: boolean }) {
  const body = defeated ? '#7a7f88' : '#6b3fa0';
  const belly = defeated ? '#a9adb4' : '#9f7ad0';
  return (
    <svg viewBox="0 0 160 140" width={size} height={(size * 140) / 160} aria-hidden="true" className="boss-creature">
      <ellipse cx="80" cy="132" rx="60" ry="6" fill="rgba(0,0,0,.25)" />
      {creature === 'slime' && (
        <g>
          <path d="M20 130c0-55 25-95 60-95s60 40 60 95z" fill={body} />
          <path d="M45 130c0-30 15-55 35-55s35 25 35 55z" fill={belly} opacity=".6" />
          <path d="M55 40 48 18l18 16M105 40l7-22-18 16" fill={body} />
          <Eyes cx={62} cy={70} defeated={defeated} />
          <Eyes cx={98} cy={70} defeated={defeated} />
          <path d="M60 95h40l-5 8-5-6-5 6-5-6-5 6-5-6z" fill="#fff" />
        </g>
      )}
      {creature === 'hydra' && (
        <g>
          <path d="M40 130c0-35 18-55 40-55s40 20 40 55z" fill={body} />
          <path d="M60 80C50 55 30 50 25 30M80 75V20M100 80c10-25 30-30 35-50" stroke={body} strokeWidth="14" fill="none" strokeLinecap="round" />
          <circle cx="25" cy="28" r="14" fill={body} />
          <circle cx="80" cy="18" r="15" fill={body} />
          <circle cx="135" cy="28" r="14" fill={body} />
          <Eyes cx={22} cy={26} defeated={defeated} />
          <Eyes cx={78} cy={16} defeated={defeated} />
          <Eyes cx={133} cy={26} defeated={defeated} />
          <path d="M60 115c0-15 9-25 20-25s20 10 20 25z" fill={belly} opacity=".7" />
        </g>
      )}
      {creature === 'dragon' && (
        <g>
          <path d="M30 70 5 35l40 15zM130 70l25-35-40 15z" fill={belly} />
          <path d="M35 130c0-40 20-65 45-65s45 25 45 65z" fill={body} />
          <path d="M50 70c0-25 13-40 30-40s30 15 30 40z" fill={body} />
          <path d="M58 34 52 12l14 18M102 34l6-22-14 18" fill="#e9e2d0" />
          <Eyes cx={68} cy={52} defeated={defeated} />
          <Eyes cx={92} cy={52} defeated={defeated} />
          <path d="M68 66h24l-3 6-4-4-5 4-5-4-4 4z" fill="#fff" />
          <path d="M60 118c0-18 9-30 20-30s20 12 20 30z" fill={belly} opacity=".7" />
        </g>
      )}
    </svg>
  );
}
