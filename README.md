# Playwright Test Generator

## Overview

This app reads test case data from a spreadsheet file and automatically generates Playwright `*.spec.ts` test files for a given target application. The project is written in TypeScript and uses Playwright as the test runner.

---

## Project Structure

```text
testing-prestasiku-kai/
├── data/                        # Place your Excel/CSV test case files here
├── tests/                       # Output folder — generated *.spec.ts files will land here
├── utils/
│   ├── file-reader.ts           # Module to read data from spreadsheet files
│   └── test-generator.ts        # CLI entry point: reads data → writes spec files
├── .env                         # Credentials (BASE_URL, ACCOUNT, PASSWORD) — NOT committed
├── playwright.config.ts         # Playwright configuration
├── package.json
└── tsconfig.json
```

---

## How to Run

Follow these steps to generate and run your tests.

### 1. Prepare your Data

Place your Excel `.xlsx` file containing the test cases inside the `data/` directory.

The expected columns are: `JIRA-ID`, `Sprint`, `Epic / Modul`, `User Story`, `TC ID`, `Judul Test Case`, `Tipe`, `Priority`, `Precondition`, `Test Steps`, `Expected Result`, `Actual Result`, `Status`, `Platform`, `Tested By`, `Tested Date`, `Bug Report Link`, `Notes`.

### 2. Generate Playwright Spec Files

Use the following `npm` command to generate the Playwright specifications. Pass your target Excel file name using `--file` and the target sheet using `--sheet` arguments.

```bash
npm run generate -- --file "your-file-name.xlsx" --sheet "Sheet1"
```

*Example:*
```bash
npm run generate -- --file sample.xlsx --sheet Sheet1
```

After running this, the script will parse the rows and output a new file at `tests/Sheet1.spec.ts`.

### 3. Run Playwright Tests

Once your specs are generated in the `tests/` directory, you can run Playwright and execute them:

```bash
# Run tests headlessly
npm test

# Run tests with the UI Mode enabled
npx playwright test --ui

# Run tests and open the generated HTML report
npx playwright show-report
```
