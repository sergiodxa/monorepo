# ADR-115: QR Package

## Status

**Accepted** - 2026-10-07

## Background

Every QR code the repo needs is one a server shows and a phone scans: the `otpauth://` URI an
authenticator app takes during TOTP enrolment, and the `verification_uri_complete` a device
shows during the device authorization grant. None of them is drawn today. `auth-saas`'s
enrolment page renders the setup key and the link alone, its module header noting that a QR
image "needs an encoding library this pass does not pull in", and the public two-factor guide on
the docs site tells readers to wrap "the QR library of your choice" in a `qrCodeDataUrl` helper.

QR encoding is a fixed, well-specified computation with no I/O: segment the text, add
Reed–Solomon error correction, place the bits in a matrix and pick a mask. It belongs in a
package that runs unchanged in a Worker, answers a `Result`, and renders through
`remix/component`, so an app draws the code in the same server HTML as the rest of its page.

## Context

### Consumers

| Location                                                       | What it encodes                                          | Today                                                        |
| -------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------ |
| `apps/auth-saas/app/views/hosted/enrol-totp-factor.tsx`        | The `otpauth://` URI from `beginTotpEnrolment`           | Setup key and link only; the header explains why             |
| `packages/crypto/src/totp.ts` (`totp.uri`)                     | Builds that URI; its README says to show it as a QR code | Leaves drawing to the caller                                 |
| `apps/sdxc/resources/docs/identity-and-security/two-factor.md` | The same URI, in a tutorial                              | Asks the reader to bring a QR library behind `qrCodeDataUrl` |
| `docs/adr/auth-saas/ADR-039-device-authorization-grant.md`     | `verification_uri_complete`, `…/device?user_code=…`      | Drawn by the device's own client, never by the server        |

The device grant is a client concern: the TV or CLI that started the grant shows the code, and
the authorization server only answers the URI. A first-party client written against the package
would use it the same way the enrolment page does, so it needs nothing beyond what TOTP needs.

Typical payloads are short ASCII URIs. An `otpauth://` URI with a 32-character base32 secret, an
issuer and an email runs 100 to 130 characters, which is version 6 to 8 (41 to 49 modules a
side) at level M; a device verification URI is version 4 or 5.

### What generating a code involves

ISO/IEC 18004:2015 specifies QR Code Model 2 as a pipeline:

| Step               | What it does                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| Segmentation       | Splits the input into numeric (10 bits per 3 digits), alphanumeric (11 bits per 2) and byte (8 bits) runs |
| Bit stream         | Mode indicator, a character count whose width depends on the version range, the data, terminator, padding |
| Version selection  | The smallest of versions 1–40 (21 to 177 modules a side) whose data capacity at the level fits the stream |
| Error correction   | Reed–Solomon over GF(256), with the version and level fixing the block count and codewords per block      |
| Interleaving       | Data and error correction codewords interleaved across blocks                                             |
| Function patterns  | Finders, separators, timing, alignment patterns (version 2+), the dark module                             |
| Masking            | Eight masks, each scored with four penalty rules; the lowest score wins                                   |
| Format and version | The level and mask as a BCH(15,5) code; the version as a BCH(18,6) code from version 7                    |
| Quiet zone         | A light margin of four modules on every side                                                              |

### Why a generator only

Every flow here is the server showing a code a phone's camera reads. Reading one would mean a
Worker receiving a photo and locating, sampling and decoding a symbol in it, which is image
processing no flow calls for. In the browser, `BarcodeDetector` is experimental and of limited
availability, so a scan-in-page feature would need its own decoder regardless. Neither is a
reason to carry a decoder in the package that draws codes.

### Issues identified

| Issue                                                     | Impact                                                                                    |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| No QR on `auth-saas`'s enrolment page                     | A person enrolling types a 32-character key, or opens a link that only works on the phone |
| The public guide points at an unnamed third-party library | Readers pick one that may not run in a Worker, and the guide cannot show the whole flow   |
| The guide renders the code as an `<img>` data URL         | The page's CSP needs `img-src data:`, and the image is a raster at a fixed size           |

## Decision

Add `@sdxc/qr`: a QR Code Model 2 encoder in plain TypeScript, an SVG path builder, and a
`remix/component` component in the `@sdxc/qr/component` entry point.

- The main entry point depends only on `@sdxc/result`. It uses `TextEncoder` and arithmetic, so
  it runs the same in a Worker, Bun, Node and the browser.
