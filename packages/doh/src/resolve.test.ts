/**
 * Exercises `resolve` against recorded DoH JSON answers served through MSW: typed records,
 * the CNAME chain, NODATA versus NXDOMAIN, every failure class, and the query it sends.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, expectTypeOf, test } from "vitest";

import type { DoH } from "./types.js";

import {
	DoHError,
	NameNotFoundError,
	ResponseCodeError,
	ServerFailureError,
	TransportError,
} from "./errors.js";
import { resolve } from "./resolve.js";
import { CLOUDFLARE, GOOGLE } from "./resolvers.js";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** One answer record as the JSON API writes it, `type` being the IANA code. */
interface WireRecord {
	name: string;
	type: number;
	TTL: number;
	data: string;
}

/** The JSON envelope Cloudflare and Google answer with, defaulting to a NOERROR reply. */
function envelope(
	name: string,
	type: number,
	fields: {
		Status?: number;
		TC?: boolean;
		AD?: boolean;
		Answer?: WireRecord[];
		Authority?: WireRecord[];
	} = {},
) {
	return {
		Status: 0,
		TC: false,
		RD: true,
		RA: true,
		AD: false,
		CD: false,
		Question: [{ name, type }],
		...fields,
	};
}

/** Answers every query at the Cloudflare endpoint with `body`, recording the requests it saw. */
function answerWith(body: Record<string, unknown>, init?: ResponseInit) {
	let requests: Request[] = [];
	server.use(
		http.get(CLOUDFLARE.url, ({ request }) => {
			requests.push(request);
			return HttpResponse.json(body, init);
		}),
	);
	return requests;
}

