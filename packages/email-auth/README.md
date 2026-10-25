# @sdxc/email-auth

Parse and evaluate a domain's email-authentication DNS policies: DMARC, SPF, MTA-STS, TLS-RPT,
BIMI and DKIM.

Every parser is pure and returns a `Result`; every lookup goes through DNS over HTTPS, so the
same checks run in a Cloudflare Worker, a server or a test. DMARC follows RFC 9989, with the
`np`, `psd` and `t` tags and the DNS Tree Walk in place of the public suffix list.

## Installation

```sh
npm add @sdxc/email-auth
```

Results come from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) and lookups
from [`@sdxc/doh`](https://www.npmjs.com/package/@sdxc/doh); both install alongside it.

## Usage

### Discover a domain's DMARC policy

```typescript
import { discoverDmarc } from "@sdxc/email-auth";
import { isSuccess } from "@sdxc/result";

let discovery = await discoverDmarc("news.example.com");
if (isSuccess(discovery)) {
	discovery.data.policy; // "quarantine": the record's sp=, since news.example.com has none
	discovery.data.policyDomain; // "example.com"
	discovery.data.organizationalDomain; // "example.com"
	discovery.data.record?.testing; // t=y
}
```

`policy` is `null` when DMARC does not apply. A resolver failure is the `Failure`, never "no
policy".

### Count SPF lookups, or evaluate a sender

```typescript
import { analyzeSpf, checkHost } from "@sdxc/email-auth";

let audit = await analyzeSpf("example.com");
// audit.data.lookups: DNS-querying terms across every include; over 10 is a permerror
// audit.data.problems: [{ code: "too-many-lookups", lookups: 13 }, …]

let evaluation = await checkHost({
	ip: "192.0.2.10",
	domain: "example.com",
	sender: "a@example.com",
});
evaluation.result; // "pass" | "fail" | "softfail" | "neutral" | "none" | "temperror" | "permerror"
evaluation.mechanism; // "mx"
```

### Read MTA-STS and TLS-RPT

```typescript
import { discoverMtaSts, discoverTlsRpt, fetchMtaStsPolicy } from "@sdxc/email-auth";

let record = await discoverMtaSts("example.com"); // { status: "found", record: { id } }
let policy = await fetchMtaStsPolicy("example.com"); // { mode: "enforce", mx: […], maxAge }
let reporting = await discoverTlsRpt("example.com"); // { status: "found", record: { rua } }
```

The policy file is fetched like a sending MTA does: HTTPS, no redirects, a 200 `text/plain`
body under 64 KiB, through [`@sdxc/outbound`](https://www.npmjs.com/package/@sdxc/outbound).

### Check whether a domain qualifies for BIMI

```typescript
import { bimiDmarcShortfalls, discoverBimi, discoverDmarc } from "@sdxc/email-auth";

let bimi = await discoverBimi("example.com"); // { status: "found", record: { location, evidence } }
let dmarc = await discoverDmarc("example.com");
// bimiDmarcShortfalls(dmarc.data): [] when DMARC enforces, else ["policy-none"], ["testing"], …
```

BIMI follows draft-brand-indicators-for-message-identification-14. The logo URL is validated as
HTTPS and SVG, and never fetched.

### Parse records and reports you already have

```typescript
import {
	parseDkimRecord,
	parseDmarcRecord,
	parseDmarcReport,
	parseSpfRecord,
} from "@sdxc/email-auth";

parseDmarcRecord("v=DMARC1; p=reject; rua=mailto:dmarc@example.com");
parseSpfRecord("v=spf1 mx include:_spf.example.net -all");
parseDkimRecord("v=DKIM1; k=rsa; p=MIGfMA0GCSq…");
parseDmarcReport(xml); // an RFC 9990 aggregate report, already decompressed
```

## API

### DMARC

- `parseDmarcRecord(text)`: a record, or a failure when `v=DMARC1` is not first. Invalid values
  fall back to their defaults and are listed in `issues`, as receivers do.
- `appliedDmarcPolicy(record, scope?)`: the policy for the domain, an existing subdomain or a
  missing one, with `np` → `sp` → `p` fallback and `none` for a reporting-only record.
- `discoverDmarc(domain, options?)`: policy discovery: the record, where it was published, and
  the policy a receiver applies.
- `dmarcTreeWalk(domain)`, `walkDmarcTree(domain, options?)`: the names a Tree Walk queries, and
  the walk itself.
- `selectOrganizationalDomain(domain, found)`, `findOrganizationalDomain(domain, options?)`: the
  Organizational Domain from a walk's records, or by running one.
- `isAligned(authorDomain, identifier, mode, options?)`: strict or relaxed identifier alignment.
- `isDmarcRecord(text)`: whether a TXT record starts with `v=DMARC1`.
- `parseDmarcReport(xml)`: an aggregate report, RFC 9990 or RFC 7489 shaped.

### SPF

- `parseSpfRecord(text)`, `isSpfRecord(text)`: the record's mechanisms and modifiers.
- `checkHost(input, options?)`: RFC 7208 `check_host()`, with the 10-lookup limit, the
  void-lookup limit (`maxVoidLookups`, default 2), macros and `exp` explanations.
- `analyzeSpf(domain, options?)`: the record, its lookup count across includes and redirects,
  and its problems.

### BIMI

- `parseBimiRecord(text)`, `isBimiRecord(text)`: the logo (`l=`), evidence (`a=`), local-part
  selectors (`lps=`) and avatar preference (`avp=`); `declined` for an explicit `l=; a=;`.
- `discoverBimi(domain, options?)`: the record at `<selector>._bimi.<domain>`, then at the
  Organizational Domain; pass `organizationalDomain` to skip the Tree Walk.
- `bimiDmarcShortfalls(discovery)`: why a DMARC discovery falls short of BIMI's requirements.

### MTA-STS, TLS-RPT and DKIM

- `parseMtaStsRecord(text)`, `parseMtaStsPolicy(text)`, `discoverMtaSts(domain, options?)`,
  `fetchMtaStsPolicy(domain, options?)`, `mtaStsPolicyUrl(domain)`, `matchesMxPattern(host, patterns)`.
- `parseTlsRptRecord(text)`, `discoverTlsRpt(domain, options?)`.
- `parseDkimRecord(text)`, `lookupDkimKey(domain, selector, options?)`: DKIM1 key records
  (RFC 6376). DKIM2 (draft-ietf-dkim-dkim2-spec) is being tracked and not parsed yet.
- `RecordParseError`: every parser's failure, with the `protocol` it was read as.
  `PolicyFetchError`: a policy file fetch that failed, with the step in `reason`.

Every lookup takes `{ resolver, signal, timeoutMs }`, passed to `@sdxc/doh`.

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
		"@sdxc/email-auth": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
