# @sdxc/png

PNG encoder and decoder over Web Streams, with no WebAssembly.

## Installation

```sh
npm add @sdxc/png
```

Decode failures are values from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which
installs alongside. Compression goes through `CompressionStream` and `DecompressionStream`, so it
runs in Workers, Bun, Node and the browser.

## Usage

### Encode pixels

```typescript
import { encode } from "@sdxc/png";

let data = new Uint8ClampedArray(width * height * 4); // straight RGBA, top row first
let bytes = await encode({ width, height, data });

return new Response(bytes, { headers: { "content-type": "image/png" } });
```

An image with no transparent pixel is written as RGB, a quarter smaller before compression. Pass
`{ alpha: "keep" }` to always write RGBA.

### Decode a file

```typescript
import { decode } from "@sdxc/png";
import { isFailure } from "@sdxc/result";

let image = await decode(bytes);
if (isFailure(image)) return new Response(image.error.message, { status: 422 });
image.data.data; // Uint8ClampedArray, RGBA, 8 bits per channel
```

Every color type and bit depth, palettes with transparency, 16-bit samples and Adam7 interlacing
read back as the same 8-bit RGBA layout.

## API

### `encode(image: PNG.Image, options?: PNG.EncodeOptions): Promise<Uint8Array>`

The complete PNG file. Each scanline takes the filter that compresses best by libpng's heuristic,
at zlib's default level. Rejects with a `RangeError` when `data` is not `width * height * 4` bytes,
a dimension is not a positive integer, or a `text` entry is not valid `tEXt`.

- `options.alpha`: `"auto"` (default) drops the alpha channel when every pixel is opaque; `"keep"`
  writes it anyway
- `options.text`: `tEXt` entries, such as `{ Software: "My App" }`; keywords are 1–79 Latin-1
  characters

### `decode(bytes: Uint8Array): Promise<Result<PNG.Image, PNGError>>`

The image as 8-bit straight RGBA. 16-bit samples round to 8 bits; ancillary chunks such as `gAMA`,
`iCCP` and `tEXt` are read past.

### `PNGError`

An `Error` with a `code`:

| Code          | When                                                                     |
| ------------- | ------------------------------------------------------------------------ |
| `signature`   | The bytes do not start with the PNG signature                            |
| `crc`         | A chunk's CRC-32 disagrees with its contents                             |
| `header`      | `IHDR`, `PLTE` or chunk order breaks the specification                   |
| `unsupported` | An unknown critical chunk, filter or method, or an image over 2²⁸ pixels |
| `truncated`   | The file or its pixel data ends early                                    |
| `inflate`     | The compressed pixel data is corrupt                                     |

### Types

- `PNG.Image`: `{ width: number; height: number; data: Uint8ClampedArray }`, the layout of the web's
  [`ImageData`](https://developer.mozilla.org/en-US/docs/Web/API/ImageData)
- `PNG.EncodeOptions`: `{ alpha?: "auto" | "keep"; text?: Record<string, string> }`
- `PNGError.Code`: `"signature" | "crc" | "header" | "unsupported" | "truncated" | "inflate"`

## Pattern: Round-Trip Assertions in Tests

Decoding what a renderer encoded lets a test assert on pixels rather than on file bytes.

```typescript
import { decode, encode } from "@sdxc/png";
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

test("the first pixel is red", async () => {
	let data = new Uint8ClampedArray(4 * 4 * 4).fill(255);
	data.set([255, 0, 0, 255], 0);

	let image = unwrap(await decode(await encode({ width: 4, height: 4, data })));
	expect([...image.data.subarray(0, 4)]).toEqual([255, 0, 0, 255]);
});
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/png": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
