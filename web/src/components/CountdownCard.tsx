import type { SiteData, StationsData } from '../lib/data'
import { LinkBadge } from './LinkBadge'
import { bodyState, skyAt, type Body } from '../lib/sky'
import { fmtDeg, hms, human } from '../lib/format'

const GREEN_H = 72
const AMBER_H = 24

type Level = 'good' | 'warn' | 'crit'

function level(up: boolean, secsToSet: number | null): Level {
  if (!up) return 'crit'
  if (secsToSet === null) return 'good'
  const h = secsToSet / 3600
  return h >= GREEN_H ? 'good' : h >= AMBER_H ? 'warn' : 'crit'
}

const LEVEL_TEXT: Record<Level, { icon: string; label: string }> = {
  good: { icon: '●', label: `≥ ${GREEN_H} h left` },
  warn: { icon: '▲', label: `${AMBER_H}–${GREEN_H} h left` },
  crit: { icon: '■', label: `< ${AMBER_H} h or down` },
}

function Row({ site, body, t }: { site: SiteData; body: Body; t: number }) {
  const s = bodyState(site, body, t)
  const icon = body === 'sun' ? '☀' : '🌍'
  const setWord = body === 'sun' ? 'SUNSET' : 'EARTHSET'
  const riseWord = body === 'sun' ? 'sunrise' : 'Earthrise'
  const toSet = s.up && s.nextSet !== null ? s.nextSet - t : null
  const lv = level(s.up, toSet)
  return (
    <div className={`count-row lv-${lv}`}>
      <div className="count-main">
        {s.up ? (
          s.nextSet !== null ? (
            <>
              <span className="mono big">T-{hms(s.nextSet - t)}</span>{' '}
              <span className={`body-tag ${body}`}>{icon} {setWord}</span>
            </>
          ) : (
            <>
              <span className="mono big">—</span> <span className={`body-tag ${body}`}>{icon} up beyond data span</span>
            </>
          )
        ) : (
          <>
            <span className="mono big">T+{s.lastChange !== null ? hms(t - s.lastChange) : '—'}</span>{' '}
            <span className={`body-tag ${body}`}>{icon} since {body === 'sun' ? 'sunset' : 'Earthset'}</span>
          </>
        )}
      </div>
      <div className="count-sub">
        <span className={`level level-${lv}`} aria-label={`status: ${LEVEL_TEXT[lv].label}`}>
          {LEVEL_TEXT[lv].icon} {LEVEL_TEXT[lv].label}
        </span>
        {!s.up && s.nextRise !== null && <span> · next {riseWord} in {human(s.nextRise - t)}</span>}
        {s.up && s.nextRise !== null && s.nextSet !== null && (
          <span> · then back up {human(s.nextRise - s.nextSet)} after setting</span>
        )}
      </div>
    </div>
  )
}

export function CountdownCard({ site, t, stations }: { site: SiteData; t: number; stations: StationsData | null }) {
  const sky = skyAt(site, t)
  return (
    <article className="card" aria-label={`${site.meta.name} countdowns`}>
      <header className="card-head">
        <h3>{site.meta.name}</h3>
        <div className="card-meta">
          {site.meta.lat.toFixed(4)}°, {site.meta.lon.toFixed(4)}° ·{' '}
          <span className={`badge src-${site.meta.horizon_source}`} title="Terrain data used for the horizon">
            horizon: {site.meta.horizon_source === 'smooth-sphere' ? 'smooth sphere (no DEM)' : `LOLA ${site.meta.horizon_source}`}
          </span>
        </div>
      </header>
      <Row site={site} body="sun" t={t} />
      <Row site={site} body="earth" t={t} />
      {stations && <LinkBadge site={site} stations={stations} t={t} />}
      {sky ? (
        <dl className="now-grid">
          <div>
            <dt>Sun elevation</dt>
            <dd className="mono">{fmtDeg(sky.sunEl)}</dd>
          </div>
          <div>
            <dt>Sun above terrain</dt>
            <dd className="mono">{fmtDeg(sky.sunClear)}</dd>
          </div>
          <div>
            <dt>Sun disc visible</dt>
            <dd className="mono">{Math.round(sky.sunFrac * 100)}%</dd>
          </div>
          <div>
            <dt>Earth elevation</dt>
            <dd className="mono">{fmtDeg(sky.earthEl)}</dd>
          </div>
          <div>
            <dt>Earth above terrain</dt>
            <dd className="mono">{fmtDeg(sky.earthClear)}</dd>
          </div>
          <div>
            <dt>Earth (DTE)</dt>
            <dd>{sky.earthClear > 0 ? 'visible' : 'blocked'}</dd>
          </div>
        </dl>
      ) : (
        <p className="muted">Selected time is outside the precomputed span.</p>
      )}
    </article>
  )
}
