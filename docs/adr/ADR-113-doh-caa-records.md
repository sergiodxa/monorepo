# ADR-113: CAA Records and Issuance Checks in the DoH Package

## Status

**Accepted** - 2026-10-07

## Background

A CAA record (RFC 8659) names the certificate authorities allowed to issue for a domain. Every
publicly trusted CA checks it before issuing, and refuses when it is not named, when the record
forbids issuance outright, when a critical property is one it does not understand, or when the
lookup itself fails. That makes CAA two things at once: the record an attacker changes to get a
certificate issued for a domain they took over, and a record that quietly blocks the renewal a
site depends on.

`@sdxc/doh` (ADR-088) already reads a CAA record into `{ critical, tag, value }`, from both the
presentation text and the RFC 3597 generic form a resolver may answer with. That says what one
record holds. It does not say what an RRset means: the `issue` value grammar and its parameters,
which RRset applies to a name (RFC 8659's climb toward the root), how `issuewild` overrides
`issue`, or what a lookup failure means to a CA. uptime ADR-026 §12 left CAA out of DNS monitors
because the zone-file spelling and the resolver's spelling had to normalize to one value, and
called it the highest-value record for the domain-hijack story it was shipping without.

## Context

### What the package reads today

| Piece                                             | Today                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `DoH.CAARecord`                                   | `critical`, `tag` (lowercased), `value` (quotes and escapes removed)                  |
| Presentation reader (`parseRecordData("CAA", …)`) | `<flags> <tag> <value>`, a quoted or bare value; refuses a missing value              |
| RFC 3597 reader (`\# len hex`)                    | Flags octet, tag length, tag, remaining octets as UTF-8                               |
| The flags octet                                   | Kept only as `critical`; reserved bits are lost, so `1 issue …` reads as `0 issue …`  |
| A printer                                         | None: nothing turns a parsed record back into presentation text                       |
| Generic data with a zero tag length               | Accepted with `tag: ""`, which RFC 8659 §4.1 forbids                                  |
| `NameNotFoundError`                               | Carries the negative TTL, not the AD flag, so an authenticated denial is not reported |

### What the resolvers answer

Queried against both presets on 2026-10-06:

| Query                                   | Cloudflare and Google answer                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `google.com CAA`                        | `0 issue "pki.goog"`                                                                              |
| `cloudflare.com CAA`                    | Eleven records, `AD: true`, including `0 iodef "mailto:…"` and `0 issue "pki.goog; cansign…=yes"` |
| `uppercase-deny.basic.caatestsuite.com` | `0 ISSUE "caatestsuite.com"`: the tag as the zone wrote it                                        |
| `critical1.basic.caatestsuite.com`      | `128 caatestsuitedummyproperty "test"`                                                            |
| `cname-deny.basic.caatestsuite.com`     | A CNAME to `deny.basic.caatestsuite.com` in `Answer`, then the target's `0 issue` under its owner |
| `dname-deny.basic.caatestsuite.com`     | `Status: 3` (NXDOMAIN), so the suite's DNAME case cannot serve as a DNAME fixture                 |
| `dnssec-failed.org CAA`                 | `Status: 2` (SERVFAIL); Cloudflare adds `Comment: ["EDE(9): …"]`, Google `extended_dns_errors`    |
| `example.com CAA`                       | `Status: 0`, no `Answer`, the SOA in `Authority`: NODATA                                          |

Both resolvers answer CAA as presentation text today. ADR-026, written on 2026-08-10, recorded
Cloudflare answering the same type in generic form (`\# 19 00 05 69 73 73 75 65 …`). The resolver
picks the form, so the package keeps reading both.

### What RFC 8659 and RFC 8657 ask of a checker

| Rule                                                                                                      | Section     |
| --------------------------------------------------------------------------------------------------------- | ----------- |
| The relevant RRset for `X` or `*.X` is the first non-empty `CAA(X)`, climbing labels up to but not root   | 8659 §3     |
| `CAA(X)` follows aliases (RFC 1034 §4.3.2); the climb continues from `X`'s parent, never the alias target | 8659 §3, §7 |
| An RRset with no `issue`/`issuewild` (only `iodef`, or tags the CA ignores) does not restrict issuance    | 8659 §3     |
| A critical property with an unknown tag forbids issuance                                                  | 8659 §4.1   |
| Reserved flag bits are ignored by an interpreter                                                          | 8659 §4.1   |
| Tags match case-insensitively; the canonical presentation writes them lowercase                           | 8659 §4.1   |
| An `issue` value that fails the grammar means the same as an empty issuer: issuance forbidden             | 8659 §4.2   |
| Authorizations add up: `issue ";"` beside `issue "ca.example"` authorizes `ca.example`                    | 8659 §4.2   |
| `issuewild` is ignored for a non-wildcard name; for a wildcard, any `issuewild` makes every `issue` moot  | 8659 §4.3   |
| `iodef` takes a `mailto:`, `http:` or `https:` URL                                                        | 8659 §4.4   |
| A lookup that fails (SERVFAIL, timeout) may be read as forbidding issuance, and CAs do                    | 8659 §6     |
| `accounturi` restricts a property to one account; two of them make it unsatisfiable                       | 8657 §3     |
| `validationmethods` restricts a property to listed methods (`dns-01`, `http-01`, …)                       | 8657 §4     |

The `issue` value grammar (RFC 8659 §4.2):

```text
issue-value = *WSP [issuer-domain-name *WSP] [";" *WSP [parameters *WSP]]
issuer-domain-name = label *("." label)
label = (ALPHA / DIGIT) *( *("-") (ALPHA / DIGIT))
parameters = (parameter *WSP ";" *WSP parameters) / parameter
parameter = tag *WSP "=" *WSP value
tag = (ALPHA / DIGIT) *( *("-") (ALPHA / DIGIT))
value = *(%x21-3A / %x3C-7E)
```

### The consumer: uptime

| Location                                  | State                                                                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/uptime/app/lib/dns-record-value.ts` | `DNS_RECORD_TYPES` is `A AAAA CNAME MX TXT NS`; `storedRecordValue` and `parseDnsRecordValue` fold both channels into one stored value      |
| `apps/uptime/app/services/zone-file.ts`   | Lists `CAA` in `KNOWN_UNTRACKED_TYPES`, so a CAA line is reported as `unsupportedType`                                                      |
| `apps/uptime/app/services/dns-check.ts`   | Sweeps every tracked type at every name; `QUERIES_PER_NAME` is the type count; drops A/AAAA answers that arrived through a CNAME            |
| `apps/uptime/app/jobs/check-ssl.ts`       | Daily re-evaluation of an HTTP monitor's manually entered certificate expiry; `ssl_issuer` is free text, since Workers cannot read the cert |

On the `sergiodxa.com` fixtures, Cloudflare's zone export holds one CAA record
(`0 issue "letsencrypt.org"`) while both resolvers answer ten: `issue` and `issuewild` for five
CAs. Cloudflare publishes records for the CAs behind its edge certificates once a zone has any
CAA record, and those records are absent from the export.

## Decision

Extend `@sdxc/doh` in two layers:

1. **Record level, at the root.** `CAARecord` keeps its flags octet, a new `formatRecordData`
   prints any typed record back to presentation text, generic data with an empty tag is refused,
   and `NameNotFoundError` reports the AD flag.
2. **Policy level, at a new `@sdxc/doh/caa` subpath.** `parseCaaProperty` reads a record's
   meaning, `findRelevantCaa` runs RFC 8659's climb, `evaluateCaa` decides a request against an
   RRset with no I/O, and `mayIssue` composes the two into a verdict whose failures read as
   refusals.

The record level is DNS: what the bytes say, read and printed so two spellings compare equal.
The policy level is WebPKI: what a CA will do with them. Keeping them apart leaves every CAA
answer as small as it is today, and lets the policy work on records from a zone file as well as
from a resolver.

### Record level

```ts
export namespace DoH {
	/** Which certificate authorities may issue for the name (RFC 8659). */
	interface CAARecord extends RecordBase {
		type: "CAA";
		/** The flags octet as published, reserved bits included, so the record prints back unchanged. */
		flags: number;
		/** Bit 128 of `flags`: a CA that does not understand `tag` must refuse to issue. */
		critical: boolean;
		/** Lowercased, since tags match case-insensitively. */
		tag: string;
		value: string;
	}
}

/** Prints a record's data in canonical presentation format, the inverse of `parseRecordData`. */
export function formatRecordData<Type extends DoH.RecordType>(data: DoH.RecordData<Type>): string;

export class NameNotFoundError extends DoHError {
	readonly ttl: number | null;
	/** The AD flag: the resolver validated the denial of existence with DNSSEC. */
	readonly authenticated: boolean;
}
```

```ts
import { formatRecordData, parseRecordData } from "@sdxc/doh";

let generic = unwrap(
	parseRecordData("CAA", "\\# 19 00 05 69 73 73 75 65 63 6f 6d 6f 64 6f 63 61 2e 63 6f 6d"),
);
let text = unwrap(parseRecordData("CAA", '0 ISSUE "comodoca.com"'));

formatRecordData(generic); // '0 issue "comodoca.com"'
formatRecordData(text); // '0 issue "comodoca.com"'
formatRecordData({ type: "MX", preference: 10, exchange: "mx.example.com" }); // "10 mx.example.com."
```

- **`formatRecordData` covers the nine typed types.** Names print absolute with the trailing dot
  (the root stays `"."`), TXT prints each character-string quoted, CAA prints `flags`, the
  lowercase tag and the value as one quoted string. `"` and `\` are escaped, and every octet
  outside printable ASCII becomes `\DDD`. Any other type prints its raw `data`.
- **The guarantee is a round trip.** For any `data` that `parseRecordData` produced,
  `parseRecordData(data.type, formatRecordData(data))` succeeds with `data`. Two spellings of one
  record therefore print to one string, which is the property a diff keyed on the value needs.
- **`flags` is additive.** `critical` stays, since it is the bit every reader asks about.
- **Generic data with a zero tag length fails to parse**, landing the record in `unparsed`.
- **`NameNotFoundError.authenticated`** is what lets a CAA climb report whether an NXDOMAIN on
  the way up was a signed denial or an unvalidated one.

### Policy level: `@sdxc/doh/caa`

`packages/doh/package.json` gains `"./caa": "./src/caa.ts"`. The entry re-exports
`src/caa/property.ts`, `src/caa/relevant-set.ts` and `src/caa/evaluate.ts`, and the `CAA`
namespace of types from `src/caa/types.ts`.

```ts
import type { Result } from "@sdxc/result";

import type { DoH, DoHError } from "@sdxc/doh";

export namespace CAA {
	/** One CAA record's data, from an answer or from `parseRecordData("CAA", …)` on a zone-file line. */
	type Record = DoH.RecordData<"CAA">;

	/** One `key=value` from an `issue` or `issuewild` value, in published order. */
	interface Parameter {
		key: string;
		value: string;
	}

	/** An `issue` or `issuewild` property. */
	interface IssueProperty {
		kind: "issue" | "issuewild";
		critical: boolean;
		/** The issuer domain, lowercased; `null` forbids issuance, as an empty or malformed value does. */
		issuer: string | null;
		/** The value failed RFC 8659's grammar, which forbids issuance the way an empty issuer does. */
		malformed: boolean;
		parameters: Parameter[];
	}

	/** Where a CA reports a refused or violating request. */
	interface IodefProperty {
		kind: "iodef";
		critical: boolean;
		/** The value when it parses as a `mailto:`, `http:` or `https:` URL, `null` otherwise. */
		url: string | null;
	}

	/** A property this package does not interpret; with `critical` set it forbids issuance. */
	interface UnknownProperty {
		kind: "unknown";
		critical: boolean;
		tag: string;
		value: string;
	}

	type Property = IssueProperty | IodefProperty | UnknownProperty;

	/** The RRset RFC 8659 §3 applies to a domain, and how it was found. */
	interface RelevantSet {
		/** The name whose query returned the records, the domain or an ancestor; `null` when none did. */
		name: string | null;
		records: DoH.CAARecord[];
		/** Records of the set whose data did not parse; a CA cannot satisfy a set it cannot read. */
		unparsed: DoH.UnknownRecord[];
		/** Aliases the resolver followed for `name`; the records are owned by the chain's end. */
		chain: DoH.CNAMERecord[];
		/** Every name queried, nearest first. */
		queried: string[];
		/** Every answer in the climb carried the AD flag, denials of existence included. */
		authenticated: boolean;
	}

	/** A certificate request to decide. */
	interface Request {
		/** The name on the certificate; `*.example.com` asks about a wildcard certificate. */
		domain: string;
		/** The CA's CAA identifiers, such as `letsencrypt.org`; any one matching authorizes. */
		issuer: string | readonly string[];
		/** RFC 8657 `accounturi` of the requesting account; omitted, the check is skipped. */
		accountUri?: string;
		/** RFC 8657 method label, such as `dns-01`; omitted, the check is skipped. */
		validationMethod?: string;
	}

	interface NoPolicy {
		allowed: true;
		reason: "no-policy";
	}
	interface Unrestricted {
		allowed: true;
		reason: "unrestricted";
	}
	interface Authorized {
		allowed: true;
		reason: "authorized";
		property: IssueProperty;
	}
	interface Forbidden {
		allowed: false;
		reason: "forbidden";
	}
	interface NotAuthorized {
		allowed: false;
		reason: "not-authorized";
		/** The issuers the applicable properties do name, for a message the owner can act on. */
		issuers: string[];
	}
	interface ParameterMismatch {
		allowed: false;
		reason: "account-mismatch" | "validation-method-mismatch";
		property: IssueProperty;
	}
	interface CriticalTag {
		allowed: false;
		reason: "critical-tag";
		property: UnknownProperty;
	}
	interface Unreadable {
		allowed: false;
		reason: "unreadable";
		record: DoH.UnknownRecord;
	}
	interface LookupFailed {
		allowed: false;
		reason: "lookup-failed";
		/** The name whose query failed. */
		name: string;
		queried: string[];
		error: DoHError;
	}

	/** Where a verdict's policy came from. */
	interface Located {
		relevant: RelevantSet;
	}

	type Decision =
		| NoPolicy
		| Unrestricted
		| Authorized
		| Forbidden
		| NotAuthorized
		| ParameterMismatch
		| CriticalTag;

	type Verdict = ((Decision | Unreadable) & Located) | LookupFailed;
}

/** Reads what one CAA record asks of a CA. */
export function parseCaaProperty(record: CAA.Record): CAA.Property;

/** RFC 8659 §3: queries the domain and each ancestor below the root, stopping at the first non-empty CAA RRset. */
export function findRelevantCaa(
	domain: string,
	options?: DoH.ResolveOptions,
): Promise<Result<CAA.RelevantSet, DoHError>>;

/** Decides a request against one RRset, with no I/O, so records from a zone file decide the same way. */
export function evaluateCaa(records: readonly CAA.Record[], request: CAA.Request): CAA.Decision;

/** Whether a CA may issue for `request.domain`: `findRelevantCaa`, then `evaluateCaa`. */
export function mayIssue(request: CAA.Request, options?: DoH.ResolveOptions): Promise<CAA.Verdict>;
```

#### Reading a property

```ts
import { parseCaaProperty } from "@sdxc/doh/caa";

parseCaaProperty({
	type: "CAA",
	flags: 0,
	critical: false,
	tag: "issue",
	value: "digicert.com; cansignhttpexchanges=yes",
});
// { kind: "issue", critical: false, issuer: "digicert.com", malformed: false,
//   parameters: [{ key: "cansignhttpexchanges", value: "yes" }] }

parseCaaProperty({ type: "CAA", flags: 0, critical: false, tag: "issue", value: ";" });
// { kind: "issue", critical: false, issuer: null, malformed: false, parameters: [] }

parseCaaProperty({ type: "CAA", flags: 0, critical: false, tag: "issue", value: "%%%%%" });
// { kind: "issue", critical: false, issuer: null, malformed: true, parameters: [] }

parseCaaProperty({ type: "CAA", flags: 128, critical: true, tag: "tbs", value: "Unknown" });
// { kind: "unknown", critical: true, tag: "tbs", value: "Unknown" }
```

- The grammar is RFC 8659 §4.2's, whitespace around `;` and `=` included. A value that fails it
  reads as `issuer: null, malformed: true` with no parameters, which is what the RFC says it
  means; `malformed` tells a display "your record is broken" apart from "your record says no".
- Issuer names are lowercased with any trailing dot dropped. Parameter keys and values are kept
  as written, since their meaning belongs to the CA the property names.
- `iodef` accepts only the three schemes RFC 8659 §4.4 lists; any other value keeps the property
  with `url: null`.
- Every type in `CAA` but `LookupFailed` is plain data, so a verdict can go into a log line, an
  alert snapshot or Durable Object storage as is.

#### Finding the relevant RRset

```ts
import { findRelevantCaa } from "@sdxc/doh/caa";

let relevant = await findRelevantCaa("shop.example.com");
// success({ name: "example.com", records: [...], unparsed: [], chain: [],
//           queried: ["shop.example.com", "example.com"], authenticated: false })
```

- The domain is lowercased, its trailing dot and a leading `*.` dropped (RFC 8659 computes the
  set for `*.X` at `X`), and sent as written otherwise, so an internationalized name must already
  be punycode, as with `resolve`.
- One `resolve(name, "CAA")` per label, in order, stopping at the first answer with records or
  unparsed records. The climb is sequential: most domains publish CAA at the apex, so it usually
  ends after one or two queries, and a caller with a subrequest budget pays only for what it
  needs. The query count is bounded by the label count, the TLD included.
- **NODATA and NXDOMAIN are both empty** and the climb continues, which covers a dangling CNAME
  too: the resolver answers it as NXDOMAIN.
- **Aliases are the resolver's.** When `CAA(X)` arrives through a CNAME, or a DNAME's synthesized
  CNAME, the records are the target's and `chain` says so; when the target has none, the climb
  continues at `X`'s parent, never the target's (RFC 8659 §7).
- **Any other failure ends the climb** as a failure: SERVFAIL (a bogus DNSSEC answer included),
  another RCODE, or a `TransportError`. A CA would not issue past it, and guessing past it would
  report a policy nobody can rely on.
- `authenticated` is the AND of every answer's AD flag, NXDOMAIN answers included through
  `NameNotFoundError.authenticated`. An unvalidated empty answer below the real policy is exactly
  where a suppressed record hides (RFC 8659 §5.4), so one unvalidated step clears the flag.
  Requiring it stays the caller's policy, as in ADR-088.

#### Deciding a request

`evaluateCaa` applies, in order:

```text
1. No records                                         -> allowed, "no-policy"
2. Any critical property of unknown kind              -> refused, "critical-tag"
3. Applicable = issuewild properties when the domain is a wildcard and any exist,
   otherwise issue properties
4. No applicable properties (only iodef, non-critical
   unknown tags, or issuewild for a non-wildcard)      -> allowed, "unrestricted"
5. An applicable property naming one of the request's
   issuers whose parameters are satisfied             -> allowed, "authorized"
6. An applicable property naming one of the issuers,
   none satisfied                                     -> refused, "account-mismatch" or
                                                         "validation-method-mismatch"
7. Applicable properties name other issuers           -> refused, "not-authorized"
8. Every applicable property names no issuer          -> refused, "forbidden"
```

- **Issuers match exactly**, case-insensitively and without the trailing dot: `letsencrypt.org`
  is not authorized by `acme.letsencrypt.org`. A CA known by several identifiers (DigiCert,
  Sectigo, Amazon) is passed as a list.
- **`accounturi`**: a property with one is satisfied when `request.accountUri` equals it; with
  two or more it is never satisfied (RFC 8657 §3). **`validationmethods`**: satisfied when the
  comma-separated list holds `request.validationMethod`; an empty or malformed list, or the
  parameter given twice, is never satisfied. RFC 8657 leaves a repeated `validationmethods`
  undefined, and refusing is the side a CA errs on.
- **An omitted `accountUri` or `validationMethod` skips that check**, so a monitor that does not
  know the ACME account still learns whether the CA is named; the `authorized` verdict carries
  the property, whose parameters show the constraint left unchecked.
- **Other parameters are reported and not evaluated**, since their semantics belong to the CA.
- **Reserved flag bits are ignored**; only `critical` is read.

#### Checking a name

```ts
import { mayIssue } from "@sdxc/doh/caa";

let verdict = await mayIssue({ domain: "*.example.com", issuer: "letsencrypt.org" });

if (verdict.reason === "lookup-failed") {
	verdict.error; // ServerFailureError: a CA refuses here too
} else if (!verdict.allowed) {
	verdict.relevant.name; // "example.com": where the blocking policy lives
}
```

- **A lookup failure is a refusal.** `mayIssue` answers a `Verdict`, not a `Result`, and the
  `lookup-failed` variant has `allowed: false`. The check a caller writes first,
  `if (!verdict.allowed)`, therefore treats a SERVFAIL the way a CA does; a caller that wants to
  retry first narrows on `reason`, and keeps the `DoHError` to tell a transport failure from a
  SERVFAIL.
- An unparsed record in the relevant set is `unreadable`, refused, before any property is read.
- `options` go to every `resolve` in the climb, so `resolver: GOOGLE` confirms a verdict through
  a second resolver.
- **The verdict is a prediction.** A public resolver is a third-party cache, which RFC 8659 §5.4
  forbids a CA from relying on alone; the CA's own lookup, made at issuance, decides. The verdict
  says what that lookup will find when the zone serves what the resolver saw.

### What stays out

- **Issuing, or naming a CA's identifiers.** Which strings identify a CA is the CA's published
  policy and a product's table; the package takes them as input.
- **`contactemail`, `contactphone`, `issuemail`, `issuevmc`.** Registered tags whose meaning is
  not issuance for TLS; they read as `kind: "unknown"`, and with `critical` set they refuse
  issuance, as for any CA that does not process them.
- **An RFC 3597 printer.** Every resolver answer and every zone file the apps read goes through
  `parseRecordData`, and `formatRecordData` prints the canonical form both arrive at.

### Tests

All under `packages/doh/src`, resolver answers served through MSW (`setupServer`, a handler on
`CLOUDFLARE.url` that dispatches on the `name` parameter and records the order of queries):

| File                         | Covers                                                                                                                                                                                                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parse-record-data.test.ts`  | `flags` kept (`1 issue …`), `0 ISSUE` lowercased, generic data with a zero tag length refused                                                                                                                                                                                |
| `format-record-data.test.ts` | One case per typed type; the round trip over every fixture the parser tests use; CAA from generic and presentation forms printing one string; escapes in TXT and CAA values                                                                                                  |
| `resolve.test.ts`            | `NameNotFoundError.authenticated` from an NXDOMAIN with and without `AD`                                                                                                                                                                                                     |
| `caa/property.test.ts`       | RFC 8659's own examples (`";"`, `"%%%%%"`, `"ca1.example.net; account=230123"`, `tbs`), whitespace around `;` and `=`, hyphenated parameter keys, `iodef` schemes, the recorded `cloudflare.com` RRset                                                                       |
| `caa/evaluate.test.ts`       | Table-driven over RFC 8659 §4.3's `wild`, `wild2` and `wild3` RRsets for plain and wildcard names; additive authorizations; `iodef`-only; critical unknown tag; RFC 8657's duplicate `accounturi`, account and method mismatches; an omitted account or method               |
| `caa/relevant-set.test.ts`   | Climb to the apex; stop at the subdomain; nothing up to the TLD; NXDOMAIN mid-climb; the recorded `cname-deny` answer; a hand-written DNAME answer; SERVFAIL ending the climb with no further queries; `authenticated` across mixed AD flags; an unparsed record stopping it |
| `caa/may-issue.test.ts`      | `lookup-failed` with `allowed: false` and the failing name; `unreadable`; `options.resolver` reaching every query                                                                                                                                                            |

## Usage in uptime

### CAA becomes a tracked record type

ADR-026 §12's blocker was three readings that had to agree. With `formatRecordData` both
channels reach the stored value through the same parse and print:

```ts
export const DNS_RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "CAA"] as const;

