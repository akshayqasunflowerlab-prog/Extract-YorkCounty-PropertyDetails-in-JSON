import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import dotenv from 'dotenv';
import { PropertyViewerPage, ExtractedPropertyRow } from '../pages/property-viewer.page';
import { readPinsFromJson } from '../utils/pin-input';
import {
  ExtractionReport,
  PinResult,
  ResultStatus,
  SummaryRecord,
  saveJsonReport
} from '../utils/json-reporter';

dotenv.config();

const BASE_URL = process.env.BASE_URL;
const INPUT_FILE = path.resolve(process.env.INPUT_FILE || 'test-data/pin-input.json');
const OUTPUT_FILE = path.resolve(process.env.OUTPUT_FILE || 'test-results/YorkCounty_PropertyDetails.json');

function validateReturnedParcelId(
  pin: string,
  rows: ExtractedPropertyRow[]
): string | null {
  const parcelIdRow = rows.find(row =>
    /18 Digit Parcel ID Number/i.test(row.field)
  );

  if (!parcelIdRow || !parcelIdRow.value.trim()) {
    return `Could not validate search value "${pin}": Parcel ID was missing or empty.`;
  }

  // Do not apply numeric-only or 13-digit assumptions to the requested search value.
  // This verifies that the property result contains a populated parcel identifier.
  return null;
}

test('Extract property details for all PINs from JSON input', async ({ page }, testInfo) => {
  test.setTimeout(10 * 60 * 1000);

  if (!BASE_URL || BASE_URL.includes('REPLACE-WITH')) {
    throw new Error('Set BASE_URL in your .env file to the York County Property Viewer 2.0 URL.');
  }

  const input = await readPinsFromJson(INPUT_FILE);
  const executionSummary: SummaryRecord[] = [];
  const results: PinResult[] = [];

  for (const invalid of input.errors) {
    const now = new Date().toISOString();
    executionSummary.push({
      inputIndex: invalid.rowNumber,
      pin: String(invalid.rawValue ?? ''),
      status: 'Invalid PIN',
      records: 0,
      message: invalid.message,
      startedAt: now,
      completedAt: now
    });
    results.push({
      pin: String(invalid.rawValue ?? ''),
      status: 'Invalid PIN',
      propertyData: [],
      error: invalid.message,
      startedAt: now,
      completedAt: now
    });
  }

  if (input.rows.length === 0) {
    const report: ExtractionReport = {
      generatedAt: new Date().toISOString(),
      sourceFile: INPUT_FILE,
      totalInputValues: input.errors.length,
      summary: { total: executionSummary.length, passed: 0, failed: 0, invalid: input.errors.length, duplicates: 0 },
      results,
      executionSummary
    };
    await saveJsonReport(OUTPUT_FILE, report);
    await testInfo.attach(path.basename(OUTPUT_FILE), {
      path: OUTPUT_FILE,
      contentType: 'application/json'
    });
    throw new Error(`No non-empty string PINs were found in ${INPUT_FILE}. Check the JSON input file.`);
  }

  const seenPins = new Set<string>();
  const viewer = new PropertyViewerPage(page);
  await viewer.open(BASE_URL);

  for (const item of input.rows) {
    const startedAt = new Date().toISOString();

    if (seenPins.has(item.pin)) {
      const now = new Date().toISOString();
      executionSummary.push({
        inputIndex: item.rowNumber,
        pin: item.pin,
        status: 'Duplicate',
        records: 0,
        message: 'Duplicate search value in input JSON; skipped to avoid repeated extraction.',
        startedAt,
        completedAt: now
      });
      results.push({
        pin: item.pin,
        status: 'Duplicate',
        propertyData: [],
        error: 'Duplicate search value; skipped.',
        startedAt,
        completedAt: now
      });
      continue;
    }
    seenPins.add(item.pin);

    await test.step(`Extract search value ${item.pin}`, async () => {
      let rows: ExtractedPropertyRow[] = [];
      let status: ResultStatus = 'Passed';
      let message = '';

      try {
        await viewer.searchAndSelectPin(item.pin);
        rows = await viewer.extractPropertyRows();

        const validationError = validateReturnedParcelId(item.pin, rows);
        if (validationError) {
          status = 'Failed';
          message = validationError;
        }
      } catch (error) {
        status = 'Failed';
        message = error instanceof Error ? error.message : String(error);

        const screenshot = await page.screenshot({ fullPage: true }).catch(() => undefined);
        if (screenshot) {
          await testInfo.attach(`failure-${item.pin}.png`, {
            body: screenshot,
            contentType: 'image/png'
          });
        }
      }

      const completedAt = new Date().toISOString();
      executionSummary.push({
        inputIndex: item.rowNumber,
        pin: item.pin,
        status,
        records: rows.length,
        message,
        startedAt,
        completedAt
      });
      results.push({
        pin: item.pin,
        status,
        propertyData: rows,
        error: message || null,
        startedAt,
        completedAt
      });
    });
  }

  const passed = results.filter(result => result.status === 'Passed').length;
  const failed = results.filter(result => result.status === 'Failed').length;
  const invalid = results.filter(result => result.status === 'Invalid PIN').length;
  const duplicates = results.filter(result => result.status === 'Duplicate').length;

  const report: ExtractionReport = {
    generatedAt: new Date().toISOString(),
    sourceFile: INPUT_FILE,
    totalInputValues: input.rows.length + input.errors.length,
    summary: {
      total: results.length,
      passed,
      failed,
      invalid,
      duplicates
    },
    results,
    executionSummary
  };

  const generatedReportPath = await saveJsonReport(OUTPUT_FILE, report);

  const attachmentName = path.basename(generatedReportPath);

  await testInfo.attach(attachmentName, {
    path: generatedReportPath,
    contentType: 'application/json'
  });

  console.log(`Extraction complete. Total: ${results.length}; Passed: ${passed}; Failed: ${failed}; Invalid: ${invalid}; Duplicates: ${duplicates}`);
  console.log(`JSON output: ${OUTPUT_FILE}`);

  expect(failed + invalid, 'One or more search values failed. Review the attached JSON report.').toBe(0);
});
