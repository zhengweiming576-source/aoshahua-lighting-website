// AOSHAHUA inquiry cart — client-side RFQ basket.
//
// Buyers never sign in. The basket survives a reload through localStorage and
// carries only what a quotation actually needs: product, quantity and the
// catalogue unit price. Freight is deliberately NOT calculated here — it is
// quoted by the sales team after they see the destination and the volumes.

import { useEffect, useState } from 'react';
import { PRODUCTS } from './data';

const STORAGE_KEY = 'aoshahua.inquiry-cart.v1';
// Showcase build: quantities are free-form, buyers start from 1.
const DEFAULT_MIN_QTY = 1;
export const PLACEHOLDER_IMG = '/assets/images/placeholder.svg';

const listeners = new Set();
// `notice` drives the minimum-order popup; it is UI state only, never persisted.
let state = { lines: read(), open: false, notice: null };

function read() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((line) => line && line.productId)
      // A basket saved before the minimum was enforced may sit below the MOQ, so
      // lift it back up on load — otherwise the buyer could submit a sub-minimum
      // inquiry that we then have to decline.
      .map((line) => ({
        ...line,
        quantity: Math.max(minOfLine(line), Math.round(Number(line.quantity) || 0)),
      }));
  } catch {
    return [];
  }
}

function commit(next) {
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.lines));
  } catch {
    // Storage unavailable (private mode / blocked cookies): the basket still
    // works for the current page view, it just will not survive a reload.
  }
  listeners.forEach((fn) => fn());
}

export function useCart() {
  const [snapshot, setSnapshot] = useState(state);
  useEffect(() => {
    const fn = () => setSnapshot(state);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return snapshot;
}

export function minQtyOf(_product) {
  // No minimums on the showcase build — buyers start from 1.
  return DEFAULT_MIN_QTY;
}

// The minimum that applies to a basket line. Lines carry their own `moq` so the
// rule still holds for a basket restored from an older localStorage payload;
// if it is missing we look the product up in the catalogue.
export function minOfLine(_line) {
  // No minimums on the showcase build — basket quantities are free-form too.
  return DEFAULT_MIN_QTY;
}

// Ask the UI to pop the "minimum order" notice for this product.
export function notifyMoq(name, min) {
  commit({
    ...state,
    notice: { name: String(name || 'This item'), min: Math.round(Number(min) || DEFAULT_MIN_QTY), at: Date.now() },
  });
}

export function dismissNotice() {
  if (!state.notice) return;
  commit({ ...state, notice: null });
}

export function openCart() {
  commit({ ...state, open: true });
}

export function closeCart() {
  commit({ ...state, open: false });
}

export function addToCart(product, quantity) {
  const min = minQtyOf(product);
  const wanted = Math.round(Number(quantity) || min);
  // Below the minimum we tell the buyer instead of silently rounding up.
  if (wanted < min) {
    notifyMoq(product.name, min);
    return;
  }
  const qty = wanted;
  const existing = state.lines.find((line) => line.productId === product.id);
  const lines = existing
    ? state.lines.map((line) =>
        line.productId === product.id ? { ...line, quantity: line.quantity + qty } : line,
      )
    : [
        ...state.lines,
        {
          productId: String(product.id),
          name: product.name,
          model: product.model || '',
          series: product.series || '',
          moq: min,
          unitPrice: null,
          quantity: qty,
          image: product.image || PLACEHOLDER_IMG,
        },
      ];
  commit({ ...state, lines, open: true });
}

// options.silent — the buyer is still typing; accept the partial value (floor 1)
//   without interrupting, the popup would fire on every keystroke.
// options.clamp  — commit now: warn, then pull the value back up to the minimum.
// Neither option → warn and leave the quantity untouched (the "−" button).
export function setQuantity(productId, quantity, options = {}) {
  const line = state.lines.find((item) => item.productId === productId);
  if (!line) return;
  const min = minOfLine(line);
  const parsed = Math.round(Number(quantity));
  let qty = Number.isFinite(parsed) && parsed > 0 ? parsed : null;

  if (qty == null) {
    // Empty box / not a number: the buyer is mid-edit. Store nothing so the empty
    // field stays empty and they can just type the new figure — forcing it to 1
    // here would turn "clear then type 35" into 135.
    if (options.silent) return;
    notifyMoq(line.name, min);
    qty = min;
  } else if (qty < min) {
    if (!options.silent) {
      notifyMoq(line.name, min);
      if (!options.clamp) return;
      qty = min;
    }
  }

  commit({
    ...state,
    lines: state.lines.map((item) => (item.productId === productId ? { ...item, quantity: qty } : item)),
  });
}

// Puts a previously submitted basket back into the cart (used by "add these
// again" on the buyer's own inquiry history). Quantities merge into any line
// that is already present instead of overwriting it.
export function restoreLines(entries) {
  const incoming = Array.isArray(entries) ? entries.filter((entry) => entry && entry.productId) : [];
  if (!incoming.length) return;
  const merged = state.lines.map((line) => ({ ...line }));
  incoming.forEach((entry) => {
    const qty = Math.max(1, Math.round(Number(entry.quantity) || 1));
    const existing = merged.find((line) => line.productId === entry.productId);
    if (existing) existing.quantity += qty;
    else merged.push({ ...entry, quantity: qty });
  });
  commit({ ...state, lines: merged, open: true });
}

export function removeFromCart(productId) {
  commit({ ...state, lines: state.lines.filter((line) => line.productId !== productId) });
}

export function clearCart() {
  commit({ ...state, lines: [] });
}

export function cartSummary(lines) {
  const priced = lines.filter((line) => typeof line.unitPrice === 'number');
  return {
    lineCount: lines.length,
    pieces: lines.reduce((total, line) => total + line.quantity, 0),
    estimate: priced.length ? priced.reduce((total, line) => total + line.quantity * line.unitPrice, 0) : null,
    hasQuoteOnly: priced.length !== lines.length,
    currency: 'CNY',
  };
}

export function formatMoney(value) {
  if (typeof value !== 'number') return null;
  return `¥${value.toLocaleString('en-US')}`;
}

export function newInquiryRef() {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate(),
  ).padStart(2, '0')}`;
  const rand = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `AHA-${stamp}-${rand}`;
}