- Reed–Solomon multiplies in GF(256) by shift and XOR, and the per-version tables (block counts,
  codewords per block, alignment positions) are literal `UPPER_SNAKE` constants, so importing the
  module does no work in the Worker's global scope.
- `remix` is an optional peer dependency, needed only by `@sdxc/qr/component`.

### Encoding

```typescript
import { QR } from "@sdxc/qr";

let encoded = QR.encode("otpauth://totp/Acme:ada%40example.com?secret=…", { level: "M" });
// Result<QR, QrError>
```

| Option       | Default  | Meaning                                                                                      |
| ------------ | -------- | -------------------------------------------------------------------------------------------- |
| `level`      | `"M"`    | The minimum error correction level: `"L"` (7%), `"M"` (15%), `"Q"` (25%) or `"H"` (30%)      |
| `minVersion` | `1`      | The smallest version to try                                                                  |
| `maxVersion` | `40`     | The largest version to try; data that does not fit it fails with `too-long`                  |
| `mask`       | Computed | A fixed mask, 0–7; omitted, every mask is scored and the lowest penalty wins                 |
| `boostLevel` | `true`   | Raises the level as far as the chosen version still fits, since the extra correction is free |

The input is a `string` or a `Uint8Array`. A string is segmented as described below; bytes are
one byte-mode segment, for a caller encoding something that is not text.

```typescript
export type QrLevel = "L" | "M" | "Q" | "H";

export class QR {
	static encode(data: string | Uint8Array, options?: QrOptions): Result<QR, QrError>;

	/** 1–40; the symbol is `17 + 4 * version` modules a side. */
	readonly version: number;
	/** The level actually applied, which `boostLevel` may have raised. */
	readonly level: QrLevel;
	readonly mask: number;
	/** Modules a side, quiet zone excluded. */
	readonly size: number;
	/** Coordinates outside the symbol answer `false`, so a renderer draws the quiet zone by reading past the edge. */
	isDark(x: number, y: number): boolean;
	toSVGPath(options?: { margin?: number }): { d: string; viewBox: string; size: number };
}
```

The encoded value is a `QR` instance, and `QR.encode` is the only way to get one, so every
instance holds a valid symbol and carries its own renderers; the component is `QrCode`, and an
app imports both on one page.

### Segmentation

A string is split into segments optimally, by the linear-time dynamic programme Nayuki
describes: for each character it tracks the cheapest bit cost of ending in each mode, then walks
back to pick the modes, and adjacent characters in one mode merge into a segment. Character
count fields widen at versions 10 and 27, so the segmentation is computed per version range
inside the version search.

Optimal segmentation is chosen over the single-mode approach (numeric if every character is a
digit, alphanumeric if every character is in its set, byte otherwise) because the payloads here
mix modes. An `otpauth://` URI is lowercase text around a 32-character uppercase base32 secret:
as alphanumeric, the secret costs 176 bits plus a 13-bit header against 256 bits as bytes, and
the switch back to bytes costs 12, so the URI shrinks by about seven bytes, which is the margin
between version 6 and 7 for some issuer and account lengths. Every decoder reads multiple
segments, since mode switching is part of the base standard, and the segmentation has no public
surface, so its cost is about a hundred lines inside the package.

### Byte mode and ECI

Byte mode carries the string's UTF-8 bytes with no ECI header. The standard's default byte
interpretation is ISO/IEC 8859-1, but phone scanners detect UTF-8 in practice and generators,
Nayuki's included, write it without a designator. Every payload in the repo is an ASCII URI, on
which the two encodings agree. An ECI 26 (UTF-8) option is deferred until a consumer encodes
non-ASCII text and a target reader needs the designator.

### Errors

`QrError` carries a `code`:

| `code`            | When                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| `too-long`        | The data does not fit `maxVersion` at `level`; the error carries the bits needed and available    |
| `invalid-options` | `minVersion` or `maxVersion` outside 1–40, `minVersion` above `maxVersion`, or `mask` outside 0–7 |

Version 40-L holds 2,953 bytes, so a URI never reaches `too-long` with the defaults. A caller
capping `maxVersion` to keep a code small on screen is the one that sees it.

### SVG path data

```typescript
let path = symbol.toSVGPath({ margin: 4 });
// { d: "M4 4h7v1h-7zM12 4h1v1h-1z…", viewBox: "0 0 53 53", size: 53 }
```

- `d` is one path: every horizontal run of dark modules in a row becomes one `h`/`v` rectangle.
  A version 7 symbol is about 500 runs, a path under ten kilobytes.
