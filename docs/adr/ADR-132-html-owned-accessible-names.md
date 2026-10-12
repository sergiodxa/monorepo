# ADR-132: `@sdxc/html` Computes Accessible Names Itself

## Status

**Implemented** - 2026-10-11

## Background

[ADR-055](./ADR-055-html-package.md) delegated accessible-name computation in `@sdxc/html`
to `dom-accessibility-api`. The package handed it each parsed element plus a
`getComputedStyle` hook that reads only the inline `style` attribute, since a static
document has no stylesheet cascade.

## Context

That hook diverged from what a browser computes in three ways the package's queries could see:

- Every element's `display` read as empty, which the library treats as block, so inline
  markup split words apart: `<a>Pro<b>file</b></a>` was named `Pro file`.
- `<script>` and `<style>` content counted toward a name built from content.
- HTML-AAM sources the library leaves out — an input's `placeholder`, a figure's
  `<figcaption>` — and an embedded text field's value inside another control's label
  were missing.

`@sdxc/html` already owns the inputs the computation needs: the role table (`roles.ts`),
the markup-level hiding rules (`visibility.ts`), and the inline-element list behind
text reads (`text.ts`). AccName itself is a bounded algorithm, a few hundred lines once
those inputs exist.

## Decision

`@sdxc/html` implements AccName 1.2 with the HTML-AAM name sources in
`src/lib/name.ts`, and drops `dom-accessibility-api`. In order:

1. Hidden nodes are left out, except inside a hidden `aria-labelledby` target, where
   hidden descendants also count.
2. `aria-labelledby`: every target's name in the listed order, without following its
   targets' own references.
3. An embedded control's value, when reached while naming another element: a field's
   text, a select's chosen option, or a range's reading.
4. `aria-label`.
5. Host-language sources: associated `<label>`s, a button-like input's value or its
   default caption, `alt`, the captioning child of `<fieldset>`, `<table>`, `<figure>`
   and `<svg>`, and a field's `title` and then its `placeholder`.
6. Content, for roles named from content and for every recursive step. Inline tags join
   without spacing and blocks are separated by a space, using the same tag list visible
   text uses.
7. `title`.

Roles come from the package's own `roleOf`, so a query's role match and the
name-from-content rule agree on what an element is. A visited set ends the computation
when a label wraps a second control it also names, and the element being named is
skipped inside its own wrapping label.

## Consequences

### Positive

- One document-handling dependency fewer. `linkedom` remains the only one.
- Names match the browser for inline markup, scripts and placeholders, and the rules
  live in one package with its own tests (`src/lib/name.test.ts`).

### Negative

- Keeping up with AccName and HTML-AAM revisions is now this package's job.
- `@sdxc/html/document` no longer exports `DOMStyle`, the style shape the delegated
  computation was typed against.
