# @sdxc/zone-file

Read and write RFC 1035 DNS zone files, with the record data codec for every typed record.

A zone file (a BIND "master file") is how DNS operators export, import, review and version a
zone. `parse` reads the whole grammar and returns the records it read beside every entry it could
not use; `stringify` writes records back, so `parse(stringify(zone))` gives the same records.

## Installation

```sh
npm add @sdxc/zone-file
```

`parse` and `parseRecordData` return a `Result` from
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which installs alongside this
package.

## Usage

### Read a zone file

```typescript
import { formatRecordData, parse } from "@sdxc/zone-file";
import { isFailure } from "@sdxc/result";

let text = `$TTL 1h
@    IN SOA ns1 hostmaster ( 1 2h 1h 1w 5m )
     IN NS  ns1 ; primary
www  IN A   192.0.2.1
`;

let parsed = parse(text, { origin: "example.com" });
if (isFailure(parsed)) throw parsed.error; // only for input over `maxBytes`

for (let record of parsed.data.records) {
	console.log(record.name, record.ttl, record.type, formatRecordData(record));
}
// example.com 3600 SOA ns1.example.com. hostmaster.example.com. 1 7200 3600 604800 300
// example.com 3600 NS ns1.example.com.
// www.example.com 3600 A 192.0.2.1
```

Every record comes back with an absolute, lowercased `name`, its `ttl`, `class`, `type`, the
typed fields of its type (`address`, `host`, `serial`…) and where it was written (`file`, `line`,
`endLine`, `comment`).

### Check what it could not read

An entry that does not parse becomes a rejection, and the rest of the file still reads.

```typescript
import { parse } from "@sdxc/zone-file";
import { unwrap } from "@sdxc/result";

let zone = unwrap(parse("bad IN A 999.1.1.1\nok IN A 192.0.2.1\n", { origin: "example.com" }));

zone.records.length; // 1
zone.rejected;
// [{ file: null, line: 1, endLine: 1, input: "bad IN A 999.1.1.1",
//    reason: "invalid-data", message: 'Invalid A record data: "999.1.1.1"' }]
```

### Write a zone file

```typescript
import { stringify } from "@sdxc/zone-file";

let text = stringify(
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

### Read and print record data on its own

```typescript
import { formatRecordData, parseRecordData } from "@sdxc/zone-file";

parseRecordData("MX", "10 Mail.Example.com.");
// success({ type: "MX", preference: 10, exchange: "mail.example.com" })

formatRecordData({ type: "MX", preference: 10, exchange: "mail.example.com" });
// "10 mail.example.com."
```

## API

### `parse(text: string, options: ParseOptions): Result<Zone, ZoneFileError>`

Reads a zone file into `{ origin, records, rejected }`. It fails only with a `ZoneFileError` for
input over `maxBytes`; every other problem is a `Rejection` beside the records that did parse,
and a caller that wants all-or-nothing checks `rejected.length`. Every record is returned —
outside the origin, repeated, any class, any type — and the caller decides which to keep.

| Option          | Default     | Meaning                                                                                                            |
| --------------- | ----------- | ------------------------------------------------------------------------------------------------------------------ |
| `origin`        | Required    | The initial `$ORIGIN`; `@` and relative names resolve against it                                                   |
| `ttl`           | `null`      | The TTL a record gets when neither it, a `$TTL` nor an earlier record states one                                   |
| `include`       | None        | `(fileName, origin) => string \| null` returns an `$INCLUDE`d file's text; without it every `$INCLUDE` is rejected |
| `relativeNames` | `"rfc1035"` | `"origin-suffix"` also reads a dotless name that equals the origin or ends in it as absolute                       |
| `maxBytes`      | 1 MiB       | The largest input in UTF-8 bytes, counted across included files                                                    |

The grammar it reads:

- `;` starts a comment outside quotes; a record's trailing comment is kept as `comment`.
- `"…"` quotes a field, with `\"`, `\\` and `\DDD` escapes.
- `(` … `)` joins lines into one entry, from `line` to `endLine`.
- `@` is the current origin, and a name without a trailing dot gets the origin appended, in
  owners and in the name fields of typed data. Names come back absolute, lowercased, without the
  trailing dot; the root is `"."`.
- A line starting with whitespace takes the previous record's owner.
- TTL and class are optional, in either order. A TTL is seconds or BIND units (`1h30m`, `2W`), up
  to 2³¹−1; a record without one takes `$TTL`, else the previous record's TTL, else
  `options.ttl`.
