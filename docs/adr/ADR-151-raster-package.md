# ADR-151: `@sdxc/raster` Draws 2D Images in a Worker

## Status

**Accepted** - 2026-10-15

## Background

The packages site wants a social card per page that matches its landing page: a near-black
field, a brand glow from one corner, a grid that fades out from the middle, dashed rails and
rules with square markers where they meet, and centred text. The usual way to render one in
a Worker is Satori (JSX and CSS to SVG) plus resvg (SVG to PNG) as WebAssembly. A card is a
handful of rectangles, two gradients, a mask and some text, so a small 2D canvas covers it
without a layout engine, a CSS subset, or a 3–4 MB bundle.

## Decision

Create `@sdxc/raster`: one `Canvas` class with an antialiased polygon rasterizer, paints,
layers and text, ending in a PNG through `@sdxc/png`. Text uses `@sdxc/font`.

```ts
import { Canvas, Path, color, radialGradient } from "@sdxc/raster";

let canvas = new Canvas(1200, 630);
canvas.fillRect(0, 0, 1200, 630, color("#0b0c10"));
canvas.fillRect(
	0,
	0,
	1200,
	630,
	radialGradient({
		center: [1020, 0],
		radius: [720, 440],
		stops: [
			[0, glow],
			[0.7, clear],
		],
	}),
);
canvas.mask(
	radialGradient({
		center: [600, 315],
		radius: 720,
		stops: [
			[0, color("#fffc")],
			[0.75, clear],
		],
	}),
	() => drawGrid(canvas),
);
canvas.text("Sign and verify JWTs", {
	font,
	size: 76,
	tracking: -3,
	x: 600,
	y: 322,
	align: "center",
	maxWidth: 900,
	maxLines: 2,
	minSize: 52,
	paint: white,
});
let png = await canvas.toPNG();
```

### Pixels and colour

- The canvas holds premultiplied RGBA in a `Float32Array`, blended source-over in sRGB space
  the way browsers composite, and quantised once in `toImage()`, so stacked translucent
  layers do not accumulate rounding.
- **`color(input)`** parses `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()`/`rgba()` and
  `oklch(L C H / A)` (L as `0–1` or a percentage) into `Raster.Color`
  (`{ r, g, b, a }`, 0–1, straight alpha), clamping out-of-gamut oklch to sRGB. An unknown
  string is a `RangeError`: colours are authored, not user input. oklch support lets a card
  read the same tokens as the site's stylesheet.

### Shapes

- **`Path`** builds contours: `moveTo`, `lineTo`, `quadTo`, `cubicTo`, `close`, plus
  `Path.rect(x, y, w, h)` and `Path.roundedRect(x, y, w, h, r)`, and `Path.from(commands)` for
  `@sdxc/font`'s command lists.
- **`fillPath(path, paint, { rule?: "nonzero" | "evenodd" })`** flattens curves to segments
  (subdividing until the chord error is under 0.1 px) and fills with exact-area coverage
  accumulation (the signed-area technique of font-rs and stb_truetype), giving analytic
  antialiasing with no supersampling. Work is bounded to the path's clipped bounding box.
- **`fillRect(x, y, w, h, paint)`** is the fast path for axis-aligned rectangles, with
  fractional edges covered partially so 1 px hairlines at half-pixel offsets stay crisp.

### Paints

`Raster.Paint` is a `Raster.Color` or a gradient:

- **`linearGradient({ from: [x, y], to: [x, y], stops })`**
- **`radialGradient({ center: [x, y], radius: r | [rx, ry], stops })`** — elliptical when
  given two radii, matching CSS `radial-gradient(rx ry at x y)`.
- Stops are `[offset 0–1, Raster.Color][]`, interpolated in premultiplied sRGB as CSS does,
  so a fade to transparent never darkens through grey.

### Layers

- **`layer(options: { opacity?: number }, draw: () => void)`** draws into an offscreen
  buffer and composites it once, so overlapping shapes inside fade as one.
- **`mask(paint, draw)`** is a layer whose every pixel is multiplied by the paint's alpha at
  that point, which is how the grid fades out from the middle.

### Text

- **`text(content, options): Raster.TextMetrics`** lays out with `font.layout`, then:
  wraps at spaces to `maxWidth` (a single word wider than the box breaks by character),
  shrinks `size` in 2 px steps down to `minSize` until the text fits `maxLines`, and ends the
  last line with `…` when it still does not. `align` is `"start" | "center" | "end"` about
  `x`; `y` is the first baseline; `lineHeight` is a multiple of `size` (default `1.15`).
  It returns `{ size, lines, width, height }` so a caller can place what comes below it.
- **`measureText(content, options)`** returns the same metrics without drawing.

### Output

- **`toImage(): PNG.Image`** — straight RGBA bytes, the `ImageData` layout.
- **`toPNG(options?)`** — `encode(this.toImage(), options)` from `@sdxc/png`.

## Consequences

### Positive

- **No WebAssembly and no layout engine.** The package is TypeScript over typed arrays.
- **Exact text fitting.** The metrics that decide the wrap are the glyphs that get painted.

### Negative

- **Coordinates, not CSS.** A template positions everything itself; a design change is a
  code change.
- **CPU-bound.** A full-canvas gradient at 1200×630 touches 756,000 pixels in JavaScript —
  tens of milliseconds. Callers cache the PNG rather than render per request.

### Neutral

- No strokes: lines are rectangles or filled paths. No image drawing, no blend modes beyond
  source-over, no hinting (text above ~20 px looks the same without it).

## Alternatives Considered

### 1. Satori + resvg-wasm

**Rejected because**: of the bundle size and cold start, and because it exchanges our own
coordinates for a CSS subset that has its own rules to learn.

### 2. Cloudflare Browser Rendering

**Rejected because**: a headless browser per card is slow, billed per session, and needs a
paid binding, for an image that is rectangles and text.

## References

- [ADR-149](./ADR-149-png-package.md), [ADR-150](./ADR-150-font-package.md)
- [font-rs: how the coverage accumulation works](https://medium.com/@raphlinus/inside-the-fastest-font-renderer-in-the-world-75ae5270c445)