export function storedRecordValue(record: DoH.RecordFor<DnsRecordType>): string {
	switch (record.type) {
		// …
		case "CAA":
			return formatRecordData(record);
	}
}

export function parseDnsRecordValue(type: DnsRecordType, data: string): string | null {
	switch (type) {
		// …
		case "CAA": {
			let parsed = parseRecordData("CAA", data);
			return isSuccess(parsed) ? formatRecordData(parsed.data) : null;
		}
	}
}
```

| File                                      | Change                                                                                                                                                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/uptime/app/lib/dns-record-value.ts` | `CAA` joins `DNS_RECORD_TYPES`; stored value is `formatRecordData` (`0 issue "letsencrypt.org"`); `normalizeDnsRecordValue` falls back to the trimmed text                                                                |
| `apps/uptime/app/services/zone-file.ts`   | `CAA` leaves `KNOWN_UNTRACKED_TYPES`; `qualifyRecordData` joins a CAA line's tokens the way it joins TXT, so a quoted `;` stays in the value                                                                              |
| `apps/uptime/app/services/dns-check.ts`   | `suppressedByCname` extends to CAA: an answer that arrived through a CNAME holds the target's policy (a hosting provider's), which a zone cannot publish at a CNAME owner and which would alert on the provider's changes |
| OpenAPI and the ad-hoc probe              | `CAA` joins the record type enum, since the probe takes `DnsRecordType`                                                                                                                                                   |
| `resources/docs/concepts/dns-monitors.md` | CAA is tracked; a Cloudflare-hosted zone lists Cloudflare's own CAA records at the first review, since its export leaves them out                                                                                         |

