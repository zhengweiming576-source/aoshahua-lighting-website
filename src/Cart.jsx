import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Minus, Paperclip, Plus, ShoppingCart, Trash2, X } from 'lucide-react';
import {
  addToCart,
  cartSummary,
  clearCart,
  closeCart,
  dismissNotice,
  minOfLine,
  minQtyOf,
  newInquiryRef,
  notifyMoq,
  openCart,
  PLACEHOLDER_IMG,
  removeFromCart,
  setQuantity,
  useCart,
  restoreLines,
} from './cartStore';
import { SALES_EMAIL, submitInquiry } from './inquiry';
import { PRODUCTS } from './data';
import { focusProduct, productHref } from './productFocus';
import {
  addToHistory,
  clearHistory,
  clearProfile,
  dismissStrip,
  saveProfile,
  useBuyerMemory,
} from './buyerProfile';

const FREIGHT_NOTE =
  'Shipping is not included. Freight depends on destination, volume and packing, so it is quoted separately and agreed with our sales team.';

// File sizes the way a buyer reads them: KB below a megabyte, MB above it.
function formatSize(bytes) {
  if (!bytes) return '0 KB';
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// Which ids still exist in the catalogue — a historical inquiry may point at a
// product that has since been removed, and then its name stays plain text.
const CATALOG_IDS = new Set(PRODUCTS.map((product) => String(product.id)));

/* The product name inside an inquiry, turned into a link back to the catalogue.
   A normal click hands the jump to the catalogue (which opens the product detail
   view in place); Cmd/Ctrl-click still follows the shareable ?product= URL. */
function ProductJump({ line }) {
  const id = String(line.productId || '');
  const label = line.name || 'Product';
  if (!id || !CATALOG_IDS.has(id)) return label;
  return (
    <a
      className="product-link"
      href={productHref(id)}
      title={`View ${label} in the catalogue`}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        closeCart();
        // Let the drawer finish closing (it hands page scrolling back) before
        // the catalogue scrolls the matching card into view.
        window.requestAnimationFrame(() => focusProduct(id));
      }}
    >
      {label}
    </a>
  );
}

/* ---------------------------------------------------------------- header icon */
export function CartButton({ className = '' }) {
  const { lines } = useCart();
  const { pieces } = cartSummary(lines);
  return (
    <button
      type="button"
      className={`cartbtn ${className}`.trim()}
      onClick={openCart}
      aria-label={lines.length ? `Inquiry list: ${lines.length} products, ${pieces} pieces` : 'Inquiry list, empty'}
    >
      <ShoppingCart size={17} aria-hidden="true" />
      {lines.length ? <span className="cartbtn__badge">{lines.length}</span> : null}
    </button>
  );
}

/* ------------------------------------------------- add-to-list button (cards) */
export function AddToCartButton({ product, variant = 'card' }) {
  const { lines } = useCart();
  const inList = lines.some((line) => line.productId === String(product.id));
  return (
    <button
      type="button"
      className={`addbtn addbtn--${variant}${inList ? ' is-in' : ''}`}
      onClick={(event) => {
        event.stopPropagation();
        addToCart(product, minQtyOf(product));
      }}
      aria-label={`Add ${product.name} to the inquiry list`}
    >
      <Plus size={13} aria-hidden="true" />
      {inList ? 'In list' : variant === 'detail' ? 'Add to inquiry list' : 'Add'}
    </button>
  );
}

/* The quantity stepper inside a basket line.
   The input keeps its own `draft` while the buyer is typing. It cannot read the
   value straight from the store: React snaps a controlled input back to its prop
   after every keystroke, so clearing the box would instantly refill with the old
   number and "clear then type 35" would land as 12135. The draft is only folded
   back into the cart on blur (or on the ± buttons). */
