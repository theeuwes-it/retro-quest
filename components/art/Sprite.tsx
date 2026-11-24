// Original pixel-style adventurers, drawn from simple rectangles on a 16x16 grid.
// Each sprite = a base body + a headwear variant + an item, with its own palette.

type Rect = [x: number, y: number, w: number, h: number, color: string];

interface Look {
  skin: string;
  hair: string;
  outfit: string;
  trim: string;
  hat: Hat;
  item: Item;
  hatColor: string;
  itemColor: string;
}

type Hat =
  | 'helmet'
  | 'wizard'
  | 'hood'
  | 'circlet'
  | 'horns'
  | 'leaves'
  | 'cap'
  | 'topknot'
  | 'goggles'
  | 'witch'
  | 'bandana'
  | 'darkhelm';
type Item = 'sword' | 'staff' | 'bow' | 'mace' | 'dagger' | 'axe' | 'leafstaff' | 'lute' | 'fist' | 'flask' | 'shield' | 'broom' | 'bigsword' | 'broken';

const OUTLINE = '#1d140b';
const EYE = '#1d140b';

const LOOKS: Record<string, Look> = {
  // 12 lobby avatars
  knight: { skin: '#f0c8a0', hair: '#6b4423', outfit: '#3d6fb0', trim: '#c9a227', hat: 'helmet', hatColor: '#aeb7c2', item: 'sword', itemColor: '#d8dee6' },
  mage: { skin: '#e8b98f', hair: '#3b2a1a', outfit: '#5b3fa0', trim: '#e2b33c', hat: 'wizard', hatColor: '#4a2f8a', item: 'staff', itemColor: '#8b5a2b' },
  archer: { skin: '#c98e5f', hair: '#2b1d0e', outfit: '#3f7a3a', trim: '#8b5a2b', hat: 'hood', hatColor: '#2f5e2c', item: 'bow', itemColor: '#8b5a2b' },
  cleric: { skin: '#f3d1b0', hair: '#d9b44a', outfit: '#e9e2d0', trim: '#c9a227', hat: 'circlet', hatColor: '#c9a227', item: 'mace', itemColor: '#aeb7c2' },
  thief: { skin: '#d9a77c', hair: '#1d140b', outfit: '#3a3a4a', trim: '#8a3b12', hat: 'hood', hatColor: '#2a2a36', item: 'dagger', itemColor: '#d8dee6' },
  barbarian: { skin: '#b9774a', hair: '#a3421c', outfit: '#7a4a2a', trim: '#5a3418', hat: 'horns', hatColor: '#e9e2d0', item: 'axe', itemColor: '#aeb7c2' },
  druid: { skin: '#e8b98f', hair: '#5a3418', outfit: '#5c7a2a', trim: '#8b5a2b', hat: 'leaves', hatColor: '#4f8f3a', item: 'leafstaff', itemColor: '#8b5a2b' },
  minstrel: { skin: '#f0c8a0', hair: '#c46b2a', outfit: '#b0384f', trim: '#e2b33c', hat: 'cap', hatColor: '#7a2a3f', item: 'lute', itemColor: '#b07a3a' },
  monk: { skin: '#c98e5f', hair: '#1d140b', outfit: '#d9822b', trim: '#8a3b12', hat: 'topknot', hatColor: '#1d140b', item: 'fist', itemColor: '#c98e5f' },
  alchemist: { skin: '#f3d1b0', hair: '#8a8a8a', outfit: '#2f6f6f', trim: '#c9a227', hat: 'goggles', hatColor: '#b07a3a', item: 'flask', itemColor: '#3fc1b0' },
  ranger: { skin: '#d9a77c', hair: '#6b4423', outfit: '#6b5a3a', trim: '#3f7a3a', hat: 'hood', hatColor: '#3f5a2a', item: 'shield', itemColor: '#8b5a2b' },
  witch: { skin: '#cfe0b0', hair: '#2b1d0e', outfit: '#3a2450', trim: '#8f5fc4', hat: 'witch', hatColor: '#2a1a3e', item: 'broom', itemColor: '#a07a3a' },
  // 6 Tavern classes
  'class-paladin': { skin: '#f0c8a0', hair: '#d9b44a', outfit: '#e9e2d0', trim: '#e2b33c', hat: 'helmet', hatColor: '#e2b33c', item: 'shield', itemColor: '#e2b33c' },
  'class-rogue': { skin: '#d9a77c', hair: '#1d140b', outfit: '#2f3a2f', trim: '#c9a227', hat: 'hood', hatColor: '#1f2a1f', item: 'dagger', itemColor: '#d8dee6' },
  'class-wizard': { skin: '#e8b98f', hair: '#d8dee6', outfit: '#2a4f9a', trim: '#e2b33c', hat: 'wizard', hatColor: '#1f3c7a', item: 'staff', itemColor: '#8b5a2b' },
  'class-warrior': { skin: '#c98e5f', hair: '#5a3418', outfit: '#8a3b12', trim: '#5a3418', hat: 'bandana', hatColor: '#a12a2a', item: 'bigsword', itemColor: '#aeb7c2' },
  'class-bard': { skin: '#f0c8a0', hair: '#c46b2a', outfit: '#7a8a9a', trim: '#b0384f', hat: 'cap', hatColor: '#4a5a6a', item: 'lute', itemColor: '#b07a3a' },
  'class-knight': { skin: '#d3c3b0', hair: '#3a2a1a', outfit: '#3a2450', trim: '#6b3fa0', hat: 'darkhelm', hatColor: '#4a4458', item: 'broken', itemColor: '#8a8f99' },
};

