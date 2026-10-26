# ADR-177: `@sdxc/font` Describes, Permits and Subsets Fonts for Embedding

## Status

**Proposed** - 2026-10-26

## Background

`@sdxc/pdf` ([ADR-176](./ADR-176-pdf-package.md)) embeds TrueType fonts in the documents it
writes. `@sdxc/font` ([ADR-150](./ADR-150-font-package.md)) already gives it what it needs to
set text: glyph lookup, advances, kerning and line layout. Embedding needs three more things
the package doesn't offer yet:

- The metrics a PDF font description carries.
- The font's embedding permission.
- A way to cut a font down to the glyphs a document uses, so a one-page résumé doesn't carry
  every glyph of every font it uses.

Each of these is a fact about the font, or work on the font, so it belongs in `@sdxc/font`,
where any other consumer can reach it too.

## Context

### What a PDF Font Description Requires

ISO 32000-1 requires a `FontDescriptor` for every embedded TrueType font:

| PDF key       | Source in the font                                                                | In `@sdxc/font` today |
| ------------- | --------------------------------------------------------------------------------- | --------------------- |
| `FontName`    | `name` ID 6, the PostScript name                                                  | No                    |
| `FontBBox`    | `head` `xMin`, `yMin`, `xMax`, `yMax`                                             | No                    |
| `ItalicAngle` | `post` `italicAngle` (16.16 fixed)                                                | No (`post` unread)    |
| `Ascent`      | `hhea` or `OS/2` typographic ascender                                             | Yes                   |
| `Descent`     | `hhea` or `OS/2` typographic descender                                            | Yes                   |
| `CapHeight`   | `OS/2` `sCapHeight` (version 2 and later)                                         | No                    |
| `XHeight`     | `OS/2` `sxHeight` (version 2 and later), optional in the PDF                      | No                    |
| `StemV`       | No table stores it; derived from the weight class                                 | No                    |
| `Flags`       | `post` `isFixedPitch`, `OS/2` `fsSelection` and `sFamilyClass`, `head` `macStyle` | No                    |

### Embedding Permission

`OS/2` `fsType` states what the font's license allows: installable, editable, preview and
print only, or restricted (no embedding at all), plus whether it may be subset and whether it
may be embedded only as bitmaps. Ignoring it can ship a font in a way its license forbids.

### Subsetting

A TrueType subset is a valid font that holds only the glyphs it is asked for. Writing one
means doing all of the following:

- Renumbering glyphs, with glyph 0 (`.notdef`) kept first.
- Following composite glyphs to their components, recursively.
- Rewriting the component ids inside each composite.
- Rebuilding `loca` in a format wide enough for the new `glyf`.
- Rebuilding `hmtx` and updating `maxp` and `hhea`.
- Padding every table to four bytes, recomputing each table checksum, and setting `head`'s
  `checkSumAdjustment`.

## Decision

Extend `@sdxc/font` with the three capabilities below. Each is plain JavaScript over the bytes
`parseFont` already holds, with no WebAssembly.

### 1. Font Metrics and Style

New read-only fields on `Font`, all in font units unless noted:

```ts
font.postscriptName; // "Inter-Regular", "" when the font has no name ID 6
font.bbox; // { xMin, yMin, xMax, yMax } from head
font.italicAngle; // degrees, negative leans right; 0 when the font has no post table
font.capHeight; // OS/2 sCapHeight; null when OS/2 is older than version 2
font.xHeight; // OS/2 sxHeight; null when OS/2 is older than version 2
font.weightClass; // OS/2 usWeightClass, 400 when the font has no OS/2
font.isFixedPitch; // post isFixedPitch
font.isItalic; // OS/2 fsSelection bit 0, or head macStyle bit 1
font.isBold; // OS/2 fsSelection bit 5, or head macStyle bit 0
font.isSerif; // OS/2 sFamilyClass classes 1-5 and 7
font.underlinePosition; // post underlinePosition
font.underlineThickness; // post underlineThickness
```

- The `post` table becomes an optional table: its header is read, and its glyph names are
  left for [ADR-178](./ADR-178-font-feature-parity.md).
- `StemV` stays with `@sdxc/pdf`, which estimates it from `weightClass`. No table stores it,
  so it isn't a fact about the font.

### 2. Embedding Permission

```ts
font.embedding;
// { allowed: "installable" | "editable" | "preview-and-print" | "restricted",
//   subsetting: boolean, bitmapOnly: boolean }
```

- Read from `OS/2` `fsType`, with the precedence the OpenType specification gives when a font
  sets more than one usage bit. A font without `OS/2` reads as `installable` with subsetting
  allowed.
- `@sdxc/font` only reports the permission. Enforcing it is the caller's decision: `@sdxc/pdf`
  refuses a `restricted` font, and embeds a font whole when `subsetting` is `false`.

### 3. Subsetting

```ts
let subset = font.subset([glyphA, glyphB, glyphC]); // Result<Font.Subset, FontError>
subset.data.bytes; // Uint8Array, a valid .ttf
subset.data.glyphId(glyphA); // the glyph's id in the subset
```

