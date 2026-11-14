// Expense & Budget Visualizer — application logic.
//
// This module is loaded as an ES module (<script type="module"> in index.html)
// and is also imported directly by the Vitest test suite. The pure logic
// functions (validation, computation, serialization, state operations) are
// exported so tests can import them. Browser-dependent code (DOM mutation,
// Local Storage access, Canvas drawing) is added in later tasks and will be
// guarded so importing this module in Node does not trigger browser-only code.

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// The only categories the application recognizes. Kept as a constant so the
// validation, aggregation, and rendering layers all agree on the category set.
const VALID_CATEGORIES = ['Food', 'Transport', 'Fun'];

// ---------------------------------------------------------------------------
// Validation (pure functions)
// ---------------------------------------------------------------------------
//
// Each field validator returns { valid: boolean, message: string }.
// `message` is an empty string when the field is valid; otherwise it holds a
// human-readable explanation suitable for display under the form field.
//
// validateTransaction combines the three field validators into a single result
// of the shape { valid, errors: { itemName?, amount?, category? } }. The
// `errors` object only contains entries for fields that failed; when every
// field is valid, `errors` is an empty object.

/**
 * Validates the transaction item name.
 *
 * Valid when the trimmed name is between 1 and 100 characters (inclusive).
 * An empty or whitespace-only name, or a name longer than 100 characters
 * after trimming, is invalid.
 *
 * @param {*} name - The raw item name value from the form input.
 * @returns {{ valid: boolean, message: string }}
 */
export function validateItemName(name) {
  if (typeof name !== 'string') {
    return { valid: false, message: 'Item name is required.' };
  }

  const trimmed = name.trim();

  if (trimmed.length === 0) {
    return { valid: false, message: 'Item name is required.' };
  }

  if (trimmed.length > 100) {
    return {
      valid: false,
      message: 'Item name must be 100 characters or fewer.',
    };
  }

  return { valid: true, message: '' };
}

/**
 * Validates the transaction amount.
 *
 * Accepts either a string or a number as input. The value is parsed with
 * `parseFloat`; valid when the parsed value is a positive number within the
 * inclusive range [0.01, 999999999.99]. Non-numeric, NaN, non-positive, or
 * out-of-range values are invalid.
 *
 * @param {*} amount - The raw amount value (string from the input or a number).
 * @returns {{ valid: boolean, message: string }}
 */
export function validateAmount(amount) {
  if (typeof amount !== 'string' && typeof amount !== 'number') {
    return { valid: false, message: 'Amount must be a number.' };
  }

  const parsed = parseFloat(amount);

  if (Number.isNaN(parsed)) {
    return { valid: false, message: 'Amount must be a number.' };
  }

  if (parsed <= 0) {
    return { valid: false, message: 'Amount must be a positive number.' };
  }

  if (parsed < 0.01 || parsed > 999999999.99) {
    return {
      valid: false,
      message: 'Amount must be between 0.01 and 999999999.99.',
    };
  }

  return { valid: true, message: '' };
}

/**
 * Validates the transaction category.
 *
 * Valid only when the category is exactly one of "Food", "Transport", or "Fun".
 *
 * @param {*} category - The raw category value from the form select.
 * @returns {{ valid: boolean, message: string }}
 */
export function validateCategory(category) {
  if (!VALID_CATEGORIES.includes(category)) {
    return {
      valid: false,
      message: 'Category must be Food, Transport, or Fun.',
    };
  }

  return { valid: true, message: '' };
}

/**
 * Validates a complete transaction input, combining the three field validators.
 *
 * Returns { valid, errors } where `valid` is true only when every field is
 * valid. The `errors` object contains a message entry only for the fields that
 * failed validation; fields that passed are omitted. When the whole input is
 * valid, `errors` is an empty object.
 *
 * @param {{ itemName: string, amount: (string|number), category: string }} input
 * @returns {{ valid: boolean, errors: { itemName?: string, amount?: string, category?: string } }}
 */
export function validateTransaction(input) {
  const errors = {};

  const itemNameResult = validateItemName(input.itemName);
  if (!itemNameResult.valid) {
    errors.itemName = itemNameResult.message;
  }

  const amountResult = validateAmount(input.amount);
  if (!amountResult.valid) {
    errors.amount = amountResult.message;
  }

  const categoryResult = validateCategory(input.category);
  if (!categoryResult.valid) {
    errors.category = categoryResult.message;
  }

  const valid =
    itemNameResult.valid && amountResult.valid && categoryResult.valid;

  return { valid, errors };
}

