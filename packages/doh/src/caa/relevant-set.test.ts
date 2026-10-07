/**
 * Exercises `findRelevantCaa`, RFC 8659's climb, against a scripted resolver: answers
 * recorded from Cloudflare on 2026-10-07 (an apex RRset, the test suite's CNAME case,
 * a SERVFAIL, NODATA) plus a hand-written DNAME answer and an unparsable record.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { NameNotFoundError, ServerFailureError } from "../errors.js";
import { CLOUDFLARE } from "../resolvers.js";

import { findRelevantCaa } from "./relevant-set.js";

/** One answer record as the JSON API writes it, `type` being the IANA code. */
interface WireRecord {
	name: string;
	type: number;
	TTL: number;
	data: string;
}

/** The members of a JSON envelope a test scripts. */
interface Envelope {
	Status?: number;
	AD?: boolean;
	Answer?: WireRecord[];
	Authority?: WireRecord[];
	Comment?: string[];
}

/** A CAA record at `name` with presentation `data`, as the resolver writes it. */
function caa(name: string, data: string, ttl = 300): WireRecord {
	return { name, type: 257, TTL: ttl, data };
}

/** `cloudflare.com CAA`: eleven records, `AD: true`, an `iodef` and `issue` values with parameters. */
const CLOUDFLARE_COM: Envelope = {
	AD: true,
	Answer: [
		caa("cloudflare.com", '0 iodef "mailto:tls-abuse@cloudflare.com"'),
		caa("cloudflare.com", '0 issue "comodoca.com"'),
		caa("cloudflare.com", '0 issue "digicert.com; cansignhttpexchanges=yes"'),
		caa("cloudflare.com", '0 issue "letsencrypt.org"'),
		caa("cloudflare.com", '0 issue "pki.goog; cansignhttpexchanges=yes"'),
		caa("cloudflare.com", '0 issue "ssl.com"'),
		caa("cloudflare.com", '0 issuewild "comodoca.com"'),
		caa("cloudflare.com", '0 issuewild "digicert.com; cansignhttpexchanges=yes"'),
		caa("cloudflare.com", '0 issuewild "letsencrypt.org"'),
		caa("cloudflare.com", '0 issuewild "pki.goog; cansignhttpexchanges=yes"'),
		caa("cloudflare.com", '0 issuewild "ssl.com"'),
	],
};

/** `cname-deny.basic.caatestsuite.com CAA`: the alias, then the target's record under its owner. */
const CNAME_DENY: Envelope = {
	Answer: [
		{
			name: "cname-deny.basic.caatestsuite.com",
			type: 5,
			TTL: 60,
			data: "deny.basic.caatestsuite.com.",
		},
		caa("deny.basic.caatestsuite.com", '0 issue "caatestsuite.com"', 60),
	],
};

/** `dnssec-failed.org CAA`: SERVFAIL from a bogus DNSSEC chain, with Cloudflare's EDE comment. */
const DNSSEC_FAILED: Envelope = {
	Status: 2,
	Comment: ["EDE(9): DNSKEY Missing no SEP matching the DS found for dnssec-failed.org."],
};

/** `example.com CAA`: NODATA, the SOA in `Authority`, validated. */
const EXAMPLE_COM_NODATA: Envelope = {
	AD: true,
	Authority: [
		{
			name: "example.com",
			type: 6,
			TTL: 1800,
			data: "elliott.ns.cloudflare.com. dns.cloudflare.com. 2416374680 10000 2400 604800 1800",
		},
	],
};

/**
 * Serves `answers` by queried name at Cloudflare's endpoint and returns the names asked, in
 * order, with the URL of each request for assertions on the resolver and parameters.
 */
function scriptedResolver(answers: Record<string, Envelope>, url = CLOUDFLARE.url) {
	let queried: string[] = [];
	let requests: URL[] = [];
	let handler = http.get(url, ({ request }) => {
		let requestUrl = new URL(request.url);
		let name = requestUrl.searchParams.get("name") ?? "";
		queried.push(name);
		requests.push(requestUrl);
		let envelope = answers[name] ?? { Status: 3 };
		return HttpResponse.json({
			Status: 0,
			TC: false,
			RD: true,
			RA: true,
			AD: false,
			CD: false,
			Question: [{ name, type: 257 }],
			...envelope,
		});
	});
	return { handler, queried, requests };
}

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Installs a scripted resolver for one test and returns the names it is asked, in order. */
function answer(answers: Record<string, Envelope>) {
	let resolver = scriptedResolver(answers);
	server.use(resolver.handler);
	return resolver.queried;
}