function hatRects(hat: Hat, c: string, hair: string): Rect[] {
  switch (hat) {
    case 'helmet':
      return [[4, 2, 8, 3, c], [4, 5, 1, 3, c], [11, 5, 1, 3, c], [7, 0, 2, 2, '#b0384f'], [5, 4, 6, 1, OUTLINE]];
    case 'darkhelm':
      return [[4, 2, 8, 3, c], [4, 5, 1, 4, c], [11, 5, 1, 4, c], [5, 4, 6, 1, '#8f5fc4'], [3, 1, 1, 2, c], [12, 1, 1, 2, c]];
    case 'wizard':
      return [[7, 0, 2, 1, c], [6, 1, 4, 1, c], [5, 2, 6, 1, c], [5, 3, 6, 1, '#e2b33c'], [3, 4, 10, 1, c]];
    case 'witch':
      return [[9, 0, 2, 1, c], [8, 1, 3, 1, c], [6, 2, 5, 1, c], [5, 3, 6, 1, '#8f5fc4'], [2, 4, 12, 1, c]];
    case 'hood':
      return [[4, 2, 8, 3, c], [4, 5, 1, 5, c], [11, 5, 1, 5, c], [5, 1, 6, 1, c]];
    case 'circlet':
      return [[5, 3, 6, 1, hair], [5, 4, 6, 1, c], [7, 3, 2, 1, '#3fc1b0'], [4, 4, 1, 4, hair], [11, 4, 1, 4, hair]];
    case 'horns':
      return [[5, 3, 6, 2, '#7a7f88'], [3, 1, 2, 1, c], [3, 2, 1, 2, c], [11, 1, 2, 1, c], [12, 2, 1, 2, c], [4, 4, 1, 4, hair], [11, 4, 1, 4, hair]];
    case 'leaves':
      return [[5, 3, 6, 1, hair], [4, 4, 1, 4, hair], [11, 4, 1, 4, hair], [4, 2, 2, 1, c], [7, 2, 2, 1, c], [10, 2, 2, 1, c], [6, 3, 1, 1, c], [9, 3, 1, 1, c]];
    case 'cap':
      return [[5, 2, 6, 2, c], [4, 4, 8, 1, c], [11, 0, 1, 1, '#e2b33c'], [12, 1, 1, 1, '#e2b33c'], [11, 2, 1, 1, '#e2b33c']];
    case 'topknot':
      return [[7, 2, 2, 2, c], [5, 4, 6, 1, c]];
    case 'goggles':
      return [[5, 3, 6, 1, hair], [4, 4, 1, 3, hair], [11, 4, 1, 3, hair], [5, 5, 2, 2, c], [9, 5, 2, 2, c], [7, 5, 2, 1, c]];
    case 'bandana':
      return [[5, 3, 6, 2, c], [11, 4, 2, 1, c], [12, 5, 1, 2, c], [4, 5, 1, 3, hair]];
  }
}

