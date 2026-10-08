# @sdxc/zone-file

Read and write RFC 1035 DNS zone files, with the record data codec for every typed record.

## Installation

```bash
npm add @sdxc/zone-file
```

`parse` returns a [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) value, which
installs alongside this package.

A zone file (a BIND "master file") is how DNS operators export, import, review and version a
zone. `parse` reads the whole RFC 1035 grammar — `$ORIGIN`, `$TTL`, `$INCLUDE`, parentheses,
blank owners, escapes, TTL units, any class and any type — and returns the records it read beside
every entry it could not use, each with its line and a reason. `stringify` writes records back, so
`parse(stringify(zone))` gives the same records.

## Usage

### Read A Zone File

```typescript
import * as ZoneFile from "@sdxc/zone-file";
import { isSuccess } from "@sdxc/result";

let parsed = ZoneFile.parse(text, { origin: "example.com" });
if (isSuccess(parsed)) {
	for (let record of parsed.data.records) console.log(record.name, record.ttl, record.type);
	for (let rejection of parsed.data.rejected) console.warn(rejection.line, rejection.message);
}
```

### Write One

```typescript
import * as ZoneFile from "@sdxc/zone-file";

let text = ZoneFile.stringify(
	{
		origin: "example.com",
		ttl: 3600,
		records: [
			{ name: "example.com", type: "MX", preference: 10, exchange: "mail.example.com" },
			{ name: "www.example.com", ttl: 300, type: "CNAME", target: "example.com" },
		],
	},
	{ relative: true },
);
// $ORIGIN example.com.
// $TTL 3600
// @	IN	MX	10 mail
// www	300	IN	CNAME	@
```

### Read Record Data From Anywhere

```typescript
import { parseRecordData } from "@sdxc/zone-file";

parseRecordData("MX", "10 Mail.Example.com.");
// success({ type: "MX", preference: 10, exchange: "mail.example.com" })
```

## API

### `parse(text, options): Result<ZoneFile.Zone, ZoneFileError>`

Reads a zone file into `{ origin, records, rejected }`. The only failure is a `ZoneFileError`
for input past `maxBytes`; any other problem — a bad line, an unknown directive, RDATA that does
not fit its type — is a `Rejection` beside the records that did parse, so a caller wanting
all-or-nothing checks `rejected.length`.

| Option          | Default     | Meaning                                                                                                          |
| --------------- | ----------- | ---------------------------------------------------------------------------------------------------------------- |
| `origin`        | Required    | The initial `$ORIGIN`; `@` and relative names resolve against it until a `$ORIGIN` line changes it               |
| `ttl`           | `null`      | The TTL a record gets when neither it, a `$TTL` nor an earlier record states one                                 |
| `include`       | None        | `(fileName, origin) => string \| null`, the text of an `$INCLUDE`d file; without it every `$INCLUDE` is rejected |
| `relativeNames` | `"rfc1035"` | `"origin-suffix"` also reads a dotless name that equals the origin or ends in it as absolute                     |
| `maxBytes`      | 1 MiB       | The largest input in UTF-8 bytes, counted across included files                                                  |

The grammar:

- `;` starts a comment outside quotes; a record's trailing comment is kept as `comment`.
- `"…"` quotes a field, with `\"`, `\\` and `\DDD` escapes; a `;` or parenthesis inside is data.
- `(` … `)` joins lines into one entry; `line` is where it starts and `endLine` where it ends.
- `@` is the current origin, and a name without a trailing dot gets the origin appended, in owners
  and in the name fields of typed RDATA.
- Names come back absolute, lowercased, without the trailing dot, `\DDD` and `\.` escapes resolved
  to one canonical spelling; the root is `"."`.
- A line starting with whitespace takes the previous record's owner.
- TTL and class are optional, in either order. A TTL is seconds or BIND units (`1h30m`, `2W`), up
  to 2³¹−1. A record without one takes `$TTL`, else the previous record's TTL, else `options.ttl`.
- `$ORIGIN`, `$TTL` and `$INCLUDE file [origin]` are read. An included file starts with the given
  or current origin, and the origin, `$TTL` and owner revert after it; includes nest 8 deep.
  `$GENERATE` is rejected.
- Classes are `IN`, `CH`, `HS`, `CS` and `CLASSnnn`; types are any mnemonic or `TYPEnnn`, and RFC
  3597 generic data (`\# 4 C0000201`) is read for every type.

Records outside the origin, a record listed twice, classes other than `IN` and every type are all
returned: which of them to keep is the caller's decision.

### `stringify(zone, options?): string`

Writes `{ origin?, ttl?, records }` (a parsed `Zone` is one) as one tab-separated line per record.
`$ORIGIN` and `$TTL` lead when the input names them, and a record's TTL is left out when it equals
`$TTL`. `relative: true` writes names under the origin relative to it and the apex as `@`;
otherwise every name is absolute. An untyped record read under another origin gets an `$ORIGIN`
line first, so relative names in its verbatim data keep their meaning. Comments are written back
after `;`; spacing, standalone comments and parentheses are not kept.

