# @sdxc/raster

2D canvas for Workers: antialiased paths, gradients, masks and text, out to PNG.

## Installation

```sh
npm add @sdxc/raster
```

Text is set with fonts from [`@sdxc/font`](https://www.npmjs.com/package/@sdxc/font) and images
encode through [`@sdxc/png`](https://www.npmjs.com/package/@sdxc/png); both install alongside. The
canvas is TypeScript over typed arrays, with no WebAssembly, so it runs in Workers, Bun, Node and
the browser.

## Usage

### Draw shapes and encode them

```typescript
import { Canvas, color, Path } from "@sdxc/raster";

let canvas = new Canvas(1200, 630);
canvas.fillRect(0, 0, 1200, 630, color("#0b0c10"));
canvas.fillPath(Path.roundedRect(100, 100, 400, 200, 24), color("oklch(0.52 0.17 275)"));

return new Response(await canvas.toPNG(), { headers: { "content-type": "image/png" } });
```

### Gradients and masks

```typescript
import { Canvas, color, radialGradient, TRANSPARENT } from "@sdxc/raster";

let glow = radialGradient({
	center: [1020, 0],
	radius: [720, 440],
	stops: [
		[0, color("#6366f140")],
		[0.7, TRANSPARENT],
	],
});
canvas.fillRect(0, 0, 1200, 630, glow);

/* Everything drawn inside fades out from the centre. */
canvas.mask(
	radialGradient({
		center: [600, 315],
		radius: 700,
		stops: [
			[0, color("#fff")],
			[0.75, TRANSPARENT],
		],
	}),
	() => {
		for (let x = 0; x < 1200; x += 48) canvas.fillRect(x, 0, 1, 630, color("#2b2d38"));
	},
);
```

### Fit text to a box

```typescript
import { parseFont } from "@sdxc/font";

import { isFailure } from "@sdxc/result";

let font = parseFont(fontBytes);
if (isFailure(font)) return font;

let metrics = canvas.text("A title that may need two lines", {
	font: font.data,
	size: 76,
	minSize: 52,
	maxLines: 2,
	maxWidth: 880,
	tracking: -3,
	x: 600,
	y: 280,
	align: "center",
	paint: color("#f4f4f6"),
});
metrics.height; // where the next block starts
```

The text wraps at spaces, shrinks in 2 px steps down to `minSize` until it fits `maxLines`, and
ends with `…` when it still does not.

## API

### `new Canvas(width, height)`

A transparent image. Pixels are premultiplied floats blended source-over in sRGB, as browsers
composite, and become bytes only on output.

- `fillRect(x, y, width, height, paint)` — fractional edges cover pixels partially.
- `fillPath(path, paint, { rule })` — `"nonzero"` (default) or `"evenodd"`, with exact-area
  antialiasing.
- `layer({ opacity }, draw)` — draws offscreen and composites the result once.
- `mask(paint, draw)` — composites what `draw` drew, scaled by the paint's alpha at each pixel.
- `text(content, options)` and `measureText(content, options)` — return
  `{ size, lines, width, height }`.
- `toImage()` — straight RGBA bytes in the `ImageData` layout. `toPNG(options?)` — PNG bytes.

### `Path`

`moveTo`, `lineTo`, `quadTo`, `cubicTo` and `close`, plus `Path.rect`, `Path.roundedRect` and
`Path.from(commands)` for `@sdxc/font` glyph outlines. An open contour fills as if closed.

`Path.fromSVG(d, { transform })` parses an SVG `d` attribute, arcs included, and throws a
`RangeError` on malformed data. `transform` is an SVG `matrix(a b c d e f)` applied to every point:

```typescript
/* A logo drawn in a 1024 viewBox, scaled to 64 px and placed at (40, 40). */
canvas.fillPath(Path.fromSVG(d, { transform: [1 / 16, 0, 0, 1 / 16, 40, 40] }), color("#fff"));
```

### `color(input)` / `withAlpha(color, opacity)` / `TRANSPARENT`

Parses `#rgb[a]`, `#rrggbb[aa]`, `rgb()`/`rgba()` and `oklch()` into straight-alpha sRGB, clipping
out-of-gamut oklch. Throws a `RangeError` on anything else, since colours are written by hand.

### `linearGradient({ from, to, stops })` / `radialGradient({ center, radius, stops })`

Paints whose stops are `[offset, color]` pairs, interpolated in premultiplied sRGB and padded
with the end colours. A `[rx, ry]` radius makes an elliptical gradient.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/raster": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
