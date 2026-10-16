# ADR-150: `@sdxc/font` Reads TrueType Fonts

## Status

**Accepted** - 2026-10-15

## Background

Drawing text into pixels without a browser needs the font itself: which glyph a character
maps to, how far each glyph advances, how pairs kern, and the outline to fill. The social
card renderer ([ADR-151](./ADR-151-raster-package.md)) draws titles and descriptions with
real glyphs, so the measurement that wraps a title is the same font that paints it.

## Decision

Create `@sdxc/font`, which parses TrueType-flavoured OpenType (`.ttf`, `glyf` outlines) and
answers metrics, layout and outlines.

```ts
import { parseFont } from "@sdxc/font";

let result = parseFont(bytes); // Result<Font, FontError>
if (isFailure(result)) return result;
let font = result.value;

let line = font.layout("Sign and verify JWTs", 76, { tracking: -3 });
line.width; // pixels
for (let { glyph, x } of line.glyphs)
	canvas.fillPath(font.path(glyph, 76, originX + x, baseline), paint);
```

- **`parseFont(bytes: Uint8Array | ArrayBuffer): Result<Font, FontError>`** reads `head`,
  `hhea`, `maxp`, `hmtx`, `cmap` (formats 4 and 12, preferring a Unicode full-repertoire
  subtable), `loca`, `glyf`, optional `kern` (format 0), optional `OS/2` and `name`. A CFF
  font (`OTTO`), a collection (`ttcf`), or a missing required table fails with a `FontError`
  whose `code` is `"unsupported" | "missing-table" | "malformed"`.
- **`Font`** exposes, all in font units unless noted:
  - `unitsPerEm`, `ascender`, `descender` (negative), `lineGap` — from `OS/2`'s typographic
    values when `USE_TYPO_METRICS` is set, `hhea` otherwise; `family` and `subfamily` from
    `name`.
  - `glyphIndex(codePoint): number` — `0` (`.notdef`) for an unmapped character.
  - `advance(glyph): number` and `kerning(left, right): number`.
  - `outline(glyph): Font.Command[]` — the glyph's contours in font units, y up, composite
    glyphs resolved with their transforms. Commands are
    `{ type: "move" | "line", x, y }`, `{ type: "quad", cx, cy, x, y }` and `{ type: "close" }`;
    implied on-curve points between consecutive off-curve points are made explicit.
  - `path(glyph, size, x, y): Font.Command[]` — the same outline scaled to `size` pixels per
    em and moved to a pixel origin with y down, `(x, y)` on the baseline. This is what a
    rasterizer fills.
  - `layout(text, size, options?: { tracking?: number; kerning?: boolean }): Font.Line` —
    iterates code points, applies kerning (on by default) and `tracking` (extra pixels after
    every glyph but the last), and returns `{ glyphs: { glyph, codePoint, x, advance }[],
width }` in pixels.
  - `measure(text, size, options?)` — `layout(...).width` without building the glyph list.
- No shaping: no GSUB ligatures, no GPOS, no bidirectional text. Text the font has no glyph
  for draws `.notdef`.

## Consequences

### Positive

- **One source of truth for text.** Wrapping, centring and painting all use the same metrics.
- **Small and synchronous.** Parsing reads table offsets lazily; a 300 KB font is ready
  without decompressing anything.

### Negative

- **Latin-first.** Scripts that need shaping (Arabic, Devanagari) render as isolated glyphs.
- **No WOFF/WOFF2.** WOFF2 needs Brotli and a glyph transform; callers ship `.ttf`.

### Neutral

- Variable fonts parse at their default instance; `gvar` is ignored.

## Alternatives Considered

### 1. `opentype.js`

**Rejected because**: it ships CFF, GSUB/GPOS and a writer this use never reaches, throws
on malformed input, and its path API is shaped for canvas rather than for a caller that
fills its own polygons.

## References

- [OpenType specification](https://learn.microsoft.com/en-us/typography/opentype/spec/)
- [TrueType `glyf` table](https://learn.microsoft.com/en-us/typography/opentype/spec/glyf)