`QUERIES_PER_NAME` follows the type count from six to seven, so each swept name costs one more
subrequest and ADR-026 §9a's batches hold a seventh fewer names.

The zone-import diff is what this unlocks: a pasted `0 issue "letsencrypt.org"` and a resolver's
`\# 22 00 05 69 73 73 75 65 …` are one record, and a CAA record that appears at review or later
is a finding like any other, the alert the domain-hijack story needed.

### A renewal check for SSL monitors

The daily `check-ssl` job learns whether a monitored certificate's CA can renew it:

```ts
import { GOOGLE } from "@sdxc/doh";
import { mayIssue } from "@sdxc/doh/caa";

let authority = certificateAuthorityFor(monitor.ssl_issuer); // uptime's table, e.g. Let's Encrypt -> ["letsencrypt.org"]
if (!authority) return null;

let request = { domain: new URL(monitor.url).hostname, issuer: authority.caaIdentifiers };
let verdict = await mayIssue(request);
if (verdict.reason === "lookup-failed") verdict = await mayIssue(request, { resolver: GOOGLE });
if (verdict.allowed) return null;

return renewalBlocked(monitor, verdict); // "CAA at example.com names only digicert.com; Let's Encrypt cannot renew"
```

- **The check runs only for certificates inside their warning window**, so its subrequests scale
  with the renewals due rather than the monitors enabled, and it runs when a block matters.
