/**
 * MemLab Memory Leak Scenario: Particles Lifecycle
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

  await page.waitForSelector('main canvas', {
    timeout: 15000,
  });
}

async function back(page) {
  await setup(page);

  await page.waitForSelector('button[data-app-action="return-welcome"]', {
    timeout: 5000,
  });
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
