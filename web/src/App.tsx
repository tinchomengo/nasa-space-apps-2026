export default function App() {
  return (
    <div className="app">
      <header className="header">
        <h1>
          T-Minus <span className="sub">Mission Clock</span>
        </h1>
        <p className="value-prop">
          Pick a south-pole site and a date. T-Minus counts down to sunset and Earthset over real
          NASA LOLA terrain, and tells you whether Malargüe can still hear you.
        </p>
      </header>

      <main className="main">
        <section className="placeholder" aria-live="polite">
          <p className="countdown">T-––:––:–– ☀ SUNSET</p>
          <p className="countdown">T-––:––:–– 🌍 EARTHSET</p>
          <p className="note">Under construction: NASA Space Apps Challenge 2026, Buenos Aires.</p>
        </section>
      </main>

      <footer className="footer">
        <p>
          Data: NASA LOLA / PGDA, JPL Horizons and NAIF SPICE kernels, ESA Malargüe station info.
          Not an official NASA product.
        </p>
      </footer>
    </div>
  )
}
