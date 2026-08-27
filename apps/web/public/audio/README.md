# Generated voice

Fish Audio renders the frozen library to files here — master prompt section 1.4.

```
audio/
  _system/<line>.wav        the eight locked system lines
  <protocol-id>/NN.wav      one per protocol step
  <protocol-id>/confirm.wav the confirm-before-guiding prompt
```

Paths come from the `audio` field on each step and system line in
`packages/protocols/content/`, so the library decides what a line sounds like
the same way it decides what it says. The confirm prompt is the one exception:
its path is `<protocol-id>/confirm.wav` by convention, because adding a field
for it would change every protocol's hash, and the frozen library changes only
through a deliberate reviewed update.

The `.wav` files are gitignored — they are large and rebuildable. What is
versioned is the text they were rendered from and its hash.

**Until they are generated, SANA is silent and the screen carries the step.**
That is the intended behaviour: there is no second voice to fall back to, and
the log records each miss as silence rather than implying a line was spoken.