describe("resolve", () => {
	test("returns typed A records with the smallest TTL", async () => {
		answerWith(
			envelope("sergiodxa.com", 1, {
				Answer: [
					{ name: "sergiodxa.com.", type: 1, TTL: 300, data: "104.21.58.249" },
					{ name: "sergiodxa.com.", type: 1, TTL: 120, data: "172.67.157.214" },
				],
			}),
		);

		let answer = unwrap(await resolve("sergiodxa.com", "A"));

		expect(answer.name).toBe("sergiodxa.com");
		expect(answer.type).toBe("A");
		expect(answer.records).toEqual([
			{ name: "sergiodxa.com", ttl: 300, type: "A", address: "104.21.58.249" },
			{ name: "sergiodxa.com", ttl: 120, type: "A", address: "172.67.157.214" },
		]);
		expect(answer.ttl).toBe(120);
		expect(answer.chain).toEqual([]);
		expect(answer.unparsed).toEqual([]);
		expect(answer.authenticated).toBe(false);
		expect(answer.truncated).toBe(false);
		expect(answer.durationMs).toBeGreaterThanOrEqual(0);
		expectTypeOf(answer.records).toEqualTypeOf<DoH.ARecord[]>();
	});

	test("sends the name, type and flags the caller asked for", async () => {
		let requests = answerWith(envelope("example.com", 15));

		await resolve("Example.com.", "MX", { dnssec: true, checkingDisabled: true });

		let url = new URL(requests[0]?.url ?? "");
		expect(url.origin + url.pathname).toBe(CLOUDFLARE.url);
		expect(url.searchParams.get("name")).toBe("Example.com.");
		expect(url.searchParams.get("type")).toBe("MX");
		expect(url.searchParams.get("do")).toBe("1");
		expect(url.searchParams.get("cd")).toBe("1");
		expect(requests[0]?.headers.get("accept")).toBe("application/dns-json");
	});

	test("queries a custom resolver, such as Google", async () => {
		server.use(http.get(GOOGLE.url, () => HttpResponse.json(envelope("example.com", 1))));
		expect(isSuccess(await resolve("example.com", "A", { resolver: GOOGLE }))).toBe(true);
	});

	test("reads a multi-string DKIM TXT as one text", async () => {
		answerWith(
			envelope("google._domainkey.example.com", 16, {
				Answer: [
					{
						name: "google._domainkey.example.com.",
						type: 16,
						TTL: 3600,
						data: '"v=DKIM1; k=rsa; p=MIIBIjANBgkq" "hkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA"',
					},
				],
			}),
		);

		let answer = unwrap(await resolve("google._domainkey.example.com", "TXT"));

		expect(answer.records[0]?.text).toBe(
			"v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA",
		);
		expect(answer.records[0]?.strings).toHaveLength(2);
	});

	test("splits the CNAME chain from the records of the asked type", async () => {
		answerWith(
			envelope("www.example.com", 1, {
				Answer: [
					{ name: "www.example.com.", type: 5, TTL: 300, data: "edge.example.net." },
					{ name: "edge.example.net.", type: 5, TTL: 60, data: "Edge-1.CDN.example." },
					{ name: "edge-1.cdn.example.", type: 1, TTL: 20, data: "192.0.2.1" },
				],
			}),
		);

		let answer = unwrap(await resolve("www.example.com", "A"));

		expect(answer.chain).toEqual([
			{ name: "www.example.com", ttl: 300, type: "CNAME", target: "edge.example.net" },
			{ name: "edge.example.net", ttl: 60, type: "CNAME", target: "edge-1.cdn.example" },
		]);
		expect(answer.records).toEqual([
			{ name: "edge-1.cdn.example", ttl: 20, type: "A", address: "192.0.2.1" },
		]);
	});

	test("returns CNAME records themselves when CNAME is the asked type", async () => {
		answerWith(
			envelope("www.example.com", 5, {
				Answer: [{ name: "www.example.com.", type: 5, TTL: 300, data: "edge.example.net." }],
			}),
		);

		let answer = unwrap(await resolve("www.example.com", "CNAME"));

		expect(answer.records).toEqual([
			{ name: "www.example.com", ttl: 300, type: "CNAME", target: "edge.example.net" },
		]);
		expect(answer.chain).toEqual([]);
	});

	test("drops records of other types, such as RRSIG with DNSSEC on", async () => {
		answerWith(
			envelope("example.com", 1, {
				AD: true,
				Answer: [
					{ name: "example.com.", type: 1, TTL: 300, data: "192.0.2.1" },
					{
						name: "example.com.",
						type: 46,
						TTL: 300,
						data: "A 13 2 300 20260101000000 20250101000000 1 example.com. abc=",
					},
				],
			}),
		);

		let answer = unwrap(await resolve("example.com", "A", { dnssec: true }));

		expect(answer.records).toHaveLength(1);
		expect(answer.authenticated).toBe(true);
	});

	test("reports NODATA as a success with no records and a null TTL", async () => {
		answerWith(
			envelope("example.com", 28, {
				Authority: [
					{
						name: "example.com.",
						type: 6,
						TTL: 1800,
						data: "ns.example.com. hostmaster.example.com. 1 7200 3600 1209600 300",
					},
				],
			}),
		);

		let answer = unwrap(await resolve("example.com", "AAAA"));

		expect(answer.records).toEqual([]);
		expect(answer.ttl).toBeNull();
	});

	test("keeps a record that fails to parse in unparsed with its raw data", async () => {
		answerWith(
			envelope("example.com", 15, {
				Answer: [
					{ name: "example.com.", type: 15, TTL: 300, data: "10 mx.example.com." },
					{ name: "example.com.", type: 15, TTL: 100, data: "garbage" },
				],
			}),
		);

		let answer = unwrap(await resolve("example.com", "MX"));

		expect(answer.records).toHaveLength(1);
		expect(answer.unparsed).toEqual([
			{ name: "example.com", ttl: 100, type: "MX", data: "garbage" },
		]);
		expect(answer.ttl).toBe(100);
	});

	test("returns an unknown type's records with raw data", async () => {
		answerWith(
			envelope("example.com", 65, {
				Answer: [{ name: "example.com.", type: 65, TTL: 300, data: '1 . alpn="h3,h2"' }],
			}),
		);

		let answer = unwrap(await resolve("example.com", "HTTPS"));

		expect(answer.records).toEqual([
			{ name: "example.com", ttl: 300, type: "HTTPS", data: '1 . alpn="h3,h2"' },
		]);
	});

	test("reports the TC flag", async () => {
		answerWith(envelope("example.com", 16, { TC: true }));
		expect(unwrap(await resolve("example.com", "TXT")).truncated).toBe(true);
	});

	test("fails NXDOMAIN with the negative TTL from the SOA", async () => {
		answerWith(
			envelope("nope.example.com", 1, {
				Status: 3,
				Authority: [
					{
						name: "example.com.",
						type: 6,
						TTL: 1800,
						data: "ns.example.com. hostmaster.example.com. 1 7200 3600 1209600 300",
					},
				],
			}),
		);

		let result = await resolve("nope.example.com", "A");

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error).toBeInstanceOf(NameNotFoundError);
		expect(result.error).toBeInstanceOf(DoHError);
		expect((result.error as NameNotFoundError).ttl).toBe(300);
	});

	test("fails NXDOMAIN with a null TTL when there is no SOA", async () => {
		answerWith(envelope("nope.example.com", 1, { Status: 3 }));
		let result = await resolve("nope.example.com", "A");
		expect(
			isFailure(result) && result.error instanceof NameNotFoundError && result.error.ttl,
		).toBeNull();
	});

	test("fails SERVFAIL as a server failure", async () => {
		answerWith(envelope("broken.example.com", 1, { Status: 2 }));
		let result = await resolve("broken.example.com", "A");
		expect(isFailure(result) && result.error).toBeInstanceOf(ServerFailureError);
	});

	test("fails any other RCODE with the code", async () => {
		answerWith(envelope("example.com", 1, { Status: 5 }));
		let result = await resolve("example.com", "A");

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error).toBeInstanceOf(ResponseCodeError);
		expect((result.error as ResponseCodeError).rcode).toBe(5);
	});

	test("fails a non-2xx response as a transport error with its status", async () => {
		answerWith({ error: "bad" }, { status: 503 });
		let result = await resolve("example.com", "A");

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error).toBeInstanceOf(TransportError);
		expect((result.error as TransportError).status).toBe(503);
	});

	test("fails a body that is not the envelope", async () => {
		answerWith({ hello: "world" });
		let result = await resolve("example.com", "A");
		expect(isFailure(result) && result.error).toBeInstanceOf(TransportError);
	});

	test("fails a body that is not JSON", async () => {
		server.use(http.get(CLOUDFLARE.url, () => new HttpResponse("<html>", { status: 200 })));
		let result = await resolve("example.com", "A");
		expect(isFailure(result) && result.error).toBeInstanceOf(TransportError);
	});

	test("fails a network error with a null status", async () => {
		server.use(http.get(CLOUDFLARE.url, () => HttpResponse.error()));
		let result = await resolve("example.com", "A");

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error).toBeInstanceOf(TransportError);
		expect((result.error as TransportError).status).toBeNull();
	});

	test("fails when the resolver outlasts the timeout", async () => {
		server.use(
			http.get(CLOUDFLARE.url, async () => {
				await new Promise((settle) => setTimeout(settle, 200));
				return HttpResponse.json(envelope("example.com", 1));
			}),
		);

		let result = await resolve("example.com", "A", { timeoutMs: 20 });

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.message).toContain("timed out");
	});

	test("fails when the caller aborts", async () => {
		answerWith(envelope("example.com", 1));
		let result = await resolve("example.com", "A", { signal: AbortSignal.abort() });
		expect(isFailure(result) && result.error).toBeInstanceOf(TransportError);
	});
});
