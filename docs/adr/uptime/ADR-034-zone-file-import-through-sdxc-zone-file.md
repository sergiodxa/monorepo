# ADR-034: Zone Files Import Through `@sdxc/zone-file`

## Status

**Accepted** - 2026-10-08. Supersedes the "Not supported, and reported rather than ignored"
table in [ADR-026 §7](./ADR-026-domain-dns-monitors-with-record-import.md#7-the-zone-file-the-smallest-parser-that-is-honest-about-what-it-skipped).
Implements the uptime half of [ADR-122](../ADR-122-zone-file-package.md).

## Background

ADR-026 §7 sized the zone-file parser to one job — contributing names — and refused every
construct outside one record per line: `$ORIGIN`, `$TTL`, parenthesised records and blank-owner
continuation lines were each reported with their own rejection reason. ADR-122 moves master-file
syntax into `@sdxc/zone-file`, which reads the full RFC 1035 grammar, so those refusals no longer
protect anything: a hand-written or BIND-exported zone was rejected line by line for syntax the
package now reads correctly.

## Decision

`app/services/zone-file.ts` is the app's import policy over `parse` from `@sdxc/zone-file`, called
with the monitor's domain as the origin, `relativeNames: "origin-suffix"` (the reading the old
`qualifyName` applied to Cloudflare's dotless SOA owner) and the 256 KiB limit.

| Construct                                                 | Outcome                                            |
| --------------------------------------------------------- | -------------------------------------------------- |
| `$ORIGIN`, `$TTL`                                         | Applied; nothing reported                          |
| Parenthesised multi-line records                          | Read as one entry, reported at the line it starts  |
| Blank-owner continuation lines                            | Take the previous record's owner                   |
| `$INCLUDE`                                                | Rejected as `includeDirective` (no file to read)   |
| `$GENERATE`                                               | Rejected as `generateDirective`                    |
| Any other `$` word                                        | Rejected as `unsupportedDirective`                 |
| Classes other than `IN`                                   | Rejected as `nonInternetClass`                     |
| Known types the monitor does not track (SOA, SRV, PTR, …) | Rejected as `unsupportedType`                      |
| Owners outside the monitor's domain                       | Rejected as `outOfZone`, including after `$ORIGIN` |
| Unreadable entries, invalid RDATA, a first blank owner    | Rejected as `malformed`                            |
| A record declared twice                                   | Imported once; the repeat listed as a duplicate    |

The rejection reasons `originDirective`, `ttlDirective`, `multiLineRecord` and
`blankOwnerContinuation` are removed from the type, the OpenAPI enum and every locale. ADR-026's
reason for refusing `$ORIGIN` — ignoring it would misplace every later name — no longer applies
once it is honored, and `outOfZone` still catches an `$ORIGIN` that leaves the domain.

**TXT follows RFC 1035.** An unquoted `v=spf1 -all` in a zone file is two character-strings, and
imports as `v=spf1-all`, the record DNS serves. Cloudflare and Route 53 always quote TXT, so real
exports are unaffected. A hand-typed expected value keeps its own rule: unquoted text is one
string with its spaces.

`app/lib/dns-record-value.ts` keeps the app's identity rules: `storedRecordValue` takes
`ZoneFile.RecordData`, so a zone-file record and a resolver answer reach their stored value
through one function from the same typed fields. The app's own IPv6 and IPv4 readers go; the codec
canonicalizes AAAA and refuses leading-zero IPv4.

## Consequences

### Positive

- A BIND-exported or hand-written zone imports instead of reporting its directives and SOA lines.
- Four fewer rejection reasons to translate; the review screen shows only real refusals.
- The Cloudflare export imports exactly as before: 43 records, 1 rejection (its SOA) and 1
  duplicate.

### Negative

- An API client matching on the four removed reasons stops seeing them; they were never produced
  for a provider export.

### Neutral

- Policy — zone membership, tracked types, duplicates, display truncation — stays in the app.
