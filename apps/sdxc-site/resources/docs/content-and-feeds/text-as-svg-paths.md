---
title: Set text as SVG paths
description: Measure text with a font's real metrics on the server, shorten it to fit a width, and draw it as SVG path outlines that look the same wherever the image is shown, for a README badge that needs no web font.
section:
    title: Content & feeds
    order: 8
order: 34
lastUpdated: 2026-10-15
outcomes:
    - "How to measure text with a font's real metrics using `@sdxc/font`"
    - "How to shorten text to fit a width and turn glyphs into SVG path data"
    - "How to lay out a README badge and serve it from a route"
---

A badge in a README, such as a project's latest version, is an SVG image the README links to.
An image loads no web fonts, so an SVG `<text>` element is drawn in whatever font the viewer's
machine picks, and a badge sized for one font clips or gaps in another. Measuring the text with
the font's own metrics and drawing each glyph as a path gives a badge that is the same width
and shape on every screen.

[`@sdxc/font`](/api/font) reads a TrueType font in plain TypeScript: its metrics, its kerning
and its glyph outlines. This guide uses it to size a two-part badge, shorten a long value to fit,
and write the text as SVG path data, served from a route.

```bash
npm add @sdxc/font @sdxc/http @sdxc/result remix
```

## Load the font

`parseFont` takes the bytes of a `.ttf` with TrueType (`glyf`) outlines. In a Worker, bundle the
file as a data module by naming it with a `.bin` extension, for example
`resources/fonts/inter-regular.ttf.bin`, and declare the module shape for TypeScript, as
[Draw social card images](/docs/building-remix-apps/social-card-images) shows. Parse it on the
first badge and keep it for the isolate:

```typescript {% title="app/initializers/badge-font.ts" %}
import type { Font, FontError } from "@sdxc/font";
import type { Result } from "@sdxc/result";

import { parseFont } from "@sdxc/font";

import INTER_REGULAR from "~/resources/fonts/inter-regular.ttf.bin";

let parsed: Result<Font, FontError> | undefined;

export function badgeFont(): Result<Font, FontError> {
	parsed ??= parseFont(INTER_REGULAR);
	return parsed;
}
```

Opening a font reads only its table headers, and each glyph is decoded the first time it is
used and cached on the `Font`, so the cost of a font grows with the characters you draw. A
failure is a `FontError` whose `code` is `unsupported` for a CFF-based `.otf`, a font
collection, or a font with no Unicode character map, and `missing-table` or `malformed` for a
damaged file.

## Measure in pixels

`measure(text, size)` is the width a line takes at `size` pixels per em, with the font's pair
kerning applied. The font's vertical metrics, `ascender`, `descender` (negative) and `lineGap`,
are in font units; dividing by `unitsPerEm` and multiplying by the size converts them to
pixels.

That is enough to shorten text to a width. Drop characters from the end until the text plus an
ellipsis fits:

```typescript {% title="app/services/badges/fit-width.ts" %}
import type { Font } from "@sdxc/font";

export function fitWidth(
	font: Font,
	text: string,
	size: number,
	maxWidth: number,
): string {
	if (font.measure(text, size) <= maxWidth) return text;
	let characters = [...text];
	while (characters.length > 0) {
		characters.pop();
		let candidate = `${characters.join("").trimEnd()}…`;
		if (font.measure(candidate, size) <= maxWidth) return candidate;
	}
	return "…";
}
```

Spreading the string iterates by code point, the unit layout works in, so an astral character
is never split in half. Layout maps one code point to one glyph, with kerning and no
ligatures, which suits Latin, Greek and Cyrillic labels; a script that needs shaping, such as
Arabic or Devanagari, calls for a shaping engine.

`glyphIndex(codePoint)` answers `0`, the font's `.notdef` box, for a character the font does not
have. Checking it before drawing tells you whether a second font is needed:

```typescript {% title="app/services/badges/covers.ts" %}
import type { Font } from "@sdxc/font";

export function covers(font: Font, text: string): boolean {
	for (let character of text) {
		if (font.glyphIndex(character.codePointAt(0) ?? 0) === 0) return false;
	}
	return true;
}
```

## Turn glyphs into path data

`layout(text, size)` places each glyph on a line, answering its glyph index and its `x` from the
line's start. `path(glyph, size, x, y)` answers that glyph's outline in pixels, y down, with
`(x, y)` on the baseline, as `move`, `line`, quadratic `quad` and `close` commands. Each one maps
to an SVG path command:

```typescript {% title="app/services/badges/text-path.ts" %}
import type { Font } from "@sdxc/font";

export function textPath(
	font: Font,
	text: string,
	size: number,
	x: number,
	baseline: number,
) {
	let parts: string[] = [];
	for (let placed of font.layout(text, size).glyphs) {
		for (let command of font.path(placed.glyph, size, x + placed.x, baseline)) {
			if (command.type === "move")
				parts.push(`M${round(command.x)} ${round(command.y)}`);
			else if (command.type === "line")
				parts.push(`L${round(command.x)} ${round(command.y)}`);
			else if (command.type === "quad") {
				parts.push(
					`Q${round(command.cx)} ${round(command.cy)} ${round(command.x)} ${round(command.y)}`,
				);
			} else parts.push("Z");
		}
	}
	return parts.join("");
}

function round(value: number): number {
	return Math.round(value * 100) / 100;
}
```

