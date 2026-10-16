# ADR-149: `@sdxc/png` Encodes and Decodes PNG Images

## Status

**Accepted** - 2026-10-15

## Background

The packages site needs a social card image per page, rendered inside a Worker
(see [ADR-151](./ADR-151-raster-package.md) and
[sdxc-site ADR-002](./sdxc-site/ADR-002-social-cards.md)). Every social platform accepts
PNG, and the existing route to one — Satori plus resvg compiled to WebAssembly — adds 3–4 MB
to the Worker and a cold-start cost. A pixel buffer becomes a PNG with a few chunks, CRC-32
and zlib, and a Worker already has zlib through `CompressionStream("deflate")`.

## Decision

Create `@sdxc/png`, a format package with both directions, following the repo's rule that a
file format gets its own package with a reader and a writer.

```ts
import { decode, encode } from "@sdxc/png";

let bytes = await encode({ width, height, data }); // data: Uint8ClampedArray, RGBA, 8-bit
let image = await decode(bytes); // Result<PNG.Image, PNGError>
```

- **`PNG.Image`** is `{ width: number; height: number; data: Uint8ClampedArray }`, straight
  (non-premultiplied) RGBA, 8 bits per channel, row-major, top row first — the layout of the
  web's `ImageData`, so a caller can hand either side to the other.
- **`encode(image, options?)`** returns `Promise<Uint8Array>`. It writes `IHDR`, one or more
  `IDAT`, and `IEND`; color type 6 (RGBA), or color type 2 (RGB) when every pixel is opaque
  (on by default, `options.alpha: "auto" | "keep"`). Each scanline picks its filter with the
  minimum-sum-of-absolute-differences heuristic libpng uses. Optional `options.text` writes
  `tEXt` chunks (`{ Software: "…" }`).
- **`decode(bytes)`** returns `Promise<Result<PNG.Image, PNGError>>`. It validates the
  signature and every chunk's CRC, inflates `IDAT` with `DecompressionStream("deflate")`,
  reverses all five filters, and expands color types 0, 2, 3 (with `tRNS`), 4 and 6 at bit
  depths 1, 2, 4, 8 and 16 into the 8-bit RGBA layout. Adam7 interlacing is decoded too, so
  any valid PNG reads back. `PNGError` carries a `code`
  (`"signature" | "crc" | "header" | "unsupported" | "truncated" | "inflate"`) and a message.
- CRC-32 comes from `@sdxc/zip`'s `crc32`.

`encode` cannot fail on a well-formed `PNG.Image`, so it resolves with bytes; a buffer whose
length is not `width * height * 4` is a programming error the type makes hard to reach, and
the function rejects it with a `RangeError` rather than writing a corrupt file.

## Consequences

### Positive

- **No WebAssembly.** The encoder is a few hundred lines of TypeScript on platform streams.
- **Round-trip testing.** A rasterizer test can decode what it encoded and assert on pixels.

### Negative

- **Compression is zlib's default level**, since `CompressionStream` exposes no level. Cards
  are flat colours and gradients, which deflate well at that level.

### Neutral

- APNG, color management chunks (`iCCP`, `gAMA`, `cHRM`) and `zTXt`/`iTXt` are read past and
  never written.

## Alternatives Considered

### 1. `@resvg/resvg-wasm` or `upng-js`

**Rejected because**: the first is the 2.5 MB rasterizer this work replaces; the second
bundles its own pako copy where the platform already provides deflate.

## References

- [PNG Specification (Third Edition)](https://www.w3.org/TR/png-3/)
