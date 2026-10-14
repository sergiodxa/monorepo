# @sdxc/jsonc

JSON with comments and trailing commas, parsed with errors that point at the line and column.

## Installation

```sh
npm add @sdxc/jsonc
```

`parse()` answers a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which installs alongside this package.

## Usage

### Read a configuration file

```typescript
import * as JSONC from "@sdxc/jsonc";
import { isFailure } from "@sdxc/result";

let text = await readFile("tsconfig.json", "utf8");
let parsed = JSONC.parse(text);
if (isFailure(parsed)) {
	parsed.error.message; // "Expected ':' after a property name at line 4, column 12"
	throw parsed.error;
}
parsed.data; // the value, exactly as JSON.parse would produce it
```

JSONC is the format `tsconfig.json`, VS Code settings and `wrangler.jsonc` use: JSON plus `//` and `/* */` comments and trailing commas in objects and arrays.

```jsonc
{
	// Comments explain a setting
	"port": 8080,
	"hosts": ["example.com", "www.example.com"], // trailing commas are fine
}
```

### Strip and parse it yourself

```typescript
import * as JSONC from "@sdxc/jsonc";

let json = JSONC.strip('{ "a": 1, /* note */ }'); // '{ "a": 1             }'
JSON.parse(json); // { a: 1 }
```

The stripped text has the same length as the input, so any offset into it is an offset into the original.

## API

### `parse(text: string): Result<unknown, JSONCParseError>`

The value `text` holds. Comments, trailing commas and a leading byte-order mark are accepted; everything else follows `JSON.parse` exactly, so JSON5 extensions such as unquoted keys, single quotes and hexadecimal numbers are rejected. A block comment that never closes is a failure.

### `strip(text: string): string`

`text` as JSON of the same length: comments and trailing commas become spaces outside strings, line breaks inside block comments stay, and a leading byte-order mark becomes a space. A comma counts as trailing only after a value, so `[,]` stays invalid.

### `JSONCParseError`

The failure `parse` answers with. `message` reads `<reason> at line <line>, column <column>`; the fields are:

- `reason`: what is wrong, without the position.
- `offset`: index of the offending character in the original text, or its length at end of input.
- `line`, `column`: 1-based, counting `\n`, `\r\n` and a lone `\r` as one line break and columns in UTF-16 code units.

The position is computed by this package rather than read out of the engine's `JSON.parse` message, so the same input reports the same position and wording on Node, Bun, Deno and Cloudflare Workers.

## Patterns

### Pattern: Validate a configuration file after parsing it

Parse first, then validate the shape with a Standard Schema such as [`remix/data-schema`](https://www.npmjs.com/package/remix), reporting both kinds of failure with the file name.

```typescript
import { readFile } from "node:fs/promises";

import * as JSONC from "@sdxc/jsonc";
import { failure, isFailure, success } from "@sdxc/result";
import * as s from "remix/data-schema";

let Config = s.object({ port: s.number(), hosts: s.array(s.string()) });

async function loadConfig(path: string) {
	let parsed = JSONC.parse(await readFile(path, "utf8"));
	if (isFailure(parsed)) return failure(new Error(`${path}: ${parsed.error.message}`));
	let checked = s.parseSafe(Config, parsed.data);
	if (!checked.success) return failure(new Error(`${path}: ${checked.issues[0]?.message}`));
	return success(checked.value);
}
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one
release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/jsonc": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
