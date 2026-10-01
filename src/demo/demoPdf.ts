/**
 * Demo only: the invoice PDF, drawn in the browser.
 *
 * On the live site invoicePdf.ts draws it on the server. The demo has no
 * server, so this draws the same layout — same fonts, colours, columns and
 * figures — with jsPDF. Paul's private notes are left out, as on the live copy.
 * Never imported by the live site: only the demo server uses it.
 */
import { jsPDF } from 'jspdf';
import { balanceDue } from '../utils/invoiceMath';
import type { InternalInvoice } from '../types';

export interface DemoPdfShop { name: string; address: string; phone: string; email: string }
export interface DemoPdfCustomer { name: string; phone: string; email: string; ticketNumber: string; bike: string }

const money = (n: number) => `$${n.toFixed(2)}`;
// The built-in PDF fonts cover Windows-1252 only — the same rule as the live PDF.
const CP1252_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
const drawable = (s: string) =>
  (s || '').replace(/−/g, '-').replace(/[^\x20-\x7E\xA0-\xFF]/gu, (ch) => (CP1252_EXTRA.includes(ch) ? ch : '?'));
const METHOD: Record<string, string> = { shopify: 'Online', cash: 'Cash', check: 'Check', card_in_person: 'Card', other: 'Other' };

export function renderDemoInvoicePdf(inv: InternalInvoice, shop: DemoPdfShop, customer: DemoPdfCustomer): Blob {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  doc.setProperties({ title: `Invoice ${inv.invoiceNumber} — ${shop.name}`, author: shop.name });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const left = 50;
  const right = pageW - 50;
  const width = right - left;
  const ink = '#18181b';
  const orange = '#ea580c';
  const grey = '#52525b';
  const font = (bold: boolean, size: number, color: string) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(color);
  };
  // jsPDF's built-in fonts drop long dashes and curly quotes; draw plain ones.
  const plain = (s: string) => s.replace(/[—–]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  const text = (s: string, x: number, y: number, align: 'left' | 'right' | 'center' = 'left') =>
    doc.text(plain(s), x, y, { baseline: 'top', align });

  // Shop, top left
  font(true, 20, ink); text(shop.name.toUpperCase(), left, 50);
  font(false, 9, grey); text(shop.address, left, 76); text(`${shop.phone}  ·  ${shop.email}`, left, 88);

  // Invoice block, top right
  font(true, 20, orange); text('INVOICE', right, 50, 'right');
  font(false, 9, grey);
  text(`Invoice ${inv.invoiceNumber}`, right, 76, 'right');
  text(`Date ${inv.createdDate || new Date().toISOString().slice(0, 10)}`, right, 88, 'right');
  text(`Ticket ${customer.ticketNumber}`, right, 100, 'right');

  doc.setDrawColor(ink); doc.setLineWidth(1.5); doc.line(left, 118, right, 118);

  // Customer and bike
  font(true, 8, orange); text('BILL TO', left, 130); text('MOTORCYCLE', left + width / 2, 130);
  font(false, 10, ink); text(drawable(customer.name), left, 142); text(drawable(customer.bike) || '—', left + width / 2, 142);
  font(false, 9, grey); text(drawable([customer.phone, customer.email].filter(Boolean).join('  ·  ')), left, 156);

  // Lines
  const col = { desc: left, qty: left + width * 0.6, rate: left + width * 0.72, amt: left + width * 0.86 };
  let y = 190;
  const header = () => {
    doc.setFillColor('#f4f4f5'); doc.rect(left, y, width, 18, 'F');
    font(true, 8, grey);
    text('DESCRIPTION', col.desc + 6, y + 5);
    text('QTY', col.rate - 8, y + 5, 'right');
    text('RATE', col.amt - 8, y + 5, 'right');
    text('AMOUNT', right - 6, y + 5, 'right');
    y += 24;
  };
  header();
  for (const it of inv.items) {
    font(false, 9.5, ink);
    const lines: string[] = doc.splitTextToSize(drawable(it.description), col.qty - col.desc - 16);
    const h = lines.length * 11.5;
    if (y + h > pageH - 200) { doc.addPage(); y = 50; header(); font(false, 9.5, ink); }
    doc.text(lines.map(plain), col.desc + 6, y, { baseline: 'top' });
    text(String(it.quantity), col.rate - 8, y, 'right');
    text(money(it.rate), col.amt - 8, y, 'right');
    text(money(it.amount), right - 6, y, 'right');
    y += Math.max(h, 12) + 8;
    doc.setDrawColor('#e4e4e7'); doc.setLineWidth(0.5); doc.line(left, y - 4, right, y - 4);
  }

  // Totals
  y += 6;
  const row = (label: string, value: string, bold = false, color = ink) => {
    font(bold, bold ? 11 : 9.5, color);
    text(label, col.amt - 10, y, 'right');
    text(value, right - 6, y, 'right');
    y += bold ? 18 : 14;
  };
  row('Subtotal', money(inv.subtotal));
  if (inv.shopSuppliesAmount > 0) row(`Shop supplies (${inv.shopSuppliesRatePct}%)`, money(inv.shopSuppliesAmount));
  if (inv.taxAmount > 0) row(`Sales tax (${inv.taxRatePct}%)`, money(inv.taxAmount));
  row('Total', money(inv.totalAmount), true);
  for (const p of inv.payments ?? []) {
    row(`Paid ${p.paidAt.slice(0, 10)} · ${METHOD[p.method ?? 'shopify'] ?? 'Payment'}`, `-${money(p.amount)}`, false, '#15803d');
  }
  const owed = balanceDue(inv);
  y += 4;
  doc.setDrawColor(ink); doc.setLineWidth(1); doc.line(col.rate - 60, y - 4, right, y - 4);
  if (owed > 0) row('BALANCE DUE', money(owed), true, orange);
  else row('PAID IN FULL', money(0), true, '#15803d');

  // Footer
  const fy = Math.max(y + 30, pageH - 110);
  font(false, 9, grey); text(`Questions about this invoice? Call or text ${shop.phone}, or email ${shop.email}.`, pageW / 2, fy, 'center');
  font(true, 9, ink); text(`Thank you — ${shop.name}`, pageW / 2, fy + 13, 'center');

  return doc.output('blob');
}
