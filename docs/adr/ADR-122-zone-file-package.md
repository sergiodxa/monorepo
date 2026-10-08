# ADR-122: Zone File Package

## Status

**Proposed** - 2026-10-08

## Background

`apps/uptime` reads pasted BIND zone files: a zone cannot be enumerated from outside it, so the
file is the only way a DNS monitor learns the names below the apex
([uptime ADR-026 §7](./uptime/ADR-026-domain-dns-monitors-with-record-import.md#7-the-zone-file-the-smallest-parser-that-is-honest-about-what-it-skipped)).
The parser in `app/services/zone-file.ts` was sized for that one job: one record per line, no
directives, no parentheses, no inherited owners, the seven types the monitor tracks, and every
other line reported with its number and a reason. It is honest about what it skips, and what it
skips is most of RFC 1035's master-file syntax.

The master file is a format: DNS operators export it, import it, diff it and keep it in git, and
the repo's convention is that a format gets its own package with `parse` and `stringify` and a
camelCase API. The record-data half of the format already lives in a package —
`@sdxc/doh`'s `parseRecordData` and `formatRecordData` read and print RDATA in presentation
format — but the file around the records does not. This ADR extracts the file syntax into
`@sdxc/zone-file`, gives it the full RFC 1035 grammar and a serializer, decides where the RDATA
codec belongs, and moves uptime onto the package.

## Context

### Current implementation

| Location                                                                                                    | What it does                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/uptime/app/services/zone-file.ts` (487 lines)                                                         | `parseZoneFile(input, domain)`: tokenizer (quotes, `;` comments, parentheses), owner/TTL/class/type reading, name qualification, per-line rejection                                  |
| `apps/uptime/app/lib/dns-record-value.ts` (300 lines)                                                       | The stored identity of a record: `normalizeDnsName`, `canonicalizeIpv6`, `isIpv4Address`, the strict `parseDnsRecordValue`, the total `normalizeDnsRecordValue`, `storedRecordValue` |
| `apps/uptime/app/services/zone-file.test.ts` (384 lines)                                                    | Per-reason tests, plus the real Cloudflare export and a reconstructed fixture whose last section exercises every unsupported construct                                               |
| `apps/uptime/app/http/controllers/actions/dns-monitors.ts`, `…/api/dns-monitors.ts`                         | The two callers: the form import and the public API                                                                                                                                  |
| `packages/doh/src/parse-record-data.ts`, `format-record-data.ts`, `character-strings.ts`, `record-types.ts` | The RDATA codec: typed fields for A, AAAA, CNAME, NS, MX, TXT, CAA, SOA, SRV; RFC 3597 generic data; canonical printing                                                              |

### What the uptime parser rejects

Each of these is a `ZoneFileRejectionReason` with a translated sentence in every locale:

| Reason                   | Construct                                    | Status under RFC 1035                                                  |
| ------------------------ | -------------------------------------------- | ---------------------------------------------------------------------- |
| `originDirective`        | `$ORIGIN`                                    | Standard. Rejected because ignoring it would misplace every later name |
| `ttlDirective`           | `$TTL`                                       | Standard (RFC 2308). Rejected because the monitor does not track TTLs  |
| `includeDirective`       | `$INCLUDE`                                   | Standard. Names a file the app does not have                           |
| `generateDirective`      | `$GENERATE`                                  | BIND extension                                                         |
| `unsupportedDirective`   | Any other `$` word                           | Not a directive                                                        |
| `multiLineRecord`        | `(` … `)` across lines                       | Standard; every SOA export uses it                                     |
| `blankOwnerContinuation` | A line starting with whitespace              | Standard: the owner is the previous record's                           |
| `nonInternetClass`       | `CH`, `HS`, `CS`                             | Standard; not the internet                                             |
| `unsupportedType`        | A known type the monitor does not track      | Standard; an app decision                                              |
| `outOfZone`              | An owner outside the monitor's domain        | Out-of-zone data; BIND ignores it                                      |
| `malformed`              | Anything unreadable, including invalid RDATA | Syntax or data error                                                   |

The first seven are syntax the parser could read and chose not to. The last four are app policy
or genuine errors. Only the first group belongs to the format; the second stays in the app.

### Where the record-data codec lives

`@sdxc/doh` owns the RDATA codec because resolving was its first use: a DoH JSON answer carries
RDATA in presentation format. But presentation format **is** the master-file format's record half
(RFC 1035 §5.1), and its README already advertises `parseRecordData` "for RDATA from anywhere
else, such as a zone file". Three placements were weighed:

| Placement                                                             | Consequence                                                                                                                                              |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A `@sdxc/doh/zone-file` subpath                                       | A file format inside a DNS-over-HTTPS client: an operator tool that diffs two zone files installs a resolver and `remix`                                 |
| `@sdxc/zone-file` depending on `@sdxc/doh` for RDATA                  | The format package depends on a network client, and every `@sdxc/zone-file` install pulls `remix`, which `@sdxc/doh` needs only to validate its envelope |
| **The codec moves into `@sdxc/zone-file`; `@sdxc/doh` depends on it** | The format owns its whole grammar, the client depends on the format, and `@sdxc/zone-file` depends on `@sdxc/result` alone                               |

The codec's only consumer outside `@sdxc/doh` is uptime's `dns-record-value.ts`, so the move
changes one import in one app.

### Real exports

The committed Cloudflare export (`apps/uptime/app/services/fixtures/sergiodxa.com.txt`) shows
what the parser meets in practice ([uptime ADR-026, open question 5](./uptime/ADR-026-domain-dns-monitors-with-record-import.md#open-questions)):
fully-qualified owners, explicit TTLs and `IN`, inline `;` comments carrying `cf_tags=` metadata,
the same record listed twice, and an SOA line whose owner **lacks** the trailing dot every other
line has. Under RFC 1035 that owner is relative and means `sergiodxa.com.sergiodxa.com`; uptime's
`qualifyName` reads a dotless name that already ends in the zone as absolute to absorb it.

## Decision

Add `@sdxc/zone-file`: an RFC 1035 master-file reader and writer that reports every entry it
cannot use, and the home of the RDATA presentation codec, which moves out of `@sdxc/doh`.

### Entry points

| Entry             | Contents                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| `@sdxc/zone-file` | `parse`, `stringify`, `parseRecordData`, `formatRecordData`, `ZoneFileError`, `RecordDataError`, `ZoneFile` (types) |

Functions are separate exports named after `JSON`'s, so `import * as ZoneFile from "@sdxc/zone-file"`
reads as `ZoneFile.parse` and a bundle keeps only what it calls.

### Reading a file

```typescript
import * as ZoneFile from "@sdxc/zone-file";

let parsed = ZoneFile.parse(text, { origin: "example.com" });
// Result<ZoneFile.Zone, ZoneFileError>
if (isSuccess(parsed)) {
	parsed.data.records; // ZoneFile.Record[]
	parsed.data.rejected; // ZoneFile.Rejection[]
}
```

| Option          | Default     | Meaning                                                                                                          |
| --------------- | ----------- | ---------------------------------------------------------------------------------------------------------------- |
| `origin`        | Required    | The initial `$ORIGIN`, absolute; `@` and relative names resolve against it until a `$ORIGIN` line changes it     |
| `ttl`           | `null`      | The TTL a record gets when neither it, a `$TTL` nor an earlier record states one                                 |
| `include`       | None        | `(fileName, origin) => string \| null`, the text of an `$INCLUDE`d file; without it every `$INCLUDE` is rejected |
| `relativeNames` | `"rfc1035"` | `"origin-suffix"` also reads a dotless name that equals the origin or ends in `.origin` as absolute              |
| `maxBytes`      | 1 MiB       | The largest input, counted across included files; past it the whole parse fails with `too-large`                 |

`parse` answers a failure only for `too-large`. Everything else — a bad line, an unknown type,
RDATA that does not fit its type — is a `Rejection` beside the records that did parse, because a
caller importing a zone needs to know what it got **and** what it did not, and a single bad line in
a thousand is not a reason to discard the other 999. A caller that wants all-or-nothing checks
`rejected.length`.

### The grammar

Everything RFC 1035 §5 and RFC 2308 §4 define, plus the conventions every BIND-compatible tool
accepts:

| Construct                | Behavior                                                                                                                                                                                           |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `;` comments             | To end of line, outside quotes. A record's trailing comment is kept as `comment`                                                                                                                   |
| Quoted strings           | `"…"` with `\"`, `\\` and `\DDD`; a `;` or parenthesis inside quotes is data. A quote cannot span lines                                                                                            |
| Parentheses              | `(` … `)` joins lines into one entry; comments inside are dropped; the entry's `line` is where it starts and `endLine` where it ends                                                               |
| `@`                      | The current origin                                                                                                                                                                                 |
| Relative names           | Owners and RDATA name fields without a trailing dot get the current origin appended                                                                                                                |
| Escapes in names         | `\.` and `\DDD` inside a label, per RFC 1035 §5.1; names come back lowercased with escapes resolved to their presentation form                                                                     |
| Blank owner              | A line starting with whitespace takes the previous entry's owner; the first record has none to take and is rejected                                                                                |
| TTL and class order      | Both optional, in either order; the type is the first field that is neither                                                                                                                        |
| TTL units                | Seconds, or BIND units combined (`1h30m`, `2W`), case-insensitive, up to 2³¹−1                                                                                                                     |
| TTL inheritance          | Explicit, else `$TTL`, else the previous record's TTL (RFC 1035's rule, which BIND applies with a warning), else `options.ttl`                                                                     |
| `$ORIGIN name`           | Changes the origin for later entries; a relative argument is appended to the current origin                                                                                                        |
| `$TTL ttl`               | Sets the default TTL for later entries                                                                                                                                                             |
| `$INCLUDE file [origin]` | Reads `options.include(file, origin)`; the included file starts with the given or current origin and its own `$TTL` scope, and the origin is restored after it. Nesting is allowed to a depth of 8 |
| Classes                  | `IN`, `CH`, `HS`, `CS`, `CLASSnnn`                                                                                                                                                                 |
| Types                    | Any mnemonic or `TYPEnnn`; RDATA in RFC 3597 generic form (`\# 4 0A000001`) for any type                                                                                                           |

**Which RDATA is typed.** The codec's current types — A, AAAA, CNAME, NS, MX, TXT, CAA, SOA,
SRV — plus PTR and DNAME, the remaining types whose RDATA is a name that must be qualified. Typed
records carry parsed fields (`exchange`, `preference`, `text`, `strings`…) exactly as
`parseRecordData` produces them. Every other type is kept as `{ type, data }` with its RDATA
joined to one line as written, plus the `origin` it was read under, because relative names inside
untyped RDATA cannot be found without knowing the type's grammar.

**`$GENERATE` is rejected.** It is a BIND extension, and one line can expand to thousands of
records; a caller that meets it in practice gets a rejection naming it.

**`relativeNames: "origin-suffix"`** exists for the exports that drop the trailing dot on a
fully-qualified name, the Cloudflare SOA line among them. The RFC reading stays the default, since
the option makes a legitimate name like `example.com.example.com` unreachable.

### The model

```typescript
export namespace ZoneFile {
	interface Zone {
		/** The origin at the end of the file, after any `$ORIGIN`. */
		origin: string;
		records: Record[];
		rejected: Rejection[];
	}

	type Record = { [Type in RecordType]: RecordFor<Type> }[RecordType];

	type RecordFor<Type extends RecordType> = RecordData<Type> & {
		/** Absolute, lowercased, no trailing dot; the root is `"."`. */
		name: string;
		/** Seconds; `null` when nothing in the file or the options stated one. */
		ttl: number | null;
		class: "IN" | "CH" | "HS" | "CS" | (string & {});
		/** The included file the record came from; `null` for the text passed to `parse`. */
		file: string | null;
		line: number;
		endLine: number;
		comment: string | null;
	};

	interface Rejection {
		file: string | null;
		line: number;
		endLine: number;
		/** The entry as written, every line of it. */
		input: string;
		reason: RejectionReason;
		/** The detail a log needs, such as the RDATA error. */
		message: string;
	}

	type RejectionReason =
		| "malformed" // unterminated quote, unbalanced parentheses, a missing type or RDATA
		| "invalid-data" // RDATA that does not fit its typed reading
		| "missing-owner" // a blank owner with no earlier record
		| "include" // `$INCLUDE` with no `include` option, a file it returned null for, or nesting past 8
		| "unsupported-directive"; // `$GENERATE` or any other `$` word
}
```

`RecordData<Type>` and the per-type field interfaces move from `@sdxc/doh`'s `DoH` namespace to
`ZoneFile`, unchanged. `DoH.RecordFor<Type>` becomes `ZoneFile.RecordData<Type>` plus `{ name, ttl }`,
so a resolved record and a parsed one share every type-specific field.

The package reports structure and leaves policy to the caller. A record outside the origin, a
second copy of the same record, a class other than `IN`, and a type a caller does not want are
all returned as records; rejecting them is the caller's decision, and uptime makes it.

### Writing a file

```typescript
let text = ZoneFile.stringify({ origin: "example.com", ttl: 3600, records }, { relative: true });
```

```text
$ORIGIN example.com.
$TTL 3600
@	IN	SOA	ns1 hostmaster 2026100801 7200 3600 1209600 300
@	IN	MX	10 mail
www	300	IN	CNAME	@
@	IN	TXT	"v=spf1 include:_spf.example.net -all" ; spf
```

- `$ORIGIN` and `$TTL` are written when the input names them. A record's TTL is omitted when it
  equals `$TTL`, and written otherwise.
- `relative: false` (the default) writes every name absolute with its trailing dot, so the output
  means the same thing wherever it is pasted. `relative: true` writes names under the origin
  relative to it and the apex as `@`, the form people keep in git.
- RDATA is printed by `formatRecordData`, so TXT strings and CAA values are quoted and escaped,
  and AAAA is RFC 5952.
- An untyped record whose `origin` differs from the current one is preceded by an `$ORIGIN` line,
  so relative names in its verbatim RDATA keep their meaning.
- Records are written in the order given, one per line, tab-separated. `comment` is written back
  after `;`.
- `stringify` returns a `string`: its input is typed, every name and value has a printed form, and
  nothing about it can fail.

**The round-trip guarantee.** For any `zone` that `parse` produced, `parse(stringify(zone))`
yields the same records — name, TTL, class, type, fields and comment. Byte identity with the
original text is not a goal: spacing, comments on their own lines, parentheses and the order of TTL
and class are not kept.

### Errors

| Class             | `code`      | When                                                                     |
| ----------------- | ----------- | ------------------------------------------------------------------------ |
| `ZoneFileError`   | `too-large` | The input, with its includes, passed `maxBytes`; `bytes` holds the count |
| `RecordDataError` | —           | `parseRecordData` on data that does not fit the type, as today           |

### `@sdxc/doh` after the move

- `parseRecordData`, `formatRecordData`, `RecordDataError`, `character-strings.ts` and
  `record-types.ts` move to `@sdxc/zone-file` with their tests. `@sdxc/doh` imports them to read
  answers and no longer exports them; its README points readers to `@sdxc/zone-file`.
- `DoH.RecordData` and the record field interfaces become `ZoneFile` types. `DoH.RecordFor`,
  `DoH.Answer` and everything `resolve` answers keep their shape.
- `@sdxc/doh/caa` is unchanged: it reads typed CAA fields, which are the same.

There is no re-export from `@sdxc/doh`; the one consumer moves in the same change.

### Testing

- Under `packages/zone-file/src/`, in the packages Vitest project.
- One test per grammar row above, and one per rejection reason.
- Fixtures: the RFC 1035 §5.3 example, a BIND `named-checkzone`-clean zone with every directive and
  an `$INCLUDE`, the Cloudflare export from uptime, and a Route 53 export. Each records the
  expected records; the BIND-clean zone's expectations are checked against
  `named-compilezone -s full` output generated once and committed.
- Round trip as a property: a seeded `@sdxc/random` stream builds zones across every typed type,
  relative and absolute names, escapes, TTL forms and comments, and asserts
  `parse(stringify(zone))` equals `zone`'s records, in both `relative` modes. A failure names its
  seed.
- `@sdxc/doh`'s existing codec tests move unchanged, which is what proves the move kept behavior.

## Migrating `apps/uptime`

`app/services/zone-file.ts` becomes the app's import policy over the package:

```typescript
let parsed = ZoneFile.parse(input, {
	origin: domain,
	relativeNames: "origin-suffix",
	maxBytes: MAX_ZONE_FILE_BYTES,
});
if (isFailure(parsed)) return failure(new ZoneFileTooLargeError(parsed.error.bytes));

for (let record of parsed.data.records) {
	if (record.class !== "IN") reject(record, "nonInternetClass");
	else if (!isDnsRecordType(record.type)) reject(record, "unsupportedType");
	else if (!inZone(record.name, domain)) reject(record, "outOfZone");
	else keepOrMarkDuplicate(record, storedRecordValue(record));
}
for (let rejection of parsed.data.rejected) reject(rejection, UPTIME_REASON[rejection.reason]);
```

| Change                                                | Effect                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$ORIGIN`, `$TTL`, parentheses, blank owners are read | A hand-written or BIND-exported zone now imports; four rejection reasons and their locale keys go from every locale. ADR-026 §7's reason for refusing `$ORIGIN` — ignoring it misplaces names — no longer applies once it is honored, and `outOfZone` still catches an `$ORIGIN` that leaves the domain |
| `$INCLUDE`, `$GENERATE`                               | Still rejected (no `include` option), mapped to `includeDirective` and `generateDirective`                                                                                                                                                                                                              |
| `malformed`, `invalid-data`, `missing-owner`          | Mapped to `malformed`, as today                                                                                                                                                                                                                                                                         |
| `qualifyName`'s suffix heuristic                      | Replaced by `relativeNames: "origin-suffix"`, the same reading                                                                                                                                                                                                                                          |
| `MAX_REPORTED_INPUT_LENGTH`                           | Stays in the app: truncating what a page shows is display policy                                                                                                                                                                                                                                        |
| Duplicates and identity                               | Stay in the app, keyed on `storedRecordValue`                                                                                                                                                                                                                                                           |
| `ZoneFileRecord.line`                                 | Read from the package record; a multi-line SOA reports its first line                                                                                                                                                                                                                                   |

`app/lib/dns-record-value.ts` shrinks to the app's identity rules:

- `storedRecordValue` widens from `DoH.RecordFor<DnsRecordType>` to
  `ZoneFile.RecordData<DnsRecordType>`, so the zone file and the resolver produce a stored value
  through the same function from the same typed fields.
- `parseDnsRecordValue` goes: its per-type reading is `parseRecordData` followed by
  `storedRecordValue`, which is what `normalizeDnsRecordValue` calls first.
- `canonicalizeIpv6` and `isIpv4Address` go: the codec already canonicalizes AAAA and refuses
  leading-zero IPv4.
- `normalizeDnsRecordValue`, `normalizeDnsName` and `DNS_RECORD_TYPES` stay. The total reading is
  the app's choice for resolver data that does not parse and for hand-typed expected values, where
  an unquoted TXT with spaces is one string.

**One deliberate change in TXT.** RFC 1035 reads an unquoted `v=spf1 -all` in a zone file as two
character-strings, whose joined text is `v=spf1-all`. Uptime's parser kept the space. Cloudflare and
Route 53 always quote TXT, so real exports are unaffected; a hand-written zone now imports the
record DNS would serve, and a test pins it.

The reconstructed fixture's "unsupported constructs" section is rewritten: the lines it uses to
prove `$ORIGIN`, `$TTL`, multi-line and blank-owner rejections become lines proving they import,
and the Cloudflare export must still yield its 42 records, 2 rejections and 1 duplicate.

## Consequences

### Positive

- **A complete master-file reader and writer** for any app or tool: import, export, diff, and
  generate zones from code.
- **Uptime imports zones it used to refuse,** with fewer rejection reasons to translate and the
  same line-level honesty.
- **One RDATA codec, owned by the format,** with the network client depending on it; the format
  package installs with `@sdxc/result` alone.
- **One stored-value path in uptime** for both input channels, from typed fields.

### Negative

- **A breaking change to `@sdxc/doh`:** three exports and the record field types move. Within the
  repo one app imports them.
- **More grammar to own:** escapes, includes and TTL inheritance each have edge cases the old
  subset avoided; the fixtures and the property test exist for them.

### Neutral

- Policy (zone membership, duplicates, tracked types) stays with each caller, so two consumers can
  import the same file differently.
- Formatting is not preserved; a caller that needs the original text keeps it.

## Implementation Plan

### Phase 1: Move the codec

**Priority:** High
**Estimated Effort:** 2 hours

1. Create `packages/zone-file`, public, depending on `@sdxc/result`.
2. Move the codec, its types and its tests from `@sdxc/doh`; add PTR and DNAME typed readings.
3. `@sdxc/doh` imports from `@sdxc/zone-file`; update its README. One commit per package.
4. `apps/uptime/app/lib/dns-record-value.ts` imports the codec from `@sdxc/zone-file`.

### Phase 2: `parse`

**Priority:** High
**Estimated Effort:** 6 hours

1. Lexer (quotes, escapes, comments, parentheses), entry reader, directives, `$INCLUDE` with depth
   and byte accounting, name qualification in owners and typed RDATA, TTL and class inheritance.
2. Grammar and rejection tests; the four fixtures.

### Phase 3: `stringify`

**Priority:** High
**Estimated Effort:** 3 hours

1. Absolute and relative output, `$ORIGIN` before untyped records, comments.
2. The round-trip property test.
3. README following the package documentation guide; root README table row;
   `bun run release:bootstrap @sdxc/zone-file`.

### Phase 4: `apps/uptime`

**Priority:** Medium
**Estimated Effort:** 3 hours

1. `zone-file.ts` over the package; `dns-record-value.ts` trimmed; the four retired reasons
   removed from `ZoneFileRejectionReason` and every locale.
2. The reconstructed fixture's expectations rewritten; the Cloudflare fixture's counts unchanged.
3. A short uptime ADR recording that ADR-026 §7's unsupported-syntax table is superseded.

## Alternatives Considered

### 1. Move uptime's parser into a package as is

**Rejected because**: a package that refuses `$ORIGIN`, `$TTL` and parentheses fails most zone
files outside one provider's export, and has no writer.

### 2. Extend `@sdxc/doh` with a zone-file subpath

**Rejected because**: see [Where the record-data codec lives](#where-the-record-data-codec-lives).

### 3. `@sdxc/zone-file` depending on `@sdxc/doh` for RDATA

**Rejected because**: the dependency points from a format to a network client and brings `remix`
into every install of a pure parser.

### 4. Fail the whole parse on the first bad line

**Rejected because**: an importer needs the records that did parse and the list of those that did
not; a line-level report is the format's honest answer, and all-or-nothing is one check away.

### 5. Policy options in the parser (`types`, `inZoneOnly`, `dedupe`)

**Rejected because**: each is one line in the caller and differs per caller; as options they would
grow with every consumer.

### 6. Expand `$GENERATE`

**Deferred**: a BIND extension with no consumer, and an expansion limit is a caller's decision.

## References

- [RFC 1035 §5, Master Files](https://www.rfc-editor.org/rfc/rfc1035#section-5)
- [RFC 2308 §4, `$TTL`](https://www.rfc-editor.org/rfc/rfc2308#section-4)
- [RFC 3597, Handling of Unknown DNS Resource Record Types](https://www.rfc-editor.org/rfc/rfc3597)
- [RFC 4034, DNSSEC Resource Records (presentation formats)](https://www.rfc-editor.org/rfc/rfc4034)
- [BIND 9, Zone File reference](https://bind9.readthedocs.io/en/latest/chapter3.html)
- [Cloudflare, Import and export DNS records](https://developers.cloudflare.com/dns/manage-dns-records/how-to/import-and-export/)
- [ADR-007: Publishable Package Releases](./ADR-007-publishable-package-releases.md)
- [ADR-088: DNS over HTTPS Package](./ADR-088-dns-over-https-package.md)
- [ADR-113: DoH CAA Records](./ADR-113-doh-caa-records.md)
- [uptime ADR-026: A DNS Monitor Watches a Domain, Not a Record Type](./uptime/ADR-026-domain-dns-monitors-with-record-import.md)

## Current Progress

- [ ] Phase 1: Move the codec
- [ ] Phase 2: `parse`
- [ ] Phase 3: `stringify`
- [ ] Phase 4: `apps/uptime`

## Open Questions

1. **Should uptime enable `$INCLUDE`?** A paste box has no second file; a multi-file upload would
   make the `include` option useful, but no customer has asked.
2. **SOA on several lines in `stringify`.** One line round-trips; the conventional parenthesized
   SOA with field comments reads better in git. An option, or always?
3. **Previous-record TTL inheritance.** RFC 1035 inherits the last TTL; RFC 2308 tools warn about
   it. Should a record that inherits this way carry a flag so a linter can surface it?
4. **The Route 53 fixture.** It needs a real export to commit, like the Cloudflare one.
