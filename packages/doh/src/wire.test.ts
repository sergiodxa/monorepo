/**
 * Exercises `resolve` against RFC 8484 wire-format answers served through MSW: the query
 * message it sends, compressed names in owners and RDATA, typed records from RFC example
 * data, RFC 8914 extended errors, extended RCODEs, and responses that are not DNS messages.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import {
	AnsweredError,
	NameNotFoundError,
	ResponseCodeError,
	ServerFailureError,
	TransportError,
} from "./errors.js";
import { resolve } from "./resolve.js";
import { CLOUDFLARE_WIRE } from "./resolvers.js";
import { decodeResponse, encodeQuery } from "./wire.js";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** A pointer to the question's name, which sits right after the 12-octet header. */
const QUESTION_NAME = [0xc0, 0x0c];

/** QR, RD and RA, the flags of an ordinary recursive answer. */
const ANSWER_FLAGS = 0x8180;

/** One resource record: its owner as wire octets (labels or a pointer), type, TTL and RDATA. */
interface ResourceRecord {
	owner: number[];
	type: number;
	ttl: number;
	rdata: number[];
}

/** A name as uncompressed wire octets. */
function wireName(name: string): number[] {
	let labels = name === "" ? [] : name.split(".");
	return [...labels.flatMap((label) => [label.length, ...new TextEncoder().encode(label)]), 0];
}

/** Hex as octets, whitespace ignored. */
function hex(text: string): number[] {
	return (text.replace(/\s+/g, "").match(/../g) ?? []).map((pair) => Number.parseInt(pair, 16));
}

/** A 16-bit big-endian integer as octets. */
function u16(value: number): number[] {
	return [value >> 8, value & 0xff];
}

/** One record in wire form. */
function record({ owner, type, ttl, rdata }: ResourceRecord): number[] {
	return [
		...owner,
		...u16(type),
		...u16(1),
		...u16(ttl >>> 16),
		...u16(ttl & 0xffff),
		...u16(rdata.length),
		...rdata,
	];
}

/** An OPT record carrying an extended RCODE and RFC 8914 extended errors. */
function opt(extendedRcode: number, errors: [number, string][] = []): ResourceRecord {
	let rdata = errors.flatMap(([code, text]) => {
		let octets = [...u16(code), ...new TextEncoder().encode(text)];
		return [...u16(15), ...u16(octets.length), ...octets];
	});
	return { owner: [0], type: 41, ttl: extendedRcode * 2 ** 24, rdata };
}

/** A response to one question about `name`, with the given flags and sections. */
function response(
	name: string,
	type: number,
	sections: {
		flags?: number;
		answer?: ResourceRecord[];
		authority?: ResourceRecord[];
		additional?: ResourceRecord[];
	} = {},
): Uint8Array {
	let { flags = ANSWER_FLAGS, answer = [], authority = [], additional = [] } = sections;
	return Uint8Array.from([
		...u16(0),
		...u16(flags),
		...u16(1),
		...u16(answer.length),
		...u16(authority.length),
		...u16(additional.length),
		...wireName(name),
		...u16(type),
		...u16(1),
		...[...answer, ...authority, ...additional].flatMap(record),
	]);
}

/** Answers every wire query with `body`, recording the requests it saw. */
function answerWith(body: Uint8Array, init: ResponseInit = {}) {
	let requests: Request[] = [];
	server.use(
		http.get(CLOUDFLARE_WIRE.url, ({ request }) => {
			requests.push(request);
			return new HttpResponse(body.slice().buffer, {
				...init,
				headers: { "Content-Type": "application/dns-message" },
			});
		}),
	);
	return requests;
}

/** The query message a request carried in its `dns` parameter. */
function sentQuery(request: Request | undefined): number[] {
	let param = new URL(request?.url ?? "http://x").searchParams.get("dns") ?? "";
	let base64 = param.replace(/-/g, "+").replace(/_/g, "/");
	return Array.from(atob(base64), (char) => char.charCodeAt(0));
}

