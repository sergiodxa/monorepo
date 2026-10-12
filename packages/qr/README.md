# @sdxc/qr

QR Code Model 2 encoder with optimal segmentation, SVG path data and a remix/component renderer.

## Installation

```sh
npm add @sdxc/qr
```

The main entry point depends only on [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) and runs anywhere `TextEncoder` does: Workers, Bun, Node and the browser. `@sdxc/qr/ui` renders through `remix/component`; install [`remix`](https://www.npmjs.com/package/remix) to use it.

## Usage

### Encode text

```typescript
import { QR } from "@sdxc/qr";
import { isSuccess } from "@sdxc/result";

let encoded = QR.encode("https://example.com/device?user_code=WDJB-MJHT");

if (isSuccess(encoded)) {
	encoded.data.version; // 4, the smallest version that holds the text
	encoded.data.size; // 33 modules a side
	encoded.data.level; // "Q": raised from the default "M" because the version had room
}
```

A string is split into numeric, alphanumeric and UTF-8 byte segments with the fewest total bits, so a URI around an upper-case token takes fewer modules than it would as bytes alone.

### Render it with remix/component

```tsx
import { QrCode } from "@sdxc/qr/ui";

<QrCode path={encoded.data.toSVGPath()} label="Scan to open this page on your phone" />;
```

`QrCode` takes path data, which is plain JSON, so the code that encodes decides what to render on failure and the component also works as a prop of a hydrated island.

### Draw into your own markup

```typescript
let { d, viewBox } = encoded.data.toSVGPath({ margin: 2 });
// <svg viewBox={viewBox}><rect width="100%" height="100%" fill="#fff" /><path d={d} /></svg>
```

### Handle a failure

```typescript
import { QR } from "@sdxc/qr";
import { isFailure } from "@sdxc/result";

let encoded = QR.encode(payload, { maxVersion: 10 });

if (isFailure(encoded)) {
	if (encoded.error.code === "too-long")
		encoded.error.bits; // { needed, available }
	else encoded.error.message; // which option was out of range
}
```

## API

### `QR`

One encoded symbol, with `version` (1–40), `level` (the level applied, after any boost), `mask` (0–7) and `size` (`17 + 4 * version` modules a side, quiet zone excluded). `QR.encode` is the only way to get one, so every instance holds a valid symbol.

#### `QR.encode(data: string | Uint8Array, options?: QrOptions): Result<QR, QrTooLongError | QrOptionsError>`

Encodes text or bytes as the smallest symbol that holds them. Text goes into byte segments as UTF-8; a `Uint8Array` is encoded as bytes as given.

- `options.level`: the minimum error correction level. Default `"M"`.
- `options.minVersion`: the smallest version to try. Default `1`.
- `options.maxVersion`: the largest version to try; data that does not fit fails with `too-long`. Default `40`.
- `options.mask`: a fixed mask, 0–7. Omitted, every mask is scored and the lowest penalty wins.
- `options.boostLevel`: raises the level as far as the chosen version still holds the data, since the extra correction costs no modules. Default `true`.

#### `qr.isDark(x: number, y: number): boolean`

Whether a module is dark. Coordinates outside the symbol answer `false`, so a renderer draws the quiet zone by reading past the edge.

#### `qr.toSVGPath(options?: SvgPathOptions): SvgPath`

Path data for one `<path>`: each horizontal run of dark modules is one rectangle, one unit per module. `viewBox` and `size` include the quiet zone, whose width `margin` sets in modules (default `4`, the standard's).

### `QrCode` from `@sdxc/qr/ui`

An inline `<svg role="img">` with a light background and one dark path. Its colors stay as given under dark and forced-color themes, since scanners need a dark code on a light margin; show the text the code carries beside it, because the payload stays out of the accessibility tree.

- `path`: path data from `qr.toSVGPath()`, quiet zone included.
- `label`: the accessible name, saying what the code is for.
- `size`: a CSS length for the rendered width and height. Default `"12rem"`.
- `dark`: module color. Default `"#000"`.
- `light`: background and quiet zone color. Default `"#fff"`. A brand pair needs the same strong contrast.
- `mix`: mixins applied to the `<svg>`, after the component's own.

### `QrError`

The `Error` every failure extends, with a `code`. Checking `code` narrows to the subclass.

### `QrTooLongError`

Code `too-long`: the data does not fit `maxVersion` at `level`. `bits` holds `{ needed, available }`.

### `QrOptionsError`

Code `invalid-options`: a version outside 1–40, `minVersion` above `maxVersion`, a mask outside 0–7, or an unknown level.

### Types

- `QrLevel`: `"L" | "M" | "Q" | "H"`, recovering about 7%, 15%, 25% and 30% of codewords.
- `QrOptions`: the options of `QR.encode`.
- `SvgPathOptions`: `{ margin?: number }`.
- `SvgPath`: `{ d: string; viewBox: string; size: number }`.
- `QrError.Code`: `"too-long" | "invalid-options"`.
- `QrError.Bits`: `{ needed: number; available: number }`.

## Pattern: An Authenticator Enrolment Page

Encode where a failure can be logged, and render the code above the setup key, which stays as the text alternative.

```tsx
import { QR } from "@sdxc/qr";
import { QrCode } from "@sdxc/qr/ui";
import { isSuccess } from "@sdxc/result";
import type { Handle } from "remix/component";

function EnrolPage(handle: Handle<{ uri: string; setupKey: string; qr: QR | null }>) {
	return () => {
		let { uri, setupKey, qr } = handle.props;
		return (
			<main>
				<h1>Set up your authenticator app</h1>
				{qr && <QrCode path={qr.toSVGPath()} label="QR code for your authenticator app" />}
				<p>
					Or enter this key: <code>{setupKey}</code>
				</p>
				<a href={uri}>Open in an authenticator app on this device</a>
			</main>
		);
	};
}

let uri =
	"otpauth://totp/Acme:ada%40example.com?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=Acme";
let encoded = QR.encode(uri);

let page = (
	<EnrolPage
		uri={uri}
		setupKey="JBSW Y3DP EHPK 3PXP"
		qr={isSuccess(encoded) ? encoded.data : null}
	/>
);
```

## Pattern: Keeping A Code Small On Screen

Cap the version, and fall back to the link when the data needs more modules than the layout has room for.

```typescript
import { QR } from "@sdxc/qr";
import { isFailure } from "@sdxc/result";

let encoded = QR.encode(url, { level: "L", maxVersion: 6 });

if (isFailure(encoded) && encoded.error.code === "too-long") {
	let { needed, available } = encoded.error.bits;
	let overBy = Math.ceil((needed - available) / 8);
	// Show the link alone, and shorten the URL by `overBy` bytes to fit a version 6 code
}
```

## Pattern: A Printed Label That Survives Damage

A label on a box gets scuffed, so ask for level `H` and give it a wider quiet zone. Encode an identifier as bytes when it is not text.

```typescript
import { QR } from "@sdxc/qr";
import { isSuccess } from "@sdxc/result";

let encoded = QR.encode(new TextEncoder().encode("PKG-000123"), { level: "H" });

if (isSuccess(encoded)) {
	let { d, viewBox } = encoded.data.toSVGPath({ margin: 6 });
	// <svg viewBox={viewBox} width="30mm" height="30mm"><path d={d} /></svg>
}
```

## Pattern: Rendering In A Terminal

`isDark` answers `false` past the edge, so a loop that starts one module outside the symbol draws a quiet zone without bounds checks.

```typescript
import { QR } from "@sdxc/qr";
import { isSuccess } from "@sdxc/result";

let encoded = QR.encode("https://example.com/pair?code=7F3K");

if (isSuccess(encoded)) {
	let qr = encoded.data;
	let lines: string[] = [];
	for (let y = -2; y < qr.size + 2; y++) {
		let line = "";
		for (let x = -2; x < qr.size + 2; x++) line += qr.isDark(x, y) ? "██" : "  ";
		lines.push(line);
	}
	process.stdout.write(lines.join("\n") + "\n");
}
```

## Credits

The encoder follows the structure of Project Nayuki's MIT-licensed QR Code generator, itself written from ISO/IEC 18004, and its segmentation follows Nayuki's optimal segmentation algorithm.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/qr": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
