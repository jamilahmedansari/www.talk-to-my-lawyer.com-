/**
 * Server-side PDF generation for approved legal letters.
 *
 * Produces a supremely formatted, print-ready legal letter PDF with:
 *  - Professional letterhead (Talk to My Lawyer branding)
 *  - Proper legal letter structure: date, sender block, recipient block, Re: line, body, signature
 *  - Times New Roman body text (12pt), 1-inch margins — standard US legal correspondence
 *  - Attorney-approved certification stamp
 *  - Multi-page support with running footer on every page
 *
 * The generated PDF is uploaded to S3 via storagePut and the public URL is returned.
 */

import PDFDocument from "pdfkit";
import { storagePut } from "./storage";

interface IntakeData {
  sender?: {
    name?: string;
    address?: string;
    email?: string;
    phone?: string;
  };
  recipient?: {
    name?: string;
    address?: string;
    email?: string;
  };
}

interface PdfGenerationOptions {
  letterId: number;
  letterType: string;
  subject: string;
  content: string;
  approvedBy?: string;
  approvedAt?: string;
  jurisdictionState?: string | null;
  jurisdictionCountry?: string | null;
  intakeJson?: IntakeData | null;
}

// ─── Brand constants ──────────────────────────────────────────────────────────
const BRAND_NAVY = "#0F2744";
const BRAND_BLUE = "#1D4ED8";
const BRAND_GREEN = "#166534";
const BRAND_GREEN_BG = "#F0FFF4";
const BRAND_GREEN_BORDER = "#22C55E";
const GRAY_LIGHT = "#E5E7EB";
const GRAY_MID = "#6B7280";
const GRAY_DARK = "#374151";

// Margins: 72pt = 1 inch
const MARGIN_LEFT = 72;
const MARGIN_RIGHT = 72;
const MARGIN_TOP = 72;
const MARGIN_BOTTOM = 72;

/**
 * Generate a professional PDF from the approved letter content,
 * upload it to S3, and return the public URL.
 */
export async function generateAndUploadApprovedPdf(
  opts: PdfGenerationOptions
): Promise<{ pdfUrl: string; pdfKey: string }> {
  const pdfBuffer = await generatePdfBuffer(opts);

  const timestamp = Date.now();
  const safeSubject = opts.subject
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .substring(0, 40)
    .trim()
    .replace(/\s+/g, "-");
  const fileKey = `approved-letters/${opts.letterId}-${safeSubject}-${timestamp}.pdf`;

  // Graceful fallback: if Supabase storage is not configured (e.g. local dev),
  // return a data URL so the approval flow still completes without crashing.
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn(`[PDF] Storage not configured — returning data URL for letter #${opts.letterId}`);
    const base64 = pdfBuffer.toString("base64");
    const dataUrl = `data:application/pdf;base64,${base64}`;
    return { pdfUrl: dataUrl, pdfKey: fileKey };
  }

  const { url } = await storagePut(fileKey, pdfBuffer, "application/pdf");

  console.log(`[PDF] Generated and uploaded letter #${opts.letterId}: ${url}`);
  return { pdfUrl: url, pdfKey: fileKey };
}

/**
 * Generate the PDF buffer in memory using PDFKit.
 */
