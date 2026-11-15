# T-Minus — Video plan v4 (Sun 2026-11-15) · source of truth

v4 folds in the 13:00 review:
- 9 accuracy fixes, in plain language for a non-technical local jury. Numbers stay true.
- F´ dropped.
- Frame server instead of Playwright.
- ElevenLabs AI video for the cinematic shots.
- Dramatic S1 countdown with a TIME-LAPSE tag.

## 0. What we're making
- **One edit, two exports:**
  - **LOCAL ≤ 3:00:** the cut the Buenos Aires jury judges.
  - **GLOBAL ≤ 30 s:** Act 1 + a 3 s end card, **with English voiceover** (the submission must be in English) plus EN subtitles.
- **Visual sources:**
  - **AI video (ElevenLabs):** Earth → Moon, the south-pole landscape, the tipped lander.
  - **S1 (ours, real data):** ridge POV at Earthset and Earthrise.
  - **APP:** screen captures.
  - **HW:** antenna prototype.
  - **GFX:** "dos horizontes".
  - **S2b (ours, real terrain):** backup only.
- **Voice:** ElevenLabs, a deep male narrator in Spanish (voseo). The global cut uses the same voice in English.
- **Subtitles:** English, **burned in** (bottom third).
- **Name and team only on the end card.**
- **Files:** .mp4 H.264 1080p30, ≤ 200 MB.
- **Never mention F´** anywhere: video, VO, page.

---

## 1. Judging criteria → how the video scores 5

| Criterion | What a 5 requires (guide) | How we deliver it (LOCAL timestamps) | Risk → mitigation |
|---|---|---|---|
| **Impact** | A significant problem; extensive reach; inspiring; a large audience | **Stakes:** 0:00 "vive o muere"; 0:52 Athena went dark in under 13 h. **Scale:** 0:30 US, China, India, companies. **Audience:** 2:36 planners + teachers + students, free in any browser. **Local:** Malargüe at 0:30 and 1:32. **Future:** 2:46 | Looks niche → spell out how many missions are heading there, and that it's life or death for the lander |
| **Creativity** | Original, inventive execution | (1) **A clock, not a map**, 1:02. (2) **"Dos horizontes"**, 1:32. (3) **Predictions drive a real antenna**, 2:02. Cinematic S1 built from real data | Looks like "another dashboard" → each idea gets its own beat; never open on a screen capture |
| **Validity** | Scientifically sound, fully developed, user-friendly | **Accuracy:** 2:26 matches JPL + reproduces NASA's sunlight maps on the same terrain. **Usable:** 1:22 "al instante", 2:36 phone, free. **Real world:** 2:02 prototype antenna | Non-technical jury → simple words in the VO; the exact number goes on a chip |
| **Relevance** | Covers the whole challenge; NASA data integral | One shot per objective: compare sites (1:12) · dates/slip (1:22) · Sun & Earth vs the real horizon (0:00, 1:02) · time to sunset/Earthset (1:02) · power & comms (1:32) · views (S1, panorama, heatmap) · timeline (1:44) · Explore (1:44) · educators (2:36). Data chips (§2.4) | The VO uses the challenge's own words: "sitios y fechas", "energía y comunicación", "horizonte" |
| **Presentation** | Clear challenge → solution → importance; polished | Arc: hook → problem → solution → proof → future. Sound design, consistent type, subtitles, music sync points | One idea per shot; at most 8 words of on-screen text per shot |

**GLOBAL 30 s:**

| Time | Criterion |
|---|---|
| 0:00 | Impact + Presentation |
| 0:05 | Presentation |
| 0:08 | Relevance + Validity (data chips) |
| 0:14 | Relevance (compare + dates + Malargüe) |
| 0:19 | Creativity (antenna) |
| 0:23 | Validity chip + Impact |
| 0:27 | End card |

---

## 2. Final script — LOCAL (3:00)

**Visual key:**
- **S1:** ridge POV, our render built from real data, true scale.
- **AI:** ElevenLabs video clip.
- **HW:** antenna on the desk.
- **APP:** screen capture.
- **PHONE:** the app on a phone.
- **GFX:** made in the editor.

