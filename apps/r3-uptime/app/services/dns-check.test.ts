/**
 * Unit tests for DNS-check resolution and status classification. Mocks the global
 * `fetch` used to hit Cloudflare's DNS-over-HTTPS endpoint so every status branch
 * (ok, changed, error) is exercised deterministically, without a real DNS lookup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { afterEach, describe, expect, mock, test } from "bun:test";

import { checkDns, getDnsStatusText, resolveDns } from "~/app/services/dns-check";

let originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

/** Builds a fake `fetch` returning a DoH JSON response with the given body. */
function mockDohResponse(body: unknown, init: ResponseInit = {}) {
	globalThis.fetch = mock(
		async () => new Response(JSON.stringify(body), init),
	) as unknown as typeof fetch;
}

describe("resolveDns", () => {
	test("returns the resolved A record values and a response time", async () => {
		mockDohResponse({
			Status: 0,
			Answer: [{ name: "example.com", type: 1, TTL: 300, data: "1.2.3.4" }],
		});

		let result = await resolveDns("example.com", "A");

		expect(result.values).toEqual(["1.2.3.4"]);
		expect(typeof result.responseTimeMs).toBe("number");
		expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
	});

	test("filters out answers that don't match the requested record type code", async () => {
		mockDohResponse({
			Status: 0,
			Answer: [
				{ name: "example.com", type: 5, TTL: 300, data: "cname.example.com" },
				{ name: "example.com", type: 1, TTL: 300, data: "5.6.7.8" },
			],
		});

		let result = await resolveDns("example.com", "A");

		expect(result.values).toEqual(["5.6.7.8"]);
	});

	test("strips surrounding quotes from TXT record data", async () => {
		mockDohResponse({
			Status: 0,
			Answer: [{ name: "example.com", type: 16, TTL: 300, data: '"v=spf1 -all"' }],
		});

		let result = await resolveDns("example.com", "TXT");

		expect(result.values).toEqual(["v=spf1 -all"]);
	});

	test("returns an empty list when there is no Answer section", async () => {
		mockDohResponse({ Status: 0 });

		let result = await resolveDns("example.com", "A");

		expect(result.values).toEqual([]);
	});

	test("throws when the HTTP response is not ok", async () => {
		mockDohResponse({}, { status: 500 });

		await expect(resolveDns("example.com", "A")).rejects.toThrow(
			"DNS query failed with status 500",
		);
	});

	test("throws when the DNS query returns a non-zero Status", async () => {
		mockDohResponse({ Status: 2 });

		await expect(resolveDns("example.com", "A")).rejects.toThrow(
			"DNS query returned status code 2",
		);
	});
});

describe("checkDns", () => {
	test("is ok when the resolved value matches the configured expected value", async () => {
		mockDohResponse({
			Status: 0,
			Answer: [{ name: "example.com", type: 1, TTL: 300, data: "1.2.3.4" }],
		});

		let result = await checkDns("example.com", "A", "1.2.3.4", null);

		expect(result.status).toBe("ok");
		expect(result.resolvedValue).toBe("1.2.3.4");
		expect(result.errorMessage).toBeUndefined();
	});

	test("normalizes and sorts multi-value expected values before comparing", async () => {
		mockDohResponse({
			Status: 0,
			Answer: [
				{ name: "example.com", type: 1, TTL: 300, data: "2.2.2.2" },
				{ name: "example.com", type: 1, TTL: 300, data: "1.1.1.1" },
			],
		});

		let result = await checkDns("example.com", "A", " 1.1.1.1 , 2.2.2.2 ", null);

		expect(result.status).toBe("ok");
		expect(result.resolvedValue).toBe("1.1.1.1, 2.2.2.2");
	});

	test("is changed when the resolved value differs from the expected value", async () => {
		mockDohResponse({
			Status: 0,
			Answer: [{ name: "example.com", type: 1, TTL: 300, data: "9.9.9.9" }],
		});

		let result = await checkDns("example.com", "A", "1.2.3.4", null);

		expect(result.status).toBe("changed");
		expect(result.resolvedValue).toBe("9.9.9.9");
	});

	test("is changed against the previous value when no expected value is configured", async () => {
		mockDohResponse({
			Status: 0,
			Answer: [{ name: "example.com", type: 1, TTL: 300, data: "9.9.9.9" }],
		});

		let result = await checkDns("example.com", "A", null, "1.2.3.4");

		expect(result.status).toBe("changed");
	});

	test("is ok when the resolved value matches the previous value", async () => {
		mockDohResponse({
			Status: 0,
			Answer: [{ name: "example.com", type: 1, TTL: 300, data: "1.2.3.4" }],
		});

		let result = await checkDns("example.com", "A", null, "1.2.3.4");

		expect(result.status).toBe("ok");
	});

	test("is ok on the first check ever, with no expected or previous value", async () => {
		mockDohResponse({
			Status: 0,
			Answer: [{ name: "example.com", type: 1, TTL: 300, data: "1.2.3.4" }],
		});

		let result = await checkDns("example.com", "A", null, null);

		expect(result.status).toBe("ok");
		expect(result.resolvedValue).toBe("1.2.3.4");
	});

	test("is error, not a throw, when the DNS query returns a non-zero Status", async () => {
		mockDohResponse({ Status: 2 });

		let result = await checkDns("example.com", "A", null, null);

		expect(result.status).toBe("error");
		expect(result.resolvedValue).toBeNull();
		expect(result.responseTimeMs).toBe(0);
		expect(result.errorMessage).toBe("DNS query returned status code 2");
	});

	test("is error, not a throw, when the HTTP request fails", async () => {
		mockDohResponse({}, { status: 502 });

		let result = await checkDns("example.com", "A", null, null);

		expect(result.status).toBe("error");
		expect(result.errorMessage).toBe("DNS query failed with status 502");
	});
});

describe("getDnsStatusText", () => {
	test("maps each status onto a human-readable label", () => {
		expect(getDnsStatusText("ok")).toBe("OK");
		expect(getDnsStatusText("changed")).toBe("Changed");
		expect(getDnsStatusText("error")).toBe("Error");
		expect(getDnsStatusText(null)).toBe("Not checked");
	});
});
