# @sana/tokens

**Everything in `src/` and `fonts/` is generated. Do not edit it.**

The source of truth for how SANA looks is `design/SANA_AI.html` — the reviewed,
Qatar-dressed Claude Design export. This package is how that design reaches the
application, and it is the *only* sanctioned route. The alternative — copying
markup out of the render into components — is what produced a frontend that
was visibly off last time, and is not to be repeated.

## Regenerate

```sh
npm run tokens          # python tools/extract_tokens.py
npm run tokens:check    # fails if the app has drifted from the design
```

`tokens:check` runs in CI. If someone hand-edits `system.css`, or the design is
re-exported without re-running the extractor, the build fails and says so.

## What is here

| Path | What it is |
|---|---|
| `src/system.css` | The design system verbatim: the `:root` token block, base element styles, and the component classes (`.btn`, `.card`, `.tag`, `.dialog`, `.input`, `.radio`, `.seg`, `.nav`, `.table`, `.elev-*`). `@font-face` rules are rewritten to point at `fonts/`. |
| `src/tokens.ts` | All 48 tokens as typed constants, plus `cssVar()` and `URGENT_TOKEN`. Raw values, not just `var()` references, because the accessibility tests need real colours to compute contrast. |
| `fonts/*.woff2` | Caprasimo and Figtree, latin and latin-ext subsets, extracted from the bundle's asset manifest. |

## Why the fonts are vendored

They are lifted out of the bundle rather than loaded from Google Fonts so the
app has **no network dependency for its typography**. On 28 August this runs in
front of investors on conference wi-fi; a webfont that fails to load would
reflow every screen in a fallback face. 54KB is a cheap price for that not
being possible.

## Using it

Import the stylesheet once, at the app root:

```ts
import '@sana/tokens/system.css';
```

Then style with the tokens — never with literal colours:

```css
.thing { background: var(--color-surface); color: var(--color-text); }
```

`--color-accent` (terracotta `#c67139`) is **reserved for the emergency-dial
control**. Master prompt section 6: it is the "a human must act here" colour and
nothing else may spend it. A test over the compiled CSS enforces this, so the
rule holds even for contributors who have not read the spec.
