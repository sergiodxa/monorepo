/**
 * Tests DNS resolution for domain monitors. The DoH endpoint is stubbed with MSW and
 * answers with payloads copied from real queries, because the four behaviours pinned here —
 * `NXDOMAIN` is not an error, a CNAME poisons an address sweep, a long TXT arrives in
 * chunks, and both input channels must fold to one string — are all properties of what
 * Cloudflare actually returns rather than of what the code expects it to.
 *
 * `resolveDns` is tested for the throw-on-anything-but-clean-NOERROR contract the public
 * probe's SSRF fence depends on, separately from the sweep's never-throw one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";

import { HttpResponse, delay, http } from "msw";
import { setupServer } from "msw/node";

import {
	QUERIES_PER_NAME,
	checkDns,
	queryDnsRecords,
	resolveDns,
	sweepDnsName,
} from "~/app/services/dns-check";

const DOH_URL = "https://cloudflare-dns.com/dns-query";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/**
 * The DoH JSON envelope, loose enough to hand a handler the sections a case cares about —
 * an `Authority`-only answer is as much a real response as an `Answer`-carrying one.
 */
interface DohBody {
	Status?: number;
	Answer?: { name: string; type: number; TTL: number; data: string }[];
	Authority?: { name: string; type: number }[];
}

/** Answers every DoH query with one fixed body, whatever was asked for. */
function respondWith(body: DohBody, init?: ResponseInit) {
	server.use(http.get(DOH_URL, () => HttpResponse.json(body, init)));
}

/** Answers per requested record type, so a sweep's six queries can differ from each other. */
function respondByType(bodies: Record<string, DohBody>, slowTypes: string[] = []) {
	server.use(
		http.get(DOH_URL, async ({ request }) => {
			let type = new URL(request.url).searchParams.get("type") ?? "";
			if (slowTypes.includes(type)) await delay(40);
			return HttpResponse.json(bodies[type] ?? { Status: 0 });
		}),
	);
}

describe("resolveDns", () => {
	test("returns the resolved A record values and a response time", async () => {
		respondWith({
			Status: 0,
			Answer: [{ name: "example.com", type: 1, TTL: 300, data: "1.2.3.4" }],
		});

		let result = await resolveDns("example.com", "A");

		expect(result.values).toEqual(["1.2.3.4"]);
		expect(typeof result.responseTimeMs).toBe("number");
		expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
	});

	test("filters out answers that don't match the requested record type code", async () => {
		respondWith({
			Status: 0,
			Answer: [
				{ name: "example.com", type: 5, TTL: 300, data: "cname.example.com" },
				{ name: "example.com", type: 1, TTL: 300, data: "5.6.7.8" },
			],
		});

		let result = await resolveDns("example.com", "A");

		expect(result.values).toEqual(["5.6.7.8"]);
	});

	test("returns an empty list when there is no Answer section", async () => {
		respondWith({ Status: 0 });

		expect((await resolveDns("example.com", "A")).values).toEqual([]);
	});

	test("throws when the HTTP response is not ok", async () => {
		respondWith({}, { status: 500 });

		expect(resolveDns("example.com", "A")).rejects.toThrow("DNS query failed with status 500");
	});

	test("throws when the DNS query returns a non-zero Status", async () => {
		respondWith({ Status: 2 });

		expect(resolveDns("example.com", "A")).rejects.toThrow("DNS query returned status code 2");
	});

	test("still throws on NXDOMAIN, which the probe fence reads as an unresolvable target", async () => {
		respondWith({ Status: 3 });

		expect(resolveDns("zzz-nope.example.com", "A")).rejects.toThrow(
			"DNS query returned status code 3",
		);
	});

	test("keeps the address reached through a CNAME, which is the one the probe would connect to", async () => {
		respondWith({
			Status: 0,
			Answer: [
				{ name: "www.github.com", type: 5, TTL: 3557, data: "github.com." },
				{ name: "github.com", type: 1, TTL: 17, data: "140.82.114.3" },
			],
		});

		expect((await resolveDns("www.github.com", "A")).values).toEqual(["140.82.114.3"]);
	});
});

