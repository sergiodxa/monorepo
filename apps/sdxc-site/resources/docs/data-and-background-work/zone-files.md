---
title: Import and export DNS zone files
description: Read a pasted BIND zone file into typed records with every unusable line reported, check them against live DNS, and hand the zone back as a file.
section:
    title: Data & background work
    order: 7
order: 15
lastUpdated: 2026-10-25
outcomes:
    - "How to read a pasted BIND zone file into typed records with `@sdxc/zone-file`"
    - "How to compare the records with live DNS"
    - "How to export the zone as a normalized file"
---

DNS will not list the names in a zone from outside it, so an app that monitors, migrates or
audits someone's DNS learns them from the zone file every provider exports. This guide imports a
pasted zone file and exports it back. [`@sdxc/zone-file`](/api/zone-file) reads and writes the
RFC 1035 format and reports every line it could not use, [`@sdxc/doh`](/api/doh) looks the
records up over DNS over HTTPS, [`@sdxc/validate`](/api/validate) checks the form, and
[`@sdxc/http`](/api/http) sends the export as a download.

```bash
npm add @sdxc/doh @sdxc/http @sdxc/result @sdxc/validate @sdxc/zone-file remix
```

## Read the paste

`parse` takes the text and the zone's origin, the domain that `@` and relative names stand for.
Some provider exports drop the trailing dot on a fully-qualified name, and
`relativeNames: "origin-suffix"` reads such a name as the absolute name it was meant to be:

```typescript {% title="app/services/zones/read-zone.ts" %}
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

The `Result` fails only for text past `maxBytes`. Everything else succeeds with `records` and
`rejected`: a file with one bad line in a thousand still gives you the other 999, and the bad
line comes back with its `line` and a `reason`. Each record has an absolute, lowercased `name`,
its `ttl`, `class`, `type`, `line`, and typed fields such as `address` for `A`.

## Keep the records you track

`parse` returns every record it read, including records outside the domain, repeats and types
you may not handle. Deciding what to keep is a filter over the records:

```typescript {% title="app/services/zones/tracked-records.ts" %}
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

`formatRecordData` prints a record's data in one canonical spelling, so `2001:DB8::1` and
`2001:db8:0:0:0:0:0:1` share a key and a record listed twice is kept once.

> [!NOTE]
> An unquoted TXT value is several character-strings, as DNS reads it, so `v=spf1 -all` imports
> as `v=spf1-all`. Provider exports always quote TXT values; mention it next to the paste box for
> hand-written files.

## Accept the paste

The action validates the form, reads the zone, and shows a review screen with the skipped and
rejected lines next to the records:

```tsx {% title="app/http/controllers/zones/import.tsx" %}
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { maxLength, minLength } from "remix/data-schema/checks";
import * as f from "remix/data-schema/form-data";
import { createAction } from "remix/router";

import { MAX_ZONE_BYTES, readZone } from "~/app/services/zones/read-zone";
import { trackedRecords } from "~/app/services/zones/tracked-records";
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

The schema stops an oversized paste early, and `parse` enforces the exact byte limit. Once the
person confirms the review, a second action stores the records.

## Compare with live DNS

A zone file says what the provider holds and a resolver says what the world sees, so comparing
the two finds records still propagating. `resolve` returns the same typed fields `parse` gives,
so `formatRecordData` lines them up:

```typescript {% title="app/services/zones/compare.ts" %}
import { resolve } from "@sdxc/doh";
import { isFailure } from "@sdxc/result";
import { formatRecordData } from "@sdxc/zone-file";

import type { TrackedRecord } from "~/app/services/zones/tracked-records";

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

A failed lookup counts every record in the group as missing.

> [!NOTE]
> The comparison sends one query per name and type, which adds up on a large zone, so run it in a
> background job and keep the request to the import.

## Export the zone

`stringify` writes records back as a zone file. With `relative: true`, names under the origin are
written relative to it and the apex as `@`:

```typescript {% title="app/http/controllers/zones/export.ts" %}
import { file } from "@sdxc/http/response";
import * as ZoneFile from "@sdxc/zone-file";
import { createAction } from "remix/router";

import { Zones } from "~/app/models/zones";
import routes from "~/routes/web";

export default createAction(routes.zones.export, async (ctx) => {
	let zone = await Zones.find(ctx.db, ctx.account.id, ctx.params.zoneId);
	let body = ZoneFile.stringify(
		{ origin: zone.domain, ttl: 3600, records: zone.records },
		{ relative: true },
	);

	return file(new Blob([body]), `${zone.domain}.zone`, {
		headers: {
			"Content-Type": "text/dns; charset=utf-8",
			"Cache-Control": "no-store",
		},
	});
});
```

`Zones` is your own table, holding the records as `parse` returned them. The export is
normalized, so two exports of the same zone diff only where the records differ.

## Test the import

`readZone` and `trackedRecords` answer data, so their test needs no request. One paste with a
missing trailing dot, a repeat, an unusable line and a record outside the domain covers the
import's decisions:

```typescript {% title="app/services/zones/tracked-records.test.ts" %}
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import { readZone } from "~/app/services/zones/read-zone";
import { trackedRecords } from "~/app/services/zones/tracked-records";

const PASTE = [
	"$TTL 3600",
	"@ IN A 192.0.2.1",
	"www.example.com IN CNAME example.com.",
	"@ IN A 192.0.2.1",
	"mail IN A not-an-address",
	"other.org. IN A 192.0.2.9",
].join("\n");

test("keeps each tracked record once and reports the rest by line", () => {
	let zone = unwrap(readZone(PASTE, "example.com"));
	let { records, skipped } = trackedRecords(zone.records, "example.com");

	expect(records.map((record) => `${record.name} ${record.type}`)).toEqual([
		"example.com A",
		"www.example.com CNAME",
	]);
	expect(zone.rejected.map((rejection) => rejection.line)).toEqual([5]);
	expect(skipped).toEqual([{ line: 6, reason: "outside-domain" }]);
});
```

A test for `missingFromDns` answers its DNS over HTTPS
requests with MSW, as [Test Workers apps](/docs/operations-and-testing/testing) shows for
outbound HTTP.

## Where to go next

- [Custom domains for your customers](/docs/identity-and-security/verify-domains) — proving a
  customer owns a domain with a TXT lookup.
- [Check a domain's email authentication](/docs/data-and-background-work/email-authentication) —
  evaluating the SPF, DKIM and DMARC records a zone holds.
- [`@sdxc/zone-file`](/api/zone-file) — every option, record field and rejection reason.
