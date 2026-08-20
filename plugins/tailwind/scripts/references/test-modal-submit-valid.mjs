import { chromium } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 1800 } });
const page = await ctx.newPage();

page.on('pageerror', err => console.log('[pageerror]', err.message.slice(0, 150)));

await page.goto('https://example.test/your/page', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForTimeout(800);

await page.click('#book-a-call-button-hero');
await page.waitForTimeout(800);

// Fill form with valid-looking data
await page.fill('#customer-request-form-name-field', 'Test Person');
await page.fill('#customer-request-form-email-field', 'test.person@example.com');
await page.fill('#customer-request-form-company-field', 'Test Co');
await page.fill('#customer-request-form-phone-field', '5555551234');
await page.selectOption('#customer-request-form-select-job-role-field', { index: 1 });
await page.fill('#customer-request-form-job-title-field', 'Tester');

await page.screenshot({ path: '/tmp/modal-filled.png', fullPage: false });

const submitResp = page.waitForResponse(r => r.url().includes('/customer_requests') && r.request().method() === 'POST', { timeout: 8000 });

await page.click('#diagnostic-inclusion-pulse-book-analyst-call-modal input[type=submit]');

try {
  const resp = await submitResp;
  console.log('SUBMIT-STATUS:', resp.status());
  const body = await resp.text();
  console.log('BODY-SIZE:', body.length);
  console.log('BODY (first 1500):\n', body.slice(0, 1500));
  console.log('---END');
  console.log('HAS-CALLBOOKING:', body.includes('callbooking') || body.includes('three_day_picker') || body.includes('appointment'));
  console.log('HAS-THANK-YOU:', body.includes('thank_you') || body.includes('Thank you') || body.includes('confirmed'));
} catch (e) {
  console.log('NO-RESPONSE:', e.message.slice(0, 200));
}

await page.waitForTimeout(2000);
await page.screenshot({ path: '/tmp/modal-after-valid-submit.png', fullPage: false });

await browser.close();
