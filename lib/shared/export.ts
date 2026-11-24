// Markdown export for the Loot Room. It is built from a player's filtered View,
// so anonymous cards stay anonymous automatically.
import { classById } from './classes';
import { CARD_TYPE_INFO } from './config';
import type { CardType, View, ViewCard } from './types';

type Visible = Extract<ViewCard, { hidden: false }>;

const ESCAPE_TABLE = (s: string) => s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const oneLine = (s: string) => s.replace(/\r?\n/g, ' ').trim();

export function exportFileName(createdAt: number): string {
  return `retro-${isoDate(createdAt)}.md`;
}

export function isoDate(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function buildMarkdown(view: View): string {
  const name = (id?: string) => view.players.find((p) => p.id === id)?.name ?? 'Former adventurer';
  const author = (c: Visible) => (c.anonymous ? 'Mysterious Stranger' : name(c.authorId));
  const visible = view.cards.filter((c): c is Visible => !c.hidden);
  const lines: string[] = [];

  lines.push(`# Sprint retro — ${isoDate(view.createdAt)}`);
  lines.push('');
  lines.push(`Retro Quest room ${view.code} · party level ${view.xp.level} · ${view.players.filter((p) => p.plays).length} adventurers`);
  lines.push('');

  // Tavern
  lines.push('## Check-in (The Tavern)');
  lines.push('');
  if (view.tavernPicks.length === 0) lines.push('_No class picks._');
  for (const pick of view.tavernPicks) {
    const cls = classById(pick.classId);
    const comment = pick.comment ? ` — "${oneLine(pick.comment)}"` : '';
    lines.push(`- **${name(pick.playerId)}**: ${cls?.name ?? pick.classId} (${cls?.description ?? ''})${comment}`);
  }
  lines.push('');

  // Cards by type
  const sections: { type: CardType; heading: string }[] = [
    { type: 'monster', heading: 'What got in the way (Monsters)' },
    { type: 'treasure', heading: 'What went well (Treasure)' },
    { type: 'potion', heading: 'What helped / ideas to try (Potions)' },
  ];
  const totals = view.votes.totals;
  for (const { type, heading } of sections) {
    lines.push(`## ${heading}`);
    lines.push('');
    const cards = visible.filter((c) => c.type === type);
    if (cards.length === 0) lines.push(`_No ${CARD_TYPE_INFO[type].plural.toLowerCase()}._`);
    if (type === 'monster') {
      const grouped = new Set<string>();
      for (const g of view.groups) {
        const votes = totals ? ` — ${totals[g.id] ?? 0} coins` : '';
        lines.push(`- **${oneLine(g.title)}** (group)${votes}`);
        for (const cid of g.cardIds) {
          const c = cards.find((x) => x.id === cid);
          if (!c) continue;
          grouped.add(c.id);
          lines.push(`  - ${oneLine(c.text)} _(${author(c)})_`);
        }
      }
      for (const c of cards.filter((x) => !grouped.has(x.id))) {
        const votes = totals ? ` — ${totals[c.id] ?? 0} coins` : '';
        lines.push(`- ${oneLine(c.text)} _(${author(c)})_${votes}`);
      }
    } else {
      for (const c of cards) lines.push(`- ${oneLine(c.text)} _(${author(c)})_`);
    }
    lines.push('');
  }

  // Votes
  lines.push('## Vote results');
  lines.push('');
  if (!totals) {
    lines.push('_Votes were not revealed._');
  } else {
    const rows = Object.entries(totals)
      .map(([id, total]) => ({
        title: view.groups.find((g) => g.id === id)?.title ?? visible.find((c) => c.id === id)?.text ?? id,
        total,
      }))
      .sort((a, b) => b.total - a.total);
    lines.push('| Monster | Coins |');
    lines.push('| --- | --- |');
    for (const r of rows) lines.push(`| ${ESCAPE_TABLE(r.title)} | ${r.total} |`);
  }
  lines.push('');

  // Actions
  lines.push('## Action items');
  lines.push('');
  const attacks = view.bosses.flatMap((b) => b.attacks.map((a) => ({ a, b })));
  if (attacks.length === 0) {
    lines.push('_No action items._');
  } else {
    for (const b of view.bosses) {
      lines.push(`- Boss: **${oneLine(b.name)}** — ${oneLine(b.title)}${b.defeated ? ' (defeated)' : ''}`);
    }
    lines.push('');
    lines.push('| # | Action | Owner | Due date | Boss |');
    lines.push('| --- | --- | --- | --- | --- |');
    attacks.forEach(({ a, b }, i) => {
      lines.push(
        `| ${i + 1} | ${ESCAPE_TABLE(a.text)} | ${a.ownerId ? ESCAPE_TABLE(name(a.ownerId)) : 'Needs a hero'} | ${a.dueDate ?? '—'} | ${ESCAPE_TABLE(b.name)} |`,
      );
    });
  }
  lines.push('');
  return lines.join('\n');
}