- **A lookup failure alerts only when both resolvers fail**, and its message says the DNS fails
  CAA lookups, which blocks issuance as surely as a record does.
- **uptime owns the CA table** (`app/lib/certificate-authorities.ts`): display names matched
  against `ssl_issuer`, each with the CAA identifiers its CA documents. An issuer the table does
  not know skips the check and asks the user to pick the CA.
- **Wildcard certificates are not modeled.** The monitor stores no SANs, so the check asks about
  the hostname; a wildcard flag on the monitor is a later product decision.
- The alert's storage and edge-triggering follow the SSL status alerts already in the job; the
  exact columns and copy belong to an uptime ADR written with the implementation.

### Elsewhere

`apps/auth-saas` registers custom hostnames through `@sdxc/hostname`, whose certificates are
issued by Cloudflare's CAs. `mayIssue` lets it warn a customer whose CAA blocks those CAs before
validation stalls; adopting it is that app's decision and is not part of this plan.

## Consequences

### Positive

- **CAA is monitored with the rest of a domain**: the type ADR-026 named as missing from the
  hijack story is tracked, imported and diffed like the other six
- **One printer for every typed record**: `parseRecordData` and `formatRecordData` are a pair, so
  any consumer comparing a zone file against a resolver gets equal strings for equal records
