#!/usr/bin/env python3
"""Apply the Qatar dressing change-list to the SANA design bundle.

`design/SANA_AI.html` is a self-contained Claude Design export. The real screen
markup lives in ONE JSON-encoded line (the page template); a separate line holds
a base64/gzip asset blob that also happens to contain the digits "112". A naive
global find-and-replace corrupts that blob, so every edit here is scoped to the
template line only, and every replacement asserts an exact expected count.

Run:  python tools/qatar_dressing.py [--check]
      --check verifies the file is already dressed and exits non-zero if not.

Reference: docs/SANA_Design_ChangeList_Qatar.md (Part A).
"""

import argparse
import json
import re
import sys
from pathlib import Path

DESIGN = Path(__file__).resolve().parent.parent / "design" / "SANA_AI.html"

MIDDOT = "·"


def fail(msg):
    print(f"FAIL: {msg}", file=sys.stderr)
    sys.exit(1)


def encode(template: str) -> str:
    """Re-encode the template the way the exporter does.

    The bundle inlines this JSON string inside a <script> tag, so the slash of
    every closing tag is written as \\u002F to stop `</script>` from terminating
    the tag. Slashes elsewhere (CSS comments) stay literal. json.dumps does not
    escape slashes at all, so we restore the convention afterwards.
    """
    return json.dumps(template, ensure_ascii=False).replace("</", "<\\u002F")


def sub(template: str, find: str, replace: str, expect: int, label: str) -> str:
    got = template.count(find)
    if got != expect:
        fail(f"{label}: expected {expect} occurrence(s) of {find!r}, found {got}")
    print(f"  ok  {label}: {got}x")
    return template.replace(find, replace)


def resub(template: str, pattern: str, replace: str, expect: int, label: str) -> str:
    new, got = re.subn(pattern, replace, template)
    if got != expect:
        fail(f"{label}: expected {expect} match(es) for {pattern!r}, found {got}")
    print(f"  ok  {label}: {got}x")
    return new


# --- A6: confirm-before-guiding beat -----------------------------------------
# The human owns the match (Master Prompt section 3). SANA states the suspected
# protocol and waits; only then are steps read. Uses existing accent-2 tokens --
# terracotta stays reserved for the emergency dial.

CONFIRM_LINE = (
    "This sounds like a faint. I'll talk you through the first steps "
    "— say 'go' or tap Continue."
)

# Anchors: the two stacked step cards (phone 2a, laptop 2b) and the one inline
# step pill (laptop 2a). Verified unique against the template.
CARD_ANCHOR = (
    '<div style="padding: 16px 18px; border-radius: 22px; '
    'background: var(--color-accent-2-100); display: flex; '
    'flex-direction: column; gap: 5px">'
)
INLINE_ANCHOR = (
    '<div style="padding: 18px 24px; border-radius: 26px; '
    'background: var(--color-accent-2-100); max-width: 540px; '
    'display: flex; gap: 16px; align-items: baseline">'
)

CARD_CONFIRM = (
    '<div style="padding: 14px 18px; border-radius: 20px; '
    'border: 1px solid var(--color-accent-2-300); '
    'background: var(--color-neutral-100); display: flex; '
    'flex-direction: column; gap: 10px">'
    '<div style="font-size: 11px; letter-spacing: .1em; text-transform: uppercase; '
    'color: var(--color-accent-2-700)">Confirm before I guide</div>'
    f'<div style="font-size: 15px; line-height: 1.45">{CONFIRM_LINE}</div>'
    '<div style="display: flex; gap: 8px">'
    '<button class="btn btn-secondary" style="flex: 1; min-height: 44px; '
    'font-size: 14px">Continue</button>'
    '<button class="btn btn-secondary" style="min-height: 44px; '
    'padding-inline: 14px; font-size: 14px; color: var(--color-neutral-700)">'
    'Not right?</button>'
    "</div></div>"
)

INLINE_CONFIRM = (
    '<div style="padding: 16px 22px; border-radius: 24px; '
    'border: 1px solid var(--color-accent-2-300); '
    'background: var(--color-neutral-100); max-width: 540px; '
    'display: flex; flex-direction: column; gap: 12px; align-items: center; '
    'text-align: center">'
    '<div style="font-size: 11px; letter-spacing: .1em; text-transform: uppercase; '
    'color: var(--color-accent-2-700)">Confirm before I guide</div>'
    f'<div style="font-size: 16px; line-height: 1.5">{CONFIRM_LINE}</div>'
    '<div style="display: flex; gap: 10px">'
    '<button class="btn btn-secondary" style="min-height: 44px; '
    'padding-inline: 26px; font-size: 15px">Continue</button>'
    '<button class="btn btn-secondary" style="min-height: 44px; '
    'padding-inline: 18px; font-size: 15px; color: var(--color-neutral-700)">'
    'Not right?</button>'
    "</div></div> "
)


