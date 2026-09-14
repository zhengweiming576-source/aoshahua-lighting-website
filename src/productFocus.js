// Jumping from the inquiry list back to a product.
//
// The catalogue lives on the home page and owns which product is open, while the
// inquiry list is rendered by a drawer mounted next to it. A DOM event keeps the
// two decoupled: the drawer says "show me this product", the catalogue decides
// how (clear whatever filter is hiding it, scroll the card into view, open the
// detail view on top).
//
// The same jump is also expressed as a plain URL parameter (`?product=<id>`), so
// a link copied out of the inquiry list reopens the same product on load.

const FOCUS_EVENT = 'aoshahua:focus-product';
const PARAM = 'product';

function asId(value) {
  return value == null ? '' : String(value);
}

/** A real, shareable URL for a product. */
export function productHref(productId) {
  return `/?${PARAM}=${encodeURIComponent(asId(productId))}`;
}

/** Reads the product id out of a URL — or out of the current location. */
export function productIdFromUrl(href) {
  try {
    const url = new URL(href || window.location.href, window.location.origin);
    const value = url.searchParams.get(PARAM);
    return value ? value : '';
  } catch (err) {
    return '';
  }
}

/**
 * Asks the catalogue to show a product. The URL is synced on a best-effort
 * basis only — the jump must never depend on the history API being available.
 */
export function focusProduct(productId) {
  const id = asId(productId);
  if (!id) return;
  try {
    window.history.replaceState(null, '', productHref(id));
  } catch (err) {
    /* ignore: some embedded webviews block history writes */
  }
  document.dispatchEvent(new CustomEvent(FOCUS_EVENT, { detail: { productId: id } }));
}

/** Drops `?product=` again once the buyer closes the detail view. */
export function clearFocusedProduct() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(PARAM)) return;
    url.searchParams.delete(PARAM);
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  } catch (err) {
    /* ignore */
  }
}

/** Subscribes to "show this product" requests. Returns an unsubscribe function. */
export function onFocusProduct(handler) {
  const listener = (event) => handler(asId(event && event.detail ? event.detail.productId : ''));
  document.addEventListener(FOCUS_EVENT, listener);
  return () => document.removeEventListener(FOCUS_EVENT, listener);
}
