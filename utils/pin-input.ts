import fs from 'node:fs/promises';

export interface PinInputRow {
  pin: string;
  rowNumber: number;
}

export interface PinInputResult {
  rows: PinInputRow[];
  errors: Array<{ rowNumber: number; rawValue: unknown; message: string }>;
}

export function validatePin(pin: string): boolean {
  return typeof pin === 'string' && pin.trim().length > 0;
}

/**
 * Reads { "pins": ["PIN-1", "PIN-2"] } from a JSON file.
 * Values are treated as strings; numeric-only PIN validation is not used.
 */
export async function readPinsFromJson(filePath: string): Promise<PinInputResult> {
  const raw = await fs.readFile(filePath, 'utf8');
  const parsed: unknown = JSON.parse(raw);

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !('pins' in parsed) ||
    !Array.isArray((parsed as { pins: unknown }).pins)
  ) {
    throw new Error(`Invalid input JSON: expected an object containing a "pins" array: ${filePath}`);
  }

  const values = (parsed as { pins: unknown[] }).pins;
  const rows: PinInputRow[] = [];
  const errors: PinInputResult['errors'] = [];

  values.forEach((value, index) => {
    const rowNumber = index + 1;

    // Preserve string input exactly apart from surrounding whitespace.
    // Non-string JSON values are rejected so JSON numbers cannot silently lose formatting.
    if (typeof value !== 'string') {
      errors.push({
        rowNumber,
        rawValue: value,
        message: 'PIN must be stored as a JSON string, enclosed in double quotes.'
      });
      return;
    }

    const pin = value.trim();
    if (!validatePin(pin)) {
      errors.push({ rowNumber, rawValue: value, message: 'PIN is empty.' });
      return;
    }

    rows.push({ pin, rowNumber });
  });

  return { rows, errors };
}
