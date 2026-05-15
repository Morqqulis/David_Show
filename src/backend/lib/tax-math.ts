export type LineInput = {
  amount: number
  rate: number
  recoverablePct: number
}

export type LineComputed = {
  amount: number
  taxAmount: number
  recoverable: number
  nonRecoverable: number
  lineTotal: number
}

export function computeLine({ amount, rate, recoverablePct }: LineInput): LineComputed {
  const taxAmount = round2(amount * rate)
  const recoverable = round2(taxAmount * recoverablePct)
  const nonRecoverable = round2(taxAmount - recoverable)
  return {
    amount: round2(amount),
    taxAmount,
    recoverable,
    nonRecoverable,
    lineTotal: round2(amount + taxAmount),
  }
}

export function sumLines(lines: LineComputed[]) {
  return lines.reduce(
    (acc, l) => ({
      subtotal: round2(acc.subtotal + l.amount),
      totalTax: round2(acc.totalTax + l.taxAmount),
      totalRecoverable: round2(acc.totalRecoverable + l.recoverable),
      totalNonRecoverable: round2(acc.totalNonRecoverable + l.nonRecoverable),
      grandTotal: round2(acc.grandTotal + l.lineTotal),
    }),
    { subtotal: 0, totalTax: 0, totalRecoverable: 0, totalNonRecoverable: 0, grandTotal: 0 },
  )
}

export function round2(n: number) {
  return Math.round(n * 100) / 100
}

export function formatCurrency(n: number | null | undefined, currency = 'CAD') {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(n)
}
