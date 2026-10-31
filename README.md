# Ezine reader (static)

Retro DOS/BBS-style web reader for late-90s virus-writing ezines: **29A** (issues 1–8, 4s) and **MATRiX** (issues 1–3). 100% static, EN/FR UI, read-only: nothing is ever executed.

**Live demo:** https://petikvx.github.io/ezine-reader/

## Layout
    index.html, css/, js/   the reader
    data/                   catalog + search index (generated)
    raw/29a/29a-*           29A issues, served as-is (decoded as CP437 in the browser)
    raw/MATRiX/mtx*         MATRiX issues
    tools/build.py          regenerates data/
    serve.sh                local server

For safety this repository ships **text, source code and images only**: executables (`.exe`, `.com`, `.dll`, …) and archives (`.zip`, `.rar`, …) from the original releases are not included.

## Run locally
    ./serve.sh [port]                       # serves on http://localhost:8000 and opens the browser
    python3 tools/build.py [raw_dir] data   # optional: rebuild catalog + search index (Python 3 only)

`raw_dir` is a folder containing `29a/` and `MATRiX/` (default: `raw/`). The site is fully static, so it can be hosted as-is (e.g. GitHub Pages).

## Keys
`/` search · `[` `]` previous/next article · `Esc` back · `j`/`k` scroll. Buttons: font size, theme (vga/green/amber/blue), CRT effect, FR/EN.

## Font
Uses `Perfect DOS VGA 437` / `Px437 IBM VGA` if installed, else DejaVu Sans Mono. To bundle one, add an `@font-face` in `css/style.css`.

## Credits
Ezine contents belong to their original authors (29A, MATRiX).
