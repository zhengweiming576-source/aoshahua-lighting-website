// Writes an inquiry (and its line items) to Supabase.
//
// The public anon key is allowed to INSERT into these two tables and nothing
// else — it cannot read them back. So we generate the inquiry id and the
// human-readable reference on the client instead of asking for the row back,
// and we never call .select() after inserting.

import { supabase } from './lib/supabase';
import { CONTACT } from './data';

// Same single source as the rest of the site (content.json → CONTACT.email).
export const SALES_EMAIL = CONTACT.email;

export async function submitInquiry({ lines, customer, ref, attachments = [] }) {
  if (!supabase) {
    throw new Error('The inquiry database is not configured for this build.');
  }
  if (!lines.length) {
    throw new Error('Your inquiry list is empty.');
  }

  const inquiryId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  // Totals and a plain-text breakdown travel with the inquiry row itself, so
  // the notification email can be built from that row alone (a row-level
  // trigger never sees the child rows in inquiry_items). The database trigger
  // recomputes the same numbers, so the two can never drift apart.
  const priced = lines.filter((line) => typeof line.unitPrice === 'number');
  const totalPieces = lines.reduce((total, line) => total + line.quantity, 0);
  const totalEstimate = priced.length
    ? priced.reduce((total, line) => total + line.quantity * line.unitPrice, 0)
    : null;
  const summaryText = lines
    .map((line) => `${line.name}${line.model ? ` (${line.model})` : ''} × ${line.quantity}`)
    .join('; ');

  const { error: headError } = await supabase.from('inquiries').insert({
    id: inquiryId,
    ref,
    company: customer.company || null,
    contact_name: customer.name,
    email: customer.email,
    country: customer.country || null,
    message: customer.message || null,
    currency: 'CNY',
    item_count: lines.length,
    total_pieces: totalPieces,
    total_estimate: totalEstimate,
    summary_text: summaryText,
  });
  if (headError) throw new Error(headError.message);

  // Attachments go in right after the head row (before any line item), so the
  // row-level trigger that fires on the first item already sees them and can
  // forward the files with the notification email.
  //
  // The base64 is handed to submit_inquiry_attachment(), which decodes it on the
  // server. Posting the string straight at the bytea column does NOT work: the
  // text -> bytea cast reads it in escape format, so the table ends up holding
  // the base64 TEXT instead of the file — which is why the backend used to show
  // every attachment as a broken image.
  for (const file of attachments) {
    const { error: attError } = await supabase.rpc('submit_inquiry_attachment', {
      p_inquiry: inquiryId,
      p_name: file.name,
      p_mime: file.mime || null,
      p_data_b64: file.data,
    });
    if (attError) throw new Error(attError.message);
  }

  // PostgREST rejects a bulk insert whose objects do not all share the same
  // keys, so every item sends the full column set (nulls included).
  const items = lines.map((line) => ({
    inquiry_id: inquiryId,
    product_id: String(line.productId),
    product_name: line.name,
    model: line.model || null,
    series: line.series || null,
    quantity: line.quantity,
    unit_price: typeof line.unitPrice === 'number' ? line.unitPrice : null,
    currency: 'CNY',
    line_note: null,
  }));

  const { error: itemError } = await supabase.from('inquiry_items').insert(items);
  if (itemError) throw new Error(itemError.message);

  return { inquiryId, ref };
}