- `viewBox` and `size` include the quiet zone. `margin` defaults to the standard's 4 modules; a
  smaller value is for a code that sits inside a light container already providing the margin.
- The output is attribute data for a renderer to place in `<path d>`, so the package builds no
  markup as a string.

### The component

```tsx
import { QrCode } from "@sdxc/qr/component";

<QrCode symbol={symbol} label={t("enrol.qrLabel")} size="12rem" />;
```

It renders:

```tsx
<svg
	role="img"
	aria-label={label}
	viewBox={path.viewBox}
	width={size}
	height={size}
	shapeRendering="crispEdges"
	mix={[css({ forcedColorAdjust: "none" }), mix]}
>
	<rect width="100%" height="100%" fill={light} />
	<path d={path.d} fill={dark} />
</svg>
```

| Prop     | Default  | Notes                                                                           |
| -------- | -------- | ------------------------------------------------------------------------------- |
| `symbol` | Required | A `QR` from `QR.encode`                                                         |
| `label`  | Required | The accessible name, which says what the code is for; the package ships no copy |
| `size`   | `12rem`  | A CSS length for the rendered width and height                                  |
| `margin` | `4`      | Quiet zone in modules                                                           |
| `dark`   | `#000`   | Module color                                                                    |
| `light`  | `#fff`   | Background and quiet zone color                                                 |
| `mix`    | None     | Passed through to the `<svg>`                                                   |

**It takes a `QR`, not the text.** Encoding answers a `Result`, and a render function has
no way to return one. The controller encodes, logs a failure, and renders the page without the
code, which works because every page that shows a QR also shows its text alternative.

**Colors are fixed, dark on light.** A scanner needs a dark symbol on a light quiet zone; many
readers reject an inverted code. `currentColor` would invert it under a dark theme, where the
text color is light. The quiet zone is part of the SVG's own light rectangle, so a dark page
still gives the code its margin. `dark` and `light` exist for a brand color, and the README
states that the pair needs strong contrast.

**Forced colors keep the code readable.** The CSS Color Adjustment spec gives `<svg>`
`forced-color-adjust: preserve-parent-color` in the browser's own stylesheet, under which a
`currentColor` fill takes the forced text color. `forced-color-adjust: none` on the element keeps
both fills as authored whatever the browser's stylesheet says, so a high-contrast theme cannot
turn the code light-on-dark.

**`role="img"` with a required `label`** gives the image one accessible name and keeps the 500
path runs out of the accessibility tree. The payload is not announced, which is correct for a
TOTP secret; the page's setup key and link are the accessible route to the same data.

**`shapeRendering="crispEdges"`** keeps adjacent rows from showing anti-aliasing seams at
fractional scales.

#### Why `@sdxc/qr/component` and not `@sdxc/ui`

`@sdxc/ui` depends on `remix`, `@sdxc/icons` and `@sdxc/u`, and its components are markup and
styling over the `--ui-*` theme. A QR component in it would make every `@sdxc/ui` consumer depend
on an encoder, and the component reads none of the theme, since its colors are fixed for
scanners. In `@sdxc/qr`, the encoder and its one renderer ship and version together, and an app
that already uses `@sdxc/ui` wraps the component in a `Card` like any other element.

### Out of scope