function QuantityStepper({ line }) {
  const min = minOfLine(line);
  const [draft, setDraft] = useState(null);
  const shown = draft == null ? String(line.quantity) : draft;

  const draftNumber = Math.round(Number(draft));
  const useDraft = draft != null && Number.isFinite(draftNumber) && draftNumber > 0;

  function stepBy(delta) {
    // Continue from what the buyer can see in the box, then hand the result to the
    // store, which refuses (and explains) anything under the minimum.
    const base = useDraft ? draftNumber : line.quantity;
    setDraft(null);
    setQuantity(line.productId, base + delta);
  }

  return (
    <div className="stepper">
      <button type="button" onClick={() => stepBy(-1)} aria-label="Decrease quantity">
        <Minus size={13} />
      </button>
      <input
        type="number"
        min={min}
        value={shown}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => {
          setDraft(null);
          setQuantity(line.productId, event.target.value, { clamp: true });
        }}
        aria-label={`Quantity for ${line.name}`}
      />
      <button type="button" onClick={() => stepBy(1)} aria-label="Increase quantity">
        <Plus size={13} />
      </button>
    </div>
  );
}

/* ------------------------------------------------- the minimum-order popup */
/* Mounted outside the drawer on purpose: the same popup has to answer a click
   that came from the catalogue grid or from the product detail view, where the
   drawer may never have been opened. */
