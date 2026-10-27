---
title: Set text as SVG paths
description: Measure text with a font's real metrics on the server, shorten it to fit a width, and draw it as SVG path outlines that look the same wherever the image is shown, for a README badge that needs no web font.
section:
    title: Content & feeds
    order: 8
order: 34
lastUpdated: 2026-10-26
outcomes:
    - "How to measure text with a font's real metrics using `@sdxc/font`"
    - "How to shorten text to fit a width and turn glyphs into SVG path data"
    - "How to lay out a README badge and serve it from a route"
---

A README badge is an SVG image, and an image loads no web fonts, so its `<text>` is drawn in
whatever font the viewer's machine picks and clips or gaps in another. Measuring the text with
the font's own metrics and drawing each glyph as a path gives a badge that looks the same on
every screen. This guide uses [`@sdxc/font`](/api/font) to size a two-part badge, shorten a long
value to fit, and write the text as SVG path data, served from a route.

```bash
npm add @sdxc/font @sdxc/http @sdxc/result remix
```

## Load the font

`parseFont` takes the bytes of a `.ttf`, an `.otf` or a `.woff`. In a Worker, bundle the file as a data module by naming
it with a `.bin` extension, as [Draw social card images](/docs/building-remix-apps/social-card-images)
shows. Parse it on the first badge and keep it for the isolate:

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

<note>
A `.woff2` file and a font collection (`.ttc`, `.dfont`) fail with an `unsupported` `FontError`.
Open them with `parseWoff2` from `@sdxc/font/woff2` and with `parseFontCollection`.
</note>

## Pick a weight from a variable font

A variable font holds every weight in one file. `instance` from `@sdxc/font/variations` fixes it
at a point on its axes, and the instance measures, lays out and draws at that weight. Make the
instance in the same initializer, so the badge parses the file and fixes the weight once:

```typescript {% title="app/initializers/badge-font.ts" %}
import type { Font, FontError } from "@sdxc/font";
import type { Result } from "@sdxc/result";

import { parseFont } from "@sdxc/font";
import { instance } from "@sdxc/font/variations";
import { isFailure } from "@sdxc/result";

import INTER_VARIABLE from "~/resources/fonts/inter-variable.ttf.bin";

let parsed: Result<Font, FontError> | undefined;

export function badgeFont(): Result<Font, FontError> {
	parsed ??= semibold();
	return parsed;
}

function semibold(): Result<Font, FontError> {
	let font = parseFont(INTER_VARIABLE);
	if (isFailure(font)) return font;
	return instance(font.data, { wght: 600 });
}
```

A value outside an axis's range is clamped to it, and `axes(font)` lists each axis with its
`min`, `default` and `max`. A font with no axes answers an `unsupported` `FontError`.

## Measure in pixels

`measure(text, size)` is the width a line takes at `size` pixels per em, kerning applied. To
shorten text to a width, drop characters from the end until the text plus an ellipsis fits:

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

<note>
`measure` and `layout` map one code point to one glyph, with kerning, which suits Latin, Greek
and Cyrillic labels. Text in a script that joins or reorders its letters, such as Arabic or
Devanagari, goes through `shape`, as [Shape text in any script](#shape-text-in-any-script) shows.
</note>

## Turn glyphs into path data

`layout(text, size)` places each glyph on a line, and `path(glyph, size, x, y)` answers its
outline in pixels with `(x, y)` on the baseline, as commands that each map to an SVG path
command. A TrueType outline curves with `quad` commands and a CFF outline in an `.otf` with
`cubic` ones:

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
			parts.push(svgCommand(command));
		}
	}
	return parts.join("");
}

export function svgCommand(command: Font.Command): string {
	switch (command.type) {
		case "move":
			return `M${point(command.x, command.y)}`;
		case "line":
			return `L${point(command.x, command.y)}`;
		case "quad":
			return `Q${point(command.cx, command.cy)} ${point(command.x, command.y)}`;
		case "cubic": {
			let { c1x, c1y, c2x, c2y, x, y } = command;
			return `C${point(c1x, c1y)} ${point(c2x, c2y)} ${point(x, y)}`;
		}
		case "close":
			return "Z";
	}
}

function point(x: number, y: number): string {
	return `${Math.round(x * 100) / 100} ${Math.round(y * 100) / 100}`;
}
```

Two decimals is finer than any screen shows, and keeps the path data short.

## Shape text in any script

`shape` from `@sdxc/font/shaping` runs the font's own layout rules: ligatures, the joined forms
of Arabic, the reordered vowels of Devanagari, and marks placed on their letters. It detects the
script from the text and answers the glyphs in visual order, so a right-to-left run comes back
reversed and draws left to right like any other:

```typescript {% title="app/services/badges/shaped-path.ts" %}
import type { Font } from "@sdxc/font";

