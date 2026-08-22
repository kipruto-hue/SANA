#!/usr/bin/env python3
"""Extract the design system from the SANA design bundle into the app.

`design/SANA_AI.html` is the source of truth for how SANA looks. Its stylesheet
calls itself so: "Organic - design-system tokens and component classes. This
file is the source of truth for the system's look." It carries OKLCH-derived
tonal ramps, spacing and radius scales, elevation tokens, and a documented
component vocabulary (.btn, .card, .tag, .dialog, .input, .radio, .seg, .nav,
.table, .elev-*).

The app must NOT reach that design by copying markup out of the render. It
reaches it by running this tool, which emits:

    packages/tokens/src/system.css   the tokens + component classes, verbatim,
                                     with @font-face pointed at local files
    packages/tokens/src/tokens.ts    every token as a typed constant
    packages/tokens/fonts/*.woff2    the real font binaries from the bundle

Extracting the fonts matters for more than tidiness: the demo then has no
network dependency for its typography, so conference wi-fi cannot change how
SANA looks in front of investors.

Run:  python tools/extract_tokens.py [--check]
      --check regenerates into memory and diffs against what is on disk,
      exiting non-zero if the app has drifted from the design. CI runs this,
      which is what keeps the render upstream instead of a stale reference.

Reference: docs/decisions/0001-palette-source-of-truth.md
Sibling:   tools/qatar_dressing.py (edits the bundle; this one only reads it)
"""

from __future__ import annotations

import argparse
import base64
import gzip
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DESIGN = ROOT / "design" / "SANA_AI.html"
OUT_PKG = ROOT / "packages" / "tokens"
OUT_CSS = OUT_PKG / "src" / "system.css"
OUT_TS = OUT_PKG / "src" / "tokens.ts"
OUT_FONTS = OUT_PKG / "fonts"

# What the bundle is expected to contain. These are assertions, not guesses:
# if the design is re-exported and any of them stops holding, extraction fails
# loudly rather than emitting a quietly wrong design system.
EXPECT_STYLE_BLOCKS = 2
EXPECT_FONT_FACES = 8
EXPECT_FONT_FILES = 4
EXPECT_TOKEN_MIN = 40

TS_BANNER = """// GENERATED FILE - DO NOT EDIT.
//
// Extracted from design/SANA_AI.html by tools/extract_tokens.py.
// The design bundle is the source of truth; edit it there (or via
// tools/qatar_dressing.py) and re-run the extractor. Hand-edits here are
// erased on the next run and will fail `npm run tokens:check` in CI."""

BANNER = (
    "/* GENERATED FILE - DO NOT EDIT.\n"
    " *\n"
    " * Extracted from design/SANA_AI.html by tools/extract_tokens.py.\n"
    " * The design bundle is the source of truth; edit it there (or via\n"
    " * tools/qatar_dressing.py) and re-run the extractor. Hand-edits here are\n"
    " * erased on the next run and will fail `npm run tokens:check` in CI.\n"
    " */\n"
)


def fail(msg: str) -> None:
    print(f"FAIL: {msg}", file=sys.stderr)
    sys.exit(1)


# --- reading the bundle -------------------------------------------------------


def load_template(raw: str) -> str:
    """The real page markup lives in one JSON-encoded line of the bundle."""
    lines = raw.split("\n")
    idx = [i for i, l in enumerate(lines) if l.startswith('"<!DOCTYPE html>')]
    if len(idx) != 1:
        fail(f"expected exactly one page-template line, found {len(idx)}")
    return json.loads(lines[idx[0]])


def load_manifest(raw: str) -> dict[str, dict]:
    m = re.search(r'<script type="__bundler/manifest"[^>]*>(.*?)</script>', raw, re.S)
    if not m:
        fail("no __bundler/manifest script tag in the bundle")
    return json.loads(m.group(1))