describe("queryDnsRecords", () => {
	test("returns the normalized RRset for a name that publishes one", async () => {
		respondWith({
			Status: 0,
			Answer: [
				{ name: "sergiodxa.com", type: 15, TTL: 300, data: "5 ALT1.aspmx.l.google.com." },
				{ name: "sergiodxa.com", type: 15, TTL: 300, data: "5 aspmx.l.google.com." },
			],
		});

		let outcome = await queryDnsRecords("sergiodxa.com", "MX");

		expect(outcome.errorMessage).toBeNull();
		expect(outcome.values).toEqual(["5 alt1.aspmx.l.google.com", "5 aspmx.l.google.com"]);
	});

	test("reads NXDOMAIN as no records here, not as a failed check", async () => {
		respondWith({ Status: 3, Authority: [{ name: "sergiodxa.com", type: 6 }] });

		let outcome = await queryDnsRecords("zzz-nope.sergiodxa.com", "A");

		expect(outcome.values).toEqual([]);
		expect(outcome.errorMessage).toBeNull();
	});

	test("reads NOERROR with no answers as no records here", async () => {
		respondWith({ Status: 0, Authority: [{ name: "sergiodxa.com", type: 6 }] });

		let outcome = await queryDnsRecords("sergiodxa.com", "CNAME");

		expect(outcome.values).toEqual([]);
		expect(outcome.errorMessage).toBeNull();
	});

	test("reads SERVFAIL as a failure, so no diff is applied for it", async () => {
		respondWith({ Status: 2 });

		let outcome = await queryDnsRecords("dnssec-failed.org", "A");

		expect(outcome.values).toEqual([]);
		expect(outcome.errorMessage).toBe("DNS query returned status code 2");
	});

	test("reads a non-2xx response as a failure", async () => {
		respondWith({}, { status: 502 });

		expect((await queryDnsRecords("example.com", "A")).errorMessage).toBe(
			"DNS query failed with status 502",
		);
	});

	test("reads a transport failure as a failure instead of throwing", async () => {
		server.use(http.get(DOH_URL, () => HttpResponse.error()));

		let outcome = await queryDnsRecords("example.com", "A");

		expect(outcome.values).toEqual([]);
		expect(outcome.errorMessage).not.toBeNull();
	});

	test("suppresses the A records a CNAME chase dragged in, which belong to the target", async () => {
		respondWith({
			Status: 0,
			Answer: [
				{ name: "www.github.com", type: 5, TTL: 3557, data: "github.com." },
				{ name: "github.com", type: 1, TTL: 17, data: "140.82.114.3" },
			],
		});

		let outcome = await queryDnsRecords("www.github.com", "A");

		expect(outcome.values).toEqual([]);
		expect(outcome.suppressedByCname).toBe(true);
		expect(outcome.errorMessage).toBeNull();
	});

	test("suppresses AAAA the same way", async () => {
		respondWith({
			Status: 0,
			Answer: [{ name: "www.github.com", type: 5, TTL: 3462, data: "github.com." }],
		});

		let outcome = await queryDnsRecords("www.github.com", "AAAA");

		expect(outcome.suppressedByCname).toBe(true);
	});

	test("still tracks the CNAME itself, which is the record that lives at the name", async () => {
		respondWith({
			Status: 0,
			Answer: [{ name: "www.github.com", type: 5, TTL: 3600, data: "GitHub.com." }],
		});

		let outcome = await queryDnsRecords("www.github.com", "CNAME");

		expect(outcome.values).toEqual(["github.com"]);
		expect(outcome.suppressedByCname).toBe(false);
	});

	test("does not suppress addresses at a name with no CNAME", async () => {
		respondWith({
			Status: 0,
			Answer: [{ name: "sergiodxa.com", type: 1, TTL: 300, data: "172.67.166.130" }],
		});

		let outcome = await queryDnsRecords("sergiodxa.com", "A");

		expect(outcome.values).toEqual(["172.67.166.130"]);
		expect(outcome.suppressedByCname).toBe(false);
	});

	test("keeps the edge addresses of a proxied name, where the answer carries no CNAME", async () => {
		respondWith({
			Status: 0,
			Answer: [
				{ name: "gh.sergiodxa.com", type: 1, TTL: 300, data: "104.21.58.249" },
				{ name: "gh.sergiodxa.com", type: 1, TTL: 300, data: "172.67.166.130" },
			],
		});

		let outcome = await queryDnsRecords("gh.sergiodxa.com", "A");

		expect(outcome.values).toEqual(["104.21.58.249", "172.67.166.130"]);
		expect(outcome.suppressedByCname).toBe(false);
		expect(outcome.errorMessage).toBeNull();
	});

	test("reports a proxied name's absent CNAME as none, not as an error", async () => {
		respondWith({ Status: 0, Authority: [{ name: "sergiodxa.com", type: 6 }] });

		let outcome = await queryDnsRecords("gh.sergiodxa.com", "CNAME");

		expect(outcome.values).toEqual([]);
		expect(outcome.errorMessage).toBeNull();
	});

	test("joins a chunked TXT record instead of leaving a stray quote pair inside it", async () => {
		respondWith({
			Status: 0,
			Answer: [
				{
					name: "google._domainkey.github.com",
					type: 16,
					TTL: 3600,
					data: '"v=DKIM1; k=rsa; p=MIIBIjANBg" "OPoA7dlR/A/pECIDAQAB"',
				},
			],
		});

		let outcome = await queryDnsRecords("google._domainkey.github.com", "TXT");

		expect(outcome.values).toEqual(["v=DKIM1; k=rsa; p=MIIBIjANBgOPoA7dlR/A/pECIDAQAB"]);
	});

	test("lowercases the queried name so the outcome keys on one spelling", async () => {
		respondWith({ Status: 0 });

		expect((await queryDnsRecords("WWW.Example.COM.", "A")).name).toBe("www.example.com");
	});
});