- **RFC 8659's decision written and tested once**, from the RFC's own examples and recorded
  answers, including the parts most hand-written checks miss: the climb, `issuewild` precedence,
  malformed values, critical tags and lookup failures
- **Refusal by default**: a lookup failure cannot be mistaken for permission by a caller that
  reads only `allowed`
- **Zone-file policies decide without DNS**: `evaluateCaa` answers for records that are not
  published yet

### Negative

- **Each swept name costs a seventh query**, and CAA answers through a CNAME are dropped from the
  sweep, so a provider's policy inherited through an alias is visible to the renewal check and
  not to the record diff
- **Cloudflare-hosted zones see records they never wrote** at their first review, since
  Cloudflare's own CAA records are in DNS and not in the export
- **The verdict is a public resolver's view**: a zone that answers a CA's resolver differently,
  or changes between the check and issuance, decides otherwise
- **The CA table is product data to maintain**, and a CA that changes its identifiers makes a
  renewal check report `not-authorized` until the table follows

### Neutral

- **`CAARecord` grows `flags`**: additive for readers, and every constructed CAA record in tests
  or callers gains the field
- **`@sdxc/doh` gains its first subpath**: the root keeps the DNS reading, `./caa` the WebPKI
  meaning

## Implementation Plan

### Phase 1: Record level

