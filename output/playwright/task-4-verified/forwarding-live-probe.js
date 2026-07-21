async page => {
  await page.mouse.move(1100, 650);
  await page.mouse.wheel(0, 2400);
  await page.waitForTimeout(800);
  const button = page.locator('[data-f1-welcome-action="enter"]');
  const box = await button.boundingBox();
  await page.evaluate(() => {
    const canvas = document.querySelector('[aria-label="Interactive Formula One showroom car"] canvas');
    const button = document.querySelector('[data-f1-welcome-action="enter"]');
    window.__task4ForwardLive = { pointerUps: [], buttonClicks: [] };
    canvas.addEventListener('pointerup', event => window.__task4ForwardLive.pointerUps.push({ trusted: event.isTrusted, x: event.clientX, y: event.clientY, pointerType: event.pointerType }), true);
    button.addEventListener('click', event => window.__task4ForwardLive.buttonClicks.push({ trusted: event.isTrusted }), true);
  });
  const cdp = await page.context().newCDPSession(page);
  const points = [{ x: 555, y: 438 }, { x: 580, y: 438 }];
  const before = { text: await button.textContent(), carAriaPressed: await page.locator('[aria-label="Interactive Formula One showroom car"]').getAttribute('aria-pressed') };
  for (const point of points) {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', buttons: 0, clickCount: 1 });
    if ((await page.evaluate(() => window.__task4ForwardLive.buttonClicks.length)) > 0) break;
  }
  return { viewport: page.viewportSize(), box, before, afterText: await button.textContent(), events: await page.evaluate(() => window.__task4ForwardLive) };
}
