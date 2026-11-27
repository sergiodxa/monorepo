# @sdxc/bytes

Typed byte size strings like "10 MB" or "10 MiB" converted to bytes.

## Installation

```sh
npm add @sdxc/bytes
```

`parse()` answers a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which installs alongside this package.

## Usage

### Convert a size

```typescript
import { toBytes } from "@sdxc/bytes";

const MAX_UPLOAD_BYTES = toBytes("10 MiB"); // 10485760, same as 10 * 1024 * 1024

toBytes("10 MB"); // 10000000
toBytes("512KiB"); // 524288
toBytes(2048); // 2048, a bare number is already bytes

toBytes("10 KB"); // type error: write "10 kB" or "10 KiB"
```

`MB`, `GB` and the other plain symbols count in powers of 1000; `MiB`, `GiB` and the other `i` symbols count in powers of 1024. Pick the one you mean: a memory or storage limit usually wants `MiB`, a figure shown to people or billed per gigabyte usually wants `MB`.

### Accept a size in your own API

Declare the parameter as `ByteSizeInput` and convert once inside, so callers pass either form.

```typescript
import type { ByteSizeInput } from "@sdxc/bytes";

import { toBytes } from "@sdxc/bytes";

interface UploadOptions {
	maxSize: ByteSizeInput;
}

function accepts(file: File, options: UploadOptions) {
	return file.size <= toBytes(options.maxSize);
}

accepts(file, { maxSize: "5 MiB" });
accepts(file, { maxSize: 5_242_880 });
```

### Parse text that arrives at runtime

Configuration values and form fields are plain strings, so the type cannot check them. `parse()` does, and reports the rejected text.

```typescript
import { parse } from "@sdxc/bytes";
import { isFailure } from "@sdxc/result";

let result = parse(env.MAX_UPLOAD_SIZE ?? "");

if (isFailure(result)) throw result.error; // Invalid byte size: "10 mb"

let maxUploadBytes = result.data;
```

### Sizes past a number's range

A number holds a byte count exactly only up to about 8 PiB. For larger totals, or to write exabytes and up, use the bigint pair:

```typescript
import { toBytesBigInt } from "@sdxc/bytes";

toBytesBigInt("2 EiB"); // 2305843009213693952n
toBytesBigInt("10 MiB"); // 10485760n
```

## API

### `toBytes(input: ByteSizeInput): number`

Converts a size to bytes; a number passes through unchanged. Text that reaches it behind a cast returns `NaN`, so send untrusted text through `parse()`.

### `parse(text: string): Result<number, InvalidByteSizeError>`

Parses text into bytes after trimming surrounding whitespace. It accepts exactly what `ByteSizeString` accepts, plus a bare amount read as bytes (`"1048576"`), and fails when the result is larger than `Number.MAX_SAFE_INTEGER` (about 8 PiB), where it could not be exact.

### `toBytesBigInt(input: BigByteSizeInput): bigint`

Converts a size to a bigint of bytes, exact at any size; a bigint passes through unchanged. Text that reaches it behind a cast throws its `InvalidByteSizeError`, since a bigint has no `NaN`.

### `parseBigInt(text: string): Result<bigint, InvalidByteSizeError>`

Parses text the way `parse()` does, with the units from `BigByteSizeString` and no upper bound.

### `InvalidByteSizeError`

The error inside a failed `parse()` or `parseBigInt()`. `text` holds the rejected input verbatim, and `message` quotes it (`Invalid byte size: "10 mb"`).

### Types

#### `ByteSizeString`

A whole amount plus a unit: a symbol with or without a space (`"10 MB"`, `"10MB"`), or a name after one space (`"10 megabytes"`).

| Decimal symbol | Name       | Bytes | Binary symbol | Name       | Bytes |
| -------------- | ---------- | ----- | ------------- | ---------- | ----- |
| `B`            | `byte`     | 1     |               |            |       |
| `kB`           | `kilobyte` | 1000¹ | `KiB`         | `kibibyte` | 1024¹ |
| `MB`           | `megabyte` | 1000² | `MiB`         | `mebibyte` | 1024² |
| `GB`           | `gigabyte` | 1000³ | `GiB`         | `gibibyte` | 1024³ |
| `TB`           | `terabyte` | 1000⁴ | `TiB`         | `tebibyte` | 1024⁴ |
| `PB`           | `petabyte` | 1000⁵ | `PiB`         | `pebibyte` | 1024⁵ |

Names take a plural `s`. Symbols are case-sensitive, so `mb`, `Mb` (megabits) and `KB`, which means 1000 or 1024 depending on who wrote it, are rejected. Amounts may be `0` or negative. Both the type and `parse()` reject fractions and exponents (`"1.5 GB"`, `"5e3 B"`), leading zeros and plus signs, a name without its space (`"10megabytes"`), and compound sizes (`"1 MB 512 kB"`).

#### `ByteSizeInput`

`number | ByteSizeString`, the type a size-taking API declares. A number is always bytes.

#### `ByteUnit`

The unit names, singular and plural.

#### `ByteUnitShort`

The unit symbols: `B`, `kB`, `MB`, `GB`, `TB`, `PB`, `KiB`, `MiB`, `GiB`, `TiB`, `PiB`.

#### `BigByteSizeString`, `BigByteSizeInput`, `BigByteUnit`, `BigByteUnitShort`

The bigint counterparts. They accept every form above plus `EB`/`exabyte`, `ZB`/`zettabyte`, `YB`/`yottabyte` (powers of 1000) and `EiB`/`exbibyte`, `ZiB`/`zebibyte`, `YiB`/`yobibyte` (powers of 1024). `BigByteSizeInput` is `bigint | BigByteSizeString`.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/bytes": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