export function MoqNotice() {
  const { notice } = useCart();

  useEffect(() => {
    if (!notice) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') dismissNotice();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [notice]);

  if (!notice) return null;
  return (
    <div className="moqmodal" role="alertdialog" aria-modal="true" aria-labelledby="moqmodal-title">
      <div className="moqmodal__card">
        <h3 id="moqmodal-title">Minimum order {notice.min} pcs</h3>
        <p>
          <strong>{notice.name}</strong> is quoted from a minimum of <strong>{notice.min} pcs</strong>. Please
          enter {notice.min} pcs or more — smaller runs are not something we can quote.
        </p>
        <button type="button" className="btn btn--accent" onClick={dismissNotice}>
          Got it
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ the drawer */
export function CartDrawer() {
  const { lines, open } = useCart();
  const summary = cartSummary(lines);
  const [form, setForm] = useState({ company: '', name: '', email: '', country: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);
  const buyer = useBuyerMemory();
  const [prefilled, setPrefilled] = useState(false);
  // Optional attachments: project photos, spec sheets, drawings, spreadsheets.
  // 20 MB a file covers phone photos and exported PDFs; the per-inquiry cap stops
  // a single submission from filling the database.
  const MAX_FILES = 5;
  const MAX_FILE_BYTES = 20 * 1024 * 1024;
  const MAX_TOTAL_BYTES = 40 * 1024 * 1024;
  const [files, setFiles] = useState([]);
  const [fileError, setFileError] = useState('');

  function addFiles(list) {
    setFileError('');
    const incoming = Array.from(list || []);
    const next = [...files];
    let total = next.reduce((sum, f) => sum + f.size, 0);
    for (const f of incoming) {
      if (next.length >= MAX_FILES) {
        setFileError(`Up to ${MAX_FILES} files per inquiry — anything more can go in the message or on WhatsApp.`);
        break;
      }
      if (f.size > MAX_FILE_BYTES) {
        setFileError(`"${f.name}" is ${formatSize(f.size)} — we can take up to ${formatSize(MAX_FILE_BYTES)} per file. Send the bigger one on WhatsApp and we will add it to your inquiry.`);
        continue;
      }
      if (total + f.size > MAX_TOTAL_BYTES) {
        setFileError(`Attachments are capped at ${formatSize(MAX_TOTAL_BYTES)} per inquiry — remove one, or send the rest on WhatsApp.`);
        break;
      }
      total += f.size;
      next.push(f);
    }
    setFiles(next);
  }

  function removeFile(index) {
    setFiles((prev) => prev.filter((_f, i) => i !== index));
    setFileError('');
  }

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') closeCart();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // The confirmation screen must not outlive the send: clear it when the
  // drawer is closed, and drop back to the list as soon as the buyer adds
  // something new.
  useEffect(() => {
    if (!open) setDone(null);
  }, [open]);
  useEffect(() => {
    if (lines.length) setDone(null);
  }, [lines.length]);

  // Pre-fill the form from what this buyer submitted last time, so a repeat
  // inquiry is one click. Only empty fields are touched, and everything stays
  // editable — the saved copy lives in this browser only.
  useEffect(() => {
    if (!open) return;
    const saved = buyer.profile;
    if (!saved.name && !saved.email) return;
    setForm((prev) => ({
      company: prev.company || saved.company || '',
      name: prev.name || saved.name || '',
      email: prev.email || saved.email || '',
      country: prev.country || saved.country || '',
      message: prev.message || saved.message || '',
    }));
    setPrefilled(true);
  }, [open, buyer.profile]);

  if (!open) return null;

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (!form.company.trim() || !form.name.trim() || !form.email.trim()) {
      setError('Please add your company, WhatsApp number and email so we can send the quotation.');
      return;
    }
    // Last line of defence: a basket edited down below a minimum must not go out
    // as an inquiry we would only have to decline.
    const belowMinimum = lines.find((line) => line.quantity < minOfLine(line));
    if (belowMinimum) {
      notifyMoq(belowMinimum.name, minOfLine(belowMinimum));
      return;
    }
    setBusy(true);
    const ref = newInquiryRef();
    const submitted = lines;
    try {
      // Read the chosen files as base64 first — if a read fails we want to
      // know before anything is written to the database.
      const attachments = await Promise.all(
        files.map(
          (f) =>
            new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                const dataUrl = String(reader.result || '');
                const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
                resolve({ name: f.name, mime: f.type, data: base64 });
              };
              reader.onerror = () => reject(new Error(`Could not read "${f.name}".`));
              reader.readAsDataURL(f);
            })
        )
      );
      await submitInquiry({ lines: submitted, customer: form, ref, attachments });
      // Keep the buyer's own details and a short history on THEIR device, so the
      // next inquiry arrives pre-filled and they can re-order in one click.
      saveProfile(form);
      addToHistory({
        ref,
        at: Date.now(),
        lineCount: submitted.length,
        pieces: submitted.reduce((total, line) => total + line.quantity, 0),
        lines: submitted,
      });
      clearCart();
      setDone({ ref, lines: submitted });
      setForm({ company: '', name: '', email: '', country: '', message: '' });
      setFiles([]);
    } catch (err) {
      setError(err && err.message ? err.message : 'Could not send the inquiry. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cart-root" data-component="inquiry-cart">
      <div className="cart-scrim" onClick={closeCart} role="presentation" />
      <aside className="cart-drawer" role="dialog" aria-modal="true" aria-label="Inquiry list">
        <header className="cart-drawer__head">
          <h2>Inquiry list</h2>
          <button type="button" className="iconbtn" onClick={closeCart} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        {done ? (
          <div className="cart-done">
            <CheckCircle2 size={38} aria-hidden="true" />
            <h3>Inquiry sent</h3>
            <p>
              Your reference is <strong>{done.ref}</strong>. Our sales team will review the items and reply
              within 1 business day with pricing and freight.
            </p>
            <div className="cart-done__items">
              <h4>What you asked us to quote</h4>
              <LineItems lines={done.lines} />
            </div>
            <p className="cart-done__note">
              A copy goes to {SALES_EMAIL}. Freight is quoted separately and agreed with the sales team.
            </p>
            <button type="button" className="btn btn--primary" onClick={closeCart}>
              Continue browsing
            </button>
          </div>
        ) : lines.length === 0 ? (
          <>
            <div className="cart-empty">
              <ShoppingCart size={30} aria-hidden="true" />
              <p>Your inquiry list is empty.</p>
              <p className="cart-empty__hint">
                Add the models you are interested in and we will quote them together — one inquiry, one reply.
              </p>
            </div>
            <InquiryHistory history={buyer.history} onRestore={restoreLines} onClear={clearHistory} />
          </>
        ) : (
          <>
            <div className="cart-lines">
              {lines.map((line) => (
                <div className="cart-line" key={line.productId}>
                  <img className="cart-line__img" src={line.image} alt="" loading="lazy" />
                  <div className="cart-line__body">
                    <p className="cart-line__name">
                      <ProductJump line={line} />
                    </p>
                    <p className="cart-line__meta">
                      {line.model ? <span>{line.model}</span> : null}
                      <span>Made to order · Priced on request</span>
                    </p>
                    <div className="cart-line__bottom">
                      <QuantityStepper line={line} />
                      <span className="cart-line__total">Inquiry only</span>
                      <button
                        type="button"
                        className="cart-line__del"
                        onClick={() => removeFromCart(line.productId)}
                        aria-label={`Remove ${line.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="cart-summary">
              <div className="cart-summary__row">
                <span>
                  {summary.lineCount} {summary.lineCount === 1 ? 'model' : 'models'} · {summary.pieces} pieces selected
                </span>
              </div>
              <p className="cart-summary__hint">Quantity is up to you — our team quotes by destination and volume.</p>
              <p className="cart-summary__freight">{FREIGHT_NOTE}</p>
            </div>

            <form className="cart-form" onSubmit={handleSubmit}>
              <h3>Where should we send the quotation?</h3>
              {prefilled ? (
                <p className="cart-form__prefill">
                  We filled in the contact details you used last time — change anything you need, or{' '}
                  <button
                    type="button"
                    className="linkbtn"
                    onClick={() => {
                      clearProfile();
                      setPrefilled(false);
                      setForm({ company: '', name: '', email: '', country: '', message: '' });
                      setFiles([]);
                    }}
                  >
                    clear the saved details
                  </button>
                  .
                </p>
              ) : null}
              <div className="cart-form__grid">
                <label>
                  <span>Company *</span>
                  <input type="text" value={form.company} onChange={set('company')} required />
                </label>
                <label>
                  <span>WhatsApp number *</span>
                  <input
                    type="tel"
                    value={form.name}
                    onChange={set('name')}
                    required
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="+86 138 0000 0000"
                  />
                </label>
                <label>
                  <span>Email *</span>
                  <input type="email" value={form.email} onChange={set('email')} required />
                </label>
                <label>
                  <span>Country / port</span>
                  <input type="text" value={form.country} onChange={set('country')} placeholder="Helps us quote freight" />
                </label>
              </div>
              <label className="cart-form__wide">
                <span>Message</span>
                <textarea rows={3} value={form.message} onChange={set('message')} placeholder="Finishes, sizes, target quantity, delivery date…" />
              </label>

              <div className="cart-form__wide cart-attach">
                <span className="cart-attach__label">
                  <Paperclip size={14} aria-hidden="true" /> Attachments{' '}
                  <em>
                    (optional — photos, drawings, specs, PDF, Word, Excel · up to {MAX_FILES} files,{' '}
                    {formatSize(MAX_FILE_BYTES)} each)
                  </em>
                </span>
                <label className="cart-attach__pick">
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.dwg,.dxf"
                    onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
                  />
                  <span className="cart-attach__btn">
                    <Paperclip size={14} aria-hidden="true" /> Choose files
                  </span>
                </label>
                {files.length > 0 ? (
                  <ul className="cart-attach__list">
                    {files.map((f, i) => (
                      <li key={`${f.name}-${i}`}>
                        <span className="cart-attach__name">{f.name}</span>
                        <span className="cart-attach__size">{formatSize(f.size)}</span>
                        <button type="button" className="cart-attach__rm" onClick={() => removeFile(i)} aria-label={`Remove ${f.name}`}>
                          <X size={13} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {fileError ? <p className="cart-form__error">{fileError}</p> : null}
              </div>

              <p className="cart-form__freight">{FREIGHT_NOTE}</p>
              {error ? <p className="cart-form__error">{error}</p> : null}
              <button type="submit" className="btn btn--primary cart-form__submit" disabled={busy}>
                {busy ? <Loader2 size={16} className="spin" aria-hidden="true" /> : null}
                {busy ? 'Sending…' : 'Send inquiry'}
              </button>
            </form>
            <InquiryHistory history={buyer.history} onRestore={restoreLines} onClear={clearHistory} />
          </>
        )}
      </aside>
    </div>
  );
}

/* Slim strip on the page itself, only for a buyer who has submitted before.
   New visitors see nothing, so the public design is untouched. */
export function BuyerWelcomeBar() {
  const buyer = useBuyerMemory();
  const latest = buyer.history[0];
  if (!latest || buyer.dismissed) return null;
  return (
    <div className="welcomebar" data-component="buyer-welcome">
      <div className="container welcomebar__inner">
        <span className="welcomebar__text">
          Welcome back — we kept the details from your inquiry <code>{latest.ref}</code> (
          {new Date(latest.at).toLocaleDateString()}). Your next inquiry will be pre-filled.
        </span>
        <span className="welcomebar__actions">
          <button type="button" className="linkbtn" onClick={openCart}>
            View my inquiries
          </button>
          <button type="button" className="linkbtn" onClick={dismissStrip}>
            Dismiss
          </button>
        </span>
      </div>
    </div>
  );
}

/* What was actually in an inquiry — used by both the sent-confirmation screen
   and the "View items" expansion of a past inquiry, so a buyer can always see
   exactly what they asked to be quoted on. */
function LineItems({ lines }) {
  if (!lines || !lines.length) return null;
  return (
    <ul className="lineitems">
      {lines.map((line) => (
        <li key={line.productId}>
          <img
            className="lineitems__thumb"
            src={line.image || PLACEHOLDER_IMG}
            alt=""
            loading="lazy"
            onError={(event) => {
              // Only swap once — otherwise a missing placeholder loops forever.
              if (event.currentTarget.dataset.fallback) return;
              event.currentTarget.dataset.fallback = '1';
              event.currentTarget.src = PLACEHOLDER_IMG;
            }}
          />
          <span className="lineitems__name">
            <ProductJump line={line} />
            {line.model ? <em> · {line.model}</em> : null}
          </span>
          <span className="lineitems__qty">
            {line.quantity} pcs
          </span>
        </li>
      ))}
    </ul>
  );
}

/* The buyer's own past submissions, read from their browser only. */
function InquiryHistory({ history, onRestore, onClear }) {
  const [openRef, setOpenRef] = useState(null);
  if (!history.length) return null;
  return (
    <section className="cart-history">
      <div className="cart-history__head">
        <h3>Your previous inquiries</h3>
        <button type="button" className="linkbtn" onClick={onClear}>
          Clear history
        </button>
      </div>
      <p className="cart-history__note">Kept in this browser only, so you can re-order in one click.</p>
      <ul>
        {history.map((entry) => {
          const expanded = openRef === entry.ref;
          return (
            <li key={entry.ref}>
              <div className="cart-history__row">
                <div className="cart-history__info">
                  <code>{entry.ref}</code>
                  <span>
                    {new Date(entry.at).toLocaleDateString()} · {entry.lineCount} products · {entry.pieces} pieces
                  </span>
                </div>
                <div className="cart-history__actions">
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    aria-expanded={expanded}
                    onClick={() => setOpenRef(expanded ? null : entry.ref)}
                  >
                    {expanded ? 'Hide items' : 'View items'}
                  </button>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => onRestore(entry.lines)}>
                    Add again
                  </button>
                </div>
              </div>
              {expanded ? <LineItems lines={entry.lines} /> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* Kept for the product drawer: quantity picker + add, in one row. */
export function DetailCartControls({ product }) {
  const min = minQtyOf(product);
  const [qty, setQty] = useState(min);
  // Same reason as the basket line: a controlled input snaps back on every
  // keystroke, so clearing the box has to go through a draft to stay empty.
  const [draft, setDraft] = useState(null);
  const shown = draft == null ? String(qty) : draft;
  const draftNumber = Math.round(Number(draft));
  const base = draft != null && Number.isFinite(draftNumber) && draftNumber > 0 ? draftNumber : qty;

  function stepBy(delta) {
    setDraft(null);
    const next = base + delta;
    if (next < min) {
      notifyMoq(product.name, min);
      return;
    }
    setQty(next);
  }

  return (
    <div className="detail-cart">
      <div className="stepper">
        <button type="button" onClick={() => stepBy(-1)} aria-label="Decrease quantity">
          <Minus size={14} />
        </button>
        <input
          type="number"
          min={min}
          value={shown}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => {
            const value = Math.round(Number(event.target.value));
            setDraft(null);
            if (!Number.isFinite(value) || value < min) {
              notifyMoq(product.name, min);
              setQty(min);
              return;
            }
            setQty(value);
          }}
          aria-label="Quantity"
        />
        <button type="button" onClick={() => stepBy(1)} aria-label="Increase quantity">
          <Plus size={14} />
        </button>
      </div>
      <button type="button" className="btn btn--accent" onClick={() => addToCart(product, qty)}>
        <ShoppingCart size={15} aria-hidden="true" /> Add to inquiry list
      </button>
      <p className="detail-cart__moq">Quantity is up to you — start from 1, we quote by volume.</p>
    </div>
  );
}
