/**
 * Tests for the SCRAPI client against a Transparency Service mocked with MSW, following the
 * exchanges draft-ietf-scitt-scrapi-11 shows: 201 and 202 registration, 204 polling, the
 * Concise Problem Details errors, and the key set and single key resources.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CBORValue } from "@sdxc/cbor";

import { createBackoff } from "@sdxc/backoff";
import { encode, Tagged } from "@sdxc/cbor";
import { Base64Url } from "@sdxc/crypto";
import { isFailure, unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { TransparencyService } from "./client.js";

/** The service every test talks to. */
const ORIGIN = "https://transparency.sdxc.dev";

/** Stand-in Receipt bytes; the client hands receipts back without reading them. */
const RECEIPT = Uint8Array.of(0xd2, 0x84, 0x40, 0xa0, 0xf6, 0x40);

/** Stand-in Signed Statement bytes. */
const STATEMENT = Uint8Array.of(0xd2, 0x84, 0x41, 0xa0, 0xa0, 0xf6, 0x40);

const SERVER = setupServer();

beforeAll(() => SERVER.listen({ onUnhandledRequest: "error" }));
afterEach(() => SERVER.resetHandlers());
afterAll(() => SERVER.close());

/** A Concise Problem Details response, as SCRAPI's error examples send them. */
function problem(
	status: number,
	title: CBORValue,
	detail: CBORValue,
	headers: Record<string, string> = {},
) {
	return new HttpResponse(
		unwrap(
			encode(
				new Map([
					[-1, title],
					[-2, detail],
				]),
			),
		),
		{ status, headers: { "content-type": "application/concise-problem-details+cbor", ...headers } },
	);
}

/** A client that polls without waiting, so polling tests run instantly. */
function client(maxAttempts = 5) {
	return new TransparencyService(ORIGIN, { maxAttempts, backoff: createBackoff({ base: 0 }) });
}

describe("register", () => {
	test("posts the statement as application/cose and returns a synchronous receipt", async () => {
		let seen: { contentType: string | null; accept: string | null; body: Uint8Array } | undefined;
		SERVER.use(
			http.post(`${ORIGIN}/entries`, async ({ request }) => {
				seen = {
					contentType: request.headers.get("content-type"),
					accept: request.headers.get("accept"),
					body: new Uint8Array(await request.arrayBuffer()),
				};
				return new HttpResponse(RECEIPT, {
					status: 201,
					headers: { location: `${ORIGIN}/entries/67ed`, "content-type": "application/cose" },
				});
			}),
		);

		let registration = unwrap(await client().register(STATEMENT));
		expect(seen?.contentType).toBe("application/cose");
		expect(seen?.accept).toContain("application/cose");
		expect(seen?.body).toEqual(STATEMENT);
		expect(registration.receipt).toEqual(RECEIPT);
		expect(registration.location.href).toBe(`${ORIGIN}/entries/67ed`);
	});

	test("returns the location and Retry-After of a running registration", async () => {
		SERVER.use(
			http.post(
				`${ORIGIN}/entries`,
				() =>
					new HttpResponse(null, {
						status: 202,
						headers: { location: "/entries/67ed", "retry-after": "3" },
					}),
			),
		);
		let registration = unwrap(await client().register(STATEMENT));
		expect(registration.receipt).toBeNull();
		expect(registration.location.href).toBe(`${ORIGIN}/entries/67ed`);
		expect(registration.retryAfter).toBe(3000);
	});

	test("reports the service's problem details", async () => {
		SERVER.use(
			http.post(`${ORIGIN}/entries`, () =>
				problem(
					400,
					"Bad Signature Algorithm",
					"Signed Statement contained a non-supported algorithm",
				),
			),
		);
		let result = await client().register(STATEMENT);
		expect(isFailure(result) && result.error).toMatchObject({
			code: "error-response",
			status: 400,
			title: "Bad Signature Algorithm",
			detail: "Signed Statement contained a non-supported algorithm",
		});
	});

	test("reads a language-tagged problem title", async () => {
		SERVER.use(
			http.post(`${ORIGIN}/entries`, () =>
				problem(400, new Tagged(38, ["en", "Rejected"]), "Not accepted by policy"),
			),
		);
		let result = await client().register(STATEMENT);
		expect(isFailure(result) && result.error.title).toBe("Rejected");
	});

	test("fails a registration response without a Location", async () => {
		SERVER.use(http.post(`${ORIGIN}/entries`, () => new HttpResponse(null, { status: 202 })));
		let result = await client().register(STATEMENT);
		expect(isFailure(result) && result.error.code).toBe("invalid-response");
	});
});