function itemRects(item: Item, c: string): Rect[] {
  switch (item) {
    case 'sword':
      return [[13, 4, 1, 7, c], [12, 10, 3, 1, '#c9a227'], [13, 11, 1, 2, '#6b4423']];
    case 'bigsword':
      return [[13, 2, 2, 9, c], [12, 10, 4, 1, '#c9a227'], [13, 11, 2, 2, '#6b4423']];
    case 'broken':
      return [[13, 7, 1, 4, c], [14, 5, 1, 1, c], [12, 10, 3, 1, '#5a4636'], [13, 11, 1, 2, '#3a2a1a']];
    case 'staff':
      return [[13, 3, 1, 12, c], [12, 1, 3, 2, '#3fc1b0']];
    case 'leafstaff':
      return [[13, 3, 1, 12, c], [12, 1, 1, 2, '#4f8f3a'], [14, 1, 1, 2, '#4f8f3a'], [13, 0, 1, 2, '#6fbf4a']];
    case 'bow':
      return [[13, 3, 1, 1, c], [14, 4, 1, 6, c], [13, 10, 1, 1, c], [13, 4, 1, 6, '#e9e2d0']];
    case 'mace':
      return [[13, 6, 1, 7, '#6b4423'], [12, 4, 3, 3, c]];
    case 'dagger':
      return [[13, 8, 1, 3, c], [12, 11, 3, 1, '#c9a227']];
    case 'axe':
      return [[13, 4, 1, 10, '#6b4423'], [14, 4, 2, 3, c], [12, 5, 1, 1, c]];
    case 'lute':
      return [[12, 10, 3, 3, c], [13, 6, 1, 4, '#6b4423'], [13, 11, 1, 1, OUTLINE]];
    case 'fist':
      return [[12, 9, 2, 2, c]];
    case 'flask':
      return [[13, 8, 1, 1, '#e9e2d0'], [12, 9, 3, 3, c]];
    case 'shield':
      return [[1, 8, 3, 5, c], [2, 9, 1, 3, '#e9e2d0']];
    case 'broom':
      return [[13, 2, 1, 10, c], [12, 12, 3, 3, '#c9a227']];
  }
}

function rects(look: Look): Rect[] {
  const r: Rect[] = [
    // head with outline
    [4, 3, 8, 7, OUTLINE],
    [5, 4, 6, 5, look.skin],
    [6, 6, 1, 1, EYE],
    [9, 6, 1, 1, EYE],
    [7, 8, 2, 1, '#b5655a'],
    // body
    [4, 10, 8, 4, OUTLINE],
    [5, 10, 6, 3, look.outfit],
    [5, 12, 6, 1, look.trim],
    // arms
    [3, 10, 1, 3, look.outfit],
    [12, 10, 1, 3, look.outfit],
    [3, 13, 1, 1, look.skin],
    [12, 13, 1, 1, look.skin],
    // legs
    [5, 14, 2, 2, OUTLINE],
    [9, 14, 2, 2, OUTLINE],
  ];
  return [...r, ...hatRects(look.hat, look.hatColor, look.hair), ...itemRects(look.item, look.itemColor)];
}

export function PixelSprite({ id, size = 40, title }: { id: string; size?: number; title?: string }) {
  const look = LOOKS[id] ?? LOOKS.knight;
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className="sprite"
    >
      {rects(look).map(([x, y, w, h, c], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill={c} />
      ))}
    </svg>
  );
}

export function AvatarSprite({ avatarId, classId, size, title }: { avatarId: string; classId?: string; size?: number; title?: string }) {
  return <PixelSprite id={classId ? `class-${classId}` : avatarId} size={size} title={title} />;
}