`[chip: …]` = a data chip (§2.4).

### ACT 1 · The pitch (0:00–0:30) → also the GLOBAL cut

| Time | Visual | VO (ES) | Subtitle (EN) |
|---|---|---|---|
| 0:00–0:05 | **S1 Earthset.** Earth sinks behind the ridge. HUD `EARTHSET T-00:00:05 → 00:00:00` + small `TIME-LAPSE` tag → red **SIGNAL LOST** + glitch (~0:04.2). Silence after "muere". | En el polo sur de la Luna… quinientos metros deciden si tu nave vive… o muere. | At the Moon's south pole… 500 meters decide whether your lander lives… or dies. |
| 0:05–0:08 | Black → **T-MINUS** · *el reloj de misión lunar* | Esto es T-Minus: el reloj de misión lunar. | This is T-Minus: the lunar mission clock. |
| 0:08–0:14 | **APP** Explore Malapert heatmap, flipping between two points 500 m apart. `[chip: NASA LRO · LOLA]` `[chip: JPL Horizons]` | Con datos abiertos de la NASA, calcula cuánto Sol y cuánta Tierra ve tu nave. | Using NASA open data, it computes how much Sun and Earth your lander sees. |
| 0:14–0:19 | **APP** 2 sites side by side + slip slider; the Malargüe badge lights up. `[chip: ESA Malargüe · NASA DSN]` | Compará sitios, mové la fecha… y mirá si Malargüe todavía te escucha. | Compare sites, shift the date… and see if Malargüe can still hear you. |
| 0:19–0:23 | **HW** the antenna drops behind the paper skyline. Small text: *prototipo* | Sus predicciones hasta pueden mover una antena real. | Its predictions can even drive a real antenna. |
| 0:23–0:27 | **S1 Earthrise**, **LINK ✓ MALARGÜE**. `[chip: validado vs JPL · 0.04″]` | Para que la próxima misión al polo sur… no se quede a oscuras. | So the next south-pole mission… doesn't go dark. |
| 0:27–0:30 | **GLOBAL:** end card. **LOCAL:** straight into Act 2. | — | — |

**Hook timing:** if the 0:00 line runs over 4.5 s, use "En el polo sur lunar, quinientos metros deciden… si tu nave vive o muere."

### ACT 2 · The problem (0:30–1:02)

| Time | Visual | VO (ES) | Subtitle (EN) |
|---|---|---|---|
| 0:30–0:40 | **AI** Earth over South America (Malargüe marker added in the editor) → flight to the Moon → approach over the south pole. Labels: *EE.UU. · China · India · privadas* | Estados Unidos, China, India y empresas privadas ya apuntan al polo sur de la Luna: ahí hay hielo de agua. Y desde Argentina, la antena de la ESA en Malargüe puede escucharlas. | The US, China, India and private companies are all heading to the Moon's south pole: there's water ice. And from Argentina, ESA's Malargüe antenna can listen to them. |
| 0:40–0:52 | **AI** south-pole landscape, Sun circling low, long shadows sweeping. *(Backup: S2b real terrain.)* | Pero ahí, el Sol nunca sube. Da vueltas, rozando el horizonte. Una loma puede tapar la luz durante días. Y la Tierra sube y baja… escondiéndose detrás de las montañas. | But there, the Sun never climbs. It circles, skimming the horizon. One ridge can block the light for days. And Earth bobs up and down… hiding behind the mountains. |
| 0:52–1:02 | **AI** a tipped lander in shadow, cold tint, power fading. Small tag: *Recreación · IA* | Sin Sol, no hay energía. Sin la Tierra a la vista, no hay señal. En 2025, la nave Athena quedó de costado cerca del polo… y se apagó en menos de trece horas. | No Sun, no power. No Earth in sight, no signal. In 2025, the Athena lander ended up on its side near the pole… and went dark in under 13 hours. |

### ACT 3 · The solution (1:02–2:02)

