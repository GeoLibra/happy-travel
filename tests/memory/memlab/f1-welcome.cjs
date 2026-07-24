/**
 * MemLab Memory Leak Scenario: F1 Welcome -> Main App Lifecycle
 */

function url() {
  return process.env.TEST_TARGET_URL || 'http://localhost:3000/';
}

async function setup(page) {
  if (!page || typeof page.evaluateOnNewDocument !== 'function') return;
  await page.evaluateOnNewDocument(() => {
    window.addEventListener('error', (event) => {
      if (!event.error) {
        try {
          Object.defineProperty(event, 'error', {
            value: new Error(event.message || 'Window error event'),
            configurable: true,
            writable: true,
          });
        } catch {}
      }
    }, true);
    window.addEventListener('unhandledrejection', (event) => {
      if (!event.reason) {
        try {
          Object.defineProperty(event, 'reason', {
            value: new Error('Unhandled promise rejection'),
            configurable: true,
            writable: true,
          });
        } catch {}
      }
    }, true);
  });
}

async function waitForWelcomeReady(page) {
  await page.waitForSelector('button[data-f1-welcome-action="enter"]', {
    timeout: 30000,
  });
  await page.waitForSelector('canvas[data-engine^="three.js"]', {
    timeout: 30000,
  });
  await page.waitForFunction(() => {
    const btn = document.querySelector('button[data-f1-welcome-action="enter"]');
    if (!btn) return false;
    const text = btn.textContent || '';
    return !text.includes('CALIBRATING');
  }, undefined, { timeout: 45000 });
}

async function enterButtonCenter(page) {
  return page.evaluate(() => {
    const btn = document.querySelector('button[data-f1-welcome-action="enter"]');
    if (!btn) return null;
    const rect = btn.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  });
}

async function action(page) {
  await setup(page);

  await waitForWelcomeReady(page);
  const point = await enterButtonCenter(page);
  if (!point) {
    throw new Error('F1 welcome enter button has no bounding box');
  }

  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.waitForFunction(() => {
    const btn = document.querySelector('button[data-f1-welcome-action="enter"]');
    const text = btn?.textContent || '';
    const match = text.match(/ENGINE STARTING\s+(\d+)%/);
    return match && Number(match[1]) >= 35;
  }, undefined, { timeout: 45000 });
  await page.mouse.up();

  await page.waitForFunction(() => {
    const btn = document.querySelector('button[data-f1-welcome-action="enter"]');
    const text = btn?.textContent || '';
    return text.includes('ENTER') || text.includes('REASSEMBLING');
  }, undefined, { timeout: 90000 });
  await page.focus('button[data-f1-welcome-action="enter"]');
  await page.keyboard.press('Enter');

  await page.waitForSelector('[data-app-action="return-welcome"]', {
    timeout: 30000,
  });
  await page.waitForSelector('button[data-f1-welcome-action="enter"]', {
    hidden: true,
    timeout: 30000,
  });
}

async function back(page) {
  await setup(page);

  await page.waitForSelector('button[data-app-action="return-welcome"]', {
    timeout: 15000,
  });

  const returnButton = await page.$('button[data-app-action="return-welcome"]');
  if (!returnButton) {
    throw new Error('Return to Welcome button not found');
  }
  await returnButton.click();
  await returnButton.dispose();

  await waitForWelcomeReady(page);
}

module.exports = {
  url,
  setup,
  action,
  back,
  leakFilter(node) {
    const name = String(node?.name || '');
    const type = String(node?.type || '');
    const retainedSize = Number(node?.retainedSize || 0);
    const signature = `${type} ${name}`;

    if (/HTMLAudioElement|Detached <audio|AudioBuffer|AudioContext/.test(signature)) {
      return true;
    }

    return false;
  },
};
