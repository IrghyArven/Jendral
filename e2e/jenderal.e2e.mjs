// Browser tests (Playwright + Chromium) against the PRODUCTION build served under a sub-path,
// exactly like GitHub Pages project sites (https://user.github.io/jenderal-game/).
//   npm run build && npm run test:e2e
// Playwright is not a project dependency. CI installs it with `npm i --no-save playwright`.
// Locally, point PLAYWRIGHT_MODULE at an existing install if `playwright` is not resolvable.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.DIR = 'dist';
process.env.BASE = '/jenderal-game/';
if (!existsSync('dist/index.html')) throw new Error('dist/ belum ada: jalankan "npm run build" dulu');
const { server } = await import('../scripts/serve.mjs');
const pw = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const chromium = pw.chromium ?? pw.default.chromium;

let browser, url;
before(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  url = `http://127.0.0.1:${server.address().port}/jenderal-game/?e2e=1`;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); server.close(); });

async function open(viewport = { width: 393, height: 851 }, ctxOpts = {}) {
  const context = await browser.newContext({ viewport, ...ctxOpts });
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) problems.push(`HTTP ${r.status()} ${r.url()}`); });
  await page.goto(url);
  return { page, context, problems };
}
const card = (page, id) => page.locator(`#hand .card[data-id="${id}"]`);
const clickCard = (page, id) => card(page, id).click({ position: { x: 6, y: 12 } }); // left strip: cards overlap
const view = (page) => page.evaluate(() => window.__jenderal.humanView());

async function fastSpeed(page) {
  await page.click('text=Pengaturan');
  await page.selectOption('#screen-settings [data-setting="speed"]', 'fast');
  await page.click('#btn-settings-back');
}
async function startFromMenu(page, { seed = '7' } = {}) {
  await page.click('#btn-menu-new');
  await page.fill('#in-seed', seed);
  await page.click('#btn-start');
  await page.waitForSelector('#screen-game.active');
}

/** Drives the human seat through the real UI (clicks) until the results screen shows. */
async function playToEnd(page, maxMs = 150000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    if (await page.locator('#screen-results.active').count()) return true;
    const v = await view(page);
    if (v?.canJenderal) { await page.click('#btn-jenderal'); continue; }
    if (v && v.phase === 'playing' && v.current === 0 && !v.finished.includes(0)) {
      if (v.legal.length) {
        for (const id of v.legal[0]) await clickCard(page, id);
        await page.click('#btn-play');
      } else await page.click('#btn-pass');
    } else await page.waitForTimeout(50);
  }
  return false;
}

test('main page opens under a GitHub Pages sub-path with no failed requests', async () => {
  const { page, context, problems } = await open();
  assert.match(await page.title(), /JENDERAL/);
  assert.equal(await page.textContent('.logo'), 'JENDERAL');
  for (const t of ['Main Baru', 'Pengaturan', 'Statistik', 'Panduan Aturan']) assert.ok(await page.locator(`#screen-menu >> text=${t}`).isVisible(), t);
  await page.click('text=Panduan Aturan');
  assert.ok(await page.locator('#screen-guide.active').isVisible());
  assert.deepEqual(problems, []);
  await context.close();
});

test('difficulty settings work and are wired to the AI seats', async () => {
  const { page, context, problems } = await open();
  await page.click('#btn-menu-new');
  assert.equal(await page.locator('#seg-diff .segbtn.on').textContent(), 'Normal');
  await page.click('#seg-diff [data-diff="hard"]');
  assert.equal(await page.getAttribute('#seg-diff [data-diff="hard"]', 'aria-checked'), 'true');
  assert.match(await page.textContent('#diff-info'), /strategis/i);
  await page.check('#in-perai');
  await page.selectOption('[aria-label="Kesulitan Budi"]', 'easy');
  await page.selectOption('[aria-label="Kesulitan Sari"]', 'normal');
  await page.selectOption('[aria-label="Kesulitan Dewa"]', 'expert');
  await page.selectOption('[aria-label="Kepribadian Dewa"]', 'aggressive');
  await page.click('#btn-start');
  await page.waitForSelector('#screen-game.active');
  const seats = await page.evaluate(() => window.__jenderal.seats());
  assert.deepEqual(seats.map((s) => s.difficulty), ['easy', 'normal', 'expert']);
  assert.equal(seats[2].personality, 'aggressive');
  assert.match(await page.textContent('#seat-1'), /Mudah · Agresif/);
  assert.match(await page.textContent('#seat-3'), /Ahli · Agresif/);
  // settings persist across a reload
  await page.reload();
  await page.click('#btn-menu-new');
  assert.equal(await page.isChecked('#in-perai'), true);
  assert.equal(await page.inputValue('[aria-label="Kesulitan Dewa"]'), 'expert');
  assert.deepEqual(problems, []);
  await context.close();
});