describe("sweepDnsName", () => {
	test("queries every supported record type once", async () => {
		let requested: string[] = [];
		server.use(
			http.get(DOH_URL, ({ request }) => {
				requested.push(new URL(request.url).searchParams.get("type") ?? "");
				return HttpResponse.json({ Status: 0 });
			}),
		);

		let sweep = await sweepDnsName("sergiodxa.com");

		expect(requested.sort()).toEqual(["A", "AAAA", "CNAME", "MX", "NS", "TXT"]);
		expect(sweep.outcomes).toHaveLength(QUERIES_PER_NAME);
		expect(sweep.queriesFailed).toBe(0);
	});

	test("collects each type's records under one name", async () => {
		respondByType({
			A: { Status: 0, Answer: [{ name: "x", type: 1, TTL: 300, data: "1.2.3.4" }] },
			AAAA: { Status: 3 },
			TXT: { Status: 0, Answer: [{ name: "x", type: 16, TTL: 300, data: '"v=spf1 -all"' }] },
		});

		let sweep = await sweepDnsName("sergiodxa.com");
		let byType = new Map(sweep.outcomes.map((outcome) => [outcome.recordType, outcome.values]));

		expect(byType.get("A")).toEqual(["1.2.3.4"]);
		expect(byType.get("AAAA")).toEqual([]);
		expect(byType.get("TXT")).toEqual(["v=spf1 -all"]);
		expect(byType.get("NS")).toEqual([]);
	});

	test("counts failed queries without failing the sweep", async () => {
		respondByType({
			A: { Status: 2 },
			MX: { Status: 2 },
			NS: {
				Status: 0,
				Answer: [{ name: "x", type: 2, TTL: 300, data: "dora.ns.cloudflare.com." }],
			},
		});

		let sweep = await sweepDnsName("sergiodxa.com");

		expect(sweep.queriesFailed).toBe(2);
		expect(sweep.outcomes.find((outcome) => outcome.recordType === "NS")?.values).toEqual([
			"dora.ns.cloudflare.com",
		]);
	});

	test("reports the slowest query, not the sum of them", async () => {
		respondByType({}, ["A", "TXT"]);

		let sweep = await sweepDnsName("sergiodxa.com");
		let total = sweep.outcomes.reduce((sum, outcome) => sum + outcome.responseTimeMs, 0);

		expect(sweep.responseTimeMs).toBe(
			Math.max(...sweep.outcomes.map((outcome) => outcome.responseTimeMs)),
		);
		expect(sweep.responseTimeMs).toBeGreaterThanOrEqual(35);
		expect(sweep.responseTimeMs).toBeLessThan(total);
	});
});

describe("checkDns", () => {
	test("is ok when the resolved value matches the configured expected value", async () => {
		respondWith({
			Status: 0,
			Answer: [{ name: "example.com", type: 1, TTL: 300, data: "1.2.3.4" }],
		});

		let result = await checkDns("example.com", "A", "1.2.3.4", null);

		expect(result.status).toBe("ok");
		expect(result.resolvedValue).toBe("1.2.3.4");
		expect(result.errorMessage).toBeUndefined();
	});

	test("is ok when extra resolved records surround the single expected one", async () => {
		respondWith({
			Status: 0,
			Answer: [
				{ name: "example.com", type: 1, TTL: 300, data: "1.2.3.4" },
				{ name: "example.com", type: 1, TTL: 300, data: "5.6.7.8" },
			],
		});

		let result = await checkDns("example.com", "A", "1.2.3.4", null);

		expect(result.status).toBe("ok");
		expect(result.resolvedValue).toBe("1.2.3.4, 5.6.7.8");
	});

	test("is changed when the resolved value differs from the expected value", async () => {
		respondWith({
			Status: 0,
			Answer: [{ name: "example.com", type: 1, TTL: 300, data: "9.9.9.9" }],
		});

		expect((await checkDns("example.com", "A", "1.2.3.4", null)).status).toBe("changed");
	});

	test("is changed against the previous value when no expected value is configured", async () => {
		respondWith({
			Status: 0,
			Answer: [{ name: "example.com", type: 1, TTL: 300, data: "9.9.9.9" }],
		});

		expect((await checkDns("example.com", "A", null, "1.2.3.4")).status).toBe("changed");
	});

	test("is ok on the first check ever, with no expected or previous value", async () => {
		respondWith({
			Status: 0,
			Answer: [{ name: "example.com", type: 1, TTL: 300, data: "1.2.3.4" }],
		});

		let result = await checkDns("example.com", "A", null, null);

		expect(result.status).toBe("ok");
		expect(result.resolvedValue).toBe("1.2.3.4");
	});

	test("is changed when only some of the comma-separated expected values are present", async () => {
		respondWith({
			Status: 0,
			Answer: [{ name: "example.com", type: 1, TTL: 300, data: "1.1.1.1" }],
		});

		expect((await checkDns("example.com", "A", "1.1.1.1, 2.2.2.2", null)).status).toBe("changed");
	});

	test("is ok when a CNAME expected value omits the trailing dot and differs in case", async () => {
		respondWith({
			Status: 0,
			Answer: [{ name: "www.example.com", type: 5, TTL: 300, data: "Target.Example.NET." }],
		});

		expect((await checkDns("www.example.com", "CNAME", "target.example.net", null)).status).toBe(
			"ok",
		);
	});

	test("compares a chunked TXT record against the value a user would paste", async () => {
		respondWith({
			Status: 0,
			Answer: [
				{ name: "example.com", type: 16, TTL: 300, data: '"v=DKIM1; k=rsa; p=AAAA" "BBBB"' },
			],
		});

		let result = await checkDns("example.com", "TXT", "v=DKIM1; k=rsa; p=AAAABBBB", null);

		expect(result.status).toBe("ok");
		expect(result.resolvedValue).toBe("v=DKIM1; k=rsa; p=AAAABBBB");
	});
});