- `$ORIGIN`, `$TTL` and `$INCLUDE file [origin]` are read. An included file starts at the given
  or current origin, the origin, `$TTL` and owner revert after it, and includes nest 8 deep.
- Classes are `IN`, `CH`, `HS`, `CS` and `CLASSnnn`; types are any mnemonic or `TYPEnnn`, and RFC
  3597 generic data (`\# 4 C0000201`) is read for every type.

### `stringify(zone: ZoneInput, options?: StringifyOptions): string`

Writes `{ origin?, ttl?, records }` (a parsed `Zone` is one) as one tab-separated line per record,
ending in a newline. `$ORIGIN` and `$TTL` lead when the input names them, and a record's TTL is
left out when it equals `$TTL`. `relative: true` writes names under the origin relative to it and
the apex as `@`; otherwise every name is absolute. Comments are written back after `;`; spacing,
standalone comments and parentheses are not.

### `parseRecordData<Type extends RecordType>(type: Type, data: string): Result<RecordData<Type>, RecordDataError>`

Reads RDATA in presentation format, or RFC 3597 generic form, into the typed fields of `A`,
`AAAA`, `CNAME`, `NS`, `PTR`, `DNAME`, `MX`, `TXT`, `CAA`, `SRV`, `SOA` (SOA timers accept TTL
units), `SVCB` and `HTTPS` (their SvcParams as `params`), `TLSA`, `DS`, `CDS`, `DNSKEY` and
`CDNSKEY` (with the key's `keyTag`). Any other type returns `{ type, data }` as written. Names come back lowercased
without the trailing dot, and a relative name stays relative.

```typescript
parseRecordData("TXT", '"v=DKIM1; p=AAA" "BBB"');
// success({ type: "TXT", text: "v=DKIM1; p=AAABBB", strings: ["v=DKIM1; p=AAA", "BBB"] })
```

### `formatRecordData(data: RecordData<RecordType>): string`

Prints record data in canonical presentation format, the inverse of `parseRecordData`: names
absolute with the trailing dot, TXT strings, the CAA value and SvcParam text quoted with
non-printable octets as `\DDD`, hex lowercase, SvcParams in key order, untyped data as is. Two spellings of one record, such as `0 ISSUE "ca.example"` and its
generic form, print to one string.

### `canonicalType(type: string): string`

The uppercase mnemonic for a type, resolving `TYPEnnn` when it has one: `canonicalType("type16")`
is `"TXT"`.

### `typeName(code: number): string`

The mnemonic for a type code, or `TYPEnnn` without one: `typeName(16)` is `"TXT"`.

### `typeCode(type: string): number | null`

The code for a mnemonic or `TYPEnnn`, `null` for an unknown mnemonic: `typeCode("HTTPS")` is `65`.

### `ZoneFileError`

The failure `parse` returns when the input, with its includes, passes `maxBytes`. `code` is
`"too-large"` and `bytes` holds the size read.

### `RecordDataError`

The failure `parseRecordData` returns for data that does not fit its type.

### Types

Every type is exported top-level and under the `ZoneFile` namespace (`ZoneFile.Zone`).

- `Zone`: `{ origin, records, rejected }`, where `origin` is the origin at the end of the file.
- `Record`: any record read from a file; `RecordFor<Type>` narrows it to one type, and
  `RecordFields` is what every record carries beside its data (`name`, `ttl`, `class`, `file`,
  `line`, `endLine`, `comment`).
- `UntypedRecord`: a record of a type without typed fields, with its `data` as written and the
  `origin` its relative names need.
- `Rejection`: `{ file, line, endLine, input, reason, message }` for an entry that did not become
  a record. `RejectionReason` is `"malformed"`, `"invalid-data"`, `"missing-owner"`, `"include"`
  (no `include` option, a file it returned `null` for, or nesting past 8) or
  `"unsupported-directive"` (`$GENERATE` or any other `$` word).
- `RecordData<Type>`: the typed fields of a type: `AData`, `AAAAData`, `CNAMEData`, `NSData`,
  `PTRData`, `DNAMEData`, `MXData`, `TXTData`, `CAAData`, `SRVData`, `SOAData`, `SVCBData`,
  `HTTPSData` (with `SvcParams`), `TLSAData`, `DSData`, `CDSData`, `DNSKEYData`, `CDNSKEYData`,
  or `UnknownData`.
- `RecordType`, `TypedRecordType`, `RecordClass`: type and class names.
- `ParseOptions`, `StringifyOptions`: the options above.
- `ZoneInput`, `RecordInput`, `RecordInputFields`: what `stringify` accepts; a record needs only
  `name`, its type and fields, with optional `ttl`, `class` (default `"IN"`) and `comment`.

## Pattern: Import Only The Records You Track

`parse` returns everything, so an import policy is a filter. Exports from DNS providers often drop
the trailing dot on fully-qualified names; `relativeNames: "origin-suffix"` reads those as
absolute.

```typescript
import { parse } from "@sdxc/zone-file";
import { isFailure } from "@sdxc/result";

function importZone(text: string, domain: string) {
	let parsed = parse(text, { origin: domain, relativeNames: "origin-suffix" });
	if (isFailure(parsed)) return { records: [], errors: [parsed.error.message] };

	let records = parsed.data.records.filter(
		(record) =>
			record.class === "IN" &&
			["A", "AAAA", "MX", "TXT"].includes(record.type) &&
			(record.name === domain || record.name.endsWith(`.${domain}`)),
	);
	let errors = parsed.data.rejected.map((entry) => `Line ${entry.line}: ${entry.message}`);
	return { records, errors };
}
```

## Pattern: Normalize A Zone File For Review

Reading and printing gives every zone one spelling — lowercased names, canonical addresses, quoted
TXT — so two exports diff only where their records differ.

```typescript
import { parse, stringify } from "@sdxc/zone-file";
import { unwrap } from "@sdxc/result";

function normalize(text: string, origin: string): string {
	let zone = unwrap(parse(text, { origin }));
	let records = [...zone.records].sort(
		(a, b) => a.name.localeCompare(b.name) || a.type.localeCompare(b.type),
	);
	return stringify({ origin, records }, { relative: true });
}
```

## Pattern: Refuse A File With Any Bad Line

For an all-or-nothing import, treat any rejection as a failure and report each with its line.

```typescript
import type { Result } from "@sdxc/result";
import type { Zone } from "@sdxc/zone-file";

import { parse } from "@sdxc/zone-file";
import { failure, isFailure, success } from "@sdxc/result";

function parseStrict(text: string, origin: string): Result<Zone, Error> {
	let parsed = parse(text, { origin, maxBytes: 256 * 1024 });
	if (isFailure(parsed)) return parsed;

	let { rejected } = parsed.data;
	if (rejected.length === 0) return success(parsed.data);

	let lines = rejected.map((entry) => `Line ${entry.line} (${entry.reason}): ${entry.input}`);
	return failure(new Error(lines.join("\n")));
}
```

## Pattern: Read A Zone With Includes

The `include` callback supplies each `$INCLUDE`d file; records from it carry its name as `file`.

```typescript
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parse } from "@sdxc/zone-file";

let parsed = parse(readFileSync("zones/example.com.zone", "utf8"), {
	origin: "example.com",
	ttl: 3600,
	include: (fileName) => readFileSync(join("zones", fileName), "utf8"),
});
```

## Pattern: Compare A Zone File With Live DNS

A resolver answers with a type code and RDATA that may be in generic form. Reading both sides with
`parseRecordData` and printing with `formatRecordData` gives one key per record, whichever way it
was spelled.

```typescript
import { formatRecordData, parse, parseRecordData, typeName } from "@sdxc/zone-file";
import { isSuccess, unwrap } from "@sdxc/result";

interface Answer {
	name: string;
	type: number;
	data: string;
}

async function missingFromDns(text: string, origin: string, name: string, type: string) {
	let url = new URL("https://cloudflare-dns.com/dns-query");
	url.searchParams.set("name", name);
	url.searchParams.set("type", type);
	let response = await fetch(url, { headers: { Accept: "application/dns-json" } });
	let body = (await response.json()) as { Answer?: Answer[] };

	let live = new Set<string>();
	for (let answer of body.Answer ?? []) {
		let data = parseRecordData(typeName(answer.type), answer.data);
		if (isSuccess(data)) live.add(formatRecordData(data.data));
	}

	return unwrap(parse(text, { origin }))
		.records.filter((record) => record.name === name && record.type === type)
		.filter((record) => !live.has(formatRecordData(record)));
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
