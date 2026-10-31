# 29A ezine reader (static)

Retro DOS/BBS-style web reader for the 29A ezine archive (issues 1–8, 4s). 100% static, EN/FR UI, read-only: nothing is ever executed.

## Run
    python3 tools/build.py [raw_dir] data   # regenerate catalog + search index (Python 3 only)
    ./serve.sh [port]                      # starts the server and opens the browser (default port 8000)

`raw/29a/` (29A 1–8, 4s) and `raw/MATRiX/` (MATRiX 1–3) hold the ezine files, served as-is and decoded as CP437 in the browser.
For safety this repository ships **text, source code and images only**: executables (`.exe`, `.com`, `.dll`, …) and archives (`.zip`, `.rar`, …) from the original releases are not included.
The whole thing is static, so it can be hosted as-is (e.g. GitHub Pages).

## Keys
`/` search · `[` `]` previous/next article · `Esc` back · `j`/`k` scroll. Buttons: font size, theme (vga/green/amber/blue), CRT effect, FR/EN.

## Font
Uses `Perfect DOS VGA 437` / `Px437 IBM VGA` if installed, else DejaVu Sans Mono. To bundle one, add an `@font-face` in `css/style.css`.
