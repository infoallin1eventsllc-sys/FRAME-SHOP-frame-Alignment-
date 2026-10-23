/**
 * The customer's copy of an invoice, as a PDF.
 *
 * Built from the invoice as saved on the server — the same figures Shopify
 * would charge — so the PDF, the portal and any payment link always agree.
 * Paul's private notes are never included: this is the copy the customer keeps.
 */
import PDFDocument from "pdfkit";
import { balanceDue, type Invoice } from "./invoice";

export interface PdfShop {
  name: string;
  address: string;
  phone: string;
  email: string;
}

export interface PdfCustomer {
  name: string;
  phone: string;
  email: string;
  ticketNumber: string;
  bike: string;
}

const money = (n: number) => `$${n.toFixed(2)}`;
// The built-in PDF fonts cover Windows-1252 only; anything outside it (a
// Unicode minus sign, say) prints as a wrong character. Keep text inside it.
const CP1252_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
const drawable = (s: string) =>
  s.replace(/\u2212/g, "-").replace(/[^\x20-\x7E\xA0-\xFF]/gu, (ch) => (CP1252_EXTRA.includes(ch) ? ch : "?"));
const METHOD: Record<string, string> = {
  shopify: "Online",
  cash: "Cash",
  check: "Check",
  card_in_person: "Card",
  other: "Other",
};

export function renderInvoicePdf(
  inv: Invoice,
  shop: PdfShop,
  customer: PdfCustomer,
  opts: { compress?: boolean } = {}
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margin: 50,
      compress: opts.compress ?? true,
      info: { Title: `Invoice ${inv.invoiceNumber} — ${shop.name}`, Author: shop.name },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = 50;
    const right = doc.page.width - 50;
    const width = right - left;
    const orange = "#ea580c";
    const grey = "#52525b";

    // Shop
    doc.font("Helvetica-Bold").fontSize(20).fillColor("#18181b").text(shop.name.toUpperCase(), left, 50);
    doc.font("Helvetica").fontSize(9).fillColor(grey)
      .text(shop.address)
      .text(`${shop.phone}  ·  ${shop.email}`);

    // Invoice block, top right
    doc.font("Helvetica-Bold").fontSize(20).fillColor(orange).text("INVOICE", left, 50, { width, align: "right" });
    doc.font("Helvetica").fontSize(9).fillColor(grey)
      .text(`Invoice ${inv.invoiceNumber}`, { width, align: "right" })
      .text(`Date ${inv.createdDate || new Date().toISOString().slice(0, 10)}`, { width, align: "right" })
      .text(`Ticket ${customer.ticketNumber}`, { width, align: "right" });

    doc.moveTo(left, 118).lineTo(right, 118).lineWidth(1.5).strokeColor("#18181b").stroke();

    // Customer and bike
    doc.y = 130;
    doc.font("Helvetica-Bold").fontSize(8).fillColor(orange).text("BILL TO", left, 130);
    doc.font("Helvetica").fontSize(10).fillColor("#18181b")
      .text(drawable(customer.name), left)
      .fillColor(grey).fontSize(9)
      .text(drawable([customer.phone, customer.email].filter(Boolean).join("  ·  ")));
    doc.font("Helvetica-Bold").fontSize(8).fillColor(orange).text("MOTORCYCLE", left + width / 2, 130);
    doc.font("Helvetica").fontSize(10).fillColor("#18181b").text(drawable(customer.bike) || "—", left + width / 2);

    // Lines
    const col = { desc: left, qty: left + width * 0.6, rate: left + width * 0.72, amt: left + width * 0.86 };
    let y = 190;
    const header = () => {
      doc.rect(left, y, width, 18).fill("#f4f4f5");
      doc.font("Helvetica-Bold").fontSize(8).fillColor(grey);
      doc.text("DESCRIPTION", col.desc + 6, y + 5);
      doc.text("QTY", col.qty, y + 5, { width: col.rate - col.qty - 8, align: "right" });
      doc.text("RATE", col.rate, y + 5, { width: col.amt - col.rate - 8, align: "right" });
      doc.text("AMOUNT", col.amt, y + 5, { width: right - col.amt - 6, align: "right" });
      y += 24;
    };
    header();
    doc.font("Helvetica").fontSize(9.5).fillColor("#18181b");
    for (const it of inv.items) {
      const h = doc.heightOfString(drawable(it.description), { width: col.qty - col.desc - 16 });
      if (y + h > doc.page.height - 200) {
        doc.addPage();
        y = 50;
        header();
        doc.font("Helvetica").fontSize(9.5).fillColor("#18181b");
      }
      doc.text(drawable(it.description), col.desc + 6, y, { width: col.qty - col.desc - 16 });
      doc.text(String(it.quantity), col.qty, y, { width: col.rate - col.qty - 8, align: "right" });
      doc.text(money(it.rate), col.rate, y, { width: col.amt - col.rate - 8, align: "right" });
      doc.text(money(it.amount), col.amt, y, { width: right - col.amt - 6, align: "right" });
      y += Math.max(h, 12) + 8;
      doc.moveTo(left, y - 4).lineTo(right, y - 4).lineWidth(0.5).strokeColor("#e4e4e7").stroke();
    }

    // Totals
    y += 6;
    const row = (label: string, value: string, bold = false, color = "#18181b") => {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 11 : 9.5).fillColor(color);
      doc.text(label, col.rate - 60, y, { width: col.amt - col.rate + 50, align: "right" });
      doc.text(value, col.amt, y, { width: right - col.amt - 6, align: "right" });
      y += bold ? 18 : 14;
    };
    row("Subtotal", money(inv.subtotal));
    if (inv.shopSuppliesAmount > 0) row(`Shop supplies (${inv.shopSuppliesRatePct}%)`, money(inv.shopSuppliesAmount));
    if (inv.taxAmount > 0) row(`Sales tax (${inv.taxRatePct}%)`, money(inv.taxAmount));
    row("Total", money(inv.totalAmount), true);
    for (const p of inv.payments ?? []) {
      row(`Paid ${p.paidAt.slice(0, 10)} · ${METHOD[p.method ?? "shopify"] ?? "Payment"}`, `-${money(p.amount)}`, false, "#15803d");
    }
    const owed = balanceDue(inv);
    y += 4;
    doc.moveTo(col.rate - 60, y - 4).lineTo(right, y - 4).lineWidth(1).strokeColor("#18181b").stroke();
    if (owed > 0) row("BALANCE DUE", money(owed), true, orange);
    else row("PAID IN FULL", money(0), true, "#15803d");

    // Footer
    doc.font("Helvetica").fontSize(9).fillColor(grey).text(
      `Questions about this invoice? Call or text ${shop.phone}, or email ${shop.email}.`,
      left,
      Math.max(y + 30, doc.page.height - 110),
      { width, align: "center" }
    );
    doc.font("Helvetica-Bold").fillColor("#18181b").text(`Thank you — ${shop.name}`, { width, align: "center" });

    doc.end();
  });
}
