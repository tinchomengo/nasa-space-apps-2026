import { useRef, type ReactNode } from 'react'

export interface TabDef {
  id: string
  label: string
  render: () => ReactNode
}

/** Accessible tabs (WAI-ARIA pattern: arrow keys move between tabs, Home/End jump). */
export function Tabs({ tabs, active, onChange }: { tabs: TabDef[]; active: string; onChange: (id: string) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const idx = Math.max(0, tabs.findIndex((t) => t.id === active))
  const focus = (i: number) => {
    const k = (i + tabs.length) % tabs.length
    onChange(tabs[k].id)
    refs.current[k]?.focus()
  }
  return (
    <section className="tabs panel">
      <div role="tablist" aria-label="More information" className="tablist">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el
            }}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={i === idx}
            aria-controls={`panel-${t.id}`}
            tabIndex={i === idx ? 0 : -1}
            className={i === idx ? 'tab active' : 'tab'}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') focus(i + 1)
              else if (e.key === 'ArrowLeft') focus(i - 1)
              else if (e.key === 'Home') focus(0)
              else if (e.key === 'End') focus(tabs.length - 1)
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tabs[idx].id}`} aria-labelledby={`tab-${tabs[idx].id}`} className="tabpanel" tabIndex={0}>
        {tabs[idx].render()}
      </div>
    </section>
  )
}