describe("resolve over RFC 8484 wire format", () => {
	test("sends one GET with the query message in base64url and asks for dns-message", async () => {
		let requests = answerWith(response("example.com", 1));

		await resolve("Example.com.", "A", {
			resolver: CLOUDFLARE_WIRE,
			dnssec: true,
			checkingDisabled: true,
		});

		expect(requests[0]?.headers.get("Accept")).toBe("application/dns-message");
		expect(new URL(requests[0]?.url ?? "").searchParams.get("dns")).not.toMatch(/[+/=]/);
		expect(sentQuery(requests[0])).toEqual([
			...hex("0000 0130 0001 0000 0000 0001"),
			...wireName("Example.com"),
			...hex("0001 0001"),
			...hex("00 0029 04d0 00 00 8000 0000"),
		]);
	});

	test("reads typed records under a compressed owner, with the AD and TC flags", async () => {
		answerWith(
			response("example.com", 1, {
				flags: ANSWER_FLAGS | 0x0020 | 0x0200,
				answer: [
					{ owner: QUESTION_NAME, type: 1, ttl: 300, rdata: [192, 0, 2, 1] },
					{ owner: QUESTION_NAME, type: 1, ttl: 60, rdata: [192, 0, 2, 2] },
				],
			}),
		);

		let answer = unwrap(await resolve("example.com", "A", { resolver: CLOUDFLARE_WIRE }));

		expect(answer.records).toEqual([
			{ name: "example.com", ttl: 300, type: "A", address: "192.0.2.1" },
			{ name: "example.com", ttl: 60, type: "A", address: "192.0.2.2" },
		]);
		expect(answer).toMatchObject({ ttl: 60, authenticated: true, truncated: true });
		expect(answer.extendedErrors).toEqual([]);
	});

	test("expands compressed names inside MX and CNAME data", async () => {
		answerWith(
			response("www.example.com", 15, {
				answer: [
					{ owner: QUESTION_NAME, type: 5, ttl: 300, rdata: [0xc0, 0x10] },
					{
						owner: [0xc0, 0x10],
						type: 15,
						ttl: 300,
						rdata: [0, 10, 4, ...new TextEncoder().encode("MAIL"), 0xc0, 0x10],
					},
				],
			}),
		);

		let answer = unwrap(await resolve("www.example.com", "MX", { resolver: CLOUDFLARE_WIRE }));

		expect(answer.chain).toEqual([
			{ name: "www.example.com", ttl: 300, type: "CNAME", target: "example.com" },
		]);
		expect(answer.records).toEqual([
			{ name: "example.com", ttl: 300, type: "MX", preference: 10, exchange: "mail.example.com" },
		]);
	});

	test("reads the RFC 9460 HTTPS and RFC 4034 DS examples from their RDATA", async () => {
		answerWith(
			response("example.com", 65, {
				answer: [
					{
						owner: QUESTION_NAME,
						type: 65,
						ttl: 300,
						rdata: hex(
							"0010 03666f6f076578616d706c65036f726700 0000 0004 0001 0004 0001 0009 02 6832 05 68332d3139 0004 0004 c0000201",
						),
					},
				],
			}),
		);
		expect(
			unwrap(await resolve("example.com", "HTTPS", { resolver: CLOUDFLARE_WIRE })).records,
		).toEqual([
			{
				name: "example.com",
				ttl: 300,
				type: "HTTPS",
				priority: 16,
				target: "foo.example.org",
				params: { mandatory: ["alpn", "ipv4hint"], alpn: ["h2", "h3-19"], ipv4Hint: ["192.0.2.1"] },
			},
		]);

		answerWith(
			response("dskey.example.com", 43, {
				flags: ANSWER_FLAGS | 0x0020,
				answer: [
					{
						owner: QUESTION_NAME,
						type: 43,
						ttl: 86400,
						rdata: hex("ec45 05 01 2BB183AF5F22588179A53B0A98631FAD1A292118"),
					},
				],
			}),
		);
		let ds = unwrap(await resolve("dskey.example.com", "DS", { resolver: CLOUDFLARE_WIRE }));
		expect(ds.authenticated).toBe(true);
		expect(ds.records).toEqual([
			{
				name: "dskey.example.com",
				ttl: 86400,
				type: "DS",
				keyTag: 60485,
				algorithm: 5,
				digestType: 1,
				digest: "2bb183af5f22588179a53b0a98631fad1a292118",
			},
		]);
	});

	test("fails SERVFAIL with the RFC 8914 extended error the resolver gave", async () => {
		answerWith(
			response("dnssec-failed.org", 1, {
				flags: ANSWER_FLAGS | 2,
				additional: [opt(0, [[6, "DNSSEC Bogus"]])],
			}),
		);

		let result = await resolve("dnssec-failed.org", "A", { resolver: CLOUDFLARE_WIRE });

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error).toBeInstanceOf(ServerFailureError);
		expect(result.error).toBeInstanceOf(AnsweredError);
		expect((result.error as ServerFailureError).extendedErrors).toEqual([
			{ code: 6, text: "DNSSEC Bogus" },
		]);
		expect(result.error.message).toContain("extended error 6: DNSSEC Bogus");
	});

	test("reports extended errors beside a successful answer", async () => {
		answerWith(
			response("example.com", 1, {
				answer: [{ owner: QUESTION_NAME, type: 1, ttl: 30, rdata: [192, 0, 2, 1] }],
				additional: [opt(0, [[3, ""]])],
			}),
		);
		let answer = unwrap(await resolve("example.com", "A", { resolver: CLOUDFLARE_WIRE }));
		expect(answer.extendedErrors).toEqual([{ code: 3, text: null }]);
	});

	test("fails NXDOMAIN with the negative TTL from a compressed SOA", async () => {
		answerWith(
			response("nope.example.com", 1, {
				flags: ANSWER_FLAGS | 0x0020 | 3,
				authority: [
					{
						owner: [0xc0, 0x11],
						type: 6,
						ttl: 1800,
						rdata: [
							2,
							...new TextEncoder().encode("ns"),
							0xc0,
							0x11,
							10,
							...new TextEncoder().encode("hostmaster"),
							0xc0,
							0x11,
							...hex("00000001 00001c20 00000e10 00127500 0000012c"),
						],
					},
				],
			}),
		);

		let result = await resolve("nope.example.com", "A", { resolver: CLOUDFLARE_WIRE });

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error).toBeInstanceOf(NameNotFoundError);
		expect(result.error).toMatchObject({ ttl: 300, authenticated: true, extendedErrors: [] });
	});

	test("reads an extended RCODE from the OPT record", async () => {
		answerWith(response("example.com", 1, { additional: [opt(1)] }));
		let result = await resolve("example.com", "A", { resolver: CLOUDFLARE_WIRE });
		expect(isFailure(result) && result.error).toBeInstanceOf(ResponseCodeError);
		if (isFailure(result)) expect((result.error as ResponseCodeError).rcode).toBe(16);
	});

	test.each([
		["a truncated body", response("example.com", 1).slice(0, 20)],
		["a query instead of a response", response("example.com", 1, { flags: 0x0100 })],
		[
			"a compression loop",
			response("example.com", 1, {
				answer: [{ owner: [0xc0, 0x1d], type: 1, ttl: 1, rdata: [192, 0, 2, 1] }],
			}),
		],
		[
			"an RDATA length the MX data overruns",
			response("example.com", 15, {
				answer: [{ owner: QUESTION_NAME, type: 15, ttl: 1, rdata: [0, 10, 0, 0] }],
			}),
		],
	])("fails %s as a transport error", async (_, body) => {
		answerWith(body);
		let result = await resolve("example.com", "A", { resolver: CLOUDFLARE_WIRE });
		expect(isFailure(result) && result.error).toBeInstanceOf(TransportError);
	});

	test("fails a name that does not fit a question before sending it", async () => {
		let result = await resolve(`${"a".repeat(64)}.example.com`, "A", {
			resolver: CLOUDFLARE_WIRE,
		});
		expect(isFailure(result) && result.error).toBeInstanceOf(TransportError);
	});
});

describe("encodeQuery and decodeResponse", () => {
	test("encode a type without a mnemonic by its number", () => {
		let query = encodeQuery({
			name: "example.com",
			type: "TYPE65280",
			dnssec: false,
			checkingDisabled: false,
		});
		expect(Array.from(query ?? []).slice(25, 27)).toEqual([0xff, 0x00]);
	});

	test("decode a record of an untyped type as RFC 3597 generic data", () => {
		let message = decodeResponse(
			response("example.com", 44, {
				answer: [{ owner: QUESTION_NAME, type: 44, ttl: 5, rdata: [4, 2, 0xab] }],
			}),
		);
		expect(message?.answer).toEqual([
			{ name: "example.com", type: 44, ttl: 5, data: "\\# 3 0402ab" },
		]);
	});
});