import { shape } from "@sdxc/font/shaping";

import { svgCommand } from "~/app/services/badges/text-path";

export function shapedPath(
	font: Font,
	text: string,
	size: number,
	x: number,
	baseline: number,
) {
	let scale = size / font.unitsPerEm;
	let shaped = shape(font, text, { features: { tnum: true } });
	let pen = x;
	let parts: string[] = [];
	for (let glyph of shaped.glyphs) {
		let left = pen + glyph.xOffset * scale;
		let top = baseline - glyph.yOffset * scale;
		for (let command of font.path(glyph.glyph, size, left, top)) {
			parts.push(svgCommand(command));
		}
		pen += glyph.xAdvance * scale;
	}
	return { d: parts.join(""), width: shaped.advanceWidth * scale };
}
```

Shaped positions are in font units with y up, so they scale by `size / unitsPerEm` and the
vertical offset is subtracted from the baseline. `features` turns OpenType features on or off;
`tnum` sets every digit at one width, so a version badge keeps its size as the number changes.
To use it in the badge, call `shapedPath` where `badgeLayout` calls `textPath`, and take each
part's width from its `width`.

<note>
`shape` sets one run: one script in one direction. Split a label that mixes scripts, such as
English beside Arabic, into a run per script and place the runs side by side.
</note>

## Lay out the badge

A badge is a grey label and a coloured value, each padded on both sides. Both widths come from
`measure`. The baseline centres the font's cap height, the height of a capital or a digit, so
the text sits in the middle of the badge whatever room the font leaves above for accents.
`capHeight` is `null` in a font too old to record it, and the ascender stands in:

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
	let baseline = HEIGHT / 2 + ((font.capHeight ?? font.ascender) / 2) * scale;

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

`<title>` and `aria-label` carry the text a screen reader announces, since the paths are only
shapes.

## Embed the font in a file of your own

Path data carries the shapes and leaves the font behind. A format that carries the font itself,
such as a PDF or a font file for another program, embeds it, which the font's license may
forbid. `font.embedding` reports what the license allows, and `subset` from
`@sdxc/font/subset` writes a font holding only the glyphs you name:

```typescript {% title="app/services/badges/embedded-font.ts" %}
import type { Font } from "@sdxc/font";

import { subset } from "@sdxc/font/subset";

export function embeddedFont(font: Font, text: string) {
	if (font.embedding.allowed === "restricted") return null;
	let glyphs = font
		.layout(text, font.unitsPerEm)
		.glyphs.map((placed) => placed.glyph);
	return subset(font, glyphs);
}
```

The subset is a `Result` holding `bytes`, a complete font file, and `glyphId(original)`, the id
a glyph has in it. TrueType outlines come back as a `.ttf` and CFF outlines as an `.otf`; a
variable font's instance comes back with fixed outlines at its weight. Its character map is empty, so the file you write addresses glyphs by those ids,
as PDF does. A font whose license forbids subsetting answers a `not-permitted` `FontError`, and
embeds whole or not at all. [`@sdxc/pdf`](/api/pdf) does all of this for you, as
[Generate PDF documents](/docs/content-and-feeds/pdf-documents) shows.

## Test the layout

Test the layout with the font the Worker bundles, read from disk: a long version comes back
shortened, and a short one whole:

```typescript {% title="app/services/badges/badge-layout.test.ts" %}
import { readFileSync } from "node:fs";

import { parseFont } from "@sdxc/font";
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import { badgeLayout } from "~/app/services/badges/badge-layout";

const FONT = unwrap(
	parseFont(
		readFileSync(
			new URL(
				"../../../resources/fonts/inter-regular.ttf.bin",
				import.meta.url,
			),
		),
	),
);

test("shortens a long value to fit the badge", () => {
	let badge = badgeLayout(
		FONT,
		"version",
		"1.0.0-canary.20261019.abcdef0123456789abcdef",
	);

	expect(badge.value).toMatch(/…$/);
	expect(FONT.measure(badge.value, 11)).toBeLessThanOrEqual(160);
});

test("keeps a short value whole", () => {
	let badge = badgeLayout(FONT, "version", "2026.10.19");

	expect(badge.value).toBe("2026.10.19");
	expect(badge.valuePath).toMatch(/^M/);
});
```

## Where to go next

- [Draw social card images](/docs/building-remix-apps/social-card-images) — the same font
  drawn onto a canvas, with wrapping and shrinking done for you.
- [Draw charts as PNG images](/docs/content-and-feeds/png-charts) — labels set in a font on
  a raster image.
- [`@sdxc/font`](/api/font) — kerning, advances and every metric a font exposes.
