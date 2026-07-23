/**
 * MemLab Memory Leak Scenario: Welcome -> Main App Lifecycle (.cjs format for MemLab compatibility)
 *
 * Tests memory release when transitioning from WelcomePage (F1 WebGL model, ParticleBackground,
 * Audio, Animation Frames) into the Main App (Itinerary / MapComponent) and returning back to Welcome.
 */

function url() {
  return process.env.TEST_TARGET_URL || 'http://localhost:3000/';
}

async function setup(page) {
  if (!page || typeof page.evaluateOnNewDocument !== 'function') return;
  // Guard against browser null pageerror events crashing MemLab's internal console parser
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

  // 1. Wait for WelcomePage CTA to be mounted
  await page.waitForSelector('button[data-f1-welcome-action="enter"]', {
    timeout: 30000,
  });

  // 2. Click the enter button to trigger transition to main application
  const enterButton = await page.$('button[data-f1-welcome-action="enter"]');
  if (enterButton) {
    await enterButton.click();
  }

  // 3. Wait for the main app view container to be visible and stable
  await page.waitForSelector('main', {
    timeout: 15000,
  });
}

async function back(page) {
  await setup(page);

  // Return to WelcomePage within SPA (in-page transition) to allow MemLab to compare V8 heap diff
  await page.waitForSelector('button[data-app-action="return-welcome"]', {
    timeout: 5000,
  });
  const returnButton = await page.$('button[data-app-action="return-welcome"]');
  if (returnButton) {
    await returnButton.click();
  }

  // Wait for WelcomePage to be remounted
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
