/**
 * MemLab Memory Leak Scenario: Rose Modal Lifecycle
 */

function url() {
  return process.env.TEST_TARGET_URL || 'http://localhost:3000/';
}

async function setup(page) {
  if (!page || typeof page.evaluateOnNewDocument !== 'function') return;
  await page.evaluateOnNewDocument(() => {
    window.addEventListener('error', (event) => {
      if (event && !event.error) {
        try {
          Object.defineProperty(event, 'error', {
            value: new Error(event.message || 'Unknown window error'),
          });
        } catch {}
      }
    }, true);
    window.addEventListener('unhandledrejection', (event) => {
      if (event && !event.reason) {
        try {
          Object.defineProperty(event, 'reason', {
            value: new Error('Unhandled promise rejection'),
          });
        } catch {}
      }
    }, true);
  });
}

async function action(page) {
  await setup(page);

  await page.waitForSelector('button[data-f1-welcome-action="enter"]', {
    timeout: 30000,
  });

  const enterButton = await page.$('button[data-f1-welcome-action="enter"]');
  if (enterButton) {
    const box = await enterButton.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForFunction(() => {
        const text = document.body.innerText || '';
        return text.includes('ENTER') || text.includes('REASSEMBLING');
      }, undefined, { timeout: 10000 });
      await page.mouse.up();
    }
    await enterButton.dispose();
  }

  await page.waitForSelector('main', {
    timeout: 15000,
  });

  // Click secret rose trigger 5 times to open Rose Modal
  const trigger = await page.$('[data-rose-trigger="true"]');
  if (trigger) {
    for (let i = 0; i < 5; i++) {
      await trigger.click();
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
    }
    await trigger.dispose();
  }

  // Wait for Rose canvas / modal container to appear
  await page.waitForSelector('div.fixed.z-\\[100\\]', {
    timeout: 10000,
  });
}

async function back(page) {
  await setup(page);

  // Press Escape to close Rose Modal
  await page.keyboard.press('Escape');

  // Wait for modal container to disappear
  await page.waitForSelector('div.fixed.z-\\[100\\]', {
    state: 'detached',
    timeout: 10000,
  }).catch(() => {});

  // Return to Welcome page
  const returnButton = await page.$('button[data-app-action="return-welcome"]');
  if (returnButton) {
    await returnButton.click();
    await returnButton.dispose();
  }

  await page.waitForSelector('button[data-f1-welcome-action="enter"]', {
    timeout: 15000,
  });
}

module.exports = {
  url,
  setup,
  action,
  back,
};
