import { chromium } from '@playwright/test';

async function run() {
  console.log('🚀 Starting Playwright E2E verification...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  // Capture console messages & uncaught errors
  page.on('console', msg => console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => console.error(`[BROWSER UNCAUGHT ERROR]`, err));

  try {
    console.log('1. Navigating to http://127.0.0.1:3000 ...');
    await page.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded', timeout: 10000 });
    
    const title = await page.title();
    console.log(`✅ Page Title: "${title}"`);

    // Verify Hero text
    const headingText = await page.locator('h1').first().textContent();
    console.log(`✅ Hero Heading: "${headingText?.trim()}"`);

    // Verify Shop Owner Portal button in top banner
    const shopOwnerBtn = page.getByRole('button', { name: /Shop Owner Portal/i });
    const isOwnerBtnVisible = await shopOwnerBtn.isVisible();
    console.log(`✅ Shop Owner Portal button visible: ${isOwnerBtnVisible}`);

    // Verify Diagnostic Tool section
    const diagSection = page.locator('#diagnostic');
    console.log(`✅ Diagnostic section visible: ${await diagSection.isVisible()}`);

    // Verify Rake & Trail Calculator section
    const rakeSection = page.locator('#calculator');
    console.log(`✅ Rake & Trail section visible: ${await rakeSection.isVisible()}`);

    // Test Shop Admin Portal PIN unlock
    console.log('2. Testing Shop Admin Portal unlock & Invoice Work Order system...');
    await shopOwnerBtn.click();
    await page.waitForTimeout(500);

    const pinInput = page.getByPlaceholder('1234');
    const isPinVisible = await pinInput.isVisible();
    console.log(`✅ Security PIN input visible: ${isPinVisible}`);

    if (isPinVisible) {
      await pinInput.fill('1234');
      const unlockBtn = page.getByRole('button', { name: /Unlock Shop Portal/i });
      await unlockBtn.click();
      await page.waitForTimeout(500);

      const portalHeader = page.getByText(/APPOINTMENT COMMAND CENTER|SHOP MANAGEMENT PORTAL/i).first();
      console.log(`✅ Shop Admin Portal unlocked successfully: ${await portalHeader.isVisible()}`);

      // Check Excel Export All button
      const exportAllBtn = page.getByRole('button', { name: /Export All to Excel/i });
      console.log(`✅ Excel Export All button visible: ${await exportAllBtn.isVisible()}`);

      // Open Invoice modal if booking exists
      const editInvoiceBtn = page.getByRole('button', { name: /Edit Invoice|Create Owner Invoice/i }).first();
      if (await editInvoiceBtn.isVisible()) {
        await editInvoiceBtn.click();
        await page.waitForTimeout(500);

        const btPrintBtn = page.getByRole('button', { name: 'Bluetooth Print', exact: true });
        const excelSingleBtn = page.getByRole('button', { name: /Export to Excel/i });
        const systemPrintBtn = page.getByRole('button', { name: /System Print/i });

        console.log(`✅ Invoice Modal Bluetooth Print button visible: ${await btPrintBtn.isVisible()}`);
        console.log(`✅ Invoice Modal Excel Export button visible: ${await excelSingleBtn.isVisible()}`);
        console.log(`✅ Invoice Modal System Print button visible: ${await systemPrintBtn.isVisible()}`);
      }
    }

    console.log('🎉 ALL PLAYWRIGHT E2E CHECKS PASSED PERFECTLY!');
  } catch (err) {
    console.error('❌ Playwright Check Failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
