---
title: Import and export DNS zone files
description: Read a pasted BIND zone file into typed records with every unusable line reported, check them against live DNS, and hand the zone back as a file.
section:
    title: Data & background work
    order: 6
order: 14
lastUpdated: 2026-10-08
---

DNS will not list the names in a zone from outside it. A resolver answers questions about names
you already know, so an app that monitors, migrates or audits someone's DNS has to learn the
names some other way. The usual way is the zone file: every DNS provider exports one, and it
holds every record, subdomains included.

This guide imports a pasted zone file into an app and exports it back.
[`@sdxc/zone-file`](/api/zone-file) reads and writes the RFC 1035 format and reports every line
it could not use. [`@sdxc/doh`](/api/doh) looks the records up over DNS over HTTPS, since a
Worker has no DNS socket. [`@sdxc/validate`](/api/validate) checks the form, and
[`@sdxc/http`](/api/http) sends the export as a download.

```bash
npm add @sdxc/zone-file @sdxc/doh @sdxc/validate @sdxc/result @sdxc/http remix
```

## Read the paste

`parse` takes the text and the zone's origin, the domain that `@` and relative names stand for.
Provider exports differ in small ways. Some drop the trailing dot on a fully-qualified name, which
RFC 1035 reads as relative: `example.com` written in the `example.com` zone means
`example.com.example.com`. `relativeNames: "origin-suffix"` reads such a name as the absolute
name it was meant to be:

```typescript {% title="app/zones/read-zone.ts" %}
import * as ZoneFile from "@sdxc/zone-file";

export const MAX_ZONE_BYTES = 256 * 1024;

export function readZone(text: string, domain: string) {
	return ZoneFile.parse(text, {
		origin: domain,
		relativeNames: "origin-suffix",
		maxBytes: MAX_ZONE_BYTES,
	});
}
```

The `Result` fails in one case only: text past `maxBytes`, where the error's `bytes` says how
large it was. Everything else succeeds with `records` and `rejected`. A file with one bad line
in a thousand still gives you the other 999, and the bad line comes back with its `line`, the
`input` as written and a `reason`: `malformed`, `invalid-data` for an `A` record that is not an
address, `missing-owner`, `include`, or `unsupported-directive` for `$GENERATE`.

The full grammar is read: `$ORIGIN`, `$TTL`, records spread over lines with parentheses, lines
that start with whitespace to reuse the previous name, TTLs like `1h30m`, and escaped names. Each
record comes back with an absolute, lowercased `name`, its `ttl`, `class`, `type`, the line it
started on, its trailing `;` comment, and typed fields: `address` for `A`, `preference` and
`exchange` for `MX`, `text` and `strings` for `TXT`.

## Keep the records you track

`parse` returns every record it read, including records outside the domain, repeats, classes
other than `IN` and types you may not handle. Deciding what to keep is a policy, and it is a
filter over the records:

```typescript {% title="app/zones/tracked-records.ts" %}
import type { ZoneFile } from "@sdxc/zone-file";

import { formatRecordData } from "@sdxc/zone-file";

export const TRACKED_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "CAA"] as const;

export type TrackedRecord = ZoneFile.RecordFor<(typeof TRACKED_TYPES)[number]>;

export interface Skipped {
	line: number;
	reason: "other-class" | "untracked-type" | "outside-domain";
}

function isTracked(record: ZoneFile.Record): record is TrackedRecord {
	return (TRACKED_TYPES as readonly string[]).includes(record.type);
}

export function trackedRecords(records: ZoneFile.Record[], domain: string) {
	let kept = new Map<string, TrackedRecord>();
	let skipped: Skipped[] = [];

	for (let record of records) {
		let { line } = record;
		if (record.class !== "IN") skipped.push({ line, reason: "other-class" });
		else if (!isTracked(record)) skipped.push({ line, reason: "untracked-type" });
		else if (record.name !== domain && !record.name.endsWith(`.${domain}`))
			skipped.push({ line, reason: "outside-domain" });
		else
			kept.set(
				`${record.name} ${record.type} ${formatRecordData(record)}`,
				record,
			);
	}

	return { records: [...kept.values()], skipped };
}
```

`formatRecordData` prints a record's data in one canonical spelling, so it makes a good identity
key. `2001:DB8::1` and `2001:db8:0:0:0:0:0:1` print the same, and so do a CAA record written
`0 ISSUE "ca.example"` and the RFC 3597 form `\# 15 00 05 …` a resolver may answer with. A
record a file lists twice is kept once, since DNS serves it once.

One rule surprises people: an unquoted TXT value is several character-strings, as DNS reads it,
so `v=spf1 -all` imports as `v=spf1-all`. Provider exports always quote TXT values. Mention it
next to the paste box for hand-written files.

## Accept the paste

The action validates the form, reads the zone, and either shows the review screen or the
reasons it cannot. The review screen should show the skipped and rejected lines next to the
records, so the person importing sees what the import covers and what it does not:

