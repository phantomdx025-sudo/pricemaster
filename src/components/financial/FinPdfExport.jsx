/**
 * FinPdfExport — PDF generation utility for party account statements.
 * Phase FIN-3
 *
 * Exports:
 *   generatePartyPDF(partyData, ledgerRows, outstandingRows, addressData) → Promise<Blob>
 *
 * Uses jsPDF + jsPDF-autotable. Client-side only. No server required.
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ── Helpers ─────────────────────────────────────────────────────────────────


const fmtAmt = (n) => {
  const abs = Math.abs(n ?? 0)
  const str = abs.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
  return (n ?? 0) < 0 ? `- ${str}` : str
}

const fmtDate = (d) => {
  if (!d) return ''
  const dt = typeof d === 'string' ? new Date(d) : d
  if (isNaN(dt)) return String(d)
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const today = () => {
  const now = new Date()
  return now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

// Brand palette — PDF uses light background for printability, violet brand accents
const C = {
  brand:        [124, 111, 247],   // #7c6ff7 — electric violet
  brandLight:   [240, 238, 255],   // very light violet tint for alternating rows
  bgBase:       [8, 11, 20],       // #080b14 — deep space (reference only)
  bgSurface:    [14, 18, 32],      // #0e1220 — card surface (reference only)
  textPrimary:  [232, 234, 245],   // #e8eaf5 — off-white (reference only)
  textMuted:    [74, 80, 120],     // #4a5078 — muted
  border:       [30, 36, 64],      // #1e2440 — border (reference only)
  text:         [20, 20, 40],      // near-black for PDF body text (dark navy, not pure black)
  muted:        [100, 105, 140],   // muted text on white PDF background
  surface:      [255, 255, 255],   // white page background
  elevated:     [248, 248, 252],   // very light tint for alternating/surface areas
  success:      [62, 207, 116],    // #3ecf74
  successLight: [220, 248, 232],   // light green tint for PDF
  error:        [224, 92, 92],     // #e05c5c
  errorLight:   [252, 228, 228],   // light red tint for PDF
  warningLight: [255, 244, 220],   // light amber tint for PDF
  white:        [255, 255, 255],
  black:        [4, 6, 13],        // near-black for PDF text (use instead of pure 0,0,0)
}

// ── Core generator ───────────────────────────────────────────────────────────

/**
 * @param {object} partyData        — fin_parties row
 * @param {Array}  ledgerRows       — fin_ledger rows (ordered by date ASC)
 * @param {Array}  outstandingRows  — fin_outstanding rows
 * @param {object|null} addressData — fin_address row or null
 * @param {string} entityName       — business name for header/footer
 * @param {object} options          — { includeOutstandingBreakdown: boolean } (default false)
 * @returns {Promise<Blob>}
 */
