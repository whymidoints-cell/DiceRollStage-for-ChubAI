import { test, expect } from '@playwright/test';
for (const port of [4173, 5173]) {
test(`${port === 4173 ? 'production bundle' : 'embedded development server'} handles Chub iframe messages`, async ({ page }) => {
  page.on('requestfailed', request => console.error(request.url(), request.failure()?.errorText));
  page.on('pageerror', error => console.error(error.message));
  await page.goto('http://localhost:5173');
  await page.setContent(`<!doctype html><iframe title="Dice stage" src="http://127.0.0.1:${port}" style="width:100%;height:900px"></iframe>`);
  const frame = page.frameLocator('iframe');
  await expect(frame.getByText('Developer chat simulator', { exact: false })).toHaveCount(0);
  // The same origin/source-checked postMessage contract used by the live Chub host.
  async function send(messageType: string, data: object | null) {
    return page.evaluate(({ messageType, data, port }) => new Promise<Record<string, unknown>>(resolve => {
      const child = document.querySelector('iframe')!.contentWindow!;
      const listener = (event: MessageEvent) => {
        if (event.source === child && event.data.messageType === messageType) {
          window.removeEventListener('message', listener);
          resolve(event.data.data);
        }
      };
      window.addEventListener('message', listener);
      child.postMessage({ messageType, data }, `http://127.0.0.1:${port}`);
    }), { messageType, data, port });
  }
  // Wait for the bundle and the ReactRunner listener before initializing it.
  await expect(frame.locator('#root')).not.toBeEmpty();
  expect((await send('INIT', { environment: 'production', config: {}, messageState: null })).success).toBe(true);
  await expect(frame.getByText('Let the dice decide.')).toBeVisible();
  const response = await send('BEFORE', { content: '/roll d20+4 # Perception', isBot: false, anonymizedId: '0', identity: 'test-1' });
  expect(response.systemMessage).toContain('Perception: d20+4');
  await expect(frame.locator('.history-list li')).toHaveCount(1);
  expect((await send('AFTER', { content: 'You notice the door.', isBot: true, anonymizedId: '1' })).messageState).toEqual(response.messageState);
  await send('SET', null);
  await expect(frame.getByText('Let the dice decide.')).toBeVisible();
});
}
