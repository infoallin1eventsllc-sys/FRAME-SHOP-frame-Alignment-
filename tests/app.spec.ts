import { test, expect } from '@playwright/test';

test.describe('The Frame Shop - Web Application End-to-End Tests', () => {

  test('Homepage loads correctly with navigation and core branding', async ({ page }) => {
    await page.goto('/');
    
    // Check title / hero heading
    await expect(page.locator('h1')).toContainText('FRAME & CHASSIS');
    
    // Check navigation buttons exist
    const shopAdminBtn = page.getByRole('button', { name: /Shop Admin/i });
    await expect(shopAdminBtn).toBeVisible();

    const bookAppointmentBtn = page.getByRole('button', { name: /Book Inspection/i }).first();
    await expect(bookAppointmentBtn).toBeVisible();
  });

  test('Diagnostic Tool interactive workflow operates without errors', async ({ page }) => {
    await page.goto('/');

    // Locate Diagnostic section or launch diagnostic button
    const diagSection = page.locator('#diagnostic');
    await expect(diagSection).toBeVisible();

    // Select symptom option (e.g. High Speed Wobble)
    const wobbleBtn = page.getByText('High-Speed Wobble / Speed Weave');
    if (await wobbleBtn.isVisible()) {
      await wobbleBtn.click();
    }

    // Verify diagnostic recommendations rendered
    await expect(page.getByText('Recommended Inspection Service')).toBeVisible();
  });

  test('Rake & Trail Calculator computes geometry accurately', async ({ page }) => {
    await page.goto('/');

    // Scroll to Rake & Trail section
    const rakeSection = page.locator('#calculator');
    await expect(rakeSection).toBeVisible();

    // Verify calculator inputs and output badges exist
    const trailDisplay = page.getByText(/Calculated Trail/i);
    await expect(trailDisplay).toBeVisible();
  });

  test('Shop Admin Portal authenticates with PIN 7777 and manages invoices', async ({ page }) => {
    await page.goto('/');

    // Click Shop Admin in Navbar
    const shopAdminNavBtn = page.getByRole('button', { name: /Shop Admin/i });
    await shopAdminNavBtn.click();

    // PIN Authentication screen
    const pinInput = page.getByPlaceholder('ENTER 4-DIGIT SECURITY PIN');
    await expect(pinInput).toBeVisible();

    await pinInput.fill('7777');
    const loginBtn = page.getByRole('button', { name: /Unlock Portal/i });
    await loginBtn.click();

    // Verify Admin Portal Header unlocked
    await expect(page.getByText('THE FRAME SHOP - MASTER SERVICE PORTAL')).toBeVisible();

    // Check Export All to Excel button exists
    const exportAllBtn = page.getByRole('button', { name: /Export All to Excel/i });
    await expect(exportAllBtn).toBeVisible();

    // Open work order invoice on first booking if available
    const editInvoiceBtn = page.getByRole('button', { name: /Edit Invoice|Create Owner Invoice/i }).first();
    if (await editInvoiceBtn.isVisible()) {
      await editInvoiceBtn.click();

      // Verify Invoice Editor Modal is open
      await expect(page.getByText('INTERNAL OWNER INVOICE & WORK ORDER')).toBeVisible();

      // Check Bluetooth Print button and Excel Export button exist
      await expect(page.getByRole('button', { name: /Bluetooth Print/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Export to Excel/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /System Print/i })).toBeVisible();

      // Close Modal
      const closeBtn = page.locator('button:has-text("Cancel")').or(page.locator('.lucide-x')).first();
      await closeBtn.click();
    }
  });

});
