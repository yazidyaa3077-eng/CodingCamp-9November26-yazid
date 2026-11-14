import { defineConfig } from 'vitest/config';

// Vitest configuration for the Expense & Budget Visualizer.
// - ES module project ("type": "module" in package.json), so config uses ESM syntax.
// - jsdom environment so DOM rendering and interaction tests run in a simulated browser.
// - globals: true lets test files use describe/it/expect without explicit imports.
// - include restricts test discovery to the tests/ directory, keeping js/ to exactly
//   one JavaScript file (Requirement 6.3) and CSS to exactly one file (Requirement 6.2).
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.js'],
  },
});
