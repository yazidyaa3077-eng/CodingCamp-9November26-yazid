# Implementation Plan: Expense & Budget Visualizer

## Overview

The implementation follows the layered architecture from the design document: pure logic functions (validation, computation, serialization, state operations) are built and property-tested first, then the persistence layer (Local Storage I/O), then the presentation layer (DOM rendering, Canvas pie chart), and finally event handlers and initialization that wire everything together. The app is a zero-dependency, no-build HTML/CSS/Vanilla JS bundle with a single CSS file in `css/` and a single JS file in `js/`. A dev-only test stack (Vitest + fast-check + jsdom) validates the pure logic layer with property-based tests and covers presentation and persistence with unit and integration tests. An optional `manifest.json` enables browser-extension deployment.

All pure functions are `export`ed from `js/app.js` (loaded as an ES module) so the test suite can import them. DOM initialization is guarded so the module can be imported in Node without triggering browser-only code.

## Tasks

- [x] 1. Set up project structure and test framework
  - [x] 1.1 Create directory structure, package.json, and test configuration
    - Create directories: `css/`, `js/`, `icons/`, and `tests/`
    - Create `package.json` with dev dependencies: `vitest`, `fast-check`, `jsdom`
    - Create `vitest.config.js` configuring the `jsdom` environment and ES module support
    - Add an `npm test` script that runs `vitest --run` (single execution, no watch)
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 1.2 Create index.html with all semantic regions and element IDs
    - Create `index.html` referencing `css/style.css` and `js/app.js` (loaded as `<script type="module">`)
    - Include `#balance-display` region at the top
    - Include `#transaction-form` with `#item-name` (text input), `#amount` (number input), `#category` (select with Food, Transport, Fun options), and `#add-button` (submit)
    - Include `#validation-messages` and `#save-error` message areas
    - Include `#transaction-list` scrollable container with an `#empty-state` child element
    - Include `#pie-chart` (`<canvas>`) and `#chart-legend` beside it
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 4.1_

- [x] 2. Implement pure logic layer — validation functions
  - [x] 2.1 Implement validateItemName, validateAmount, validateCategory, and validateTransaction in js/app.js
    - `validateItemName(name)`: returns `{ valid, message }`; valid when trimmed name is 1–100 characters
    - `validateAmount(amount)`: returns `{ valid, message }`; valid when parsed value is a positive number in [0.01, 999999999.99]
    - `validateCategory(category)`: returns `{ valid, message }`; valid when category is one of "Food", "Transport", "Fun"
    - `validateTransaction(input)`: returns `{ valid, errors: { itemName?, amount?, category? } }` combining the three field validators
    - Export all four functions for test-suite import
    - _Requirements: 1.1, 1.4_


- [x] 3. Implement pure logic layer — computation functions
  - [x] 3.1 Implement computeTotalBalance and aggregateByCategory in js/app.js
    - `computeTotalBalance(transactions)`: returns the sum of all `amount` values rounded to 2 decimals via `Math.round(value * 100) / 100`; returns 0 for an empty array
    - `aggregateByCategory(transactions)`: returns `{ Food, Transport, Fun }` with each category total rounded to 2 decimals; categories with no transactions contribute 0
    - Export both functions
    - _Requirements: 3.1, 3.4, 4.1, 4.4_

- [x] 4. Implement pure logic layer — serialization functions
  - [x] 4.1 Implement serializeTransactions and deserializeTransactions in js/app.js
    - `serializeTransactions(transactions)`: returns `JSON.stringify(transactions)`
    - `deserializeTransactions(json)`: returns `{ success, transactions, error }`; on parse failure or invalid entries returns `{ success: false, transactions: [], error }`; never throws
    - Export both functions
    - _Requirements: 5.3, 5.5_


- [x] 5. Implement pure logic layer — state operations
  - [x] 5.1 Implement createTransaction, addTransaction, and deleteTransaction in js/app.js
    - `createTransaction(input)`: returns a `Transaction` with a unique `id` (using `crypto.randomUUID()` with timestamp-plus-random fallback), trimmed `itemName`, rounded `amount`, and validated `category`
    - `addTransaction(state, transaction)`: returns a new array with the transaction appended (immutable — does not mutate the original)
    - `deleteTransaction(state, id)`: returns a new array with the matching `id` removed; if `id` is not found, returns the original array unchanged (immutable)
    - Export all three functions
    - _Requirements: 1.3, 2.3_

  - [x] 5.2 Write property test for add grows list by one
    - **Property 2: Adding a valid transaction grows the list by exactly one and includes it**
    - **Validates: Requirements 1.3**
    - Generate current transaction lists and valid transactions; assert the resulting array length is exactly one greater and contains the added transaction
    - Configure fast-check with `numRuns` ≥ 100
    - Tag with comment: `// Feature: expense-budget-visualizer, Property 2: Adding a valid transaction grows the list by exactly one and includes it`
    - _Requirements: 1.3_


- [x] 6. Checkpoint — ensure all pure logic tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement CSS styling
  - [x] 7.1 Create css/style.css with clean, minimal, responsive interface
    - Style the layout: form at top, balance display prominently above the list, transaction list scrollable with a max height and overflow-y auto, pie chart and legend side by side
    - Set minimum font size of 14 pixels on the root element
    - Make interactive elements (inputs, select, buttons, delete actions) visually distinct from display elements (balance, list rows) using background, border, and hover/focus states
    - Style the empty-state indicator to be centered and muted
    - Ensure the layout is responsive and adapts to narrow widths (extension popup sizing)
    - _Requirements: 7.1_