export async function generatePartyPDF(partyData, ledgerRows, outstandingRows, addressData, entityName, options = {}) {
  const { includeOutstandingBreakdown = false } = options
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const PW = doc.internal.pageSize.getWidth()   // 210
  const PH = doc.internal.pageSize.getHeight()  // 297
  const ML = 14  // left margin
  const MR = 14  // right margin
  const CW = PW - ML - MR  // content width = 182

  // ── Page header draw fn (called by autoTable hooks) ──────────────────────
  const drawPageHeader = (pageNum, totalPages) => {
    // Brand bar
    doc.setFillColor(...C.brand)
    doc.rect(0, 0, PW, 12, 'F')

    // Business name
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...C.white)
    doc.text((entityName ?? 'ANKxIOUS'), ML, 8)

    // "Account Statement" label on right
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text('ACCOUNT STATEMENT', PW - MR, 8, { align: 'right' })

    // Thin bottom accent
    doc.setFillColor(...C.brandLight)
    doc.rect(0, 12, PW, 3, 'F')
  }

  // ── Draw page 1 header ───────────────────────────────────────────────────
  drawPageHeader(1, 1)

  let y = 20  // cursor after header bar

  // "Generated on" + date range
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...C.muted)

  const genLine = `Generated on: ${today()}`
  doc.text(genLine, PW - MR, y, { align: 'right' })

  // ── Party info block ─────────────────────────────────────────────────────
  y += 6

  // Party name (large)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...C.text)
  doc.text(partyData.party_name ?? '', ML, y)
  y += 5

  // Party type chip-like label + status
  const typeLabel = partyData.party_type === 'debtor' ? 'Debtor' : 'Creditor'
  const status    = partyData.status ?? ''
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...C.muted)
  doc.text(`${typeLabel}  ·  ${status}`, ML, y)
  y += 5

  // Address block if present
  if (addressData) {
    const addrParts = []
    if (addressData.address?.trim())      addrParts.push(addressData.address.trim())
    if (addressData.state_name?.trim())   addrParts.push(addressData.state_name.trim())
    if (addressData.pincode?.trim())      addrParts.push(addressData.pincode.trim())
    if (addrParts.length) {
      doc.setFontSize(8)
      doc.setTextColor(...C.text)
      const addrText = addrParts.join(', ')
      const lines = doc.splitTextToSize(addrText, CW * 0.6)
      doc.text(lines, ML, y)
      y += lines.length * 4.5
    }

    const contactParts = []
    if (addressData.mobile?.trim())  contactParts.push(`M: ${addressData.mobile.trim()}`)
    if (addressData.phone?.trim())   contactParts.push(`T: ${addressData.phone.trim()}`)
    if (addressData.email?.trim())   contactParts.push(addressData.email.trim())
    if (contactParts.length) {
      doc.setFontSize(7.5)
      doc.setTextColor(...C.muted)
      doc.text(contactParts.join('   '), ML, y)
      y += 4.5
    }

    const gstParts = []
    if (addressData.gstin?.trim())  gstParts.push(`GSTIN: ${addressData.gstin.trim()}`)
    if (addressData.pan_no?.trim()) gstParts.push(`PAN: ${addressData.pan_no.trim()}`)
    if (gstParts.length) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5)
      doc.setTextColor(...C.text)
      doc.text(gstParts.join('   '), ML, y)
      doc.setFont('helvetica', 'normal')
      y += 4.5
    }
  }

  // ── Closing balance highlight box ────────────────────────────────────────
  y += 2
  const bal      = partyData.closing_bal ?? 0
  const balLabel = partyData.party_type === 'debtor' ? 'Closing Receivable' : 'Closing Payable'
  const balColor = bal < 0 ? C.errorLight : C.brandLight
  const balText  = bal < 0 ? `- ₹${fmtAmt(bal)}` : `₹${fmtAmt(bal)}`
  const balTxtC  = bal < 0 ? C.error : C.brand

  doc.setFillColor(...balColor)
  doc.roundedRect(ML, y, CW, 12, 2, 2, 'F')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...C.muted)
  doc.text(balLabel, ML + 4, y + 4.5)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...balTxtC)
  doc.text(balText, PW - MR - 4, y + 8, { align: 'right' })
  y += 16

  // ── Ledger table ─────────────────────────────────────────────────────────
  if (ledgerRows.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...C.text)
    doc.text('Transaction Ledger', ML, y)
    y += 4

    const lRows = ledgerRows.map((r, idx) => {
      const isFirst = idx === 0
      const isLast  = idx === ledgerRows.length - 1
      return {
        date:       fmtDate(r.txn_date),
        type:       r.vch_type ?? '',
        vchNo:      r.vch_no  ?? '',
        // narration intentionally omitted — BUG-3 fix: wastes column space in PDF
        debit:      (r.debit  ?? 0) > 0 ? fmtAmt(r.debit)  : '',
        credit:     (r.credit ?? 0) > 0 ? fmtAmt(r.credit) : '',
        balance:    fmtAmt(r.balance),
        _isFirst:   isFirst,
        _isLast:    isLast,
        _balNeg:    (r.balance ?? 0) < 0,
        _balVal:    r.balance ?? 0,
      }
    })

    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      // BUG-3: Narration removed. New widths total 182mm = content width exactly.
      // Date 26 + Type 40 + VchNo 32 + Debit 26 + Credit 26 + Balance 32 = 182mm
      head: [['Date', 'Type', 'Vch No.', 'Debit', 'Credit', 'Balance']],
      body: lRows.map(r => [r.date, r.type, r.vchNo, r.debit, r.credit, r.balance]),
      styles: {
        font:      'helvetica',
        fontSize:  7.5,
        cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
        textColor: C.text,
        lineColor: C.border,
        lineWidth: 0.1,
        overflow:  'ellipsize',
      },
      headStyles: {
        fillColor:  C.brand,
        textColor:  C.white,
        fontSize:   7.5,
        fontStyle:  'bold',
        halign:     'center',
      },
      columnStyles: {
        0: { cellWidth: 26,  halign: 'center' },  // Date
        1: { cellWidth: 40,  halign: 'left'   },  // Type (long Tally names)
        2: { cellWidth: 32,  halign: 'left'   },  // Vch No
        3: { cellWidth: 26,  halign: 'right',  textColor: C.error   },  // Debit
        4: { cellWidth: 26,  halign: 'right',  textColor: C.success },  // Credit
        5: { cellWidth: 32,  halign: 'right'  },  // Balance
      },
      alternateRowStyles: { fillColor: C.elevated },
      willDrawCell: (data) => {
        if (data.section !== 'body') return
        const row = lRows[data.row.index]
        if (!row) return

        // Opening row (first): brand-light tint
        if (row._isFirst) {
          doc.setFillColor(...C.brandLight)
        }
        // Closing row (last): elevated tint
        else if (row._isLast) {
          doc.setFillColor(...C.elevated)
        }

        // Balance column colour (index 5 now, was 6 before narration removal)
        if (data.column.index === 5 && row._balNeg) {
          data.cell.styles.textColor = C.error
        } else if (data.column.index === 5) {
          data.cell.styles.textColor = C.text
        }
      },
      didDrawPage: (data) => {
        const pg  = doc.internal.getCurrentPageInfo().pageNumber
        const tot = doc.internal.getNumberOfPages()
        drawPageHeader(pg, tot)
        drawFooter(pg, tot, doc, PW, PH, MR, entityName)
      },
    })

    y = doc.lastAutoTable.finalY + 6
  }

  // ── Outstanding invoices table ───────────────────────────────────────────
  // BX-7: Only rendered when includeOutstandingBreakdown is true (disabled by default)
  if (includeOutstandingBreakdown && outstandingRows.length > 0) {
    // Start new page if insufficient space
    if (y > PH - 60) {
      doc.addPage()
      const pg  = doc.internal.getCurrentPageInfo().pageNumber
      drawPageHeader(pg, doc.internal.getNumberOfPages())
      y = 20
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...C.text)
    doc.text('Outstanding Invoices', ML, y)
    y += 4

    // Summary line
    const totalOut = outstandingRows.reduce((s, r) => s + (r.remaining ?? 0), 0)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...C.error)
    doc.text(
      `Total outstanding: ₹${fmtAmt(totalOut)} across ${outstandingRows.length} invoice${outstandingRows.length !== 1 ? 's' : ''}`,
      ML, y
    )
    y += 5

    const now = new Date()
    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      head: [['Date', 'Type', 'Vch No', 'Original (₹)', 'Paid (₹)', 'Remaining (₹)', 'Reason', 'Age']],
      body: outstandingRows.map(r => {
        const invDate  = r.inv_date ? new Date(r.inv_date) : null
        const ageDays  = invDate ? Math.floor((now - invDate) / 86400000) : null
        const ageLabel = ageDays === null ? '' : `${ageDays}d`
        return [
          fmtDate(r.inv_date),
          r.vch_type ?? '',
          r.vch_no   ?? '',
          fmtAmt(r.original_amt),
          fmtAmt(r.paid_amt),
          fmtAmt(r.remaining),
          r.reason   ?? '',
          ageLabel,
        ]
      }),
      styles: {
        font:        'helvetica',
        fontSize:    7.5,
        cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
        textColor:   C.text,
        lineColor:   C.border,
        lineWidth:   0.1,
        overflow:    'ellipsize',
      },
      headStyles: {
        fillColor: C.error,
        textColor: C.white,
        fontSize:  7.5,
        fontStyle: 'bold',
        halign:    'center',
      },
      columnStyles: {
        0: { cellWidth: 20, halign: 'center' },
        1: { cellWidth: 16, halign: 'left'   },
        2: { cellWidth: 16, halign: 'left'   },
        3: { cellWidth: 24, halign: 'right'  },
        4: { cellWidth: 20, halign: 'right'  },
        5: { cellWidth: 24, halign: 'right', textColor: C.error },
        6: { cellWidth: 'auto', halign: 'left' },
        7: { cellWidth: 14, halign: 'center' },
      },
      alternateRowStyles: { fillColor: C.elevated },
      didDrawPage: (data) => {
        const pg  = doc.internal.getCurrentPageInfo().pageNumber
        drawFooter(pg, doc.internal.getNumberOfPages(), doc, PW, PH, MR, entityName)
        // Re-draw header on overflow pages only (not first page of outstanding, already drawn)
        if (data.pageNumber > 1) {
          drawPageHeader(pg, doc.internal.getNumberOfPages())
        }
      },
    })

    y = doc.lastAutoTable.finalY + 6
  }

  // ── Stamp final footer on all pages ─────────────────────────────────────
  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    drawFooter(i, totalPages, doc, PW, PH, MR, entityName)
  }

  return doc.output('blob')
}

// ── Footer helper ────────────────────────────────────────────────────────────
function drawFooter(pageNum, totalPages, doc, PW, PH, MR, entityName) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(166, 129, 108)  // var(--text-muted)

  const left  = `Confidential — generated by ${(entityName ?? 'ANKxIOUS')}`
  const right = `Page ${pageNum} of ${totalPages}`

  doc.text(left,  14,    PH - 6)
  doc.text(right, PW - MR, PH - 6, { align: 'right' })

  // Thin top rule
  doc.setDrawColor(230, 217, 207)
  doc.setLineWidth(0.2)
  doc.line(14, PH - 9, PW - 14, PH - 9)
}