### `parseRecordData(type, data): Result<ZoneFile.RecordData<Type>, RecordDataError>`

Reads RDATA in presentation format into typed fields. Typed types: `A` and `AAAA` (`address`, IPv6
in RFC 5952 form), `CNAME`, `PTR` and `DNAME` (`target`), `NS` (`host`), `MX` (`preference`,
`exchange`), `TXT` (`text`, `strings`), `CAA` (`flags`, `critical`, `tag`, `value`), `SRV`
(`priority`, `weight`, `port`, `target`) and `SOA` (`primary`, `mailbox`, `serial`, `refresh`,
`retry`, `expire`, `minimum`, the timers accepting TTL units). Any other type returns
`{ type, data }`. RFC 3597 generic data is decoded for the typed types. Names are not qualified:
relative names stay relative.

```typescript
parseRecordData("TXT", '"v=DKIM1; p=AAA" "BBB"');
// success({ type: "TXT", text: "v=DKIM1; p=AAABBB", strings: ["v=DKIM1; p=AAA", "BBB"] })
```

### `formatRecordData(data): string`

Prints record data in canonical presentation format, the inverse of `parseRecordData`: names
absolute with the trailing dot, TXT strings and the CAA value quoted with every octet outside
printable ASCII as `\DDD`, the CAA tag lowercased, untyped data as is. Two spellings of one record —
`0 ISSUE "ca.example"` and its generic form — print to one string.

```typescript
formatRecordData({ type: "MX", preference: 10, exchange: "mx.example.com" }); // "10 mx.example.com."
```

### `canonicalType(type): string` / `typeName(code): string`

`canonicalType("txt")` is `"TXT"` and `canonicalType("TYPE16")` is `"TXT"`; `typeName(16)` is
`"TXT"`, and a code without a mnemonic is `"TYPEnnn"`.

### Errors

| Class             | When                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------- |
| `ZoneFileError`   | `code: "too-large"`: the input, with its includes, passed `maxBytes`; `bytes` holds it |
| `RecordDataError` | `parseRecordData` on data that does not fit the type                                   |

### Rejection reasons

| `reason`                | When                                                                                      |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `malformed`             | An unterminated quote, unbalanced parentheses, a bad owner or TTL, a missing type or data |
| `invalid-data`          | RDATA that does not fit its type; `message` holds the codec's error                       |
| `missing-owner`         | A blank owner with no earlier record to take it from                                      |
| `include`               | `$INCLUDE` without the `include` option, a file it returned `null` for, or nesting past 8 |
| `unsupported-directive` | `$GENERATE` or any other `$` word                                                         |

Each rejection carries `file` (`null` for the text passed to `parse`), `line`, `endLine`, `input`
(the entry as written) and `message`.

### `ZoneFile` namespace

Types only: `Zone`, `Record`, `RecordFor<Type>`, `RecordFields`, `UntypedRecord`, `Rejection`,
`RejectionReason`, `ParseOptions`, `ZoneInput`, `RecordInput`, `StringifyOptions`, `RecordType`,
`TypedRecordType`, `RecordClass`, `RecordData<Type>`, and one data interface per typed type
(`AData` through `SOAData`) plus `UnknownData`.

## Pattern: Import Only What You Track

`parse` returns everything; the policy is a filter.

```typescript
import * as ZoneFile from "@sdxc/zone-file";
import { isFailure } from "@sdxc/result";

let parsed = ZoneFile.parse(text, { origin: domain, relativeNames: "origin-suffix" });
if (isFailure(parsed)) throw new Error(parsed.error.message);

let tracked = parsed.data.records.filter(
	(record) =>
		record.class === "IN" &&
		["A", "AAAA", "MX", "TXT"].includes(record.type) &&
		(record.name === domain || record.name.endsWith(`.${domain}`)),
);
```

## Pattern: Normalize A Zone File For Review

Reading and printing gives every zone one spelling — absolute names, canonical addresses, quoted
TXT — so two exports diff only where their records differ.

```typescript
import * as ZoneFile from "@sdxc/zone-file";
import { unwrap } from "@sdxc/result";

function normalize(text: string, origin: string): string {
	let zone = unwrap(ZoneFile.parse(text, { origin }));
	let records = zone.records.toSorted((a, b) => a.name.localeCompare(b.name));
	return ZoneFile.stringify({ origin, records }, { relative: true });
}
```

## Pattern: Read A Zone With Includes

```typescript
import { readFileSync } from "node:fs";
import { join } from "node:path";

import * as ZoneFile from "@sdxc/zone-file";

let parsed = ZoneFile.parse(readFileSync("zones/example.com.zone", "utf8"), {
	origin: "example.com",
	include: (fileName) => readFileSync(join("zones", fileName), "utf8"),
});
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
		"@sdxc/zone-file": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
