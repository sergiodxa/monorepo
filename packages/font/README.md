# @sdxc/font

Font reader: metrics, outlines, layout, shaping, variable fonts, color glyphs, subsetting, in plain JavaScript with no WebAssembly.

## Installation

```sh
npm add @sdxc/font @sdxc/result
```

`parseFont` answers a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result).

## Usage

```typescript
import { parseFont } from "@sdxc/font";
import { isFailure } from "@sdxc/result";

let result = parseFont(await (await fetch(fontUrl)).arrayBuffer());
if (isFailure(result)) throw result.error;
let font = result.data;

font.measure("Hello, world", 32); // width in pixels
```

Lay out a line and turn each glyph into a pixel-space path for a rasterizer to fill:

```typescript
let line = font.layout("Sign and verify JWTs", 76, { tracking: -3 });
for (let { glyph, x } of line.glyphs) {
	let commands = font.path(glyph, 76, left + x, baseline);
	// commands: { type: "move" | "line", x, y } | { type: "quad", cx, cy, x, y } | { type: "close" }
}
```

## API

### `parseFont(bytes: Uint8Array | ArrayBuffer): Result<Font, FontError>`

Reads a `.ttf`, `.otf` (TrueType, CFF or CFF2 outlines) or `.woff`. Opening a font reads only the table headers; glyphs are decoded on first use. Fails with `FontError` whose `code` is `"unsupported"` (a collection or `.woff2`, whose message names the function that opens it, or no usable `cmap`), `"missing-table"` or `"malformed"`, and whose `table` names the table at fault. `parseFontCollection(bytes)` opens `.ttc` and `.dfont` files.

### `Font`

- `unitsPerEm`, `ascender`, `descender` (negative), `lineGap` — font units, from `OS/2` when the font sets `USE_TYPO_METRICS`, `hhea` otherwise. `family` and `subfamily` come from `name`; `glyphCount` is the number of glyphs.
- `glyphIndex(codePoint)` — the glyph for a character, `0` (`.notdef`) when the font has none.
- `advance(glyph)` and `kerning(left, right)` — font units. Kerning reads the `kern` table, or GPOS pair positioning when the font has no `kern` table.
- `outline(glyph)` — `Font.Command[]` in font units, y up, composite glyphs resolved.
- `path(glyph, size, x, y)` — the outline at `size` pixels per em, y down, with `(x, y)` on the baseline.
- `layout(text, size, { tracking?, kerning? })` — `{ glyphs: { glyph, codePoint, x, advance }[], width }` in pixels. `tracking` adds pixels between glyphs; `kerning` defaults to `true`.
- `measure(text, size, options?)` — `layout(...).width` without the glyph list.

Layout maps one code point to one glyph: no ligatures, no GPOS mark positioning, no bidirectional text. Use `@sdxc/font/shaping` for complex scripts and OpenType features.

### Entry points

- `@sdxc/font/shaping` — `shape(font, text, { script, language, direction, features })`.
- `@sdxc/font/variations` — `axes(font)`, `namedInstances(font)`, `instance(font, { wght: 700 })`.
- `@sdxc/font/color` — `colorLayers(font, glyph)`, `palettes(font)`, `bitmap(font, glyph, ppem)`.
- `@sdxc/font/woff2` — `parseWoff2(bytes)`, `decodeWoff2(bytes)`.
- `@sdxc/font/subset` — `subset(font, glyphs)` for CFF fonts and variable font instances.

## Pattern: Wrap a paragraph to a width

```typescript
import type { Font } from "@sdxc/font";

function wrap(font: Font, text: string, size: number, maxWidth: number): string[] {
	let lines: string[] = [];
	let line = "";
	for (let word of text.split(/\s+/)) {
		let candidate = line === "" ? word : `${line} ${word}`;
		if (line !== "" && font.measure(candidate, size) > maxWidth) {
			lines.push(line);
			line = word;
		} else line = candidate;
	}
	if (line !== "") lines.push(line);
	return lines;
}

let lineHeight = ((font.ascender - font.descender + font.lineGap) / font.unitsPerEm) * 48;
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/font": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
