export function csvEscape(v: unknown): string {
  if (v == null) return ''
  const s = typeof v === 'string' ? v : Array.isArray(v) ? v.join('; ') : typeof v === 'object' ? JSON.stringify(v) : String(v)
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function toCsv(rows: Array<Record<string, unknown>>, columns: Array<{ key: string; label: string }>) {
  const header = columns.map((c) => csvEscape(c.label)).join(',')
  const body = rows.map((row) => columns.map((c) => csvEscape(row[c.key])).join(',')).join('\n')
  return header + '\n' + body + '\n'
}