| Time | Visual | VO (ES) | Subtitle (EN) | Criterion |
|---|---|---|---|---|
| 1:02–1:12 | **APP** pick Shackleton Connecting Ridge → countdown card (zoom on both clocks) | Elegí un sitio y una fecha. T-Minus no te da un mapa: te da dos relojes. Cuánto falta para que se ponga el Sol… y para que se ponga la Tierra. | Pick a site and a date. T-Minus doesn't give you a map: it gives you two clocks. Time until sunset… and until Earthset. | Creativity 1 · Relevance |
| 1:12–1:22 | **APP** compare 3 sites: **Connecting Ridge, Malapert, de Gerlache rim** (all three have the 5 m terrain). `[chip: NASA LRO · LOLA 5 m · PGDA]` | Compará hasta tres sitios, cada uno con su horizonte real, medido con el relieve de la NASA. | Compare up to three sites, each with its real horizon, measured from NASA terrain maps. | Relevance · Validity |
| 1:22–1:32 | **APP** slip 0 → +30 d; the cards change colour | ¿Se atrasó el lanzamiento? Mové la fecha: todo se recalcula al instante. | Launch slipped? Move the date: everything recalculates instantly. | Relevance · Validity (usable) |
| 1:32–1:44 | **GFX** Moon ↔ Earth with two horizon lines that light up (lunar horizon ✓ + Malargüe horizon ✓) → **APP** link badge. `[chip: ESA Malargüe · NASA DSN]` | Y para hablar con la Tierra hacen falta dos horizontes: que la Tierra se vea desde la Luna… y que la Luna se vea desde una antena en la Tierra. T-Minus revisa los dos. | And to talk to Earth you need two horizons: Earth visible from the Moon… and the Moon visible from an antenna on Earth. T-Minus checks both. | **Creativity 2** · Impact (local) |
| 1:44–2:02 | **APP** timeline (2 s) → Explore Malapert: click the point **500 m from the summit** → Δ panel (Earth 80.3 → 100 %, Sun 66.5 → 55.0 %, −11.5) | Y lo más sorprendente: tocá cualquier punto del mapa. A quinientos metros de la cima de Malapert, la Tierra se ve el cien por ciento del tiempo… pero perdés más de once puntos de Sol. Quinientos metros… lo cambian todo. | The most surprising part: tap any spot on the map. 500 meters from Malapert's summit, Earth is visible 100% of the time… but you lose over 11 points of sunlight. 500 meters… change everything. | Relevance (small changes, big impact) |

### ACT 4 · From planning to operations (2:02–2:26)

| Time | Visual | VO (ES) | Subtitle (EN) | Criterion |
|---|---|---|---|---|
| 2:02–2:26 | **HW** dark desk; laptop behind running **S1 live** in sync. The antenna follows Earth, drops behind the paper skyline at zero → stows → Earthrise → wakes up. Small text: *Prototipo · elevación ×6 · azimut ×3* | Y de la planificación… a la operación. Este prototipo de antena sigue las predicciones de T-Minus: apunta a la Tierra mientras se ve… se guarda cuando la montaña la tapa, para ahorrar energía… y vuelve cuando sale. | From planning… to operations. This antenna prototype follows T-Minus predictions: it points at Earth while visible… stows when the mountain hides it, to save power… and returns when Earth rises. | **Creativity 3** · Validity (real world) |

