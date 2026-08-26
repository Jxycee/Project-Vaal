// Display formatting for the /prices page — pulled out of the page component
// so these (non-trivial branching: the "1 / N" inversion, the day/hour/minute
// cascade) can be unit-tested like the rest of the app's display helpers.

// No scientific notation ever. Large → separators; tiny → "1 / N".
export function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n === 0) return '0'
  if (n >= 1000) return Math.round(n).toLocaleString()
  if (n >= 100) return n.toFixed(0)
  if (n >= 10) return n.toFixed(1)
  if (n >= 1) return n.toFixed(2)
  if (n >= 0.1) return n.toFixed(2)
  if (n >= 0.01) return n.toFixed(3)
  const inv = Math.round(1 / n)
  return `1 / ${inv.toLocaleString()}`
}

// Exchange values are always >= 1 (we flip direction otherwise), so this never
// needs the "1 / N" form — it just keeps big numbers clean and readable.
export function fmtCount(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n >= 100) return Math.round(n).toLocaleString()
  if (n >= 10) return n.toFixed(1)
  return n.toFixed(2)
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.round(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr} hr ago`
  const day = Math.round(hr / 24)
  return `${day} day${day === 1 ? '' : 's'} ago`
}
