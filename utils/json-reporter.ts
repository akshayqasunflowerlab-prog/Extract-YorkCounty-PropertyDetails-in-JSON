
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ExtractedPropertyRow } from '../pages/property-viewer.page';

export type ResultStatus = 'Passed' | 'Failed' | 'Invalid PIN' | 'Duplicate';

export interface SummaryRecord {
  inputIndex: number;
  pin: string;
  status: ResultStatus;
  records: number;
  message: string;
  startedAt: string;
  completedAt: string;
}

export interface PinResult {
  pin: string;
  status: ResultStatus;
  propertyData: ExtractedPropertyRow[];
  error: string | null;
  startedAt: string;
  completedAt: string;
}

export interface ExtractionReport {
  generatedAt: string;
  sourceFile: string;
  totalInputValues: number;
  summary: {
    total: number;
    passed: number;
    failed: number;
    invalid: number;
    duplicates: number;
  };
  results: PinResult[];
  executionSummary: SummaryRecord[];
}


export async function saveJsonReport(
  outputFile: string,
  report: ExtractionReport
): Promise<string> {
  const outputDir = path.dirname(outputFile);

  await fs.mkdir(outputDir, { recursive: true });

  const uniqueId = randomUUID().replace(/-/g, '').slice(0, 8);

  const outputPath = path.join(
    outputDir,
    `YorkCounty-PropertyDetails-${uniqueId}.json`
  );

  await fs.writeFile(
    outputPath,
    JSON.stringify(report, null, 2),
    'utf8'
  );

  console.log(`JSON report saved: ${outputPath}`);

  return outputPath;
}