// ---------------------------------------------------------------------------
// Computation (pure functions)
// ---------------------------------------------------------------------------
//
// The computation functions derive derived values (total balance, per-category
// totals) from a list of transactions. They are pure: they read no external
// state, mutate nothing, and depend only on their arguments. Monetary amounts
// are rounded to two decimal places using Math.round(value * 100) / 100 to
// bound floating-point drift, matching the rounding applied on parse.

/**
 * Computes the total balance from a list of transactions.
 *
 * Returns the sum of every transaction's `amount`, rounded to two decimal
 * places via `Math.round(value * 100) / 100`. When the array is empty, returns
 * 0 (so the displayed Total Balance is zero rather than a blank value).
 *
 * @param {Array<{ amount: number }>} transactions - The transactions to sum.
 * @returns {number} The sum of all amounts, rounded to 2 decimals.
 */
export function computeTotalBalance(transactions) {
  const sum = transactions.reduce(
    (total, transaction) => total + transaction.amount,
    0,
  );

  return Math.round(sum * 100) / 100;
}

/**
 * Aggregates transaction totals by category.
 *
 * Returns a `CategoryTotals` object of the shape `{ Food, Transport, Fun }`
 * where each value is the sum of the amounts of all transactions in that
 * category, rounded to two decimal places via `Math.round(value * 100) / 100`.
 * Categories that have no transactions contribute 0, so the result always
 * contains all three keys regardless of the input.
 *
 * @param {Array<{ amount: number, category: string }>} transactions - The transactions to aggregate.
 * @returns {{ Food: number, Transport: number, Fun: number }} Per-category totals.
 */
export function aggregateByCategory(transactions) {
  const totals = { Food: 0, Transport: 0, Fun: 0 };

  for (const transaction of transactions) {
    if (Object.prototype.hasOwnProperty.call(totals, transaction.category)) {
      totals[transaction.category] += transaction.amount;
    }
  }

  totals.Food = Math.round(totals.Food * 100) / 100;
  totals.Transport = Math.round(totals.Transport * 100) / 100;
  totals.Fun = Math.round(totals.Fun * 100) / 100;

  return totals;
}
// ---------------------------------------------------------------------------
// Serialization (pure functions)
// ---------------------------------------------------------------------------

/**
 * Serializes an array of transactions into a JSON string.
 *
 * @param {Array<Object>} transactions
 * @returns {string}
 */
export function serializeTransactions(transactions) {
  return JSON.stringify(transactions);
}

/**
 * Deserializes a JSON string into a validated list of transactions.
 * Never throws; returns { success: false, transactions: [], error } on failure.
 *
 * @param {string} json
 * @returns {{ success: boolean, transactions: Array<Object>, error: string|null }}
 */
export function deserializeTransactions(json) {
  try {
    const parsed = JSON.parse(json);

    if (!Array.isArray(parsed)) {
      return {
        success: false,
        transactions: [],
        error: 'Parsed data is not an array.',
      };
    }

    const isValidEntry = (item) =>
      item !== null &&
      typeof item === 'object' &&
      typeof item.id === 'string' &&
      item.id.trim().length > 0 &&
      validateItemName(item.itemName).valid &&
      typeof item.amount === 'number' &&
      Number.isFinite(item.amount) &&
      validateAmount(item.amount).valid &&
      validateCategory(item.category).valid;

    if (!parsed.every(isValidEntry)) {
      return {
        success: false,
        transactions: [],
        error: 'One or more transaction entries are invalid.',
      };
    }

    return {
      success: true,
      transactions: parsed,
      error: null,
    };
  } catch (err) {
    return {
      success: false,
      transactions: [],
      error: err instanceof Error ? err.message : 'Invalid JSON format.',
    };
  }
}
// ---------------------------------------------------------------------------
// State Operations (pure functions)
// ---------------------------------------------------------------------------

/**
 * Generates a unique ID using crypto.randomUUID() with a timestamp-plus-random fallback.
 *
 * @returns {string}
 */
function generateTransactionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Creates a Transaction object from validated input.
 *
 * @param {{ itemName: string, amount: (string|number), category: string }} input
 * @returns {{ id: string, itemName: string, amount: number, category: string }}
 */
export function createTransaction(input) {
  const trimmedName = String(input.itemName).trim();
  const roundedAmount = Math.round(parseFloat(input.amount) * 100) / 100;
  const category = VALID_CATEGORIES.includes(input.category)
    ? input.category
    : VALID_CATEGORIES[0];

  return {
    id: generateTransactionId(),
    itemName: trimmedName,
    amount: roundedAmount,
    category,
  };
}

