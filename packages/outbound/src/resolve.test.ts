/**
 * Exercises `resolveHost` against DoH JSON answers served through MSW: a literal
 * answering itself, public and private records, a name with none, NXDOMAIN, a failing
 * resolver, and a record the resolver answered in a form no address parses from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { resolveHost } from "./resolve.js";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Answers every lookup with `status` and the `A` and `AAAA` data given. */
function answering(status: number, records: { A?: string[]; AAAA?: string[] } = {}) {
	server.use(
		http.get("https://cloudflare-dns.com/dns-query", ({ request }) => {
			let url = new URL(request.url);
			let name = url.searchParams.get("name");
			let asksA = url.searchParams.get("type") === "A";
			let data = (asksA ? records.A : records.AAAA) ?? [];
			return HttpResponse.json({
				Status: status,
				Answer: data.map((value) => ({ name, type: asksA ? 1 : 28, TTL: 60, data: value })),
			});
		}),
	);
}

describe("resolveHost", () => {
	test("answers a literal with itself, without a lookup", async () => {
		let result = await resolveHost(new URL("http://[2606:4700::1111]/"));
		expect(isSuccess(result) && result.data).toEqual(["2606:4700::1111"]);
	});

	test("answers every address of a name that resolves only to public ones", async () => {
		answering(0, { A: ["93.184.216.34"], AAAA: ["2606:2800:220:1:248:1893:25c8:1946"] });

		let result = await resolveHost(new URL("https://example.com/"));

		expect(isSuccess(result) && result.data).toEqual([
			"93.184.216.34",
			"2606:2800:220:1:248:1893:25c8:1946",
		]);
	});

	test("refuses a name with any address that is not public", async () => {
		answering(0, { A: ["93.184.216.34", "127.0.0.1"] });

		let result = await resolveHost(new URL("https://example.com/"));

		expect(isFailure(result) && result.error.code).toBe("refused-address");
		expect(isFailure(result) && result.error.retryable).toBe(false);
	});

	test("refuses a name the resolver answered with an unreadable address", async () => {
		answering(0, { A: ["not-an-address"] });

		let result = await resolveHost(new URL("https://example.com/"));

		expect(isFailure(result) && result.error.code).toBe("refused-address");
	});

	test("refuses a name with no address", async () => {
		answering(0);

		let result = await resolveHost(new URL("https://example.com/"));

		expect(isFailure(result) && result.error.code).toBe("refused-host");
	});

	test("refuses a name that does not exist", async () => {
		answering(3);

		let result = await resolveHost(new URL("https://missing.example.com/"));

		expect(isFailure(result) && result.error.code).toBe("refused-host");
	});

	test("reports a failing resolver as a retryable network failure", async () => {
		answering(2);

		let result = await resolveHost(new URL("https://example.com/"));

		expect(isFailure(result) && result.error.code).toBe("network");
		expect(isFailure(result) && result.error.retryable).toBe(true);
	});
});
