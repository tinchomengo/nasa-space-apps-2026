import type { ReactNode } from 'react'

/** Plain-language callout shown only in educator mode. */
export function Explain({ on, children }: { on: boolean; children: ReactNode }) {
  if (!on) return null
  return (
    <aside className="explain" role="note">
      <span className="explain-icon" aria-hidden="true">💡</span>
      <div>{children}</div>
    </aside>
  )
}

const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: 'Why does the Sun never climb at the pole?',
    a: (
      <>
        The Moon's spin axis is tilted only 1.54° from the plane of its orbit around the Sun. From the pole, the Sun therefore
        circles the whole horizon once a month, never more than about 1.5° above or below it. That is less than three Sun
        widths. A hill a few kilometres away is enough to block it.
      </>
    ),
  },
  {
    q: 'Why does Earth hardly move?',
    a: (
      <>
        The Moon always shows the same face to Earth, so Earth stays in roughly the same spot in the lunar sky. A slight
        wobble (libration) moves it about 7° up and down and 8° sideways each month. At the south pole Earth sits right on
        the horizon, so that wobble decides whether it is above or behind the hills: roughly two weeks visible, two weeks hidden.
      </>
    ),
  },
  {
    q: 'Why do a few hundred metres matter?',
    a: (
      <>
        Because the Sun and Earth are so low, the skyline around the lander matters more than anything else. Open the
        Explore map and click around: around Connecting Ridge, Malapert and the Shackleton rim, neighbouring points
        500 m apart differ by up to about 50 percentage points in how often they see the Sun.
      </>
    ),
  },
  {
    q: 'What does a schedule slip do?',
    a: (
      <>
        Light and Earth visibility at the pole come in cycles (about 27–30 days, plus a yearly season). Sliding the
        launch by a week can move a landing from "two weeks of Sun and Earth ahead" to "darkness in 20 hours". Try the
        slip slider and watch the countdowns.
      </>
    ),
  },
  {
    q: 'What happened to IM-2?',
    a: (
      <>
        In March 2025, IM-2 landed tipped over in a spot the Sun couldn't reach, and ran about 12 hours and 45 minutes
        before its power ran out. Its landing point is in the site list as "Mons Mouton (IM-2 landing site)".
      </>
    ),
  },
]

export function Faq() {
  return (
    <section className="panel faq" aria-label="Questions and answers">
      <div className="panel-head">
        <strong>Questions people ask</strong>
      </div>
      {FAQ.map((f) => (
        <details key={f.q}>
          <summary>{f.q}</summary>
          <p>{f.a}</p>
        </details>
      ))}
    </section>
  )
}