describe("findRelevantCaa", () => {
	test("climbs past a missing name to the apex's RRset", async () => {
		let queried = answer({ "cloudflare.com": CLOUDFLARE_COM });

		let relevant = unwrap(await findRelevantCaa("shop.cloudflare.com"));

		expect(relevant.name).toBe("cloudflare.com");
		expect(relevant.records).toHaveLength(11);
		expect(relevant.records[1]).toEqual({
			name: "cloudflare.com",
			ttl: 300,
			type: "CAA",
			flags: 0,
			critical: false,
			tag: "issue",
			value: "comodoca.com",
		});
		expect(relevant.queried).toEqual(["shop.cloudflare.com", "cloudflare.com"]);
		expect(queried).toEqual(relevant.queried);
	});

	test("stops at the first name that publishes, with no further queries", async () => {
		let queried = answer({
			"shop.example.com": { Answer: [caa("shop.example.com", '0 issue "pki.goog"')] },
			"example.com": CLOUDFLARE_COM,
		});

		let relevant = unwrap(await findRelevantCaa("shop.example.com"));

		expect(relevant.name).toBe("shop.example.com");
		expect(relevant.records.map((record) => record.value)).toEqual(["pki.goog"]);
		expect(queried).toEqual(["shop.example.com"]);
	});

	test("climbs through NODATA and NXDOMAIN up to the TLD and finds nothing", async () => {
		let queried = answer({ "example.com": EXAMPLE_COM_NODATA, com: {} });

		let relevant = unwrap(await findRelevantCaa("a.example.com"));

		expect(relevant).toEqual({
			name: null,
			records: [],
			unparsed: [],
			chain: [],
			queried: ["a.example.com", "example.com", "com"],
			authenticated: false,
		});
		expect(queried).toEqual(["a.example.com", "example.com", "com"]);
	});

	test("computes a wildcard's set at its base name, folding case and the trailing dot", async () => {
		let queried = answer({ "cloudflare.com": CLOUDFLARE_COM });
		await findRelevantCaa("*.Shop.Cloudflare.COM.");
		expect(queried).toEqual(["shop.cloudflare.com", "cloudflare.com"]);
	});

	test("reports records reached through a CNAME as the target's, with the chain", async () => {
		let queried = answer({ "cname-deny.basic.caatestsuite.com": CNAME_DENY });

		let relevant = unwrap(await findRelevantCaa("cname-deny.basic.caatestsuite.com"));

		expect(relevant.name).toBe("cname-deny.basic.caatestsuite.com");
		expect(relevant.records).toEqual([
			{
				name: "deny.basic.caatestsuite.com",
				ttl: 60,
				type: "CAA",
				flags: 0,
				critical: false,
				tag: "issue",
				value: "caatestsuite.com",
			},
		]);
		expect(relevant.chain).toEqual([
			{
				name: "cname-deny.basic.caatestsuite.com",
				ttl: 60,
				type: "CNAME",
				target: "deny.basic.caatestsuite.com",
			},
		]);
		expect(queried).toHaveLength(1);
	});

	test("follows a DNAME's synthesized CNAME to the target's records", async () => {
		answer({
			"www.old.example": {
				Answer: [
					{ name: "old.example", type: 39, TTL: 300, data: "new.example." },
					{ name: "www.old.example", type: 5, TTL: 300, data: "www.new.example." },
					caa("www.new.example", '0 issue "letsencrypt.org"'),
				],
			},
		});

		let relevant = unwrap(await findRelevantCaa("www.old.example"));

		expect(relevant.name).toBe("www.old.example");
		expect(relevant.records[0]?.name).toBe("www.new.example");
		expect(relevant.chain.map((record) => record.target)).toEqual(["www.new.example"]);
	});

	test("continues at the alias's parent when the target publishes nothing", async () => {
		let queried = answer({
			"www.example.com": {
				Answer: [{ name: "www.example.com", type: 5, TTL: 300, data: "edge.hosting.net." }],
			},
			"example.com": { Answer: [caa("example.com", '0 issue "letsencrypt.org"')] },
		});

		let relevant = unwrap(await findRelevantCaa("www.example.com"));

		expect(relevant.name).toBe("example.com");
		expect(relevant.chain).toEqual([]);
		expect(queried).toEqual(["www.example.com", "example.com"]);
	});

	test("ends the climb on SERVFAIL with no further queries", async () => {
		let queried = answer({ "dnssec-failed.org": DNSSEC_FAILED });

		let result = await findRelevantCaa("shop.dnssec-failed.org");

		expect(isFailure(result) && result.error).toBeInstanceOf(ServerFailureError);
		expect(queried).toEqual(["shop.dnssec-failed.org", "dnssec-failed.org"]);
	});

	test("ends the climb on a transport failure", async () => {
		server.use(http.get(CLOUDFLARE.url, () => HttpResponse.error()));
		let result = await findRelevantCaa("example.com");
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).not.toBeInstanceOf(NameNotFoundError);
	});

	test("is authenticated only when every answer in the climb carried AD", async () => {
		answer({ "shop.cloudflare.com": { Status: 3, AD: true }, "cloudflare.com": CLOUDFLARE_COM });
		expect(unwrap(await findRelevantCaa("shop.cloudflare.com")).authenticated).toBe(true);

		answer({ "shop.cloudflare.com": { Status: 3 }, "cloudflare.com": CLOUDFLARE_COM });
		expect(unwrap(await findRelevantCaa("shop.cloudflare.com")).authenticated).toBe(false);

		answer({ "shop.cloudflare.com": { AD: false }, "cloudflare.com": CLOUDFLARE_COM });
		expect(unwrap(await findRelevantCaa("shop.cloudflare.com")).authenticated).toBe(false);
	});

	test("stops at a set holding only an unparsable record", async () => {
		let queried = answer({
			"bad.example.com": { Answer: [caa("bad.example.com", "garbage")] },
			"example.com": CLOUDFLARE_COM,
		});

		let relevant = unwrap(await findRelevantCaa("bad.example.com"));

		expect(relevant.name).toBe("bad.example.com");
		expect(relevant.records).toEqual([]);
		expect(relevant.unparsed).toEqual([
			{ name: "bad.example.com", ttl: 300, type: "CAA", data: "garbage" },
		]);
		expect(queried).toEqual(["bad.example.com"]);
	});
});