describe("submit", () => {
	test("polls a running registration until the receipt is ready", async () => {
		let polls = 0;
		SERVER.use(
			http.post(
				`${ORIGIN}/entries`,
				() =>
					new HttpResponse(null, {
						status: 202,
						headers: { location: `${ORIGIN}/entries/123`, "retry-after": "0" },
					}),
			),
			http.get(`${ORIGIN}/entries/123`, () => {
				polls++;
				if (polls < 3) {
					return new HttpResponse(null, {
						status: 204,
						headers: { "retry-after": "0", "cache-control": "no-store" },
					});
				}
				return new HttpResponse(RECEIPT, {
					status: 200,
					headers: { "content-type": "application/cose" },
				});
			}),
		);
		expect(unwrap(await client().submit(STATEMENT))).toEqual(RECEIPT);
		expect(polls).toBe(3);
	});

	test("waits out a 429 and keeps polling", async () => {
		let polls = 0;
		SERVER.use(
			http.get(`${ORIGIN}/entries/123`, () => {
				polls++;
				if (polls === 1)
					return problem(429, "Too Many Requests", "Only 1 request per second", {
						"retry-after": "0",
					});
				return new HttpResponse(RECEIPT, { status: 200 });
			}),
		);
		expect(unwrap(await client().waitForReceipt("123"))).toEqual(RECEIPT);
	});

	test("fails a registration the service reports as failed", async () => {
		SERVER.use(
			http.get(`${ORIGIN}/entries/123`, () =>
				problem(
					404,
					"Registration Failed",
					"Signed Statement with entry ID 123 could not be persisted to the log",
				),
			),
		);
		let result = await client().waitForReceipt("123");
		expect(isFailure(result) && result.error).toMatchObject({
			status: 404,
			title: "Registration Failed",
		});
	});

	test("gives up as pending after the last poll", async () => {
		SERVER.use(http.get(`${ORIGIN}/entries/123`, () => new HttpResponse(null, { status: 204 })));
		let result = await client(3).waitForReceipt("123");
		expect(isFailure(result) && result.error.code).toBe("pending");
	});

	test("stops polling when aborted", async () => {
		let controller = new AbortController();
		SERVER.use(
			http.get(
				`${ORIGIN}/entries/123`,
				() => new HttpResponse(null, { status: 204, headers: { "retry-after": "60" } }),
			),
		);
		let waiting = client().waitForReceipt("123", { signal: controller.signal, retryAfter: 60_000 });
		controller.abort();
		let result = await waiting;
		expect(isFailure(result) && result.error.code).toBe("network-error");
	});
});

describe("keys", () => {
	test("reads the COSE Key Set at /.well-known/scitt-keys", async () => {
		let accept: string | null = null;
		let set = [
			new Map<CBORValue, CBORValue>([
				[1, 2],
				[2, new TextEncoder().encode("kid1")],
				[-1, 1],
			]),
		];
		SERVER.use(
			http.get(`${ORIGIN}/.well-known/scitt-keys`, ({ request }) => {
				accept = request.headers.get("accept");
				return new HttpResponse(unwrap(encode(set)), {
					headers: { "content-type": "application/cbor" },
				});
			}),
		);
		let keys = unwrap(await new TransparencyService(`${ORIGIN}/scitt/`).keys());
		expect(accept).toBe("application/cbor");
		expect(keys).toEqual(set);
	});

	test("resolves one key by the base64url form of its kid", async () => {
		let kid = Uint8Array.of(0xfb, 0xff, 0x00);
		SERVER.use(
			http.get(`${ORIGIN}/.well-known/scitt-keys/:kid`, ({ params }) => {
				if (params.kid !== Base64Url.encode(kid))
					return problem(404, "No such key", "No key could be found for this kid value");
				return new HttpResponse(unwrap(encode(new Map([[1, 2]]))));
			}),
		);
		expect(unwrap(await client().key(kid)).get(1)).toBe(2);
		let missing = await client().key("other");
		expect(isFailure(missing) && missing.error).toMatchObject({
			status: 404,
			title: "No such key",
		});
	});

	test("fails a key set that is not an array of maps", async () => {
		SERVER.use(
			http.get(`${ORIGIN}/.well-known/scitt-keys`, () => new HttpResponse(unwrap(encode("keys")))),
		);
		let result = await client().keys();
		expect(isFailure(result) && result.error.code).toBe("invalid-response");
	});
});