describe("checkDns expected-value containment", () => {
	/** The five MX answers a live Google Workspace domain returns, in DoH shape. */
	function googleWorkspaceMx() {
		return {
			Status: 0,
			Answer: [
				{ name: "example.com", type: 15, TTL: 300, data: "5 alt1.aspmx.l.google.com." },
				{ name: "example.com", type: 15, TTL: 300, data: "5 alt2.aspmx.l.google.com." },
				{ name: "example.com", type: 15, TTL: 300, data: "5 alt3.aspmx.l.google.com." },
				{ name: "example.com", type: 15, TTL: 300, data: "5 alt4.aspmx.l.google.com." },
				{ name: "example.com", type: 15, TTL: 300, data: "5 aspmx.l.google.com." },
			],
		};
	}

	test("is ok when a single bare MX host is present among the resolved records", async () => {
		respondWith(googleWorkspaceMx());

		expect((await checkDns("example.com", "MX", "aspmx.l.google.com", null)).status).toBe("ok");
	});

	test("is changed when one of the listed MX hosts is missing", async () => {
		respondWith(googleWorkspaceMx());

		let result = await checkDns(
			"example.com",
			"MX",
			"aspmx.l.google.com, mx.hostile.example",
			null,
		);

		expect(result.status).toBe("changed");
	});

	test("does not accept a longer record that merely contains the expected host", async () => {
		respondWith({
			Status: 0,
			Answer: [{ name: "example.com", type: 15, TTL: 300, data: "5 alt1.aspmx.l.google.com." }],
		});

		expect((await checkDns("example.com", "MX", "aspmx.l.google.com", null)).status).toBe(
			"changed",
		);
	});

	test("is ok when the expected MX token pins the preference number too", async () => {
		respondWith(googleWorkspaceMx());

		expect((await checkDns("example.com", "MX", "5 aspmx.l.google.com", null)).status).toBe("ok");
	});

	test("is changed when the expected MX token pins a preference the record doesn't have", async () => {
		respondWith(googleWorkspaceMx());

		expect((await checkDns("example.com", "MX", "10 aspmx.l.google.com", null)).status).toBe(
			"changed",
		);
	});

	test("keeps passing configs that list the full record set verbatim", async () => {
		respondWith(googleWorkspaceMx());

		let result = await checkDns(
			"example.com",
			"MX",
			"5 alt1.aspmx.l.google.com., 5 alt2.aspmx.l.google.com., 5 alt3.aspmx.l.google.com., 5 alt4.aspmx.l.google.com., 5 aspmx.l.google.com.",
			null,
		);

		expect(result.status).toBe("ok");
	});
});

describe("checkDns errors", () => {
	test("is error, not a throw, when the DNS query returns a non-zero Status", async () => {
		respondWith({ Status: 2 });

		let result = await checkDns("example.com", "A", null, null);

		expect(result.status).toBe("error");
		expect(result.resolvedValue).toBeNull();
		expect(result.responseTimeMs).toBe(0);
		expect(result.errorMessage).toBe("DNS query returned status code 2");
	});

	test("is error, not a throw, when the HTTP request fails", async () => {
		respondWith({}, { status: 502 });

		let result = await checkDns("example.com", "A", null, null);

		expect(result.status).toBe("error");
		expect(result.errorMessage).toBe("DNS query failed with status 502");
	});
});