**Priority:** High
**Estimated Effort:** 3 hours

1. Tests first: `flags`, the zero-length tag, `NameNotFoundError.authenticated`, and the
   `formatRecordData` round trip over every parser fixture.
2. `CAARecord.flags` in both readers; the zero-length tag refused in `WireReader`.
3. `formatRecordData` in `src/format-record-data.ts`, exported from the root.
4. `NameNotFoundError` takes the envelope's `AD`.
5. README: the new field, `formatRecordData`, and a "Compare a zone file with DNS" pattern.

### Phase 2: `@sdxc/doh/caa`

**Priority:** High
**Estimated Effort:** 1 day

1. Fixtures recorded from both resolvers for the answers in Context, plus a hand-written DNAME
   answer and an unparsed CAA record.
2. `parseCaaProperty` against RFC 8659 §4.2's grammar; `evaluateCaa` table-driven from the RFC
   examples; then `findRelevantCaa` and `mayIssue` over MSW.
3. The `./caa` export in `package.json`, and README sections for the subpath, including the
   "a lookup failure is a refusal" pattern.

### Phase 3: uptime tracks CAA

**Priority:** High
**Estimated Effort:** 4 hours

1. `dns-record-value.ts`, `zone-file.ts` and `dns-check.ts` as above, with a regression test that
   the `sergiodxa.com` export's CAA line and the resolver's answer, in both forms, store one value.
