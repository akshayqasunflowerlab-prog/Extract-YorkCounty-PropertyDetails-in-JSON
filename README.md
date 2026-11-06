# York County Property Extraction Automation Framework (JSON)

Reusable Playwright + TypeScript framework for searching multiple values in York County Property Viewer 2.0 and saving extracted property information to one JSON report.

## 1. Requirements

- Node.js 18 or newer
- npm
- Visual Studio Code (recommended)
- Access to York County Property Viewer 2.0

## 2. Install

Open this project folder in VS Code, then run:

```bash
npm install
npx playwright install chromium
```

## 3. Configure the URL

1. Copy `.env.example` and rename the copy to `.env`.
2. Open `.env`.
3. Replace `BASE_URL` with the actual York County Property Viewer URL copied from your browser.
4. Save the file.

Example only:

```env
BASE_URL=https://your-actual-property-viewer-url/
HEADLESS=false
INPUT_FILE=test-data/pin-input.json
OUTPUT_FILE=test-results/YorkCounty_PropertyDetails.json
```

Do not use the example URL. Use the actual application URL.

## 4. Add search values

Open `test-data/pin-input.json`. Add values as JSON strings:

```json
{
  "pins": [
    "8200005027100",
    "2600007003700",
    "47000FI0132A0",
    "37000AF0108D0"
  ]
}
```

Important:
- Keep every value inside double quotes.
- Both numeric and alphanumeric values are supported.
- Do not remove leading zeroes.
- Empty strings are recorded as invalid input.
- Duplicate values are recorded as `Duplicate` and skipped.
- Non-string JSON values (for example, an unquoted number) are rejected to prevent accidental formatting changes.

## 5. Run

```bash
npm test
```

To see Chrome:

```bash
npm run test:headed
```

## 6. Output JSON

The default report is:

`test-results/YorkCounty_PropertyDetails.json`

The report contains:
- `generatedAt`: report generation timestamp
- `sourceFile`: input JSON path
- `summary`: totals for passed, failed, invalid and duplicate values
- `results`: one result object per input value, including property rows or error
- `executionSummary`: row-level execution status and timestamps

Each successful result stores `propertyData` as an array of `{ section, field, value }` objects.

## 7. Project structure

```text
York_County_Property_Extraction_JSON_Framework/
├── pages/
│   └── property-viewer.page.ts
├── tests/
│   └── property-extraction.spec.ts
├── utils/
│   ├── pin-input.ts
│   └── json-reporter.ts
├── test-data/
│   └── pin-input.json
├── test-results/
├── .env.example
├── .gitignore
├── package.json
├── playwright.config.ts
├── tsconfig.json
└── README.md
```

## 8. Important implementation notes

- `validatePin()` accepts any non-empty string; there is no numeric-only or fixed-length validation.
- The page object keeps the known working search interaction: fill, Enter, select the matching `PIDN (13-Digit)` suggestion once.
- The page object waits for the Property Information heading and populated property table before extraction.
- Each search is isolated with per-value error handling so one failed lookup does not prevent later values from being attempted.
- Parcel validation checks that a populated `18 Digit Parcel ID Number` field was extracted. It deliberately does not compare a numeric-normalized parcel ID with an alphanumeric search value.
- The application locator and suggestion group name are based on the behavior shared for the current York County viewer. If the site changes, update the page object locators.