```tsx {% title="app/http/controllers/zones/import.tsx" %}
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { maxLength, minLength } from "remix/data-schema/checks";
import * as f from "remix/data-schema/form-data";
import { createAction } from "remix/router";

import { MAX_ZONE_BYTES, readZone } from "~/app/zones/read-zone";
import { trackedRecords } from "~/app/zones/tracked-records";
import { ImportZonePage, ReviewZonePage } from "~/resources/views/zones";
import routes from "~/routes/web";

const IMPORT_ZONE = f.object({
	domain: f.field(s.string().pipe(minLength(1))),
	zoneFile: f.field(s.string().pipe(minLength(1), maxLength(MAX_ZONE_BYTES))),
});

export default createAction(routes.zones.import, async (ctx) => {
	let form = await validate(ctx.formData, IMPORT_ZONE);
	if (isFailure(form)) {
		let page = <ImportZonePage issues={form.error.issues} />;
		return ctx.render(page, { status: 400 });
	}

	let { domain, zoneFile } = form.data;
	let zone = readZone(zoneFile, domain.toLowerCase());
	if (isFailure(zone)) {
		let page = <ImportZonePage tooLarge={zone.error.bytes} />;
		return ctx.render(page, { status: 413 });
	}

	let { records, skipped } = trackedRecords(
		zone.data.records,
		domain.toLowerCase(),
	);
	let page = (
		<ReviewZonePage
			records={records}
			skipped={skipped}
			rejected={zone.data.rejected}
		/>
	);
	return ctx.render(page);
});
```

`maxLength` counts characters while `maxBytes` counts UTF-8 bytes. The schema stops an
oversized paste early, and `parse` gives the exact limit. Once the person confirms the review, a
second action stores the records it lists.

## Compare with live DNS

A zone file says what the provider holds. A resolver says what the world sees. Comparing the two
finds records that are still propagating or edited by hand on the provider's side. `resolve`
returns records with the same typed fields `parse` gives, so the same `formatRecordData` key
lines them up:

```typescript {% title="app/zones/compare.ts" %}
import { resolve } from "@sdxc/doh";
import { isFailure } from "@sdxc/result";
import { formatRecordData } from "@sdxc/zone-file";

import type { TrackedRecord } from "~/app/zones/tracked-records";

export async function missingFromDns(records: TrackedRecord[]) {
	let groups = Map.groupBy(records, (record) => `${record.name} ${record.type}`);
	let missing: TrackedRecord[] = [];

	for (let group of groups.values()) {
		let [{ name, type }] = group as [TrackedRecord];
		let answer = await resolve(name, type);
		if (isFailure(answer)) {
			missing.push(...group);
			continue;
		}

		let live = new Set(
			answer.data.records.map((record) => formatRecordData(record)),
		);
		missing.push(
			...group.filter((record) => !live.has(formatRecordData(record))),
		);
	}

	return missing;
}
```

A failed lookup counts every record in the group as missing. Use the error classes to tell
NXDOMAIN, where the name is gone, apart from a resolver having a bad minute, as
[Custom domains for your customers](/docs/identity-and-security/verify-domains) does. One query
per name and type adds up on a large zone, so run the comparison in a background job rather than
inside the request.

## Export the zone

`stringify` writes records back as a zone file. With `relative: true`, names under the origin are
written relative to it and the apex as `@`, the form people keep in git and paste into another
provider:

```typescript {% title="app/http/controllers/zones/export.ts" %}
import { attachment, text } from "@sdxc/http/response";
import * as ZoneFile from "@sdxc/zone-file";
import { createAction } from "remix/router";

import { Zones } from "~/app/data/zones";
import routes from "~/routes/web";

export default createAction(routes.zones.export, async (ctx) => {
	let zone = await Zones.find(ctx.db, ctx.account.id, ctx.params.zoneId);
	let body = ZoneFile.stringify(
		{ origin: zone.domain, ttl: 3600, records: zone.records },
		{ relative: true },
	);

	return text(body, {
		headers: {
			"Content-Disposition": attachment(`${zone.domain}.zone`),
			"Cache-Control": "no-store",
		},
	});
});
```

`Zones` is your own table, holding each record's name, type, TTL and typed fields as `parse`
returned them. The file starts with `$ORIGIN` and `$TTL`, and a record's TTL is written only when
it differs from `$TTL`. Records parsed from a file go back out through `stringify` and parse
again to the same records. Spacing, comments on lines of their own and parentheses are not kept,
so an export is normalized: two exports of the same zone diff only where the records differ.

## Read a zone with includes

A zone kept in a repository is often split up, with `$INCLUDE` lines pulling in a file per
service. `parse` has no file system, so the `include` option hands it the text. Without the
option, every `$INCLUDE` is rejected with the `include` reason:

```typescript {% title="scripts/check-zone.ts" %}
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { isFailure } from "@sdxc/result";
import * as ZoneFile from "@sdxc/zone-file";

let directory = "zones";
let parsed = ZoneFile.parse(
	readFileSync(join(directory, "example.com.zone"), "utf8"),
	{
		origin: "example.com",
		include: (fileName) => readFileSync(join(directory, fileName), "utf8"),
	},
);

if (isFailure(parsed)) throw parsed.error;
for (let rejection of parsed.data.rejected) {
	console.error(
		`${rejection.file ?? "example.com.zone"}:${rejection.line} ${rejection.message}`,
	);
}
process.exitCode = parsed.data.rejected.length > 0 ? 1 : 0;
```

Each record and rejection names the `file` it came from, `null` for the text passed to `parse`.
The included text counts toward `maxBytes`, and includes nest up to eight files deep. Run it in
CI and a typo in a zone fails the build with its file and line, before a provider rejects it.

## Where to go next

- [Custom domains for your customers](/docs/identity-and-security/verify-domains): proving a
  customer owns a domain with a TXT lookup.
- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron): running the DNS
  comparison off the request.
- [Watch when a domain expires](/docs/data-and-background-work/domain-expiry): the registration
  date that takes every record in the zone down with it.
- [Import and export CSV](/docs/data-and-background-work/csv): the same import shape for
  spreadsheets.
- [`@sdxc/zone-file`](/api/zone-file): every option, record field and rejection reason.