| Feature                 | Reason                                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| Decoding                | See [Why a generator only](#why-a-generator-only)                                                               |
| Kanji mode              | Needs a Shift JIS table of several thousand entries; UTF-8 byte mode encodes Japanese, and no consumer needs it |
| Micro QR                | Phone camera apps read Model 2 symbols, which every payload here fits                                           |
| Structured append       | Splits data across several symbols; the largest payload here is a few hundred bytes                             |
| ECI designators         | See [Byte mode and ECI](#byte-mode-and-eci)                                                                     |
| FNC1 and GS1 data       | A supply-chain format with no consumer                                                                          |
| PNG and data URL output | See below                                                                                                       |

**PNG output is deferred.** A PNG encoder is feasible in a Worker: a 1-bit grayscale image, a
CRC-32 per chunk, and the image data compressed through `CompressionStream("deflate")`, which
the Workers runtime supports. Every consumer renders into HTML, where an inline SVG is smaller,
sharp at any pixel density, synchronous, and needs no `img-src data:` in the page's CSP. A PNG
earns its place for email, where clients block SVG; when a consumer sends a QR by email, it
arrives as an asynchronous `@sdxc/qr/png` entry point, so the main entry point stays
synchronous.

## Usage Examples

### `auth-saas` TOTP enrolment

The controllers that render `EnrolTotpFactorPage` encode the URI next to the call that produced
it:

```tsx
let enrolment = await ctx.tenantStub.beginTotpEnrolment({ subjectId: session.subjectId });
let encoded = QR.encode(enrolment.uri, { level: "M" });
if (isFailure(encoded)) ctx.log.warn("totp.qr_failed", { code: encoded.error.code });

return ctx.render(
	<EnrolTotpFactorPage
		uri={enrolment.uri}
		setupKey={enrolment.setupKey}
		qr={isSuccess(encoded) ? encoded.data : null}
	/>,
);
```

The page draws `<QrCode symbol={qr} label={t("hostedSecondFactor.enrol.qrLabel")} />` above the
setup key when `qr` is present, keeps the key and the link, and its module header drops the
sentence about the missing image. The label is a new locale key.

### The two-factor guide

The guide's `qrCodeDataUrl` helper and its "no `@sdxc` package draws QR codes" sentence go. The
controller encodes with `QR.encode`, and the view renders `<QrCode>` in place of the `<img>`, so
the guide shows every step with packages the reader installs from npm.

### A terminal client

A CLI started for the device grant reads `isDark` directly, two rows per character:

```typescript
for (let y = -1; y < symbol.size + 1; y += 2) {
	let line = "";
	for (let x = -1; x < symbol.size + 1; x++) {
		line += HALF_BLOCKS[Number(symbol.isDark(x, y)) * 2 + Number(symbol.isDark(x, y + 1))];
	}
	output.push(line);
}
```

No client in the repo does this today; the example shows why `isDark` is the symbol's interface
rather than a fixed set of renderers.

## Consequences

### Positive

- **TOTP enrolment by scanning:** `auth-saas` shows the code every authenticator app expects.
- **A complete public guide:** the two-factor tutorial uses packages a reader can install.
- **Runs anywhere the apps do:** no runtime dependency beyond `@sdxc/result`, no Node API, no
  work at import time.
- **Accessible by default:** the component cannot render without a label, and its colors hold
  under dark themes and forced colors.
- **No CSP change:** an inline SVG needs no `data:` image source.

### Negative

- **A new encoder to own:** a bug in masking, interleaving or format bits produces a code some
  readers reject, which the tests below exist to catch.
- **A test-only decoder dependency:** `jsQR` is unmaintained since its last release; it runs only
  in tests, pinned exactly.
- **Fixed colors:** a page cannot theme the code through `--ui-*` variables, only through the
  `dark` and `light` props.

### Neutral

- **Optimal segmentation produces different matrices than single-mode generators** for mixed
  input. Both are valid; the known-answer fixtures record which reference produced each one.
- **The component's input is a `QR`,** so a page encodes in its controller before it
  renders.

## Implementation Plan

### Phase 1: The encoder

**Priority:** High
**Estimated Effort:** 6 hours

1. Create `packages/qr`, public, with `QR` (`encode`, `isDark`, `toSVGPath`), `QrLevel` and `QrError`.
2. Known-answer tests under `src/`:
   - The ISO/IEC 18004 annex example, `"01234567"` at 1-M with `boostLevel: false`: the data
     codewords `10 20 0C 56 61 80 EC 11 …`, the error correction codewords, and the matrix.
   - Matrices from Nayuki's reference implementation (MIT), generated once and committed as
     fixtures of `#` and `.` rows, each recording its input, options and reference: single-mode
     inputs against the TypeScript port, mixed inputs against the Java port's optimal
     segmenter. The set covers every level, each mode, versions 1, 2, 7, 10, 27 and 40, each
     forced mask, and the boost.
   - Reed–Solomon, format and version BCH codes against the standard's tables.
3. Round-trip tests: render each symbol to RGBA pixels and decode it with `jsQR`, a
   devDependency pinned exactly, asserting the bytes and the version. A seeded `@sdxc/random`
   stream generates inputs across modes, lengths and levels, so a failure names its seed.
4. Property tests: the optimal segmentation's bit length never exceeds the single-mode length,
   and the chosen version is the smallest that fits.
5. Write the README following the package documentation guide, including the contrast
   requirement and the ECI behavior.

### Phase 2: The component and the guide

**Priority:** High
**Estimated Effort:** 2 hours

1. `@sdxc/qr/component` with `QrCode`, tested through `renderToString`: the role, the label, the
   viewBox including the margin, and `forced-color-adjust: none`.
2. `apps/sdxc`: the two-factor guide switches to `QR.encode` and `QrCode`, in its own commit.

### Phase 3: `auth-saas`

**Priority:** Medium
**Estimated Effort:** 1 hour

1. The second-factor and step-up controllers encode the URI, and `EnrolTotpFactorPage` renders
   the code, with the new locale key in every locale.

## Alternatives Considered

### 1. A third-party QR library

The `qrcode` package on npm is the common choice.

**Rejected because**: it ships PNG, terminal and canvas renderers and their dependencies with
the encoder, throws rather than answering a `Result`, and has no `remix/component` renderer, so
the repo would wrap it in about as much code as the encoder is. The public guide also gains a
dependency the docs site does not control.

### 2. The component in `@sdxc/ui`

**Rejected because**: it adds an encoder to every `@sdxc/ui` install and reads none of the
theme. See [Why `@sdxc/qr/component` and not `@sdxc/ui`](#why-sdxcqrcomponent-and-not-sdxcui).

### 3. A `value` prop that encodes during render

`<QrCode value={uri} level="M" />` would save the controller a call.

**Rejected because**: a render function cannot answer a `Result`, so a failure would have to
throw or render nothing silently.

### 4. `currentColor` modules

The code would follow the text color like an icon.

**Rejected because**: under a dark theme it renders light on dark, which many scanners reject,
and under forced colors it takes whatever the user's palette assigns to text.

### 5. Single-mode segmentation

**Rejected because**: `otpauth://` URIs mix lowercase text with an uppercase base32 secret, and
splitting them saves a version for some lengths. See [Segmentation](#segmentation).

### 6. A PNG data URL as the output

**Deferred**: see [Out of scope](#out-of-scope). Inline SVG serves every HTML consumer.

## References

- [ISO/IEC 18004:2015, QR Code bar code symbology specification](https://www.iso.org/standard/62021.html)
- [Nayuki, QR Code generator library](https://www.nayuki.io/page/qr-code-generator-library)
- [Nayuki, Optimal text segmentation for QR Codes](https://www.nayuki.io/page/optimal-text-segmentation-for-qr-codes)
- [Nayuki, Creating a QR Code step by step](https://www.nayuki.io/page/creating-a-qr-code-step-by-step)
- [Thonky, QR Code Tutorial: Data Masking](https://www.thonky.com/qr-code-tutorial/data-masking)
- [Thonky, QR Code Tutorial: Mask Patterns](https://www.thonky.com/qr-code-tutorial/mask-patterns)
- [Thonky, QR Code Tutorial: Character Capacities](https://www.thonky.com/qr-code-tutorial/character-capacities)
- [jsQR](https://github.com/cozmo/jsQR)
- [MDN, BarcodeDetector](https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector)
- [CSS Color Adjustment Module Level 1, forced colors](https://www.w3.org/TR/css-color-adjust-1/)
- [Cloudflare Workers, Web standards (`CompressionStream`)](https://developers.cloudflare.com/workers/runtime-apis/web-standards/)
- [RFC 8628, OAuth 2.0 Device Authorization Grant](https://datatracker.ietf.org/doc/html/rfc8628)
- [ADR-007: Publishable Package Releases](./ADR-007-publishable-package-releases.md)
- [ADR-104: Random Package](./ADR-104-random-package.md)
- [auth-saas ADR-026: TOTP Second Factor and Recovery Codes](./auth-saas/ADR-026-totp-second-factor-and-recovery-codes.md)
- [auth-saas ADR-039: Device Authorization Grant](./auth-saas/ADR-039-device-authorization-grant.md)

## Current Progress

- [x] Phase 1: The encoder
- [x] Phase 2: The component and the guide
- [x] Phase 3: `auth-saas`

## Notes

- The public two-factor guide tells readers to install `@sdxc/qr`, so the package is public from
  its first commit: a description, a `LICENSE.md`, a ✅ in the root README table, and
  `bun run release:bootstrap @sdxc/qr` before the release that first carries it. `@sdxc/result`
  is already public.
- Nayuki's implementations are MIT-licensed and written from the ISO specification; the encoder
  may follow their structure, and the README credits them.
- The penalty rules follow the standard: N1 for runs of five or more (3 points plus 1 per extra
  module), N2 for each 2×2 block (3), N3 for each finder-like pattern (40), N4 for the dark
  ratio's distance from 50% (10 per 5%).
