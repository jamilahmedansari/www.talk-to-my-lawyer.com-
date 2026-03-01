# PDF Generation Reference

## Table of Contents
- [Overview](#overview)
- [Generation Flow](#generation-flow)
- [PDF Layout Specification](#pdf-layout-specification)
- [Branding Constants](#branding-constants)
- [HTML Stripping](#html-stripping)
- [Multi-Page Handling](#multi-page-handling)

---

## Overview

**File:** `server/pdfGenerator.ts`
**Library:** PDFKit (Node.js)
**Trigger:** `review.approve` procedure
**Output:** Professional legal letter PDF uploaded to S3

---

## Generation Flow

```
review.approve()
    │
    ├─ Create final_approved version
    ├─ Update status to approved
    │
    ▼
generateAndUploadApprovedPdf({
  letterId, letterType, subject, content,
  approvedBy, approvedAt, jurisdictionState,
  jurisdictionCountry, intakeJson
})
    │
    ├─ generatePdfBuffer() → PDFKit in-memory
    │   └─ Returns Buffer
    │
    ├─ storagePut(fileKey, buffer, "application/pdf")
    │   └─ Uploads to S3 bucket
    │   └─ Returns { url }
    │
    ├─ updateLetterPdfUrl(letterId, url)
    │
    └─ Returns { pdfUrl, pdfKey }
```

**File naming:** `approved-letters/{letterId}-{safeSubject}-{timestamp}.pdf`

---

## PDF Layout Specification

### Page Setup
- **Size:** US Letter (8.5" x 11")
- **Margins:** 1 inch (72pt) all sides
- **Buffer pages:** Enabled (for page numbering)

### Document Metadata
```
Title: "Legal Letter — {subject}"
Author: "Talk to My Lawyer"
Subject: {subject}
Creator: "Talk to My Lawyer Platform"
Keywords: "legal letter, attorney reviewed, {letterType}"
```

### Layout Sections (Top to Bottom)

1. **Top Navy Bar** — 8pt height, full width, `#0F2744`
2. **Brand Name** — "TALK TO MY LAWYER", Helvetica-Bold 18pt, centered, navy
3. **Tagline** — "Attorney-Reviewed Legal Correspondence", Helvetica 9pt, centered, gray
4. **Divider** — 1.5pt navy line
5. **Metadata Row** — Type, Ref#, Jurisdiction, Helvetica 8pt, centered, gray
6. **Date Line** — Times-Roman 12pt
7. **Sender Block** — Name, address lines, email, phone
8. **Recipient Block** — Name, address lines
9. **Re: Subject Line** — Times-Bold 12pt, with thin rule underneath
10. **Letter Body** — Times-Roman 12pt, paragraph detection, heading detection
11. **Attorney Approval Stamp** — Green rounded rect with checkmark icon
12. **Footer** — On every page: disclaimer, ref#, copyright, page numbers

---

## Branding Constants

```typescript
const BRAND_NAVY = "#0F2744";
const BRAND_BLUE = "#1D4ED8";
const BRAND_GREEN = "#166534";
const BRAND_GREEN_BG = "#F0FFF4";
const BRAND_GREEN_BORDER = "#22C55E";
const GRAY_LIGHT = "#E5E7EB";
const GRAY_MID = "#6B7280";
const GRAY_DARK = "#374151";
```

---

## HTML Stripping

The `stripHtml()` function converts HTML content to plain text for PDF rendering:
- `<br>` → newline
- `</p>`, `</h1-6>` → double newline
- `</div>`, `</li>` → newline
- All other tags stripped
- HTML entities decoded (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`, `&nbsp;`)
- Triple+ newlines collapsed to double

---

## Multi-Page Handling

### Page Overflow Detection
Before each paragraph, checks if `y > pageHeight - bottomMargin - 120`. If so, adds new page.

### Continuation Pages (2+)
- Minimal header: navy bar + brand name (left) + "Letter #{id} — {subject}" (right)
- Thin gray divider
- Content starts at `MARGIN_TOP + 10`

### Footer (All Pages)
- Thin gray divider line
- Left: "This letter was drafted with AI assistance and reviewed by a licensed attorney via Talk to My Lawyer. · Ref: #{id} · © {year} Talk to My Lawyer"
- Right: "Page {n} of {total}"

### Heading Detection
Lines are treated as headings if:
- Short (<80 chars), all uppercase, contains letters, no periods
- OR starts with: RE:, Dear, To Whom, Sincerely, Respectfully, Regards, Yours truly