- Glyph 0 is always included and always stays 0. Every other id is renumbered in the order
  requested, and components of composite glyphs are added after them.
- The subset keeps `head`, `hhea`, `maxp`, `hmtx`, `loca`, `glyf`, `name`, `OS/2` and `post`
  (rewritten as format 3, with no glyph names), plus the hinting tables `cvt `, `fpgm` and
  `prep` when the font has them. It drops `cmap`, `kern` and `GPOS`, since a PDF addresses
  glyphs by id and its text is already positioned. Which tables PDF viewers need is checked
  against what fontkit's `TTFSubset` writes before this list is final.
- `loca` uses the short format when every offset fits in it, the long format otherwise.
- A font whose `embedding.subsetting` is `false` fails with a `FontError` whose `code` is
  `"not-permitted"`.
- Subsetting a variable font, which needs its outlines flattened at one instance first, is
  part of [ADR-178](./ADR-178-font-feature-parity.md).

### Edge Cases from fontkit's Tests

[fontkit](https://github.com/foliojs/fontkit) has covered these features for years, and its
tests record the edge cases real fonts hit. Before each part is implemented, read the
matching fontkit test file and add a Vitest case to `@sdxc/font` for every behavior that
applies:

| Part        | fontkit test file                                                                  |
| ----------- | ---------------------------------------------------------------------------------- |
| Metrics     | `test/metadata.js` (typo metrics, Windows symbol font names, `maxp` 16.16 version) |
| Composites  | `test/glyphs.js` (recursive composites, off-diagonal transforms), for subsets      |
| Subsetting  | `test/subset.js` (`truetype subsetting`: composite glyphs, `indexToLocFormat = 1`) |
| Regressions | `test/issues.js`                                                                   |

The tests are the reference; the code stays our own. A fixture font is copied from fontkit's
`test/data` only together with its license file, the way `inter-regular.ttf` sits beside
`OFL-inter.txt` today.

## Consequences

### Positive

- **Complete PDF font descriptions.** `@sdxc/pdf` fills every required `FontDescriptor` key
  from the font itself.
- **Smaller documents.** A subset of a Latin text font is a few kilobytes, where the whole font
  is hundreds.
- **Licenses respected.** Restricted fonts fail before they are embedded.
- **Reusable.** Subsetting also serves anything else that ships a font, such as an EPUB from
  `@sdxc/epub` or a font served to the web for one page.

### Negative

- **More surface.** `Font` grows a dozen fields and a method that writes fonts as well as
  reading them.
- **Subsetting is unforgiving.** A wrong checksum or `loca` entry gives a font that some
  viewers reject without saying why, so the tests have to parse every subset back.

### Neutral

- `parseFont` reads one more optional table (`post`); fonts without it keep parsing as before.
- Hinting instructions are copied unchanged. Glyph renumbering doesn't affect them, since
  they don't refer to glyph ids.

## Implementation Plan

### Phase 1: Metrics, Style and Permission

**Priority:** High
**Estimated Effort:** half a day

1. Read `post`'s header, and `OS/2` versions 0 to 5, defensively by length
2. Add the fields and `embedding`, with tests ported from `test/metadata.js`

### Phase 2: Subsetting

**Priority:** High
**Estimated Effort:** 1-2 days

1. Collect glyphs, follow composites, renumber
2. Rewrite composite component ids, `glyf`, `loca`, `hmtx`, `maxp`, `hhea` and `post`
3. Align, checksum, set `checkSumAdjustment`, and write the table directory
4. Test every subset by parsing it back with `parseFont` and comparing outlines and advances
   glyph by glyph, with cases ported from `test/subset.js`

## Alternatives Considered

### 1. Put Metrics and Subsetting in `@sdxc/pdf`

**Rejected because**: both are about the font, not the document. Another package that needs
them would have to depend on a PDF writer, and two packages would each parse the same tables.

### 2. Depend on fontkit

**Rejected because**: it duplicates the parsing `@sdxc/font` already does, it brings CFF,
shaping and variation code the PDF path doesn't reach yet, and it would leave the repository
with two font readers that can disagree about a metric.

## References

- [OpenType `OS/2` table](https://learn.microsoft.com/en-us/typography/opentype/spec/os2)
- [OpenType `post` table](https://learn.microsoft.com/en-us/typography/opentype/spec/post)
- [OpenType font file checksums](https://learn.microsoft.com/en-us/typography/opentype/spec/otff#calculating-checksums)
- [PDF 1.7 (ISO 32000-1), 9.8 Font Descriptors](https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/PDF32000_2008.pdf)
- [fontkit tests](https://github.com/foliojs/fontkit/tree/master/test)
- [ADR-150: `@sdxc/font`](./ADR-150-font-package.md)
- [ADR-176: `@sdxc/pdf`](./ADR-176-pdf-package.md)
- [ADR-178: `@sdxc/font` feature parity with fontkit](./ADR-178-font-feature-parity.md)

## Current Progress

- [ ] Phase 1: Metrics, style and permission
- [ ] Phase 2: Subsetting
