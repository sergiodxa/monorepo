# ADR-178: `@sdxc/font` Reaches Feature Parity with fontkit

## Status

**Proposed** - 2026-10-26

## Background

`@sdxc/font` ([ADR-150](./ADR-150-font-package.md)) reads TrueType fonts well enough to measure
and draw Latin text: one glyph per code point, kerning, and outlines. [ADR-177](./ADR-177-font-embedding-metrics-and-subsetting.md)
adds what PDF embedding needs. [fontkit](https://github.com/foliojs/fontkit), the font engine
behind pdfkit and react-pdf, covers much more: other formats, CFF outlines, full OpenType and
AAT shaping, variable fonts, color glyphs and CFF subsetting.

Nothing the apps ship today needs that scope. But each gap closes off something we expect to
want: a WOFF2 font from a CDN, text in Arabic or Devanagari, a variable font's bold
instance, an emoji. We want `@sdxc/font` to reach fontkit's feature scope, so the repository
never needs a second font engine. This ADR records that scope and the order to reach it in.

## Context

### Feature Comparison

| Area              | fontkit                                                                                                                                 | `@sdxc/font` after ADR-177 |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Containers        | TrueType, OpenType/CFF, WOFF, WOFF2, TrueType collections (`ttcf`), Mac `dfont`                                                         | TrueType only              |
| Outlines          | `glyf` (quadratic), CFF and CFF2 (cubic), CID-keyed CFF                                                                                 | `glyf` only                |
| Character mapping | `cmap` formats including 10, variation selectors (format 14), `characterSet`, reverse mapping from glyphs to strings                    | Formats 4 and 12           |
| Names             | Every `name` record, localized, with a default language; Windows symbol fonts decoded as UTF-16BE                                       | Family and subfamily       |
| Glyph data        | `bbox`, `cbox`, glyph names (`post`, CFF charset), SVG and function paths, scaled paths                                                 | Outlines and scaled paths  |
| Metrics           | Horizontal and vertical (`vhea`, `vmtx`, `VORG`), device metrics (`hdmx`)                                                               | Horizontal only            |
| Layout            | OpenType GSUB and GPOS (all lookup types), GDEF, script and language selection, user features, feature parameters (stylistic set names) | Pair kerning               |
| Shapers           | Default, Arabic, Hebrew, Thai, Hangul, Indic and the Universal Shaping Engine, with fallback mark positioning                           | None                       |
| AAT               | `morx` (rearrangement, contextual, ligature, insertion, noncontextual) and `feat`                                                       | None                       |
| Variable fonts    | `fvar` axes and named instances, `avar`, `gvar`, `HVAR`, CFF2 blending, variations of GPOS anchors and GSUB features, inside WOFF2 too  | Default instance only      |
| Color             | `COLR` and `CPAL` layered glyphs, `sbix` bitmap glyphs                                                                                  | None                       |
| Subsetting        | TrueType, CFF and CID-keyed CFF; variable fonts flattened at an instance                                                                | TrueType (ADR-177)         |

### Constraints

- **No WebAssembly.** `@sdxc/font` is plain JavaScript and stays that way.
- **Workers bundle size.** A social card that draws one Latin title can't pay for Indic state
  machines and Unicode property tables. Heavy capabilities have to load only when used.
- **Decompression.** WOFF needs zlib, which `DecompressionStream("deflate")` provides
  everywhere the apps run. WOFF2 needs Brotli, which isn't a `DecompressionStream` format we
  can rely on across the runtimes the apps target.
- **Unicode data.** Shaping needs general category, script, Arabic joining type, Indic
  syllabic and positional categories, Universal Shaping Engine categories, and combining
  classes. fontkit reads them from `unicode-properties` and `unicode-trie`.

## Decision

Grow `@sdxc/font` to fontkit's feature scope, as our own implementation in the package's
existing style: a `Result` from every parse, camelCase fields, and lazy decoding.

### Entry Points

Heavy capabilities ship behind subpath exports, so a consumer imports only what it uses:

| Entry point             | Adds                                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| `@sdxc/font`            | `parseFont` for every container and outline format, metrics, names, glyph data, cmap, pair kerning |
| `@sdxc/font/woff2`      | WOFF2 decoding, Brotli included                                                                    |
| `@sdxc/font/shaping`    | OpenType and AAT layout with every shaper, and its Unicode data                                    |
| `@sdxc/font/variations` | Instancing variable fonts                                                                          |
| `@sdxc/font/color`      | `COLR`, `CPAL` and `sbix` glyphs                                                                   |
| `@sdxc/font/subset`     | Subsetting, CFF included, moved here from the main entry once CFF lands                            |

`parseFont` recognizes a WOFF2 or a font that needs an unloaded capability, and fails with a
`FontError` whose `code` is `"unsupported"`, naming the entry point to import.

### Scope by Area

- **Containers.** WOFF (zlib per table), WOFF2 (Brotli, plus reconstructing the transformed
  `glyf`, `loca` and `hmtx`), TrueType collections and Mac `dfont`, with
  `parseFontCollection(bytes)` returning every font and finding one by PostScript name.
- **CFF and CFF2 outlines.** Type 2 charstrings, subroutines, CID-keyed fonts with their
  `FDSelect`, and glyph names from the charset. `Font.Command` gains a cubic command, which
  the raster package learns to fill.
- **Character mapping.** Every `cmap` format fontkit reads, format 14 variation selectors,
  `characterSet`, `hasGlyph(codePoint)` and `stringsForGlyph(glyph)`.
- **Names and metadata.** Every `name` record by ID and language, a default-language choice,
  Windows symbol fonts decoded as UTF-16BE, and `table(tag)` returning a table's raw bytes.
- **Glyph data.** `bbox(glyph)` and `cbox(glyph)`, glyph names from `post` and CFF, and an SVG
  path string helper.
- **Vertical and device metrics.** `vhea`, `vmtx`, `VORG` and `hdmx`.
- **Shaping.** `shape(text, { script?, language?, direction?, features? })` returns glyphs with
  clusters, advances and offsets on both axes. It covers:
  - GSUB lookup types 1 to 8 and GPOS lookup types 1 to 9, with GDEF classes and mark
    filtering sets.
  - Feature selection by script and language, with user features turned on and off.
  - The default, Arabic, Hebrew, Thai, Hangul, Indic and Universal Shaping Engine shapers.
  - AAT `morx` and `feat` for fonts without OpenType layout.
  - Fallback mark positioning for fonts without mark lookups.
  - Feature parameters, such as stylistic set names.

  `layout()` keeps its current fast path for text that needs no shaping.

- **Variable fonts.** `axes`, `namedInstances`, and `instance({ wght: 700 })` returning a
  `Font`. Covers `avar`, `gvar` with shared, enumerated and empty point sets, interpolation of
  untouched points, `HVAR` metrics, CFF2 blending, and feature variations in GSUB and GPOS.
- **Glyph data on `Font`.** Per-glyph data is methods taking a glyph id (`glyphBBox`,
  `glyphCBox`, `glyphName`, `svgPath`, `verticalAdvance`, `deviceAdvance`); `Font.bbox` stays
  the font's own box. `name(id, language)` takes the language per call, falling back to a
  regional variant, then English, then the first language listed.
- **Character mapping.** Unicode subtables are preferred, then a Windows symbol subtable
  (where a byte code `c` also tries U+F000 + `c`), then the first single-byte legacy one.
- **CFF outlines.** A CFF table is parsed and validated when the font opens; charstrings run
  on first draw and the default instance is cached per glyph. A charstring that exceeds the
  limits (subroutine depth 10, the format's stack size, 100,000 operators per glyph), calls a
  missing subroutine or uses an unknown operator ends that glyph with what it drew so far.
  Operand order follows the Type 2 specification where implementations disagree (`sub`, `div`,
  `put`, `hflex1`), and `random` is seeded per glyph so a glyph always draws the same outline.
  The ItemVariationStore reader in `src/item-variation-store.ts` serves CFF2 `blend` and the
  variation tables alike.
- **Variable fonts.** `@sdxc/font/variations` exposes `axes(font)`, `namedInstances(font)` and
  `instance(font, settings | name)`. An instance is lazy: a `Font` over the same bytes whose
  outlines and advances are varied per glyph on first use and cached. Normalized coordinates
  snap to 2.14 before and after `avar`; `gvar` deltas sum as floats and each point rounds once;
  `HVAR` decides advances when present, phantom points otherwise; `MVAR` varies line metrics.
  `featureVariationSubstitutions(font, "GSUB" | "GPOS")` answers the feature tables that apply
  at the instance's location, for the shaper to read. `avar` version 2 and `VVAR` are not read.
- **Color.** Layered `COLR` glyphs with `CPAL` palettes, and `sbix` bitmaps handed back as PNG
  or JPEG bytes for `@sdxc/png` or a browser to decode.
- **Subsetting.** CFF and CID-keyed CFF, keeping only the defaults that differ, and variable
  fonts flattened at an instance, composite glyphs included.

### fontkit's Tests as the Checklist

fontkit's test files record years of fonts that broke it. Before each phase starts, read the
matching files, list every behavior they assert, and port each one as a Vitest case. A case
that doesn't apply gets a line in the phase's pull request saying why, so the gaps are
deliberate:

| Phase                    | fontkit test files                                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Containers               | `test/index.js`, `test/directory.js`, `test/compression.js`, `test/entrypoints.js`                         |
| CFF outlines             | `test/glyphs.js` (`CFF glyphs`, CID fonts)                                                                 |
| Mapping and metadata     | `test/glyph_mapping.js`, `test/metadata.js`, `test/i18n.js`, `test/device_metrics.js`                      |
| Shaping                  | `test/shaping.js`, `test/glyph_positioning.js`, `test/opentype.js`, and the `aots` and `fonttest` fixtures |
| Variable fonts           | `test/variations.js`                                                                                       |
| Color                    | `test/glyphs.js` (`COLR`, `sbix` cases)                                                                    |
| Subsetting               | `test/subset.js` (`CFF subsetting`, `with set variations`)                                                 |
| Regressions, every phase | `test/issues.js`                                                                                           |

The tests are the reference; the code is our own. fontkit's fixture fonts live in
`test/data` with a license per family. A fixture is copied into `packages/font/src/fixtures`
only with its license file, and only when that license allows redistribution.

## Consequences

### Positive

- **One font engine.** Every font a browser accepts, every script, variable instances and
  color glyphs go through the same package that already draws social cards and will embed
  PDF fonts.
- **Pay for what you use.** Subpath entries keep a Latin-only Worker as small as it is today.
- **Proven edge cases.** Porting fontkit's assertions starts the package with the bugs fontkit
  already found and fixed.

### Negative

- **Large.** The shapers, the layout processors and the Unicode data are most of fontkit's
  code. All phases together are months of work, not days.
- **A Brotli decoder.** WOFF2 needs one in plain JavaScript until every target runtime decodes
  Brotli in `DecompressionStream`. It's a decoder only, but still a substantial piece to write
  and verify.
- **Generated Unicode data.** Shaping needs property tables generated from the Unicode
  Character Database, and regenerated with each Unicode release.
- **A breaking change.** Adding a cubic command to `Font.Command` changes the type every
  consumer of outlines switches on.

### Neutral

- Bidirectional reordering (UAX #9) of a mixed-direction paragraph stays outside the font
  engine, as in fontkit: `shape()` takes one direction per run.
- Hinting stays unapplied; outlines are rendered unhinted, as they are now.

## Implementation Plan

Each phase is independent once its prerequisites land, and each ships when its ported fontkit
cases pass.

### Phase 1: Mapping, Names, Glyph Data and Metrics

**Priority:** Medium
**Estimated Effort:** 2-3 days

1. Every `cmap` format, format 14, `characterSet`, `hasGlyph`, `stringsForGlyph`
2. Every `name` record with languages, UTF-16BE symbol names, `table(tag)`
3. `bbox`, `cbox`, glyph names from `post`, SVG path helper
4. `vhea`, `vmtx`, `VORG`, `hdmx`

### Phase 2: Containers

**Priority:** Medium
**Estimated Effort:** 1 week

1. WOFF through `DecompressionStream`
2. TrueType collections, `dfont`, `parseFontCollection`
3. Brotli decoder and WOFF2 with transformed tables, behind `@sdxc/font/woff2`

### Phase 3: CFF and CFF2 Outlines

**Priority:** Medium
**Estimated Effort:** 1 week

1. CFF index, dictionaries, charstrings and subroutines; CID-keyed fonts
2. The cubic command in `Font.Command`, and cubic fills in the raster package

### Phase 4: Shaping

**Priority:** Low
**Estimated Effort:** 4-6 weeks

1. Generated Unicode property tables
2. GSUB, GPOS and GDEF processors; the default shaper; `shape()`
3. Arabic, Hebrew, Thai and Hangul shapers
4. Indic and Universal Shaping Engine shapers with their syllable state machines
5. AAT `morx` and `feat`; fallback mark positioning

### Phase 5: Variable Fonts

**Priority:** Low
**Estimated Effort:** 2 weeks

1. `fvar`, `avar`, named instances, `instance()`
2. `gvar` deltas and interpolation, `HVAR`, CFF2 blending
3. Feature variations in GSUB and GPOS; variations of fonts inside WOFF2

### Phase 6: Color Glyphs

**Priority:** Low
**Estimated Effort:** 2-3 days

1. `COLR` layers with `CPAL` palettes
2. `sbix` bitmaps

### Phase 7: Subsetting Beyond TrueType

**Priority:** Low
**Estimated Effort:** 1 week

1. CFF and CID-keyed CFF subsets
2. Variable fonts flattened at an instance before subsetting

## Alternatives Considered

### 1. Depend on fontkit

**Rejected because**: the repository would carry two font engines that can disagree on a
metric. It also ships its layout engine and Unicode data as one package, so every Worker that
imports it pays for shaping, even to measure one Latin title.

### 2. HarfBuzz Compiled to WebAssembly

HarfBuzz is the reference shaper, and `harfbuzzjs` runs it in JavaScript runtimes.

**Rejected because**: `@sdxc/font` takes no WebAssembly, and HarfBuzz covers shaping only,
leaving containers, CFF, variations and subsetting to be done anyway.

### 3. Stop at ADR-177

Keep `@sdxc/font` to what the apps use today.

**Rejected because**: each missing area is something we expect to need, and adding them one
by one under pressure leaves the package shaped by whichever font broke first.

## References

- [fontkit](https://github.com/foliojs/fontkit) and its [tests](https://github.com/foliojs/fontkit/tree/master/test)
- [OpenType specification](https://learn.microsoft.com/en-us/typography/opentype/spec/)
- [WOFF 2.0](https://www.w3.org/TR/WOFF2/)
- [CFF (Adobe Technical Note 5176)](https://adobe-type-tools.github.io/font-tech-notes/pdfs/5176.CFF.pdf)
- [Apple TrueType Reference: `morx`](https://developer.apple.com/fonts/TrueType-Reference-Manual/RM06/Chap6morx.html)
- [Unicode Character Database](https://www.unicode.org/ucd/)
- [ADR-150: `@sdxc/font`](./ADR-150-font-package.md)
- [ADR-177: Embedding metrics and subsetting](./ADR-177-font-embedding-metrics-and-subsetting.md)

## Implementation Notes

Decisions made while implementing, where this ADR left a choice open:

- **Glyph data on `Font`.** Per-glyph data is methods taking a glyph id (`glyphBBox`,
  `glyphCBox`, `glyphName`, `svgPath`, `verticalAdvance`, `deviceAdvance`); `Font.bbox` stays
  the font's own box. `name(id, language)` takes the language per call, falling back to a
  regional variant, then English, then the first language listed.
- **Character mapping.** Unicode subtables are preferred, then a Windows symbol subtable
  (where a byte code `c` also tries U+F000 + `c`), then the first single-byte legacy one.
- **CFF outlines.** A CFF table is parsed and validated when the font opens; charstrings run
  on first draw and the default instance is cached per glyph. A charstring that exceeds the
  limits (subroutine depth 10, the format's stack size, 100,000 operators per glyph), calls a
  missing subroutine or uses an unknown operator ends that glyph with what it drew so far.
  Operand order follows the Type 2 specification where implementations disagree (`sub`, `div`,
  `put`, `hflex1`), and `random` is seeded per glyph so a glyph always draws the same outline.
  The ItemVariationStore reader in `src/item-variation-store.ts` serves CFF2 `blend` and the
  variation tables alike.
- **Variable fonts.** `@sdxc/font/variations` exposes `axes(font)`, `namedInstances(font)` and
  `instance(font, settings | name)`. An instance is lazy: a `Font` over the same bytes whose
  outlines and advances are varied per glyph on first use and cached. Normalized coordinates
  snap to 2.14 before and after `avar`; `gvar` deltas sum as floats and each point rounds once;
  `HVAR` decides advances when present, phantom points otherwise; `MVAR` varies line metrics.
  `featureVariationSubstitutions(font, "GSUB" | "GPOS")` answers the feature tables that apply
  at the instance's location, for the shaper to read. `avar` version 2 and `VVAR` are not read.
- **Color.** `@sdxc/font/color` exposes functions over a `Font` (`colorLayers`, `palettes`,
  `bitmap`, `strikes`). `colorLayers` answers `null` for a glyph without color, so a caller
  draws the plain outline; a layer that takes the text color carries `"foreground"`. `COLR`
  version 1 paint graphs are not read; their version 0 fallback layers are. An `sbix` request
  picks the smallest strike at or above the size, else the largest.

## Current Progress

- [x] Phase 1: Mapping, names, glyph data and metrics
- [ ] Phase 2: Containers
- [x] Phase 3: CFF and CFF2 outlines
- [ ] Phase 4: Shaping
- [ ] Phase 5: Variable fonts
- [x] Phase 6: Color glyphs
- [ ] Phase 7: Subsetting beyond TrueType
