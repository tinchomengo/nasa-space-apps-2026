#!/usr/bin/env bash
# Download raw inputs (SPICE kernels + LOLA DEMs) into data/ (gitignored).
# Resumable and idempotent: re-run until it reports all files OK.
# Expected sizes were checked with HTTP HEAD on 2026-11-14.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA="$ROOT/data"

NAIF=https://naif.jpl.nasa.gov/pub/naif/generic_kernels
PGDA78=https://pgda.gsfc.nasa.gov/data/LOLA_5mpp
LOLA_POLAR=https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/FLOAT_IMG

# dest_subdir  url  expected_bytes (0 = don't check)
FILES=(
  "kernels https://ssd.jpl.nasa.gov/ftp/eph/planets/bsp/de421.bsp 16788480"
  "kernels $NAIF/fk/satellites/moon_080317.tf 0"
  "kernels $NAIF/pck/a_old_versions/pck00008.tpc 0"
  "kernels $NAIF/pck/moon_pa_de421_1900-2050.bpc 0"
  "dem/far $LOLA_POLAR/LDEM_75S_120M_FLOAT.LBL 0"
  "dem/far $LOLA_POLAR/LDEM_75S_120M_FLOAT.IMG 232501504"
  "dem/near $PGDA78/README 0"
  "dem/near $PGDA78/Site01/Site01_final_adj_5mpp_surf.tif 40980810"
  "dem/near $PGDA78/Site04/Site04_final_adj_5mpp_surf.tif 40980806"
  "dem/near $PGDA78/Site06/Site06_final_adj_5mpp_surf.tif 64025603"
  "dem/near $PGDA78/Site07/Site07_final_adj_5mpp_surf.tif 40980808"
  "dem/near $PGDA78/Site11/Site11_final_adj_5mpp_surf.tif 40980806"
  "dem/near $PGDA78/Site20v2/Site20v2_final_adj_5mpp_surf.tif 108192905"
  "dem/near $PGDA78/Site23/Site23_final_adj_5mpp_surf.tif 70586804"
)

size_of() { stat -f%z "$1" 2>/dev/null || stat -c%s "$1" 2>/dev/null || echo 0; }

fail=0
for entry in "${FILES[@]}"; do
  read -r sub url expected <<<"$entry"
  dir="$DATA/$sub"; mkdir -p "$dir"
  name="$(basename "$url")"
  [[ "$name" == README ]] && name=README_LOLA_5mpp.txt
  out="$dir/$name"
  for attempt in 1 2 3 4 5 6; do
    have=$(size_of "$out")
    if [[ "$expected" != 0 && "$have" == "$expected" ]] || [[ "$expected" == 0 && "$have" -gt 0 ]]; then
      break
    fi
    curl -sSfL --retry 3 --connect-timeout 30 -C - -o "$out" "$url" || echo "  retry $attempt: $name"
  done
  have=$(size_of "$out")
  if [[ "$expected" != 0 && "$have" != "$expected" ]] || [[ "$have" == 0 ]]; then
    echo "FAIL $sub/$name ($have / $expected bytes)"; fail=1
  else
    echo "OK   $sub/$name ($have bytes)"
  fi
done
exit $fail