def asset_bytes(entry: dict) -> bytes:
    data = base64.b64decode(entry["data"])
    return gzip.decompress(data) if entry.get("compressed") else data


# --- fonts --------------------------------------------------------------------

FONT_FACE_RE = re.compile(r"@font-face\s*\{([^}]*)\}", re.S)


def font_filename(family: str, unicode_range: str) -> str:
    """Name a font file after its family and subset.

    Figtree ships one file per subset shared across weights 400/600/700, so
    several @font-face rules legitimately resolve to the same filename. The
    caller asserts that any such collision carries identical bytes.
    """
    subset = "latin-ext" if unicode_range.strip().startswith("U+0100") else "latin"
    return f"{family.strip().strip(chr(39)).strip(chr(34)).lower()}-{subset}.woff2"


def extract_fonts(style: str, manifest: dict) -> tuple[str, dict[str, bytes]]:
    """Rewrite @font-face src to local files; return the CSS and the binaries."""
    files: dict[str, bytes] = {}
    faces = FONT_FACE_RE.findall(style)
    if len(faces) != EXPECT_FONT_FACES:
        fail(f"expected {EXPECT_FONT_FACES} @font-face rules, found {len(faces)}")

    def rewrite(match: re.Match[str]) -> str:
        block = match.group(1)
        family = re.search(r"font-family:\s*([^;]+);", block)
        urange = re.search(r"unicode-range:\s*([^;]+);", block)
        src = re.search(r'src:\s*url\("([^"]+)"\)', block)
        if not (family and urange and src):
            fail("a @font-face rule is missing font-family, unicode-range or src")
        uuid = src.group(1)
        if uuid not in manifest:
            fail(f"@font-face references asset {uuid} which is not in the manifest")
        entry = manifest[uuid]
        if entry["mime"] != "font/woff2":
            fail(f"asset {uuid} is {entry['mime']}, expected font/woff2")
        data = asset_bytes(entry)
        if data[:4] != b"wOF2":
            fail(f"asset {uuid} does not carry a woff2 signature")

        name = font_filename(family.group(1), urange.group(1))
        if name in files and files[name] != data:
            fail(f"two different binaries both want to be {name}")
        files[name] = data

        newblock = re.sub(
            r'src:\s*url\("[^"]+"\)\s*format\(\s*[\'"]woff2[\'"]\s*\)',
            f'src: url("../fonts/{name}") format("woff2")',
            block,
        )
        if newblock == block:
            fail(f"could not rewrite the src of the @font-face for {name}")
        return "@font-face {" + newblock + "}"

    css = FONT_FACE_RE.sub(rewrite, style)
    if len(files) != EXPECT_FONT_FILES:
        fail(f"expected {EXPECT_FONT_FILES} distinct font files, got {len(files)}")
    return css, files


# --- tokens -------------------------------------------------------------------

ROOT_RE = re.compile(r":root\s*\{(.*?)\n\}", re.S)
DECL_RE = re.compile(r"^\s*(--[a-z0-9-]+)\s*:\s*(.+?);\s*$", re.M)


def extract_tokens(style: str) -> dict[str, str]:
    m = ROOT_RE.search(style)
    if not m:
        fail("no :root token block found in the design stylesheet")
    tokens = {name: value.strip() for name, value in DECL_RE.findall(m.group(1))}
    if len(tokens) < EXPECT_TOKEN_MIN:
        fail(f"only {len(tokens)} tokens found, expected at least {EXPECT_TOKEN_MIN}")
    for required in ("--color-bg", "--color-accent", "--color-accent-2", "--color-text"):
        if required not in tokens:
            fail(f"the design stylesheet is missing {required}")
    return tokens


