# ADR-206: Color Package Stores Extended sRGB and Works in OKLCH

## Status

**Accepted** - 2026-11-27

## Background

Three pieces of work need one color value: `@sdxc/u` should accept a color in its color and
gradient helpers, `@sdxc/a11y` needs DOM contrast checks that read `getComputedStyle`, and apps
derive hover shades and readable text from colors users pick. Each would otherwise parse CSS
colors and compute WCAG luminance on its own.

Browsers now serialize computed colors in more than `rgb()`: `color-mix()` results come back as
`oklab(…)` or `color(srgb …)`, and authored `oklch()` or `color(display-p3 …)` values can sit
outside sRGB. A value type that rounds to 0–255 integers loses those colors on the first read.

## Decision

Create `@sdxc/color`, one immutable `Color` class with zero third-party dependencies (only
`@sdxc/result`) and no DOM or Node APIs.

- **Storage.** A `Color` holds gamma-encoded sRGB as unclamped floats plus alpha 0–1. Channels may
  sit below 0 or above 1 (extended sRGB), so any CSS color, including wide-gamut ones, is kept
  without loss. Integers 0–255 are never stored; hex output rounds at print time.
- **Perceptual work in OKLCH, on demand.** Lightness, chroma, hue, mixing, scales and contrast
  fixes convert to Oklab or OKLCH when called. Nothing caches a second representation.
- **Gamut mapping is explicit.** `toGamut()` runs the CSS Color 4 algorithm (lower OKLCH chroma
  until clipping moves the color less than a just-noticeable difference). Formats that can only
  describe sRGB (`hex`, `rgb`, `hsl`) map first; `toString()` with no format prints `oklch()` for
  an out-of-gamut color instead of clipping it.
- **Errors as values.** `Color.parse` and `ensureContrast` answer a `Result`; numeric
  constructors cannot fail and read non-finite input as 0.
- **API shape.** The surface follows Color.js where it has one (`darken(0.1)` is 10% darker in
  OKLCH lightness, `mix` follows `color-mix()`), so its semantics are familiar.
- **Contrast.** WCAG 2.1 only, named by an `algorithm` argument and an `algorithm` field on the
  result so APCA can be added later. A translucent foreground is painted over the background,
  and a translucent background over white, before measuring.
- **Parsing scope.** Every CSS `<color>` Chrome's `getComputedStyle` can return: hex, named
  colors, `rgb()`, `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()` and `color()` in every
  predefined space. Matrices for those spaces are constants derived from the CSS primaries.

## Consequences

- Wide-gamut colors survive parse, operations and lossless output (`srgb`, `oklch`, `oklab`).
- Operations do not gamut-map their results; callers call `toGamut()` when a color must fit.
- An authored hue on an achromatic color and `none` components do not survive a round trip: a
  gray reads back with hue 0 and `none` reads as 0, so `with({ chroma })` on a gray starts at
  hue 0.
- Each perceptual call converts again; a hot loop over many colors pays that cost per call.
- Relative color syntax, `currentcolor` and system colors are rejected, since resolving them
  needs a document.