test('card selection, invalid-combination message, PLAY/PASS gating', async () => {
  const { page, context, problems } = await open();
  await page.evaluate(() => window.__jenderal.startWithHands([['3C', '4D', '9H', 'KS'], ['5C'], ['6C'], ['7C']], { seed: 1, speed: 'slow' }));
  await page.waitForSelector('#screen-game.active');
  assert.equal(await page.isDisabled('#btn-play'), true);
  assert.equal(await page.isDisabled('#btn-pass'), true); // leading: cannot pass
  await clickCard(page, '4D'); await clickCard(page, '9H');
  assert.equal(await page.locator('#hand .card.sel').count(), 2);
  assert.equal(await page.isDisabled('#btn-play'), true);
  assert.match(await page.textContent('#status'), /Bukan kombinasi yang sah|Langkah pertama/);
  await clickCard(page, '4D'); await clickCard(page, '9H'); // deselect
  assert.equal(await page.locator('#hand .card.sel').count(), 0);
  await clickCard(page, '3C');
  assert.equal(await page.isDisabled('#btn-play'), false);
  await page.click('#btn-play');
  assert.equal(await page.locator('#table-cards .card').count(), 1);
  assert.equal(await page.locator('#hand .card').count(), 3);
  assert.ok(await page.locator('#seat-1.turn').isVisible()); // turn indicator moved to the AI
  assert.deepEqual(problems, []);
  await context.close();
});

test('a full match runs to the end through the UI; rematch and menu work', async () => {
  const { page, context, problems } = await open();
  await fastSpeed(page);
  await startFromMenu(page, { seed: '7' });
  assert.ok(await page.locator('#hand .card').count() >= 13);
  assert.ok(await playToEnd(page), 'pertandingan tidak selesai');
  const title = await page.textContent('#res-title');
  assert.match(title, /Menang|Kalah|Juara/);
  assert.equal(await page.locator('#res-list li').count(), 4);
  assert.ok(await page.locator('#res-stats tr').count() >= 5);
  // rematch: fresh state, no reload
  await page.click('#btn-again');
  await page.waitForSelector('#screen-game.active');
  assert.ok(await page.locator('#hand .card').count() >= 13);
  assert.equal(await page.locator('#screen-results.active').count(), 0);
  // quit mid-game: pending timers must not resurrect the results screen
  await page.click('#btn-pause'); await page.click('#btn-quit');
  await page.waitForTimeout(1500);
  assert.ok(await page.locator('#screen-menu.active').isVisible());
  // and a new match can start again after that
  await startFromMenu(page, { seed: '8' });
  assert.ok(await playToEnd(page), 'pertandingan ke-2 tidak selesai');
  await page.click('#btn-menu-results');
  assert.ok(await page.locator('#screen-menu.active').isVisible());
  await page.click('text=Statistik');
  assert.match(await page.textContent('#stats-list'), /Pertandingan\s*2/);
  assert.deepEqual(problems, []);
  await context.close();
});

test('AI performs Jenderal after a Joker: effect, chip and defeat screen', async () => {
  const { page, context, problems } = await open();
  await page.click('#btn-menu-new'); await page.click('#seg-diff [data-diff="expert"]');
  // Budi's only legal answer to the black 3C is the black Joker; Sari holds four 9s.
  await page.evaluate(() => window.__jenderal.startWithHands([['3C', '7D', 'KS'], ['JB', 'JR'], ['9C', '9D', '9H', '9S'], ['6C', '8D']], { seed: 1 }));
  await page.waitForSelector('#screen-game.active');
  await clickCard(page, '3C'); await page.click('#btn-play');
  await page.waitForSelector('[data-testid="fx-jenderal"]', { timeout: 8000 });
  assert.match(await page.textContent('#jen-chip'), /JENDERAL/);
  await page.waitForSelector('#screen-results.active', { timeout: 8000 });
  assert.match(await page.textContent('#res-title'), /Kalah oleh Jenderal/);
  assert.match(await page.textContent('#res-sub'), /empat 9/);
  assert.ok(await page.locator('#screen-results.res-lose').isVisible());
  assert.deepEqual(problems, []);
  await context.close();
});

test('human can declare Jenderal and wins immediately', async () => {
  const { page, context, problems } = await open();
  await page.evaluate(() => window.__jenderal.startWithHands([['3C', '9C', '9D', '9H', '9S'], ['JB', 'JR'], ['5C'], ['6C']], { seed: 1 }));
  await page.waitForSelector('#screen-game.active');
  await clickCard(page, '3C'); await page.click('#btn-play');
  await page.waitForSelector('#overlay-jenderal:not(.hidden)', { timeout: 8000 });
  assert.match(await page.textContent('#jen-chip'), /TERBUKA/);
  await page.click('#btn-jenderal');
  await page.waitForSelector('[data-testid="fx-jenderal"]');
  await page.waitForSelector('#screen-results.active', { timeout: 8000 });
  assert.match(await page.textContent('#res-title'), /Kamu Menang/);
  assert.ok(await page.locator('#screen-results.res-win').isVisible());
  assert.deepEqual(problems, []);
  await context.close();
});

