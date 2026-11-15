"""Printable paper skyline ring for the antenna prototype (A4 portrait tiles, PDF).

It uses the same display mapping as hw_antenna.py (hw_common.py: elevation ×6 + 45°, azimuth ×3 around
the mean Earth azimuth). So the pointer drops behind the paper exactly when Earth's centre drops behind
the real terrain.

Geometry: the strip stands vertically on the desk, curved into an arc of radius --radius-cm around the
mount's vertical axis. The pointer pivot is --pivot-cm above the desk. A mount elevation e hits the paper
at height pivot + radius·tan(e), and mount azimuth φ is at arc length radius·φ along the strip.

    .venv/bin/python video/horizon_ring.py --radius-cm 15 --pivot-cm 8      # -> video/out/horizon_ring.pdf
Print at 100 % ("actual size"), check the 10 cm bar, cut along the skyline, and tape the tiles at the marks.
"""
from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.backends.backend_pdf import PdfPages  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parent))
from hw_common import AZ_LIMIT, AZ_SCALE, EL_OFFSET, EL_SCALE, load, mount_az, mount_el, utc  # noqa: E402

PAGE_W, PAGE_H = 21.0, 29.7
MARGIN = 1.2
TILE_W = PAGE_W - 2 * MARGIN       # strip length per tile (cm)
OVERLAP = 1.0
BASE_Y = 3.0                        # desk line on the page (cm); the strip below it is a glue flap


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--radius-cm", type=float, default=15.0)
    ap.add_argument("--pivot-cm", type=float, default=8.0, help="pointer pivot height above the desk")
    ap.add_argument("--span-deg", type=float, default=AZ_LIMIT, help="mount azimuth half-span covered by the ring")
    ap.add_argument("--out", default=str(Path(__file__).resolve().parent / "out" / "horizon_ring.pdf"))
    a = ap.parse_args()
    tr = load()
    R, P = a.radius_cm, a.pivot_cm

    def height(m_el: float) -> float:
        return P + R * math.tan(math.radians(min(m_el, 80.0)))

    # sample the skyline along the strip (mount azimuth -> real azimuth via the inverse mapping)
    n = 1200
    phis = [-a.span_deg + 2 * a.span_deg * k / (n - 1) for k in range(n)]
    xs = [R * math.radians(p + a.span_deg) for p in phis]           # arc length from the strip's left end
    real_az = [(tr.mean_az + p / AZ_SCALE) % 360 for p in phis]
    ys = [height(mount_el(tr.mask_at(z))) for z in real_az]
    total = xs[-1]
    top = max(ys)
    if BASE_Y + top > PAGE_H - MARGIN - 2.5:
        print(f"warning: skyline reaches {top:.1f} cm; reduce --radius-cm or --pivot-cm to fit A4", file=sys.stderr)

    # where Earth sets / rises on the strip (real events)
    marks = []
    for label, t in (("EARTHSET", tr.t_set), ("EARTHRISE", tr.t_rise)):
        az, el, _ = tr.at(t)
        marks.append((label, R * math.radians(mount_az(az, tr.mean_az) + a.span_deg), height(mount_el(el)), utc(t)))

    tiles = max(1, math.ceil((total - OVERLAP) / (TILE_W - OVERLAP)))
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    with PdfPages(a.out) as pdf:
        for k in range(tiles):
            x0 = k * (TILE_W - OVERLAP)
            fig = plt.figure(figsize=(PAGE_W / 2.54, PAGE_H / 2.54))
            ax = fig.add_axes([0, 0, 1, 1])
            ax.set_xlim(0, PAGE_W); ax.set_ylim(0, PAGE_H); ax.set_aspect("equal"); ax.axis("off")
            X = lambda x: MARGIN + (x - x0)
            seg = [(X(x), BASE_Y + y) for x, y in zip(xs, ys) if x0 - 0.05 <= x <= x0 + TILE_W + 0.05]
            if seg:
                poly = [(seg[0][0], BASE_Y)] + seg + [(seg[-1][0], BASE_Y)]
                ax.fill([p[0] for p in poly], [p[1] for p in poly], color="#2b2f38", lw=0)
                ax.plot([p[0] for p in seg], [p[1] for p in seg], color="black", lw=0.8)
                ax.plot([seg[0][0], seg[-1][0]], [BASE_Y, BASE_Y], color="black", lw=0.6, ls="--")
                ax.fill_between([seg[0][0], seg[-1][0]], BASE_Y - 1.5, BASE_Y, color="#d9dce2", lw=0)
                ax.text(seg[0][0] + 0.2, BASE_Y - 1.0, "fold / glue flap", fontsize=6, color="#555")
            # azimuth ticks (real azimuth) along the desk line
            for p in range(-int(a.span_deg), int(a.span_deg) + 1, 15):
                x = R * math.radians(p + a.span_deg)
                if x0 <= x <= x0 + TILE_W:
                    ax.plot([X(x), X(x)], [BASE_Y, BASE_Y + 0.6], color="white", lw=0.8)
                    z = (tr.mean_az + p / AZ_SCALE) % 360
                    ax.text(X(x), BASE_Y + 0.8, f"{z:.0f}°", fontsize=6, color="white", ha="center")
                    if p == 0:
                        ax.plot([X(x), X(x)], [BASE_Y, BASE_Y + 3], color="#f4c25a", lw=1.5)
                        ax.text(X(x), BASE_Y + 3.3, "MOUNT AZ 0", fontsize=6.5, color="#f4c25a", ha="center", weight="bold")
            for label, x, y, when in marks:
                if x0 <= x <= x0 + TILE_W:
                    ax.plot(X(x), BASE_Y + y, marker="v", color="#3a7bd5", ms=6)
                    ax.text(X(x), BASE_Y + y + 0.5, f"{label}\n{when}", fontsize=5.5, color="#3a7bd5", ha="center")
            # overlap / alignment marks
            for xe, tag in ((x0, f"{chr(64 + k)}" if k else None), (x0 + TILE_W - OVERLAP, chr(65 + k) if k < tiles - 1 else None)):
                if tag:
                    ax.plot([X(xe), X(xe)], [BASE_Y - 1.5, BASE_Y + top + 0.5], color="#d14", lw=0.6, ls=":")
                    ax.text(X(xe), BASE_Y + top + 0.8, f"align {tag}", fontsize=6, color="#d14", ha="center")
            # header + scale bar
            ax.text(MARGIN, PAGE_H - 1.5, f"T-Minus · horizon ring · tile {k + 1}/{tiles}", fontsize=10, weight="bold")
            ax.text(MARGIN, PAGE_H - 2.1,
                    f"Shackleton Connecting Ridge skyline (NASA LOLA 5 m + 120 m). Prototipo: elevación ×{EL_SCALE:g} (+{EL_OFFSET:g}°), "
                    f"azimut ×{AZ_SCALE:g}.", fontsize=6.5)
            ax.text(MARGIN, PAGE_H - 2.6,
                    f"Ring radius {R:g} cm · pivot {P:g} cm above desk · mount az 0 = Earth mean az {tr.mean_az:.2f}° · strip {total:.1f} cm",
                    fontsize=6.5, color="#555")
            ax.plot([MARGIN, MARGIN + 10], [1.0, 1.0], color="black", lw=1.5)
            ax.text(MARGIN + 10.3, 0.9, "10 cm: print at 100 %", fontsize=6.5)
            pdf.savefig(fig)
            plt.close(fig)
    print(f"{a.out}: {tiles} A4 tiles · strip {total:.1f} cm · skyline {min(ys):.1f}–{top:.1f} cm above the desk · "
          f"mean az {tr.mean_az:.2f}°")


if __name__ == "__main__":
    main()
