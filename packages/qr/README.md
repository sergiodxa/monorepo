# @sdxc/qr

QR Code Model 2 encoder with optimal segmentation, SVG path data and a remix/component renderer.

## Installation

```bash
npm add @sdxc/qr
```

The main entry point depends only on [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) and runs anywhere `TextEncoder` does: Workers, Bun, Node and the browser. `@sdxc/qr/component` renders through [`remix/component`](https://www.npmjs.com/package/remix); install `remix` to use it.

## Usage

### Encoding Text

```typescript
import { isSuccess } from "@sdxc/result";

import { QR } from "@sdxc/qr";

let encoded = QR.encode("https://example.com/device?user_code=WDJB-MJHT");

if (isSuccess(encoded)) {
	encoded.data.version; // 4
	encoded.data.size; // 33 modules a side
	encoded.data.isDark(0, 0); // true: the top-left finder
}
```

### Rendering With remix/component

```tsx
import { QrCode } from "@sdxc/qr/component";

<QrCode path={qr.toSVGPath()} label="Scan to add this account to your authenticator app" />;
```

The component takes path data, so the handler that has the text encodes it and decides what to render when encoding fails. The path data is plain JSON, so it also works as a prop of a hydrated component.

### Drawing Into Your Own Markup

```typescript
let { d, viewBox } = qr.toSVGPath({ margin: 4 });
// <svg viewBox={viewBox}><path d={d} /></svg>
```

### Reading Modules Directly

`isDark` answers `false` outside the symbol, so a loop that runs one module past each edge draws the quiet zone without bounds checks:

```typescript
for (let y = -1; y <= qr.size; y++) {
	let line = "";
	for (let x = -1; x <= qr.size; x++) line += qr.isDark(x, y) ? "██" : "  ";
	console.log(line);
}
```

## API

### `QR`

One encoded symbol. `QR.encode` is the only way to get one, so every instance holds a valid symbol: `version` (1–40), `level` (the level applied, after any boost), `mask` (0–7) and `size` (`17 + 4 * version` modules a side, quiet zone excluded).

#### `QR.encode(data: string | Uint8Array, options?: QrOptions): Result<QR, QrError>`

Encode text or bytes as the smallest symbol that holds them. A string is split into numeric, alphanumeric and byte segments with the fewest total bits, so a URI around an upper-case token takes fewer modules than it would as bytes alone. A `Uint8Array` is encoded as bytes as given.

| Option       | Default  | Meaning                                                                                      |
| ------------ | -------- | -------------------------------------------------------------------------------------------- |
| `level`      | `"M"`    | The minimum error correction level: `"L"` (7%), `"M"` (15%), `"Q"` (25%) or `"H"` (30%)      |
| `minVersion` | `1`      | The smallest version to try                                                                  |
| `maxVersion` | `40`     | The largest version to try; data that does not fit it fails with `too-long`                  |
| `mask`       | Computed | A fixed mask, 0–7; omitted, every mask is scored and the lowest penalty wins                 |
| `boostLevel` | `true`   | Raises the level as far as the chosen version still fits, since the extra correction is free |

Text goes into byte segments as UTF-8, with no ECI designator. Phone scanners read UTF-8 this way, and ASCII, which covers every URI, reads the same under any interpretation.

#### `qr.isDark(x: number, y: number): boolean`

Whether a module is dark. Coordinates outside the symbol answer `false`, so a renderer draws the quiet zone by reading past the edge.

#### `qr.toSVGPath(options?: SvgPathOptions): SvgPath`

Path data for one `<path>`: each horizontal run of dark modules is one rectangle, one unit per module. `viewBox` and `size` include the quiet zone, which `margin` sets in modules and defaults to the standard's 4; a smaller margin suits a code inside a light container that already provides one.

### `QrCode` from `@sdxc/qr/component`

An inline `<svg role="img">` with a light background rectangle and one dark path.

| Prop    | Default  | Notes                                                    |
| ------- | -------- | -------------------------------------------------------- |
| `path`  | Required | Path data from `qr.toSVGPath()`, quiet zone included     |
| `label` | Required | The accessible name, saying what the code is for         |
| `size`  | `12rem`  | A CSS length for the rendered width and height           |
| `dark`  | `#000`   | Module color                                             |
| `light` | `#fff`   | Background and quiet zone color                          |
| `mix`   | None     | Mixins applied to the `<svg>`, after the component's own |

The colors stay as given under a dark theme, and the SVG sets `forced-color-adjust: none` so a high-contrast theme keeps them too: scanners need a dark code on a light margin. A brand pair passed through `dark` and `light` needs the same strong contrast. The payload stays out of the accessibility tree, so show the text the code carries, or an equivalent, beside it.

### `QrError`

An `Error` with a `code`:

- `too-long`: the data does not fit `maxVersion` at `level`. `error.bits` holds `{ needed, available }`. Version 40 at level L holds 2,953 bytes, so this comes from a capped `maxVersion` in practice.
- `invalid-options`: a version outside 1–40, `minVersion` above `maxVersion`, a mask outside 0–7, or an unknown level.

### Types

`QrLevel` is `"L" | "M" | "Q" | "H"`. `QrOptions`, `SvgPathOptions` and `SvgPath` are the option and return shapes above.

## Pattern: An Authenticator Enrolment Page

Encode in the handler, which can log a failure, and render the code above the setup key, which stays as the text alternative.

```tsx
import { QR } from "@sdxc/qr";
import { QrCode } from "@sdxc/qr/component";
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
let encoded = QR.encode(uri, { level: "M" });

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
	let { needed, available } = encoded.error.bits!;
	console.warn(
		`Shorten the URL by ${Math.ceil((needed - available) / 8)} bytes to fit a version 6 code`,
	);
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