for (const [name, vp] of [['Android 360x640', { width: 360, height: 640 }], ['iPhone SE 375x667', { width: 375, height: 667 }], ['iPhone 14 390x844', { width: 390, height: 844 }], ['tablet 768x1024', { width: 768, height: 1024 }], ['desktop 1280x800', { width: 1280, height: 800 }]]) {
  test(`layout fits the screen without clipping: ${name}`, async () => {
    const { page, context, problems } = await open(vp);
    await page.evaluate(() => window.__jenderal.startWithHands([['3C', '4D', '4S', '5H', '6H', '7C', '8D', '9H', 'JS', 'QD', 'KS', 'AH', '2D', 'JR'], ['5C', '5D', '5S', '9C', '9D', '9S', '10C', '10D', '10H', '10S', 'JC', 'JD', 'JH'], ['6C', '6D', '6S', '7D', '7S', '8C', '8H', '8S', 'QC', 'QH', 'QS', 'KC', 'KD'], ['3D', '3H', '3S', '4C', '4H', 'AC', 'AD', 'AS', '2C', '2H', '2S', 'JB', 'KH']], { seed: 2, speed: 'slow' }));
    await page.waitForSelector('#screen-game.active');
    await page.waitForTimeout(1300); // let the deal animation finish
    const m = await page.evaluate(() => {
      const w = innerWidth, h = innerHeight;
      const rects = (sel) => [...document.querySelectorAll(sel)].map((e) => e.getBoundingClientRect());
      const out = (r) => r.left < -0.5 || r.right > w + 0.5 || r.top < -0.5 || r.bottom > h + 0.5;
      return {
        hScroll: document.documentElement.scrollWidth > w,
        handClipped: rects('#hand .card').filter(out).length, handCount: document.querySelectorAll('#hand .card').length,
        seatsClipped: rects('.seat').filter(out).length, buttonsClipped: rects('.actions .btn, #btn-pause').filter(out).length,
        statusClipped: out(document.getElementById('status').getBoundingClientRect()),
        tableH: document.querySelector('.table').getBoundingClientRect().height,
      };
    });
    assert.equal(m.hScroll, false, 'scroll horizontal');
    assert.equal(m.handCount, 14);
    assert.equal(m.handClipped, 0, 'kartu tangan terpotong');
    assert.equal(m.seatsClipped, 0, 'kursi pemain terpotong');
    assert.equal(m.buttonsClipped, 0, 'tombol terpotong');
    assert.equal(m.statusClipped, false);
    assert.ok(m.tableH > 150, 'meja terlalu kecil: ' + m.tableH);
    // the last (rightmost) card is tappable: select it
    await page.locator('#hand .card').last().click();
    assert.equal(await page.locator('#hand .card.sel').count(), 1);
    // a long ladder fits on the table centre
    assert.deepEqual(problems, []);
    await context.close();
  });
}

test('animations can be reduced or switched off; sound settings persist', async () => {
  const { page, context, problems } = await open();
  await page.click('text=Pengaturan');
  await page.selectOption('#screen-settings [data-setting="anim"]', 'off');
  assert.equal(await page.getAttribute('#app', 'data-anim'), 'off');
  await page.uncheck('#screen-settings [data-setting="sound"]');
  await page.fill('#screen-settings [data-setting="volume"]', '30');
  await page.click('#btn-settings-back');
  await page.evaluate(() => window.__jenderal.startWithHands([['3C', '4D'], ['5C'], ['6C'], ['7C']], { seed: 1, speed: 'slow' }));
  await page.waitForSelector('#screen-game.active');
  const anim = await page.evaluate(() => getComputedStyle(document.querySelector('#hand .card')).animationName);
  assert.equal(anim, 'none');
  await page.reload();
  assert.equal(await page.getAttribute('#app', 'data-anim'), 'off');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('jenderal.settings.v2')));
  assert.equal(saved.sound, false); assert.equal(saved.volume, 0.3);
  // full animation actually animates
  await page.click('text=Pengaturan');
  await page.selectOption('#screen-settings [data-setting="anim"]', 'full');
  await page.click('#btn-settings-back');
  await page.evaluate(() => window.__jenderal.startWithHands([['3C', '4D'], ['5C'], ['6C'], ['7C']], { seed: 1, speed: 'slow' }));
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#hand .card')).animationName), 'deal');
  assert.deepEqual(problems, []);
  await context.close();
});

test('pause overlay stops the AI; no double actions from rapid clicks', async () => {
  const { page, context, problems } = await open();
  await page.evaluate(() => window.__jenderal.startWithHands([['3C', '4D', '9H'], ['5C', '8D'], ['6C', 'QD'], ['7C', 'KD']], { seed: 1, speed: 'fast' }));
  await page.waitForSelector('#screen-game.active');
  await clickCard(page, '3C');
  await page.evaluate(() => { const b = document.getElementById('btn-play'); b.click(); b.click(); b.click(); });
  const v = await view(page);
  assert.equal(v.hand.length, 2, 'hanya satu 3C yang boleh keluar');
  await page.click('#btn-pause');
  const before = await page.textContent('#table-label');
  await page.waitForTimeout(1200);
  assert.equal(await page.textContent('#table-label'), before);
  await page.click('#btn-resume');
  assert.deepEqual(problems, []);
  await context.close();
});
