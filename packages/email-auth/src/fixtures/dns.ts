/**
 * Serves zone files as a DNS-over-HTTPS resolver for tests: every lookup this package makes
 * reaches an MSW handler that answers from the records an RFC's example zone declares,
 * NXDOMAIN for a name it never mentions, and SERVFAIL for names marked as failing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { setupServer } from "msw/node";

import { CLOUDFLARE } from "@sdxc/doh";
import { isFailure } from "@sdxc/result";
import { formatRecordData, parse, typeCode } from "@sdxc/zone-file";
import { http, HttpResponse } from "msw";

/** One record as the DoH JSON API writes it. */
interface WireRecord {
	name: string;
	type: number;
	TTL: number;
	data: string;
}

/**
 * Answers every query from `zone`, read relative to `origin`. Names listed in `failing`
 * answer SERVFAIL, so a test can tell a resolver outage from an absent record.
 *
 * @param server - The test's MSW server.
 * @param zone - Zone file text; `$ORIGIN` lines switch zones as in a real file.
 * @param options - The starting origin and the names that fail.
 * @returns The names queried, in order, as `name/TYPE`.
 */
export function serveZone(
	server: ReturnType<typeof setupServer>,
	zone: string,
	options: { origin?: string; failing?: string[] } = {},
): string[] {
	let parsed = parse(zone, { origin: options.origin ?? "example.com.", ttl: 300 });
	if (isFailure(parsed)) throw parsed.error;
	let rejected = parsed.data.rejected[0];
	if (rejected) throw new Error(`The fixture zone has a bad line: ${rejected.message}`);

	let records = new Map<string, WireRecord[]>();
	for (let record of parsed.data.records) {
		let entries = records.get(record.name) ?? [];
		entries.push({
			name: `${record.name}.`,
			type: typeCode(record.type) ?? 0,
			TTL: record.ttl ?? 300,
			data: formatRecordData(record),
		});
		records.set(record.name, entries);
	}

	let failing = new Set(options.failing ?? []);
	let queries: string[] = [];

	server.use(
		http.get(CLOUDFLARE.url, ({ request }) => {
			let url = new URL(request.url);
			let name = (url.searchParams.get("name") ?? "").toLowerCase().replace(/\.$/, "");
			let type = url.searchParams.get("type") ?? "";
			queries.push(`${name}/${type}`);
			if (failing.has(name)) return HttpResponse.json({ Status: 2 });
			let entries = records.get(name);
			if (!entries) return HttpResponse.json({ Status: 3 });
			let code = typeCode(type);
			return HttpResponse.json({
				Status: 0,
				Answer: entries.filter((entry) => entry.type === code),
			});
		}),
	);
	return queries;
}
