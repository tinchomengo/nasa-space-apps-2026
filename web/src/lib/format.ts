export const HOUR = 3600
export const DAY = 86400

/** "41:12:05" — total hours (can exceed 24), minutes, seconds. */
export function hms(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

/** Human duration: "3 d 4 h", "5 h 12 min", "8 min". */
export function human(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  const d = Math.floor(s / DAY)
  const h = Math.floor((s % DAY) / HOUR)
  const m = Math.floor((s % HOUR) / 60)
  if (d > 0) return `${d} d ${h} h`
  if (h > 0) return `${h} h ${m} min`
  return `${m} min`
}

export function utcLabel(t: number): string {
  return new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
}

/** Value for <input type="datetime-local"> interpreted as UTC. */
export function toInputUTC(t: number): string {
  return new Date(t * 1000).toISOString().slice(0, 16)
}

export function fromInputUTC(v: string): number | null {
  const ms = Date.parse(v + ':00Z')
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null
}

export const fmtPct = (x: number) => `${x.toFixed(1)}%`
export const fmtDeg = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(2)}°`