2. OpenAPI snapshot and the DNS monitor docs.
3. Mark ADR-026 §12 and Open Question 8 resolved by this ADR.

### Phase 4: uptime renewal check

**Priority:** Medium
**Estimated Effort:** 1 day

1. An uptime ADR for the alert: the CA table, storage of the last verdict, edge-triggering and
   copy.
2. `app/lib/certificate-authorities.ts` and the check in `app/jobs/check-ssl.ts`, behind the
   warning window.

Each phase is its own commit per workspace: `packages/doh` for phases 1 and 2, `apps/uptime` for
3 and 4.

## Alternatives Considered

### 1. Interpret CAA inside `CAARecord`

`resolve(name, "CAA")` would return `issuer`, `parameters` and `url` on every record.

**Rejected because**: it puts WebPKI semantics into the DNS reading, grows every CAA answer, and
leaves no shape that prints back to the published text. The property reading is a function over
the record, available to whoever wants it.

### 2. `mayIssue` answering `Result<Verdict, DoHError>`

**Rejected because**: the natural first line, `if (isFailure(result)) return`, treats a SERVFAIL
as "nothing to report", which is the reading RFC 8659 §6 warns against and the opposite of what a
CA does. A verdict whose failure variant is `allowed: false` makes the safe reading the default.