- [ ] 8. Implement persistence layer
  - [ ] 8.1 Implement saveTransactions and loadTransactions in js/app.js
    - Define `EXPENSE_VISUALIZER_STORAGE_KEY = "expense_visualizer_transactions"`
    - `saveTransactions(transactions)`: serializes and writes to `localStorage`; wraps in try/catch; returns `{ success: false, error }` on `QuotaExceededError` or `SecurityError`; returns `{ success: true, error: null }` on success
    - `loadTransactions()`: reads from `localStorage` and deserializes; returns empty transactions when key is absent, unparseable, or invalid; returns `{ success, transactions, error }`; never throws
    - Guard all `localStorage` access so it does not throw in non-browser (Node test) contexts
    - Export both functions
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [ ] 9. Implement presentation layer
  - [ ] 9.1 Implement renderTransactionList, renderTotalBalance, renderPieChart, and renderAll in js/app.js
    - `renderTransactionList(transactions)`: renders a row for each transaction with item name, amount, and category; toggles `#empty-state` based on `transactions.length === 0`; attaches delete buttons with data-id attributes
    - `renderTotalBalance(transactions)`: calls `computeTotalBalance` and updates `#balance-display`; displays 0 when empty
    - `renderPieChart(transactions)`: calls `aggregateByCategory`; draws pie slices on `#pie-chart` canvas for categories with non-zero totals using fixed colors (Food `#4CAF50`, Transport `#2196F3`, Fun `#FF9800`); draws no slices and shows empty state when total is 0; updates `#chart-legend` with category names, totals, and color swatches
    - `renderAll(transactions)`: calls all three render functions
    - Guard all DOM access so missing elements do not throw
    - _Requirements: 2.1, 2.2, 2.4, 3.1, 3.4, 4.1, 4.4_

  - [ ] 9.2 Implement showFieldError, clearFieldErrors, and showSaveError in js/app.js
    - `showFieldError(field, message)`: displays a validation message for the affected field in `#validation-messages`
    - `clearFieldErrors()`: removes all validation messages before each validation pass
    - `showSaveError(message)`: displays a persistence error message in `#save-error`
    - Guard all DOM access so missing elements do not throw
    - _Requirements: 1.4, 5.4_

  - [ ] 9.3 Write unit tests for rendering
    - Test the form renders with three input fields and three category options (Food, Transport, Fun) — Requirements 1.1, 1.2
    - Test a rendered transaction row contains the item name, amount, and category — Requirement 2.2
    - Test the empty-state indicator shows when the list is empty and hides when non-empty — Requirement 2.4
    - Test `renderTotalBalance` displays 0 for an empty list — Requirement 3.4
    - Test `renderPieChart` draws no slices for an empty list — Requirement 4.4
    - Test save failure surfaces an error message while the transaction stays in the in-memory list — Requirement 5.4
    - Test empty storage on load renders an empty list, zero balance, and no chart slices — Requirement 5.6
    - Use jsdom environment for DOM assertions
    - _Requirements: 1.1, 1.2, 2.2, 2.4, 3.4, 4.4, 5.4, 5.6_

- [ ] 10. Implement event handlers and initialization
  - [ ] 10.1 Implement handleSubmit, handleDelete, and init in js/app.js
    - `handleSubmit(event)`: prevents default; reads form values into `TransactionInput`; calls `validateTransaction`; on invalid calls `showFieldError` for each invalid field and returns; on valid calls `createTransaction` + `addTransaction`, then `saveTransactions` (showing save error if it fails while keeping the transaction in memory), then `renderAll`; clears the form fields
    - `handleDelete(id)`: calls `deleteTransaction` on current state, then `saveTransactions`, then `renderAll`
    - `init()`: calls `loadTransactions` to hydrate state, calls `renderAll`, attaches the form submit listener and delete click delegation; wrapped in a `document` guard so it only runs in a browser
    - _Requirements: 1.3, 1.4, 2.3, 3.2, 3.3, 4.2, 4.3, 5.1, 5.2, 5.3_


- [ ] 11. Implement browser extension support
  - [ ] 11.1 Create manifest.json and placeholder icons
    - Create `manifest.json` with Manifest V3 fields: `manifest_version: 3`, name, version, description, `action.default_popup` pointing to `index.html`, and icon references
    - Create placeholder `icons/icon16.png`, `icons/icon48.png`, and `icons/icon128.png`
    - _Requirements: 6.5_

- [ ] 12. Write smoke tests for structural constraints

- [ ] 13. Final checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP, but property tests are strongly recommended as they validate the pure logic layer against large input spaces.
- Each task references specific requirements for traceability.
- Checkpoints ensure incremental validation — run the full test suite at each checkpoint before proceeding.
- Property tests validate universal correctness properties of the pure logic layer; unit tests validate specific examples and edge cases; integration tests verify wiring and I/O with mocked dependencies; smoke tests verify structural and deployment constraints.
- The test stack (Vitest, fast-check, jsdom) is a dev-only dependency; the shipped application remains a zero-dependency, no-build HTML/CSS/JS bundle.
- All pure functions are `export`ed from `js/app.js` as an ES module; DOM initialization is guarded so the module can be imported in Node for testing without triggering browser-only code.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "7.1", "11.1"] },
    { "id": 2, "tasks": ["3.1", "2.2"] },
    { "id": 3, "tasks": ["4.1", "2.3", "3.2"] },
    { "id": 4, "tasks": ["5.1", "3.3", "4.2"] },
    { "id": 5, "tasks": ["8.1", "4.3", "5.2"] },
    { "id": 6, "tasks": ["9.1", "5.3", "8.2"] },
    { "id": 7, "tasks": ["9.2", "8.3"] },
    { "id": 8, "tasks": ["10.1", "9.3"] },
    { "id": 9, "tasks": ["10.2", "10.3", "12.1"] }
  ]
}
```