/**
 * Returns a new state array with the transaction appended (immutable).
 *
 * @param {Array<Object>} state
 * @param {Object} transaction
 * @returns {Array<Object>}
 */
export function addTransaction(state, transaction) {
  return [...state, transaction];
}

/**
 * Returns a new state array with the matching id removed (immutable).
 * If id is not found, returns the original array unchanged.
 *
 * @param {Array<Object>} state
 * @param {string} id
 * @returns {Array<Object>}
 */
export function deleteTransaction(state, id) {
  const index = state.findIndex((item) => item.id === id);
  if (index === -1) {
    return state;
  }
  return state.filter((item) => item.id !== id);
}

// ---------------------------------------------------------------------------
// Persistence Layer (Task 8.1)
// ---------------------------------------------------------------------------

export const EXPENSE_VISUALIZER_STORAGE_KEY = 'expense_visualizer_transactions';

export function saveTransactions(transactions) {
  try {
    if (typeof localStorage === 'undefined') {
      return { success: false, error: 'localStorage is not available.' };
    }
    const serialized = serializeTransactions(transactions);
    localStorage.setItem(EXPENSE_VISUALIZER_STORAGE_KEY, serialized);
    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save transactions.',
    };
  }
}

export function loadTransactions() {
  try {
    if (typeof localStorage === 'undefined') {
      return { success: true, transactions: [], error: null };
    }
    const raw = localStorage.getItem(EXPENSE_VISUALIZER_STORAGE_KEY);
    if (!raw) {
      return { success: true, transactions: [], error: null };
    }
    const result = deserializeTransactions(raw);
    if (!result.success) {
      return { success: false, transactions: [], error: result.error };
    }
    return { success: true, transactions: result.transactions, error: null };
  } catch (err) {
    return {
      success: false,
      transactions: [],
      error: err instanceof Error ? err.message : 'Failed to load transactions.',
    };
  }
}

// ---------------------------------------------------------------------------
// Presentation Layer (Task 9.1 & 9.2)
// ---------------------------------------------------------------------------

const CATEGORY_COLORS = {
  Food: '#4CAF50',
  Transport: '#2196F3',
  Fun: '#FF9800',
};

function formatCurrency(amount) {
  return Number(amount || 0).toFixed(2);
}

export function renderTransactionList(transactions) {
  if (typeof document === 'undefined') return;

  const listEl = document.getElementById('transaction-list');
  const emptyStateEl = document.getElementById('empty-state');

  if (emptyStateEl) {
    emptyStateEl.style.display = transactions.length === 0 ? 'block' : 'none';
  }

  if (!listEl) return;

  listEl.innerHTML = '';

  transactions.forEach((tx) => {
    const row = document.createElement('li');
    row.className = 'transaction-item';

    const info = document.createElement('div');
    info.className = 'transaction-info';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'transaction-name';
    nameSpan.textContent = tx.itemName;

    const categorySpan = document.createElement('span');
    categorySpan.className = `transaction-category category-${tx.category.toLowerCase()}`;
    categorySpan.textContent = tx.category;

    const amountSpan = document.createElement('span');
    amountSpan.className = 'transaction-amount';
    amountSpan.textContent = `$${formatCurrency(tx.amount)}`;

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.setAttribute('data-id', tx.id);

    info.appendChild(nameSpan);
    info.appendChild(categorySpan);
    row.appendChild(info);
    row.appendChild(amountSpan);
    row.appendChild(deleteBtn);

    listEl.appendChild(row);
  });
}

export function renderTotalBalance(transactions) {
  if (typeof document === 'undefined') return;

  const balanceEl = document.getElementById('balance-display');
  if (!balanceEl) return;

  const total =
    typeof computeTotalBalance === 'function'
      ? computeTotalBalance(transactions)
      : transactions.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  balanceEl.textContent = transactions.length === 0 ? '0' : formatCurrency(total);
}