async function generatePdfBuffer(opts: PdfGenerationOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "LETTER",
        margins: { top: MARGIN_TOP, bottom: MARGIN_BOTTOM, left: MARGIN_LEFT, right: MARGIN_RIGHT },
        bufferPages: true,
        info: {
          Title: `Legal Letter — ${opts.subject}`,
          Author: "Talk to My Lawyer",
          Subject: opts.subject,
          Creator: "Talk to My Lawyer Platform",
          Keywords: `legal letter, attorney reviewed, ${opts.letterType}`,
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const pageWidth = doc.page.width - MARGIN_LEFT - MARGIN_RIGHT;
      const approvedDate = opts.approvedAt
        ? new Date(opts.approvedAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

      const intake = opts.intakeJson ?? {};
      const senderName = intake.sender?.name ?? "Sender";
      const senderAddress = intake.sender?.address ?? "";
      const senderEmail = intake.sender?.email ?? "";
      const senderPhone = intake.sender?.phone ?? "";
      const recipientName = intake.recipient?.name ?? "Recipient";
      const recipientAddress = intake.recipient?.address ?? "";
      const letterTypeLabel = opts.letterType
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

      // ─── LETTERHEAD ────────────────────────────────────────────────────────
      // Top navy bar
      doc
        .rect(0, 0, doc.page.width, 8)
        .fill(BRAND_NAVY);

      // Brand name
      doc
        .font("Helvetica-Bold")
        .fontSize(18)
        .fillColor(BRAND_NAVY)
        .text("TALK TO MY LAWYER", MARGIN_LEFT, 26, { align: "center", width: pageWidth });

      // Tagline
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(GRAY_MID)
        .text("Attorney-Reviewed Legal Correspondence", MARGIN_LEFT, 48, { align: "center", width: pageWidth });

      // Divider
      doc
        .moveTo(MARGIN_LEFT, 64)
        .lineTo(MARGIN_LEFT + pageWidth, 64)
        .strokeColor(BRAND_NAVY)
        .lineWidth(1.5)
        .stroke();

      // ─── METADATA ROW ──────────────────────────────────────────────────────
      let y = 76;
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(GRAY_MID);

      const metaParts: string[] = [
        `Type: ${letterTypeLabel}`,
        `Ref: #${opts.letterId}`,
      ];
      if (opts.jurisdictionState) {
        metaParts.push(`Jurisdiction: ${opts.jurisdictionState}${opts.jurisdictionCountry ? `, ${opts.jurisdictionCountry}` : ""}`);
      }
      doc.text(metaParts.join("   ·   "), MARGIN_LEFT, y, { align: "center", width: pageWidth });
      y += 18;

      // ─── DATE LINE ─────────────────────────────────────────────────────────
      doc
        .font("Times-Roman")
        .fontSize(12)
        .fillColor(GRAY_DARK)
        .text(approvedDate, MARGIN_LEFT, y, { width: pageWidth });
      y += 24;

      // ─── SENDER BLOCK ──────────────────────────────────────────────────────
      doc.font("Times-Roman").fontSize(12).fillColor("#000000");
      doc.text(senderName, MARGIN_LEFT, y, { width: pageWidth });
      y = doc.y + 2;
      if (senderAddress) {
        // Split address on comma or newline for multi-line display
        const addrLines = senderAddress.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
        for (const line of addrLines) {
          doc.text(line, MARGIN_LEFT, y, { width: pageWidth });
          y = doc.y + 2;
        }
      }
      if (senderEmail) { doc.text(senderEmail, MARGIN_LEFT, y, { width: pageWidth }); y = doc.y + 2; }
      if (senderPhone) { doc.text(senderPhone, MARGIN_LEFT, y, { width: pageWidth }); y = doc.y + 2; }
      y += 14;

      // ─── RECIPIENT BLOCK ───────────────────────────────────────────────────
      doc.font("Times-Roman").fontSize(12).fillColor("#000000");
      doc.text(recipientName, MARGIN_LEFT, y, { width: pageWidth });
      y = doc.y + 2;
      if (recipientAddress) {
        const addrLines = recipientAddress.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
        for (const line of addrLines) {
          doc.text(line, MARGIN_LEFT, y, { width: pageWidth });
          y = doc.y + 2;
        }
      }
      y += 14;

      // ─── RE: SUBJECT LINE ──────────────────────────────────────────────────
      doc.font("Times-Bold").fontSize(12).fillColor("#000000");
      doc.text(`Re: ${opts.subject}`, MARGIN_LEFT, y, { width: pageWidth });
      y = doc.y + 4;

      // Thin rule under Re: line
      doc
        .moveTo(MARGIN_LEFT, y)
        .lineTo(MARGIN_LEFT + pageWidth, y)
        .strokeColor(GRAY_LIGHT)
        .lineWidth(0.5)
        .stroke();
      y += 16;

      // ─── LETTER BODY ───────────────────────────────────────────────────────
      const plainContent = stripHtml(opts.content);
      const paragraphs = plainContent.split(/\n{2,}/);

      doc.font("Times-Roman").fontSize(12).fillColor("#000000");

      for (const para of paragraphs) {
        const trimmed = para.trim();
        if (!trimmed) continue;

        // Check for page overflow before writing
        if (y > doc.page.height - MARGIN_BOTTOM - 120) {
          doc.addPage();
          addPageHeader(doc, pageWidth, opts.letterId, opts.subject);
          y = MARGIN_TOP + 10;
        }

        // Detect heading-like lines: short all-caps, or starts with RE:/Dear/Sincerely/Regards
        const isHeading =
          (trimmed.length < 80 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed) && !trimmed.includes(".")) ||
          /^(RE:|Re:|Dear |To Whom|Sincerely|Respectfully|Regards|Yours truly)/i.test(trimmed);

        if (isHeading) {
          doc.font("Times-Bold").fontSize(12);
          doc.text(trimmed, MARGIN_LEFT, y, { width: pageWidth, lineGap: 3 });
          y = doc.y + 8;
          doc.font("Times-Roman").fontSize(12);
        } else {
          // Body paragraph — first-line indent for non-address paragraphs
          doc.text(trimmed, MARGIN_LEFT, y, {
            width: pageWidth,
            lineGap: 3,
            paragraphGap: 0,
          });
          y = doc.y + 12;
        }
      }

      // ─── ATTORNEY APPROVAL STAMP ───────────────────────────────────────────
      y += 8;
      if (y > doc.page.height - MARGIN_BOTTOM - 80) {
        doc.addPage();
        addPageHeader(doc, pageWidth, opts.letterId, opts.subject);
        y = MARGIN_TOP + 10;
      }

      doc
        .save()
        .roundedRect(MARGIN_LEFT, y, pageWidth, 56, 6)
        .fillColor(BRAND_GREEN_BG)
        .fill();
      doc
        .roundedRect(MARGIN_LEFT, y, pageWidth, 56, 6)
        .strokeColor(BRAND_GREEN_BORDER)
        .lineWidth(1)
        .stroke();

      // Checkmark icon area
      doc
        .circle(MARGIN_LEFT + 28, y + 28, 14)
        .fillColor(BRAND_GREEN_BORDER)
        .fill();
      doc
        .font("Helvetica-Bold")
        .fontSize(14)
        .fillColor("#FFFFFF")
        .text("✓", MARGIN_LEFT + 22, y + 20, { width: 12 });

      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(BRAND_GREEN)
        .text("ATTORNEY REVIEWED & APPROVED", MARGIN_LEFT + 52, y + 12, { width: pageWidth - 60 });

      const stampLine2 = opts.approvedBy
        ? `Reviewed by ${opts.approvedBy}  ·  ${approvedDate}`
        : `Approved on ${approvedDate}`;
      doc
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor(BRAND_GREEN)
        .text(stampLine2, MARGIN_LEFT + 52, y + 30, { width: pageWidth - 60 });

      doc.restore();
      y += 70;

      // ─── FOOTER ON ALL PAGES ───────────────────────────────────────────────
      const totalPages = (doc as any).bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        addPageFooter(doc, pageWidth, i + 1, totalPages, opts.letterId);
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Add a minimal continuation header on pages 2+.
 */
function addPageHeader(doc: InstanceType<typeof PDFDocument>, pageWidth: number, letterId: number, subject: string) {
  doc
    .rect(0, 0, doc.page.width, 8)
    .fill(BRAND_NAVY);

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(BRAND_NAVY)
    .text("TALK TO MY LAWYER", MARGIN_LEFT, 18, { width: pageWidth });

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(GRAY_MID)
    .text(`Letter #${letterId} — ${subject}`, MARGIN_LEFT, 18, { width: pageWidth, align: "right" });

  doc
    .moveTo(MARGIN_LEFT, 34)
    .lineTo(MARGIN_LEFT + pageWidth, 34)
    .strokeColor(GRAY_LIGHT)
    .lineWidth(0.5)
    .stroke();
}

/**
 * Add a footer with page numbers and disclaimer on every page.
 */
function addPageFooter(
  doc: InstanceType<typeof PDFDocument>,
  pageWidth: number,
  pageNum: number,
  totalPages: number,
  letterId: number
) {
  const footerY = doc.page.height - MARGIN_BOTTOM + 16;

  doc
    .moveTo(MARGIN_LEFT, footerY - 8)
    .lineTo(MARGIN_LEFT + pageWidth, footerY - 8)
    .strokeColor(GRAY_LIGHT)
    .lineWidth(0.5)
    .stroke();

  doc
    .font("Helvetica")
    .fontSize(7)
    .fillColor(GRAY_MID)
    .text(
      `This letter was drafted with AI assistance and reviewed by a licensed attorney via Talk to My Lawyer.  ·  Ref: #${letterId}  ·  © ${new Date().getFullYear()} Talk to My Lawyer`,
      MARGIN_LEFT,
      footerY,
      { width: pageWidth - 60, align: "left" }
    );

  doc
    .font("Helvetica")
    .fontSize(7)
    .fillColor(GRAY_MID)
    .text(`Page ${pageNum} of ${totalPages}`, MARGIN_LEFT, footerY, { width: pageWidth, align: "right" });
}

/**
 * Strip HTML tags and decode common entities for plain text rendering in PDF.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
