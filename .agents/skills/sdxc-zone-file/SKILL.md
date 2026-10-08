---
name: sdxc-zone-file
description: "@sdxc/zone-file reads and writes RFC 1035 DNS zone (BIND master) files — `parse(text, { origin, relativeNames, include, maxBytes, ttl })` answering `Result<Zone, ZoneFileError>` with `records` and line-level `rejected`, `stringify(zone, { relative })` — and owns the RDATA codec `parseRecordData(type, data)` / `formatRecordData(data)` plus `canonicalType` / `typeName`. Use when importing or exporting a zone file, reading `$ORIGIN`/`$TTL`/`$INCLUDE`/parenthesized records, comparing zone-file records with `@sdxc/doh` answers, or parsing/printing record data (MX, TXT, CAA, SOA…) in presentation form."
---

# @sdxc/zone-file

An RFC 1035 master-file reader and writer, and the home of the record-data presentation codec `@sdxc/doh` reads answers through. `parse` reads the whole grammar: `;` comments (a record's trailing one kept as `comment`), quoted strings with `\"`/`\\`/`\DDD`, `(`…`)` across lines (`line`/`endLine`), `@`, relative names qualified in owners and typed RDATA, escaped names printed canonically, blank owners, TTL and class in either order, BIND TTL units (`1h30m`) up to 2³¹−1, TTL inheritance (explicit → `$TTL` → previous record → `options.ttl`), `$ORIGIN`, `$TTL`, `$INCLUDE` through the `include` option (nests 8 deep; origin, `$TTL` and owner revert after), any class (`CLASSnnn` too), any type (`TYPEnnn`, RFC 3597 `\# len hex`). `$GENERATE` is rejected.

The only failure is `ZoneFileError` (`code: "too-large"`, `bytes`) past `maxBytes` (default 1 MiB, includes counted). Everything else is a `Rejection` beside the records that parsed: `{ file, line, endLine, input, reason, message }`, reason `malformed` | `invalid-data` | `missing-owner` | `include` | `unsupported-directive`.

Records come back with `name` (absolute, lowercased, no trailing dot, root `"."`), `ttl` (`null` when nothing stated one), `class`, `type`, `file`, `line`, `endLine`, `comment`, and typed fields for A, AAAA, CNAME, NS, PTR, DNAME, MX, TXT, CAA, SRV, SOA. Other types keep `data` as written plus the `origin` it was read under.

Full API and examples: [packages/zone-file/README.md](packages/zone-file/README.md)

## Using it

```json
{ "dependencies": { "@sdxc/zone-file": "workspace:*" } }
```

```typescript
import { isFailure } from "@sdxc/result";
import * as ZoneFile from "@sdxc/zone-file";

let parsed = ZoneFile.parse(text, { origin: "example.com", relativeNames: "origin-suffix" });
if (isFailure(parsed)) return tooLarge(parsed.error.bytes);

let records: ZoneFile.Record[] = parsed.data.records;
let report = parsed.data.rejected.map((rejection) => `${rejection.line}: ${rejection.message}`);

let text = ZoneFile.stringify({ origin: "example.com", ttl: 3600, records }, { relative: true });
```

Types read both ways: `import * as ZoneFile` gives `ZoneFile.Record`, and `import type { ZoneFile } from "@sdxc/zone-file"` gives the same.

## Suggestions

- Policy belongs to the caller: `parse` returns records outside the origin, repeats, non-`IN` classes and every type. Filter after parsing; do not ask for parser options.
- Key a record's identity on `` `${name} ${type} ${formatRecordData(record)}` ``: AAAA spellings, CAA tag case and RFC 3597 generic data all print to one string, so it dedupes a file and matches `@sdxc/doh` answers.
- Use `relativeNames: "origin-suffix"` for provider exports (Cloudflare's SOA owner lacks its trailing dot); keep the `"rfc1035"` default for hand-written or BIND zones.
- An unquoted TXT value is several character-strings: `v=spf1 -all` parses as `v=spf1-all`. Tell users to quote.
- `parseRecordData` does not qualify relative names; only `parse` knows the origin.
- To show a rejected entry, use `rejection.input` (the whole entry); records carry only `line`/`endLine`, so slice the original text for theirs.
- `stringify` round-trips records, not bytes: spacing, standalone comments and parentheses are not kept, which makes it a normalizer for diffs.
- Any letters-only word is accepted as a type, so a typo reads as an untyped record. Keep your own list of known types if you want to report typos.

## Related

- `@sdxc/doh` — resolves records with the same typed fields (`DoH.RecordFor<Type>` is `ZoneFile.RecordData<Type>` plus `name` and `ttl`)
- `@sdxc/result` — the `Result` `parse` and `parseRecordData` answer; skill `sdxc-result`
- sdxc guide: `/docs/data-and-background-work/zone-files`
