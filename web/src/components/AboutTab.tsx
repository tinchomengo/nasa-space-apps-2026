const REPO = 'https://github.com/tinchomengo/nasa-space-apps-2026/blob/main'

export function AboutTab() {
  return (
    <div className="prose">
      <h3>Why this exists</h3>
      <p>
        At the Moon's south pole the Sun and Earth skim the horizon. A ridge a few hundred meters away decides whether a
        lander has power, or a voice. In March 2025, IM-2 landed tipped over in a spot the Sun couldn't reach, and ran
        about 12 hours and 45 minutes before its power ran out.
      </p>
      <p>
        T-Minus is a mission clock for those decisions: pick a site and a landing date, see how long until sunset and
        Earthset over the real terrain, and slide the launch date to see how a schedule slip changes the picture.
      </p>
      <h3>Credits</h3>
      <p>
        Built during the NASA Space Apps Challenge 2026 (Buenos Aires) for the <em>Lunar Landing Site Navigator</em>{' '}
        challenge. Data from NASA LOLA / PGDA, JPL Horizons and NAIF. Not an official NASA product. Built with AI assistance
        (Claude Code): see the <a href={`${REPO}/docs/AI_DISCLOSURE.md`}>AI disclosure</a> and{' '}
        <a href={`${REPO}/REFERENCES.md`}>references</a>.
      </p>
      <p className="muted small">Site status labels are as of November 2026.</p>
    </div>
  )
}
