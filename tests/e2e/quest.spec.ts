import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * The multi-browser happy path: a host plus players in separate browser
 * contexts travel through all 8 locations. Along the way every /view
 * response is recorded, so we can prove that no client ever receives
 * someone else's card text during a writing round, nor the author of
 * someone else's anonymous card.
 */

interface Seat {
  page: Page;
  name: string;
  secret: string;
  views: string[];
}

const NAMES = ['Hana', 'Ari', 'Bo', 'Cy', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal', 'Ivy', 'Jo', 'Kai'];

async function openSeat(browser: Browser, name: string, i: number): Promise<Seat> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const seat: Seat = { page, name, secret: `SECRET-${i}-${Math.random().toString(36).slice(2, 8)}`, views: [] };
  page.on('response', async (res) => {
    if (res.url().includes('/view') && res.request().method() === 'GET' && res.ok()) {
      seat.views.push(await res.text().catch(() => ''));
    }
  });
  return seat;
}

const hostButton = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

async function runQuest(browser: Browser, players: number) {
  const host = await openSeat(browser, NAMES[0], 0);
  await host.page.goto('/');
  await host.page.getByLabel('Your name').fill(host.name);
  await host.page.getByRole('button', { name: 'Create room' }).click();
  await host.page.waitForURL(/\/[A-Z]{4}$/);
  const code = new URL(host.page.url()).pathname.slice(1);

  // --- Town Gate: everyone joins at the same time
  const others = await Promise.all(Array.from({ length: players - 1 }, (_, i) => openSeat(browser, NAMES[i + 1], i + 1)));
  await Promise.all(
    others.map(async (s) => {
      await s.page.goto(`/${code}`);
      await s.page.getByLabel('Your name').fill(s.name);
      await expect(s.page.locator('.avatar-option[aria-pressed="true"]')).toHaveCount(1);
      // Avatar 0 is the host's knight; each player takes their own.
      await s.page.locator('.avatar-option').nth(Number(s.secret.split('-')[1]) % 12).click();
      await s.page.getByRole('button', { name: 'Enter the town' }).click();
      await expect(s.page.getByText('Waiting for the host to start the quest')).toBeVisible();
    }),
  );
  const all = [host, ...others];
  await expect(host.page.getByRole('heading', { name: `Adventurers (${players})` })).toBeVisible();

  // --- Tavern
  await hostButton(host.page, 'Start the quest →').first().click();
  await Promise.all(all.map((s) => expect(s.page.getByRole('heading', { name: 'The Tavern' })).toBeVisible()));
  await Promise.all(all.map((s, i) => s.page.getByRole('button', { name: i % 2 ? /Wise Wizard/ : /Weary Warrior/ }).click()));
  await expect(host.page.getByRole('heading', { name: `${players} of ${players} have chosen` })).toBeVisible();
  await hostButton(host.page, 'Reveal class picks').click();
  await Promise.all(all.map((s) => expect(s.page.getByRole('heading', { name: 'The party' })).toBeVisible()));

  // --- Monster Woods: everyone writes in the same second; one card is anonymous
  await hostButton(host.page, 'Travel to Monster Woods →').click();
  await Promise.all(all.map((s) => expect(s.page.getByRole('heading', { name: 'Monster Woods' })).toBeVisible()));
  await Promise.all(
    all.map(async (s, i) => {
      await s.page.getByLabel('New Monster card').fill(`${s.secret} slows us down`);
      if (i === 1) await s.page.getByLabel('Post anonymously').check();
    }),
  );
  await Promise.all(all.map((s) => s.page.getByRole('button', { name: 'Add card' }).click()));
  // Every face-down card is on the table (no lost writes).
  await expect(host.page.locator('.facedown')).toHaveCount(players);
  for (const s of all) await expect(s.page.getByText(s.secret)).toBeVisible();

  // Wait for one more polling round, then prove nothing leaked during writing.
  await host.page.waitForTimeout(3500);
  for (const s of all) {
    expect(s.views.length).toBeGreaterThan(0);
    for (const body of s.views) {
      for (const other of all) if (other !== s) expect(body).not.toContain(other.secret);
    }
  }
  // Direct check of the /view endpoint too.
  for (const s of all) {
    const body = await s.page.evaluate(async (c) => {
      const raw = localStorage.getItem(`retro-quest:room:${c}`);
      const token = JSON.parse(raw!).token;
      const res = await fetch(`/api/rooms/${c}/view`, { headers: { 'x-player-token': token } });
      return res.text();
    }, code);
    for (const other of all) if (other !== s) expect(body).not.toContain(other.secret);
  }

  await hostButton(host.page, 'Reveal cards').click();
  for (const s of all) for (const other of all) await expect(s.page.getByText(other.secret)).toBeVisible();
  await expect(others[0].page.getByText('Mysterious Stranger').first()).toBeVisible();

  // --- Treasure Cave and Potion Shop
  await hostButton(host.page, 'Travel to Treasure Cave →').click();
  await expect(others[1].page.getByRole('heading', { name: 'Treasure Cave' })).toBeVisible();
  await others[1].page.getByLabel('New Treasure card').fill('Great pairing');
  await others[1].page.getByRole('button', { name: 'Add card' }).click();
  await expect(others[1].page.getByText('Great pairing')).toBeVisible();
  await hostButton(host.page, 'Next: reveal →').click();
  await hostButton(host.page, 'Travel to Potion Shop →').click();
  await expect(others[2].page.getByRole('heading', { name: 'Potion Shop' })).toBeVisible();
  await others[2].page.getByLabel('New Potion card').fill('No-meeting Wednesday');
  await others[2].page.getByRole('button', { name: 'Add card' }).click();
  await expect(others[2].page.getByText('No-meeting Wednesday')).toBeVisible();
  await hostButton(host.page, 'Next: reveal →').click();

  // --- War Table: host merges the first two Monsters, everyone votes with the keyboard-friendly buttons
  await hostButton(host.page, 'Travel to The War Table →').click();
  await expect(host.page.getByRole('heading', { name: 'The War Table' })).toBeVisible();
  await host.page.getByRole('checkbox', { name: 'Select' }).nth(0).check();
  await host.page.getByRole('checkbox', { name: 'Select' }).nth(1).check();
  await host.page.getByRole('button', { name: 'Merge selected (2)' }).click();
  await expect(host.page.locator('.group-box')).toHaveCount(1);
  await hostButton(host.page, 'Next: open voting →').click();
  await Promise.all(
    all.map(async (s) => {
      await expect(s.page.getByText('3 coins left')).toBeVisible();
      const add = s.page.locator('.group-box').getByRole('button', { name: 'Add a coin' });
      for (let i = 0; i < 3; i++) {
        await add.click();
        await expect(s.page.getByText(`${2 - i} coins left`)).toBeVisible();
      }
      await expect(add).toBeDisabled(); // capped at 3
    }),
  );
  await hostButton(host.page, 'Reveal votes').click();
  await expect(others[0].page.getByText('The votes are in.')).toBeVisible();

  // --- Boss Lair: the group is the top Monster, so it is the Boss
  await hostButton(host.page, 'Travel to Boss Lair →').click();
  await expect(others[0].page.getByRole('meter', { name: /Boss HP 100 of 100/ })).toBeVisible();
  await others[0].page.getByLabel('New Attack (action item)').fill('Fix the flaky tests');
  await others[0].page.getByLabel('Hero (owner)').selectOption({ label: others[0].name });
  await others[0].page.getByRole('button', { name: 'Attack!' }).click();
  await expect(host.page.getByRole('meter', { name: /Boss HP 40 of 100/ })).toBeVisible();
  await hostButton(host.page, 'Defeat the Boss').click();
  await expect(others[1].page.getByText('Victory! The Boss is defeated.')).toBeVisible();

  // --- Reconnect: a refresh puts a player straight back in
  const t0 = Date.now();
  await others[2].page.reload();
  await expect(others[2].page.getByRole('heading', { name: 'Boss Lair' })).toBeVisible({ timeout: 5000 });
  expect(Date.now() - t0).toBeLessThan(5000);

  // --- Loot Room and end
  await hostButton(host.page, 'Travel to Loot Room →').click();
  await Promise.all(all.map((s) => expect(s.page.getByRole('heading', { name: 'Loot Room' })).toBeVisible()));
  await expect(host.page.getByRole('button', { name: 'Copy as Markdown' })).toBeVisible();
  await hostButton(host.page, 'End session').click();
  await hostButton(host.page, 'Yes, end it').click();
  await Promise.all(all.map((s) => expect(s.page.getByText('This retro has ended and is read-only.')).toBeVisible()));

  // The anonymous card's author never reached any other client, in any phase.
  const anonAuthor = others[0];
  for (const s of all) {
    if (s === anonAuthor) continue;
    for (const body of s.views) {
      const view = JSON.parse(body);
      for (const c of view.cards) if (c.anonymous) expect(c.authorId).toBeUndefined();
    }
  }

  await Promise.all(all.map((s) => s.page.context().close()));
}

test('5 browsers (host + 4 players) complete a quest', async ({ browser }) => {
  await runQuest(browser, 5);
});

test('10 browsers complete a quest', async ({ browser }) => {
  await runQuest(browser, 10);
});

test('reduced motion replaces flips, shakes and coin drops with fades', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const names = await page.evaluate(() =>
    ['flip-in', 'shake', 'coin-drop'].map((cls) => {
      const el = document.createElement('div');
      el.className = cls;
      document.body.appendChild(el);
      const name = getComputedStyle(el).animationName;
      el.remove();
      return name;
    }),
  );
  expect(names).toEqual(['fade', 'fade', 'fade']);

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const normal = await page.evaluate(() => {
    const el = document.createElement('div');
    el.className = 'flip-in';
    document.body.appendChild(el);
    return getComputedStyle(el).animationName;
  });
  expect(normal).toBe('flip');
});
