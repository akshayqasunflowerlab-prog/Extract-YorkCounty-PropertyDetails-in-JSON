import { expect, Locator, Page } from '@playwright/test';

export interface ExtractedPropertyRow {
  section: string;
  field: string;
  value: string;
}

export class PropertyViewerPage {
  constructor(private readonly page: Page) { }

  private get searchBox(): Locator {
    return this.page.getByRole('textbox', { name: 'Search' });
  }

  async open(url: string): Promise<void> {
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    await expect(this.page).toHaveTitle(/York County Property Viewer 2\.0/i);

    // Accept the disclaimer only if it is displayed.
    const agreement = this.page.getByRole('checkbox', {
      name: 'I agree to the above terms'
    });
    if (await agreement.isVisible().catch(() => false)) {
      await agreement.check();
      await this.page.getByRole('button', { name: 'OK', exact: true }).click();
    }
    await this.page.waitForLoadState('networkidle');
    await expect(this.searchBox).toBeVisible({ timeout: 60_000 });
  }

  async searchAndSelectPin(pin: string): Promise<void> {
    const searchValue = pin.trim();
    if (!searchValue) {
      throw new Error('PIN cannot be empty.');
    }

    console.log(`\n========== Processing PIN: ${searchValue} ==========`);

    await expect(this.searchBox).toBeVisible({ timeout: 30_000 });
    await expect(this.searchBox).toBeEnabled();

    // Clearing the search also dismisses the previous property's popup in this application.
    await this.searchBox.click();
    await this.searchBox.fill('');
    await this.searchBox.fill(searchValue);
    await this.searchBox.press('Enter');

    const suggestion = this.page
      .getByRole('group', { name: 'PIDN (13-Digit)' })
      .getByRole('option', { name: searchValue, exact: true });

    await expect(suggestion).toBeVisible({ timeout: 30_000 });
    await suggestion.click();

    await this.waitForPropertyDetails();
    console.log(`Property details loaded for search value: ${searchValue}`);
  }

  private async waitForPropertyDetails(): Promise<void> {
    const heading = this.page.getByRole('heading', {
      name: 'Property Information',
      exact: true
    });
    await expect(heading).toBeVisible({ timeout: 60_000 });

    const propertyTable = this.page
      .locator('arcgis-feature-fields')
      .filter({ hasText: '18 Digit Parcel ID Number' })
      .locator('table');

    await expect(propertyTable).toBeVisible({ timeout: 60_000 });
    await expect(propertyTable.locator('tbody tr').first()).toBeVisible({
      timeout: 60_000
    });
  }

  async extractPropertyRows(): Promise<ExtractedPropertyRow[]> {
    const sections = this.page.locator('arcgis-feature-fields');
    await expect(sections.first()).toBeVisible({ timeout: 60_000 });

    const output: ExtractedPropertyRow[] = [];
    const sectionCount = await sections.count();

    for (let i = 0; i < sectionCount; i++) {
      const sectionLocator = sections.nth(i);
      const heading = sectionLocator.locator('h3[role="heading"], h3').first();
      const sectionName = (await heading.innerText().catch(() => `Section ${i + 1}`)).trim();

      const tables = sectionLocator.locator('table');
      const tableCount = await tables.count();

      for (let t = 0; t < tableCount; t++) {
        const rows = tables.nth(t).locator('tbody tr');
        const rowCount = await rows.count();

        for (let r = 0; r < rowCount; r++) {
          const row = rows.nth(r);
          const field = (await row.locator('th').first().innerText().catch(() => '')).trim();
          const value = (await row.locator('td').first().innerText().catch(() => '')).trim();

          if (field || value) {
            output.push({
              section: sectionName || `Section ${i + 1}`,
              field: field || `Row ${r + 1}`,
              value
            });
          }
        }
      }
    }

    if (output.length === 0) {
      throw new Error('No property table rows were found. The page structure may have changed.');
    }

    return output;
  }
}