export function renderPieChart(transactions) {
  if (typeof document === 'undefined') return;

  const canvas = document.getElementById('pie-chart');
  const legendEl = document.getElementById('chart-legend');
  const chartEmptyEl = document.getElementById('chart-empty-state');

  const totals =
    typeof aggregateByCategory === 'function'
      ? aggregateByCategory(transactions)
      : transactions.reduce(
          (acc, tx) => {
            if (acc[tx.category] !== undefined) {
              acc[tx.category] += Number(tx.amount || 0);
            }
            return acc;
          },
          { Food: 0, Transport: 0, Fun: 0 }
        );

  const grandTotal = Object.values(totals).reduce((sum, val) => sum + val, 0);

  if (chartEmptyEl) {
    chartEmptyEl.style.display = grandTotal === 0 ? 'block' : 'none';
  }

  if (canvas && typeof canvas.getContext === 'function') {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (grandTotal > 0) {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 10;
        let startAngle = -Math.PI / 2;

        VALID_CATEGORIES.forEach((category) => {
          const value = totals[category] || 0;
          if (value <= 0) return;

          const sliceAngle = (value / grandTotal) * 2 * Math.PI;
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
          ctx.closePath();
          ctx.fillStyle = CATEGORY_COLORS[category] || '#999999';
          ctx.fill();

          startAngle += sliceAngle;
        });
      }
    }
  }

  if (legendEl) {
    legendEl.innerHTML = '';
    VALID_CATEGORIES.forEach((category) => {
      const value = totals[category] || 0;
      const item = document.createElement('div');
      item.className = 'legend-item';

      const swatch = document.createElement('span');
      swatch.className = 'legend-swatch';
      swatch.style.backgroundColor = CATEGORY_COLORS[category];

      const label = document.createElement('span');
      label.className = 'legend-label';
      label.textContent = `${category}: $${formatCurrency(value)}`;

      item.appendChild(swatch);
      item.appendChild(label);
      legendEl.appendChild(item);
    });
  }
}

export function renderAll(transactions) {
  renderTransactionList(transactions);
  renderTotalBalance(transactions);
  renderPieChart(transactions);
}

export function showFieldError(field, message) {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('validation-messages');
  if (!container) return;

  const p = document.createElement('p');
  p.className = `validation-error error-${field}`;
  p.textContent = message;
  container.appendChild(p);
}

export function clearFieldErrors() {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('validation-messages');
  if (container) {
    container.innerHTML = '';
  }
}

export function showSaveError(message) {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('save-error');
  if (!el) return;

  if (!message) {
    el.textContent = '';
    el.style.display = 'none';
  } else {
    el.textContent = message;
    el.style.display = 'block';
  }
}

// ---------------------------------------------------------------------------
// Event Handlers & Initialization (Task 10.1)
// ---------------------------------------------------------------------------

let currentTransactions = [];

export function handleSubmit(event) {
  if (event && typeof event.preventDefault === 'function') {
    event.preventDefault();
  }
  if (typeof document === 'undefined') return;

  clearFieldErrors();
  showSaveError('');

  const form = document.getElementById('transaction-form');
  const itemNameInput = document.getElementById('item-name');
  const amountInput = document.getElementById('amount');
  const categoryInput = document.getElementById('category');

  const input = {
    itemName: itemNameInput ? itemNameInput.value : '',
    amount: amountInput ? amountInput.value : '',
    category: categoryInput ? categoryInput.value : '',
  };

  const validation = validateTransaction(input);
  if (!validation.valid) {
    Object.entries(validation.errors).forEach(([field, message]) => {
      showFieldError(field, message);
    });
    return;
  }

  const newTx = createTransaction(input);
  currentTransactions = addTransaction(currentTransactions, newTx);

  const saveResult = saveTransactions(currentTransactions);
  if (!saveResult.success) {
    showSaveError(saveResult.error || 'Failed to save transaction.');
  }

  renderAll(currentTransactions);

  if (form && typeof form.reset === 'function') {
    form.reset();
  }
}

export function handleDelete(id) {
  showSaveError('');
  currentTransactions = deleteTransaction(currentTransactions, id);

  const saveResult = saveTransactions(currentTransactions);
  if (!saveResult.success) {
    showSaveError(saveResult.error || 'Failed to save changes.');
  }

  renderAll(currentTransactions);
}

export function init() {
  if (typeof document === 'undefined') return;

  const loaded = loadTransactions();
  currentTransactions = loaded.transactions || [];
  if (!loaded.success && loaded.error) {
    showSaveError(loaded.error);
  }

  renderAll(currentTransactions);

  const form = document.getElementById('transaction-form');
  if (form) {
    form.addEventListener('submit', handleSubmit);
  }

  const listEl = document.getElementById('transaction-list');
  if (listEl) {
    listEl.addEventListener('click', (event) => {
      const target = event.target;
      if (target && target.matches('.delete-btn')) {
        const id = target.getAttribute('data-id');
        if (id) {
          handleDelete(id);
        }
      }
    });
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}