Two decimals is a hundredth of a pixel, finer than any screen shows, and it keeps the path
data short. Composite glyphs, such as an accented letter built from a base and a mark,
arrive already resolved into one outline.

`outline(glyph)` answers the same commands in font units with y up, for a caller that scales and
flips them itself, such as one writing a `viewBox` in font units.

## Lay out the badge

A badge is a grey label and a coloured value, each padded on both sides. Both widths come from
`measure`, and the baseline centres the font's ascender-to-descender box in the badge's height:

```typescript {% title="app/services/badges/badge-layout.ts" %}
import type { Font } from "@sdxc/font";

import { fitWidth } from "~/app/services/badges/fit-width";
import { textPath } from "~/app/services/badges/text-path";

const SIZE = 11;
const HEIGHT = 20;
const PADDING = 6;
const MAX_VALUE_WIDTH = 160;

export interface BadgeLayout {
	width: number;
	height: number;
	labelWidth: number;
	value: string;
	labelPath: string;
	valuePath: string;
}

export function badgeLayout(font: Font, label: string, value: string): BadgeLayout {
	let shown = fitWidth(font, value, SIZE, MAX_VALUE_WIDTH);
	let labelWidth = Math.ceil(font.measure(label, SIZE)) + PADDING * 2;
	let valueWidth = Math.ceil(font.measure(shown, SIZE)) + PADDING * 2;
	let scale = SIZE / font.unitsPerEm;
	let baseline = HEIGHT / 2 + ((font.ascender + font.descender) / 2) * scale;

	return {
		width: labelWidth + valueWidth,
		height: HEIGHT,
		labelWidth,
		value: shown,
		labelPath: textPath(font, label, SIZE, PADDING, baseline),
		valuePath: textPath(font, shown, SIZE, labelWidth + PADDING, baseline),
	};
}
```

Rounding each half's width up to a whole pixel keeps the edge between the two colours on a pixel
boundary, where it stays sharp.

## Serve it from a route

Render the SVG with `remix/component`'s `renderToString` and answer it with the SVG content
type. `routes.badge` is a route such as `/badges/:name.svg`, and `Releases` is your own model:

```tsx {% title="app/http/controllers/badge.tsx" %}
import { SVG } from "@sdxc/http/content-type";
import { internalServerError, notFound } from "@sdxc/http/response/html";
import { isFailure } from "@sdxc/result";
import { renderToString } from "remix/component/server";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import Releases from "~/app/models/release";
import { badgeFont } from "~/app/initializers/badge-font";
import { badgeLayout } from "~/app/services/badges/badge-layout";
import routes from "~/routes/web";

export default createAction(routes.badge, async (ctx) => {
	let { name } = s.parse(s.object({ name: s.string() }), ctx.params);
	let release = await Releases.latest(ctx.db, name);
	if (release === null) return notFound("Not Found");

	let font = badgeFont();
	if (isFailure(font)) {
		ctx.log.fail(font.error, { table: font.error.table ?? null });
		return internalServerError("The badge font could not be read.");
	}

	let badge = badgeLayout(font.data, "version", release.version);
	let label = `version: ${badge.value}`;
	let svg = await renderToString(
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={badge.width}
			height={badge.height}
			viewBox={`0 0 ${badge.width} ${badge.height}`}
			role="img"
			aria-label={label}
		>
			<title>{label}</title>
			<rect width={badge.labelWidth} height={badge.height} fill="#52525b" />
			<rect
				x={badge.labelWidth}
				width={badge.width - badge.labelWidth}
				height={badge.height}
				fill="#4f46e5"
			/>
			<path d={badge.labelPath} fill="#fff" />
			<path d={badge.valuePath} fill="#fff" />
		</svg>,
	);

	return new Response(svg, {
		headers: { "Content-Type": SVG, "Cache-Control": "public, max-age=300" },
	});
});
```

`<title>` and `aria-label` carry the text a screen reader announces, since the paths themselves
are only shapes. The `width` and `height` attributes give the image its size in a README, which
sizes images from their intrinsic dimensions. Image proxies such as GitHub's cache the badge per
URL, so five minutes is roughly how long a new release takes to show.

## Where to go next

- [Draw social card images](/docs/building-remix-apps/social-card-images) — the same font
  drawn onto a canvas, with wrapping and shrinking done for you.
- [Draw charts as PNG images](/docs/content-and-feeds/png-charts) — labels set in a font on
  a raster image.
- [Draw QR codes](/docs/building-remix-apps/qr-codes) — another image served as SVG from a
  route.
- [`@sdxc/font`](/api/font) — kerning, advances and every metric a font exposes.
