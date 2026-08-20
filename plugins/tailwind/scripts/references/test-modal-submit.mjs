import { chromium } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 1600 } });
const page = await ctx.newPage();

page.on('console', msg => console.log(`[c:${msg.type()}]`, msg.text().slice(0, 200)));
page.on('pageerror', err => console.log('[pageerror]', err.message.slice(0, 200)));
page.on('requestfailed', req => console.log('[reqfail]', req.url(), req.failure()?.errorText));

await page.goto('https://example.test/your/page', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForTimeout(800);

await page.click('#book-a-call-button-hero');
await page.waitForTimeout(800);

// Fill form
await page.fill('#customer-request-form-name-field', 'Test Person');
await page.fill('#customer-request-form-email-field', 'test@example.com');
await page.fill('#customer-request-form-company-field', 'Test Co');
await page.fill('#customer-request-form-phone-field', '555-1212');
await page.selectOption('#customer-request-form-select-job-role-field', { index: 1 });
await page.fill('#customer-request-form-job-title-field', 'Tester');

// Capture submit response
const responsePromise = page.waitForResponse(r => r.url().includes('/customer_requests') && r.request().method() === 'POST', { timeout: 8000 });

await page.click('#diagnostic-inclusion-pulse-book-analyst-call-modal input[type=submit]');

try {
  const resp = await responsePromise;
  console.log('SUBMIT-STATUS:', resp.status());
  console.log('SUBMIT-CONTENT-TYPE:', resp.headers()['content-type']);
  const body = await resp.text();
  console.log('SUBMIT-BODY (first 600):', body.slice(0, 600));
} catch (e) {
  console.log('NO-RESPONSE:', e.message.slice(0, 200));
}

await page.waitForTimeout(2000);
await page.screenshot({ path: '/tmp/modal-after-submit.png', fullPage: false });

const afterSubmit = await page.evaluate(() => {
  const m = document.querySelector('#diagnostic-inclusion-pulse-book-analyst-call-modal');
  return {
    visible: m && getComputedStyle(m).display !== 'none',
    bodyHTML: m?.querySelector('.modal-body')?.innerHTML?.length
  };
});
console.log('AFTER-SUBMIT:', JSON.stringify(afterSubmit));

await browser.close();