def dress(template: str) -> str:
    print("A1  emergency number 112 -> 999 (Qatar)")
    template = sub(template, "112", "999", 19, "112 -> 999")

    print("A2  hospital wording")
    template = sub(template, "Nearest A&amp;E", "Nearest hospital", 1, "Nearest A&E")
    template = sub(template, "A&amp;E open now", "ER open now", 1, "A&E open now")
    template = resub(
        template, r"ER open now " + MIDDOT + r" [^<]*", f"ER open now {MIDDOT} 24 hrs",
        1, "opening hours -> 24 hrs",
    )

    print("A3  warden -> safety officer")
    template = sub(template, "Warden Amina O.", "Safety officer Amina O.", 2, "Warden Amina O.")
    template = sub(template, "Warden on duty", "Safety officer on duty", 1, "Warden on duty")
    template = sub(template, "Warden alerted", "Safety officer alerted", 1, "Warden alerted")
    template = sub(template, "warden alerted", "safety officer alerted", 1, "warden alerted")
    template = sub(template, "who the warden is", "who the safety officer is", 1, "who the warden is")
    template = sub(
        template, "your warden contact", "your safety-officer contact", 1, "your warden contact"
    )
    # Whatever "Warden" survives is the bare field label.
    template = sub(template, "Warden", "Safety officer", 1, "Warden (label)")

    print("A4  phone number -> Qatar")
    template = resub(
        template, r"\+234[^<]*", "+974 3" + MIDDOT * 3 + " " + MIDDOT * 4, 1, "+234 -> +974"
    )

    print("A6  confirm-before-guiding beat")
    template = sub(template, CARD_ANCHOR, CARD_CONFIRM + CARD_ANCHOR, 2, "stacked step cards")
    template = sub(template, INLINE_ANCHOR, INLINE_CONFIRM + INLINE_ANCHOR, 1, "inline step pill")

    return template


STALE = {
    "112": r"(?<![0-9])112(?![0-9])",
    "A&E": r"A&amp;E",
    "warden": r"(?i)warden",
    "+234": r"\+234",
}


def sweep(template: str) -> bool:
    print("A7  consistency sweep")
    clean = True
    for name, pattern in STALE.items():
        hits = len(re.findall(pattern, template))
        status = "ok " if hits == 0 else "STALE"
        print(f"  {status} {name}: {hits}")
        clean = clean and hits == 0
    # "999" alone is not countable -- the bundle already contains 999 inside CSS
    # tokens and asset ids. Count the phrases the change-list actually names.
    expected = (
        ("Call 999", 7),
        ("Emergency services " + MIDDOT + " 999", 1),
        ("emergency, call 999.", 1),
        ("I've put 999", 4),
        ("999 called", 4),
        ("999 dialled from this device", 2),
        ("Safety officer", 5),
        ("+974", 1),
        ("Confirm before I guide", 3),
    )
    for name, expect in expected:
        hits = template.count(name)
        status = "ok " if hits == expect else "OFF"
        print(f"  {status} {name}: {hits} (expected {expect})")
        clean = clean and hits == expect
    return clean


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="verify only, write nothing")
    args = ap.parse_args()

    lines = DESIGN.read_text(encoding="utf-8").split("\n")
    idx = [i for i, l in enumerate(lines) if l.startswith('"<!DOCTYPE html>')]
    if len(idx) != 1:
        fail(f"expected exactly one page-template line, found {len(idx)}")
    i = idx[0]
    raw = lines[i]
    template = json.loads(raw)

    # Prove the round-trip is byte-exact before trusting it with edits.
    if encode(template) != raw:
        fail("re-encoding is not byte-identical; refusing to rewrite the bundle")
    print(f"template line {i + 1}: {len(template)} chars, round-trip verified")

    if args.check:
        sys.exit(0 if sweep(template) else 1)

    before = len(lines)
    template = dress(template)
    if not sweep(template):
        fail("sweep found stale strings after dressing")

    lines[i] = encode(template)
    if len(lines) != before:
        fail("line count changed")
    DESIGN.write_text("\n".join(lines), encoding="utf-8")
    print(f"written: {DESIGN}")


if __name__ == "__main__":
    main()
