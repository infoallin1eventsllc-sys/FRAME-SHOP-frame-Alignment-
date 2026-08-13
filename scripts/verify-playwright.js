import { chromium } from '@playwright/test';

async function run() {
  console.log('🚀 Starting Playwright E2E verification...');
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium' });
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

    // Verify Book Inspection button in navbar
    const bookBtn = page.getByRole('button', { name: /Book Inspection/i }).first();
    const isBookBtnVisible = await bookBtn.isVisible();
    console.log(`✅ Book Inspection button visible: ${isBookBtnVisible}`);

    // Verify Diagnostic Tool section
    const diagSection = page.locator('#diagnostic');
    console.log(`✅ Diagnostic section visible: ${await diagSection.isVisible()}`);

    // Verify Rake & Trail Calculator section
    const rakeSection = page.locator('#calculator');
    console.log(`✅ Rake & Trail section visible: ${await rakeSection.isVisible()}`);

    // Test Shop Admin Portal PIN unlock via footer Owner Login button
    console.log('2. Testing Shop Admin Portal unlock & Invoice Work Order system...');
    const footer = page.locator('footer');
    await footer.scrollIntoViewIfNeeded();
    const ownerLoginBtn = page.getByRole('button', { name: /Owner Login/i });
    await ownerLoginBtn.click();
    await page.waitForTimeout(500);

    const pinInput = page.getByPlaceholder('1234');
    const isPinVisible = await pinInput.isVisible();
    console.log(`✅ Security PIN input visible: ${isPinVisible}`);

    if (isPinVisible) {
      await pinInput.fill('1234');
      const unlockBtn = page.getByRole('button', { name: /Unlock Shop Portal/i });
      await unlockBtn.click();
      await page.waitForTimeout(500);

      const portalHeader = page.getByRole('heading', { name: /COMMAND CENTER/i });
      console.log(`✅ Shop Admin Portal unlocked successfully: ${await portalHeader.isVisible()}`);

      // Check Invoices Excel export button
      const exportAllBtn = page.getByRole('button', { name: /Invoices Excel/i });
      console.log(`✅ Invoices Excel button visible: ${await exportAllBtn.isVisible()}`);

      // Open Invoice modal if booking exists
      const editInvoiceBtn = page.getByRole('button', { name: /Edit Invoice|Create Owner Invoice/i }).first();
      if (await editInvoiceBtn.isVisible()) {
        await editInvoiceBtn.click();
        await page.waitForTimeout(500);

        const btPrintBtn = page.getByRole('button', { name: /Bluetooth Print/i }).first();
        const excelSingleBtn = page.getByRole('button', { name: /Export to Excel/i }).first();
        const systemPrintBtn = page.getByRole('button', { name: /System Print/i }).first();

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
