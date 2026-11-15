"""Drive the antenna prototype (unmodified iss-tracker Pico firmware) through a real Earthset -> Earthrise.

It replays Connecting Ridge from 2 days before the 2027-03-19 Earthset to 2 days after the 2027-04-01
Earthrise in --duration seconds: a third tracking Earth as it sets, a third fast-forwarding the hidden
13 days, a third as it rises and is tracked again. The data is the same as the S1 render, and it prints the matching S1 live URL so the
laptop screen and the mount stay in sync.

    .venv/bin/python video/hw_antenna.py --dry-run                 # no serial: prints the plan + commands
    .venv/bin/python video/hw_antenna.py --zero                    # align az zero by hand, then run
    .venv/bin/python video/hw_antenna.py --port /dev/tty.usbmodem1101 --duration 24 --lead 12

While Earth is above the terrain (clearance > 0), the mount points at it (prototype mapping: el ×6, az ×3).
At Earthset, by default it drops to --park-below degrees under the printed skyline and holds there
(behind the paper ring). With --stow it sends the firmware STOW instead (az 0, el 90 = pointing up).
At Earthrise it points at Earth again. When the run ends, it sends STOW.

Firmware protocol: PING, ENABLE, DISABLE, ZERO_AZ, SET <az> <el>, STOW, HEARTBEAT <s>; TLM at 5 Hz.
Power-on order: USB, then 12 V, then 5 V.
"""
from __future__ import annotations

import argparse
import glob
import sys
import threading
import time
import webbrowser

sys.path.insert(0, __import__("os").path.dirname(__file__))
from hw_common import interp, load, mount_az, mount_el, utc  # noqa: E402

RATE_HZ = 10


class DryLink:
    def __init__(self):
        self.last = 0.0

    def send(self, line: str, force: bool = False) -> None:
        now = time.monotonic()
        if force or not line.startswith(("SET", "PING")) or now - self.last > 0.5:
            print(f"  -> {line}", flush=True)
            if line.startswith(("SET", "PING")):
                self.last = now

    def close(self) -> None:
        pass


class SerialLink:
    def __init__(self, port: str):
        import serial  # pyserial 3.5 (video/requirements.txt)
        self.s = serial.Serial(port, 115200, timeout=0.2)
        self.stop = False
        self.tlm = ""
        threading.Thread(target=self._read, daemon=True).start()

    def _read(self) -> None:
        while not self.stop:
            try:
                line = self.s.readline().decode(errors="replace").strip()
            except Exception as e:  # noqa: BLE001
                print(f"serial read error: {e}", flush=True)
                return
            if not line:
                continue
            if line.startswith("TLM"):
                self.tlm = line
            elif not line.startswith("OK SET") and not line.startswith("OK PING"):
                print(f"  <- {line}", flush=True)

    def send(self, line: str, force: bool = False) -> None:
        self.s.write((line + "\n").encode())

    def close(self) -> None:
        self.stop = True
        time.sleep(0.3)
        self.s.close()


def find_port() -> str:
    ports = sorted(glob.glob("/dev/tty.usbmodem*") + glob.glob("/dev/ttyACM*"))
    if not ports:
        raise SystemExit("no Pico serial port found (looked for /dev/tty.usbmodem*); pass --port")
    return ports[0]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--port")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--duration", type=float, default=24.0, help="wall seconds for the whole replay (S1 'cycle' default 24)")
    ap.add_argument("--lead", type=float, default=10.0, help="seconds from now until playback starts (time to press record)")
    ap.add_argument("--start", type=float, help="playback start as Unix epoch ms (to reuse an S1 live URL)")
    ap.add_argument("--park-below", type=float, default=10.0, help="mount degrees below the printed skyline while Earth is hidden")
    ap.add_argument("--stow", action="store_true", help="at Earthset send firmware STOW (points up) instead of parking low")
    ap.add_argument("--zero", action="store_true", help="disable, let you align the mount to the ring's centre mark, then ZERO_AZ")
    ap.add_argument("--open", action="store_true", help="open the S1 live URL in the default browser")
    ap.add_argument("--page", default="http://127.0.0.1:8765/", help="S1 page served by video/frame_server.py")
    a = ap.parse_args()

    tr = load()
    kn = tr.knots(a.duration)
    start_ms = a.start if a.start else (time.time() + a.lead) * 1000
    kq = ";".join(f"{w:.3f}:{t:.0f}" for w, t in kn)
    url = f"{a.page}?shot=cycle&mode=live&start={start_ms:.0f}&knots={kq}"
    w = lambda t: interp(kn, t, inverse=True)
    print(f"Connecting Ridge · mean Earth az {tr.mean_az:.2f}° = mount az 0 (centre mark on the ring)")
    print(f"Earthset  {utc(tr.t_set)}  at +{w(tr.t_set):.1f} s")
    print(f"Earthrise {utc(tr.t_rise)}  at +{w(tr.t_rise):.1f} s")
    print(f"time-lapse ×{(kn[1][1] - kn[0][1]) / kn[1][0]:.0f} while tracking, ×{(kn[2][1] - kn[1][1]) / (kn[2][0] - kn[1][0]):.0f} "
          f"while hidden · duration {a.duration:.0f} s · starts in {(start_ms / 1000 - time.time()):.1f} s")
    print(f"S1 live: {url}\n", flush=True)
    if a.open:
        webbrowser.open(url)

    link = DryLink() if a.dry_run else SerialLink(a.port or find_port())
    try:
        link.send("PING", force=True)
        link.send("HEARTBEAT 3", force=True)
        if a.zero and not a.dry_run:
            link.send("DISABLE", force=True)
            input("Stepper off. Turn the mount by hand to the ring's centre mark, then press Enter… ")
            link.send("ZERO_AZ", force=True)
        link.send("ENABLE", force=True)

        hidden = None
        park_az = 0.0
        while True:
            now = time.time()
            tw = now - start_ms / 1000
            if tw > a.duration:
                break
            t = interp(kn, max(0.0, tw))
            az, el, clear = tr.at(t)
            maz, mel = mount_az(az, tr.mean_az), mount_el(el)
            is_hidden = clear <= 0
            if is_hidden != hidden:
                if hidden is not None:
                    print(f"[{max(0, tw):5.1f} s] {utc(t)}  {'EARTHSET' if is_hidden else 'EARTHRISE'}  clearance {clear:+.3f}°", flush=True)
                if is_hidden and a.stow:
                    link.send("STOW", force=True)
                hidden = is_hidden
                park_az = maz
            if is_hidden:
                if a.stow:
                    link.send("PING")  # heartbeat only; SET would leave the stow pose
                else:
                    skyline = mount_el(tr.mask_at(az))
                    link.send(f"SET {park_az:.2f} {max(0.0, skyline - a.park_below):.2f}")
            else:
                link.send(f"SET {maz:.2f} {mel:.2f}")
            time.sleep(1 / RATE_HZ)
        link.send("STOW", force=True)
        print("done: STOW sent", flush=True)
        time.sleep(0.5)
    except KeyboardInterrupt:
        link.send("STOW", force=True)
        print("\ninterrupted: STOW sent")
    finally:
        link.close()


if __name__ == "__main__":
    main()