def render_tokens_ts(tokens: dict[str, str]) -> str:
    """Emit the tokens as typed constants.

    Raw values (not just var() references) because the accessibility tests need
    real colours to compute contrast against, and the accent-reservation test
    needs to recognise terracotta wherever it appears.
    """
    lines = [TS_BANNER, "", "export const tokens = {"]
    for name, value in tokens.items():
        lines.append(f"  {json.dumps(name[2:])}: {json.dumps(value)},")
    lines += [
        "} as const;",
        "",
        "export type TokenName = keyof typeof tokens;",
        "",
        "/** Reference a token the way CSS should: `var(--color-bg)`. */",
        "export const cssVar = (name: TokenName): string => `var(--${name})`;",
        "",
        "/**",
        " * The one colour that means 'a human must act here'.",
        " *",
        " * Master prompt section 6 reserves it for the emergency-dial control.",
        " * Nothing else may spend it; a test over the compiled CSS enforces that,",
        " * so the rule survives contributors who have not read the spec.",
        " */",
        "export const URGENT_TOKEN = 'color-accent' satisfies TokenName;",
        "",
    ]
    return "\n".join(lines)


# --- build --------------------------------------------------------------------


def build() -> tuple[str, str, dict[str, bytes]]:
    raw = DESIGN.read_text(encoding="utf-8")
    template = load_template(raw)
    manifest = load_manifest(raw)

    styles = re.findall(r"<style[^>]*>(.*?)</style>", template, re.S)
    if len(styles) != EXPECT_STYLE_BLOCKS:
        fail(f"expected {EXPECT_STYLE_BLOCKS} style blocks, found {len(styles)}")
    system = styles[0]

    tokens = extract_tokens(system)
    css_body, fonts = extract_fonts(system, manifest)
    css = BANNER + "\n" + css_body.strip() + "\n"
    ts = render_tokens_ts(tokens)

    print(f"  tokens:  {len(tokens)}")
    print(f"  fonts:   {len(fonts)} ({', '.join(sorted(fonts))})")
    print(f"  css:     {len(css)} chars")
    return css, ts, fonts


def write(css: str, ts: str, fonts: dict[str, bytes]) -> None:
    OUT_CSS.parent.mkdir(parents=True, exist_ok=True)
    OUT_FONTS.mkdir(parents=True, exist_ok=True)
    OUT_CSS.write_text(css, encoding="utf-8", newline="\n")
    OUT_TS.write_text(ts, encoding="utf-8", newline="\n")
    for name, data in fonts.items():
        (OUT_FONTS / name).write_bytes(data)
    print(f"written: {OUT_CSS}, {OUT_TS}, {len(fonts)} fonts")


def check(css: str, ts: str, fonts: dict[str, bytes]) -> bool:
    ok = True

    def cmp_text(path: Path, want: str) -> None:
        nonlocal ok
        if not path.exists():
            print(f"  MISSING {path.relative_to(ROOT)}")
            ok = False
        elif path.read_text(encoding="utf-8") != want:
            print(f"  DRIFTED {path.relative_to(ROOT)}")
            ok = False
        else:
            print(f"  ok      {path.relative_to(ROOT)}")

    cmp_text(OUT_CSS, css)
    cmp_text(OUT_TS, ts)
    for name, data in fonts.items():
        p = OUT_FONTS / name
        if not p.exists():
            print(f"  MISSING {p.relative_to(ROOT)}")
            ok = False
        elif p.read_bytes() != data:
            print(f"  DRIFTED {p.relative_to(ROOT)}")
            ok = False
        else:
            print(f"  ok      {p.relative_to(ROOT)}")
    return ok


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--check", action="store_true", help="verify only, write nothing")
    args = ap.parse_args()

    css, ts, fonts = build()
    if args.check:
        if not check(css, ts, fonts):
            print(
                "\nThe app's design system no longer matches design/SANA_AI.html.\n"
                "Run `python tools/extract_tokens.py` to regenerate it.",
                file=sys.stderr,
            )
            sys.exit(1)
        print("design system is in sync with the bundle")
        return
    write(css, ts, fonts)


if __name__ == "__main__":
    main()