The HW exaggeration label stays (CLAUDE.md §10: the device's exaggeration is always labelled). The "no scale labels" rule applies to S1 only, and S1 is rendered at true scale (§3).

### ACT 5 · Proof and future (2:26–3:00)

| Time | Visual | VO (ES) | Subtitle (EN) | Criterion |
|---|---|---|---|---|
| 2:26–2:36 | **APP** Validation tab: zoom on **0.040″**, then the method check (Sun 1.3 / Earth 1.2 points) and the first two rows of the Connecting Ridge table (PGDA 75.2 % → ours on the same terrain 75.2 %). `[chip: vs JPL Horizons · 0.04″]` | ¿Se puede confiar? Sus cálculos del Sol y la Tierra coinciden con los del JPL de la NASA. Y con el mismo relieve, reproduce los mapas de luz de la NASA con alrededor de un punto de diferencia. | Can you trust it? Its Sun and Earth positions match NASA JPL's. And on the same terrain, it reproduces NASA's sunlight maps to within about one point. | **Validity** |
| 2:36–2:46 | **PHONE** the app on a phone in hand → educator-mode toggle | Funciona hoy, gratis, en cualquier navegador… con un modo educativo para que cualquier estudiante lo entienda. | It works today, free, in any browser… with an educator mode so any student can understand it. | Validity (usable) · Impact (reach) |
| 2:46–2:54 | **S1 Earthrise**, **LINK ✓ MALARGÜE** | Mañana, podría guiar a cada nave que vaya al polo sur. Elegí dónde aterrizar… antes de que se ponga la Tierra. | Tomorrow, it could guide every lander bound for the south pole. Choose where to land… before Earth sets. | **Impact (future)** |
| 2:54–3:00 | **End card:** **T-MINUS** · *el reloj de misión lunar* · **Martín Mengo · Equipo T-Minus** · tminus-lunar.vercel.app · NASA Space Apps Challenge 2026 · Buenos Aires · Lunar Landing Site Navigator. Micro-lines: *Datos: NASA LRO/LOLA, NASA PGDA, JPL Horizons/NAIF, NASA DSN, ESA Malargüe. Escenas del horizonte generadas con datos reales.* · *Voz e imágenes: IA (ElevenLabs).* · *No es un producto oficial de la NASA.* | — | — | Presentation |

**If it runs over 3:00, cut in this order:**
1. The 2 s timeline at 1:44.
2. The second sentence at 0:30.
3. Shorten the 2:36 phone beat to 6 s.

**Accuracy (don't change):**
- Never imply T-Minus would have saved Athena. The Athena shot is an AI recreation, tagged as such, with no logos or insignia.
- "Podría guiar" and "puede escucharlas" describe capability, not fact.
- App numbers come from the shipped data:
  - Malapert summit: 66.5 % Sun / 80.3 % Earth.
  - The point 500 m away: 55.0 % / 100 %.
  - Horizons max 0.040″.
  - Method check median: 1.3 (Sun) / 1.2 (Earth) points.
  - Connecting Ridge: 75.2 → 75.2.
- **The 500 m claim:** across the 7 Explore maps, two points 500 m apart differ by up to 41–67 points of sunlight and 52–80 points of Earth visibility.
- "100 % of the time" means over the data span 2026–2028, hourly.
- **The S1 countdown is dramatized:** `T-00:00:05` runs over 5 s of video while real time is compressed, and the `TIME-LAPSE` tag says so. The UTC clock, elevations and link state shown in the HUD are real.
- **What's real vs illustrative:**
  - S1 and S2b are renders of our data.
  - The AI clips are illustrative.
  - The end card says both.

### 2.4 Data chips (Relevance: "NASA data integral")
Small rounded tags, top third, monospace, 1.5–3 s, shown **at the moment that data is in use**:
- `NASA LRO · LOLA`
- `NASA LRO · LOLA 5 m · PGDA`
- `JPL Horizons`
- `NAIF SPICE`
- `NASA DSN`
- `ESA Malargüe DSA-3`
- `validado vs JPL · 0.04″` / `vs JPL Horizons · 0.04″`

No NASA logos.

---

## 3. Production of each element

### S1 — Ridge POV (Earthset + Earthrise) · MUST · Claude
- **Events** (real, from `pipeline/export_video.py`; logged in `video/EVENTS.md`):
  - **Earthset 2027-03-19 17:07 UTC.** Madrid has the Moon at 19° until Earth sets, so SIGNAL LOST is true. Earth is only about 10 % lit (thin crescent) and the Sun is 1.5° below the horizon, so the ridge is dark.
  - **S1 Earthrise shot: 2027-03-05 12:17 UTC.** Malargüe has the Moon at 52° and climbing, above 10° for about 8 h, so LINK ✓ MALARGÜE is true for the whole clip (1.5 h/s). Earth is about 92 % lit.
  - The first pick, 2027-04-01, was rejected for S1: Malargüe was setting and lost the Moon 1.3 h after Earthrise, so the label didn't hold. That Earthrise stays as the end of the antenna cycle (Act 4).
  - Alternatives are exported too (§3 of `video/EVENTS.md`).
- **Scene (three.js):**
  - Camera 2 m above the site, telephoto, pointed at the event azimuth.
  - **True scale everywhere:** the terrain silhouette comes from our horizon computation in distance layers (near / mid / far). Earth is at its real size, position, phase and rotation. No exaggeration, so no scale labels.
  - Starfield. A Sun glow if the Sun is in frame.
- **HUD** (drawn on canvas, so it is captured with the frame; monospace mission-control style):
  - Site and coordinates.
  - Real UTC.
  - Earth elevation and clearance.
  - Per-station link state.
  - The dramatic countdown `T-00:00:05 → 00:00:00` with a small `TIME-LAPSE` tag.
  - Earthset: red `SIGNAL LOST` + glitch.
  - Earthrise: `LINK ✓ MALARGÜE`.
- **Modes:**
  - `?mode=preview`: plays in the browser.
  - `?mode=render`: deterministic `renderFrame(i)` → frame server.
  - `?mode=live&start=<epoch_ms>&scale=<x>`: wall-clock synced with HW.
- **Capture:**
  - `video/frame_server.py` (Python standard library, 127.0.0.1 only) serves the built page and writes the POSTed PNG frames.
  - Then ffmpeg encodes 1080p30 CRF 16. No Playwright.

### S3 — South-pole flyover · Claude (rendered)
- **Terrain:** NASA LOLA `LDEM_75S_120M`, ±200 km around the pole, relief ×1.3.
- **Lighting, baked by `pipeline/export_southpole.py`:** the real Sun at 2027-10-07 12:00 UTC (1.42° above the pole), curvature, Lambert shading, cast shadows with penumbra.
- **Camera:** 12 s flyover from the sunlit side, ending in a push toward Connecting Ridge.
- **Labels** (HUD style, one at a time): Nobile, Mons Mouton (IM-2), Malapert, de Gerlache, Shackleton, Connecting Ridge. Header: "POLO SUR · LOLA".
- **Outputs:** `video/out/southpole_labels.mp4`, `video/out/southpole_clean.mp4`.

### AI clips — ElevenLabs video · Martín
- **Clips:**
  - Earth → Moon (10 s).
  - South-pole landscape with a low circling Sun (12 s).
  - Tipped lander in shadow (10 s).
- **Prompts:** no logos, flags or agency insignia; generic lander.
- **Editor:** the Malargüe marker is added in the editor, not by the AI.

### S2b — Real terrain + Sun · BACKUP · Claude (only after S1, HW scripts and capture are done)
- Heightfield from the 5 m Connecting Ridge tile, about 1024².
- Directional light from the real Sun direction sweeping one lunar day; shadow map 4096.
- Low dolly; ends fading to shadow with a cold tint.

### GFX — "Dos horizontes" · MUST · Martín (in the editor, about 30 min)
- Left: the Moon with a lunar horizon line; Earth rises above it → ✓.
- Right: Earth with Malargüe and its horizon; the Moon rises above it → ✓.
- Both ✓ → "LINK ✓".
- Flat shapes, Sun amber `#bf830b`, Earth blue `#3a7bd5`.

### HW — Antenna prototype · SHOULD
**`video/hw_antenna.py` (Claude; pyserial 3.5):**
- Talks to the **unmodified iss-tracker Pico firmware** directly (no F´).
- Reads exactly the S1 data (`video/public/data/s1_mar2027.json`), through `video/hw_common.py`. The ring uses the same module.
- **Time map** (24 s default, piecewise and shared with S1 live via `knots=` in the URL):
  - 0–8 s: tracks Earth from 2 days before the Earthset (about 6 h/s); Earth sets at about 7.5 s.
  - 8–16 s: fast-forwards the hidden 13 days.
  - 16–24 s: Earthrise at about 16.5 s, then tracking resumes.
- **Mapping:** `az = clamp(3·(az − mean_az), ±85°)`, `el = clamp(45 + 6·el, 0, 90)`. Mean az = 139.26°.
- **While Earth is hidden:** parks 10° below the printed skyline (behind the paper). `--stow` sends the firmware `STOW` instead, which points straight up (az 0, el 90).
- **Commands:** `SET` at 10 Hz, `HEARTBEAT 3`, `STOW` at the end or on Ctrl-C.
- **Flags:**
  - `--dry-run`
  - `--zero`: set az zero by hand at the ring's centre mark.
  - `--lead <s>`
  - `--duration <s>`
  - `--open`: opens the S1 live URL.
  - `--start <epoch_ms>`

**`video/horizon_ring.py` (Claude):** printable PDF of the skyline (A4 strips with alignment marks) using **the same mapping**. Ring radius and pivot height are parameters.
- Defaults: radius 15 cm, pivot 8 cm → 3 A4 tiles, a 44.5 cm strip, skyline 16.4–20.5 cm above the desk.
- Measure the real pivot height and re-run with `--pivot-cm` before printing.
- The pointer arm must be shorter than the ring radius.

**Firmware:** unchanged (`PING`, `ENABLE`, `DISABLE`, `ZERO_AZ`, `SET`, `STOW`, `HEARTBEAT`; `TLM` at 5 Hz). Power on in this order: USB → 12 V → 5 V.

**Filming (Martín):**
- Dark room, laptop behind running S1 live, mount in front.
- Phone on a tripod, slow push-in. 3 takes, plus a close-up of the pointer dropping behind the ring.
- Record the real motor sound.

### APP + PHONE — Screen captures (Martín)
- **Setup:** 1920×1080, browser zoom 125 %, full screen, slow cursor, 3 takes per move.
- **Start URL:** `https://tminus-lunar.vercel.app/?site=connecting-ridge&t=2027-03-12T00:00Z`
- **Moves:**
  1. Explore Malapert: heatmap, two points 500 m apart, then the point 500 m from the summit with its Δ panel.
  2. Countdown cards (Play 1 h/s).
  3. Compare Connecting Ridge + Malapert + de Gerlache rim.
  4. Slip 0 → +30 d.
  5. Link badge.
  6. Timeline.
  7. Validation (0.040″, method check, the first two Connecting Ridge rows).
  8. Educator toggle.
- **PHONE:** layout already checked at 390 px. Film it in hand, scroll the cards, toggle educator mode, plain background.

**Priority if time runs short:** S1 > APP > GFX > AI clips > HW > PHONE > S2b.

---

## 4. Audio + AI video: ElevenLabs, except the real motor sound

**Credit budget (Starter, about 30k credits):**

| Item | Rate | Plan | Credits |
|---|---|---|---|
| Voiceover (ES) | 1 credit per character | about 2.1k characters × 3 takes | ~6.5k |
| EN voiceover for the 30 s cut | — | — | ~1k |
| Music | 900 per minute | 3:00 + 0:30, one retake | ~6.5k |
| Sound effects | 200 per generation | about 12 | ~2.4k |
| AI video clips | Check the price in the app before generating | 3 clips | **check** |

**Music (Eleven Music)** — generate it after the voiceover.
- **3:00 prompt:**
  > Cinematic space score, 3 minutes. 0:00–0:05 low ominous drone with a ticking pulse, then hard stop. 0:05 big orchestral hit, then a driving synth pulse (0:05–0:30), building. 0:30–1:02 wide, awe-inspiring strings and pads (flight to the Moon), turning cold and sparse at 0:52. 1:02–2:02 steady, curious electronic rhythm, lighter (product demo). 2:02–2:26 tension builds, mechanical, determined. 2:26–2:54 hopeful rise to a full emotional climax. 2:54–3:00 resolve and end on a single sustained note. No vocals.
- **0:30 prompt:** the same idea compressed.
- **Sync:** hard silences and sync points are cut in CapCut (silence at 0:04.5, hit at 0:05).
- **Level:** music about −18 LUFS under the VO.

**Sound effects (one generation each):**
1. Countdown beep
2. Static burst → silence
3. Lock-on tone
4. Deep space ambience (loop)
5. Whoosh
6. Title impact
7. UI click
8. Digital pop
9. Power-down hum
10. Glitch, 0.3 s
11. Servo whir (backup)
12. Telemetry chirp

**Recorded for real:** the motor sound in Act 4.

## 5. ElevenLabs voiceover
- **Voice:** Spanish, male, deep, narration.
- **Models:**
  - **v3** for the hook and other high-drama lines, e.g. `[dramatic] En el polo sur de la Luna… [pause] quinientos metros deciden si tu nave vive… [whispers] o muere.`
  - **Multilingual v2** for the rest. If v3 sounds noticeably different from v2, use v3 for everything.
- **Settings (v2):** Stability 35–45 % · Similarity 75 % · Style 15–25 % · Speed 0.95.
- **Generate act by act** (5 files, 2–3 takes each).
- **Text to paste:** numbers written out in words, plus phonetic spellings:
  - "quinientos", "cien por ciento", "más de once puntos", "un punto", "trece horas", "dos mil veinticinco"
  - "Ti Máinus" · "Shákelton" · "Atena" · "jota pe ele" · "Malapér" · "e ese a"
- **Act 1:** about 65 words in 26 s.
- **Global EN voiceover:** the same voice reading the EN subtitle lines of Act 1. Keep the EN subtitles burned in.

## 6. Edit and export (CapCut desktop)
- **Project:** 1920×1080, 30 fps.
- **Track layout (top to bottom):**
  - V3 data chips / GFX / tags
  - V2 subtitles
  - V1 video
  - A1 VO
  - A2 music
  - A3 SFX
  - A4 real motor sound
- **Subtitles:** auto-captions → EN → check every line against §2. Burn in: 2 lines, ≤ 42 characters per line.
- **Typography:** one sans + one monospace.
- **LOCAL:** H.264 High 1080p30, 8 Mbps VBR + AAC 192k. Check with `ffprobe`: ≤ 3:00 and ≤ 200 MB.
- **GLOBAL:** Act 1 (EN VO) + end card, 12 Mbps. Must be ≤ 30.0 s.
- **Metadata `comment`:** "Voiceover: SI-generated (ElevenLabs). Code assisted by Claude Code."
- **Project page:** same arc, same numbers.

## 7. Schedule (ART), re-based at 13:15

| Time | Martín | Claude Code |
|---|---|---|
| 13:15–14:10 | ElevenLabs: voice + Act 1 (v3 hook), then Acts 2–5 | Plan/docs ✓ · `export_video.py` + `video/EVENTS.md` · S1 scaffold |
| 14:10–15:00 | ElevenLabs: AI video clips, music, SFX, EN VO for the global cut | S1 (render + preview + live) → **S1 previewable** |
| 15:00–15:45 | Wire up the HW; `hw_antenna.py --dry-run` → for real; print the ring | `hw_antenna.py` + `horizon_ring.py` |
| 15:45–16:30 | Film HW + PHONE | Frame capture + ffmpeg for S1 shots; then S2b backup |
| 16:30–17:00 | APP screen captures | Fixes |
| 17:00–17:30 | GFX "dos horizontes" + data chips | — |
| 17:30–20:00 | Edit the 3:00 | Fixes on request |
| 20:00–20:20 | 5-second test with 2–3 people | — |
| 20:20–20:45 | 30 s cut + both exports + ffprobe | — |
| 20:45–21:45 | Project page | Draft text |
| **22:30** | **SUBMIT** + screenshot | — |

**Minimum viable fallback** (start no later than 20:00): S1 + APP + GFX + AI clips + VO, dropping HW.

## 8. Rules for Claude Code
- `web/` stays frozen.
- New code goes in `pipeline/export_video.py` and `video/`.
- `video/` is its own package:
  - `.npmrc` with ignore-scripts, the 2026-10-15 cutoff and exact pins.
  - Dependencies: vite 6.4.4 + three 0.160.0 only.
  - Plain JS.
- Python: pyserial 3.5 (pinned).
- Never run vite with `--host`. The frame server binds 127.0.0.1.
- Use only real computed events (`video/EVENTS.md`).
- Push after each green step.
- Never mention F´.