### 3. A `wildcard: boolean` on the request

**Rejected because**: RFC 8659 defines the Wildcard Domain Name as `*.` followed by an FQDN, which
is how a certificate request and a monitor's hostname already spell it. A separate flag would
admit `{ domain: "*.example.com", wildcard: false }`.

### 4. Query every ancestor at once

**Rejected because**: it spends a subrequest per label on every check to save one or two round
trips on a daily job, and most domains end the climb at the first or second query.

### 5. A separate `@sdxc/caa` package

**Rejected because**: the climb is a sequence of DoH lookups with the same options, resolvers and
errors as `checkCname`, and the property reading needs only `parseRecordData`'s output. A subpath
keeps one release unit and one README.

### 6. Keep the CAA policy in uptime

**Rejected because**: RFC 8659 is not a product rule, `packages/*` cannot import from `apps/*`,
and `auth-saas` has a use for the same check.

## References

- [RFC 8659 - DNS Certification Authority Authorization (CAA) Resource Record](https://www.rfc-editor.org/rfc/rfc8659)
- [RFC 8657 - CAA Record Extensions for Account URI and ACME Method Binding](https://www.rfc-editor.org/rfc/rfc8657)
- [RFC 3597 - Handling of Unknown DNS Resource Record Types](https://www.rfc-editor.org/rfc/rfc3597)
- [RFC 1034 §4.3.2 - Algorithm](https://www.rfc-editor.org/rfc/rfc1034#section-4.3.2)
- [CAA test suite (`caatestsuite.com`)](https://github.com/sleevi/caa-test-suite)
- [Cloudflare DNS over HTTPS: JSON format](https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-json/)
- [Google Public DNS: JSON API](https://developers.google.com/speed/public-dns/docs/doh/json)
- [ADR-088: DNS over HTTPS Package](./ADR-088-dns-over-https-package.md)
- [uptime ADR-026: A DNS Monitor Watches a Domain, Not a Record Type](./uptime/ADR-026-domain-dns-monitors-with-record-import.md)

## Current Progress

- [x] Phase 1: Record level
- [x] Phase 2: `@sdxc/doh/caa`
- [ ] Phase 3: uptime tracks CAA
- [ ] Phase 4: uptime renewal check

## Notes

- `@sdxc/doh` is public, so `formatRecordData`, `CAARecord.flags` and the `./caa` subpath ship in
  the next dated release; nothing else in the repo constructs a `CAARecord` by hand outside tests.
- Cloudflare's `Comment` is an array of strings and Google's a single string, with extended DNS
  errors in a separate `extended_dns_errors` member. The envelope schema reads neither, so a
  SERVFAIL's EDE text stays out of `ServerFailureError`; surfacing it is a separate change.
- Google answers an RRset in a different order on every query and Cloudflare in a sorted one;
  nothing here depends on order, since an RRset is a set.
