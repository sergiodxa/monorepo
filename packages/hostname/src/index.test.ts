/**
 * Covers the unified Cloudflare for SaaS custom-hostname client: request/response
 * schema validation and error mapping to {@link HostnameApiError}, the configurable
 * `custom_metadata` key (so `tenant_id` and `blog_id` semantics both round-trip),
 * result normalization for both the flat and nested consumer shapes, entity
 * filtering with pagination, and the static status helpers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { afterEach, describe, expect, mock, test } from "bun:test";

import type { HostnameResult } from "./index";

import { HostnameApiError, HostnameClient } from "./index";

/** Builds a client with predictable config for tests. */
function makeClient(metadataKey?: string) {
	return new HostnameClient({
		apiToken: "test-token",
		zoneId: "zone-123",
		platformDomain: "auth.example.com",
		metadataKey,
	});
}

/** A minimal active-hostname API payload. */
function activeHostname(overrides: Record<string, unknown> = {}) {
	return {
		id: "cf-1",
		hostname: "blog.example.com",
		status: "active",
		ssl: { status: "active", method: "txt", type: "dv" },
		custom_metadata: { tenant_id: "tenant-1", region: "wnam" },
		created_at: "2026-01-01T00:00:00.000Z",
		...overrides,
	};
}

/** A request the client made, recorded so a test can assert on what it sent. */
interface RecordedCall {
	url: string;
	init?: RequestInit;
}

/** The create payload, as it arrives over the wire once serialized. */
interface SentHostname {
	hostname: string;
	ssl: { method: string; type: string };
	custom_metadata: Record<string, string>;
}

/**
 * Parses the JSON body of a recorded call. Every payload the client sends is a
 * `JSON.stringify` result, so a body that is not a string means the request was
 * built wrong and the test should fail loudly rather than assert on `undefined`.
 */
function sentBody(call: RecordedCall | undefined): SentHostname {
	let body = call?.init?.body;
	if (typeof body !== "string") throw new TypeError("expected a serialized JSON body");
	return JSON.parse(body) as SentHostname;
}

/** Installs a fetch mock returning `body` with `status`, capturing the last call. */
function mockFetch(body: unknown, status = 200) {
	let calls: RecordedCall[] = [];
	globalThis.fetch = mock((url: string, init?: RequestInit) => {
		calls.push({ url, init });
		return Promise.resolve(
			new Response(JSON.stringify(body), {
				status,
				headers: { "content-type": "application/json" },
			}),
		);
	}) as unknown as typeof fetch;
	return calls;
}

let originalFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("HostnameClient.create", () => {
	test("writes the configured metadata key and returns a normalized result", async () => {
		let calls = mockFetch({
			result: activeHostname({ status: "pending", ssl: { status: "pending_validation" } }),
			success: true,
			errors: [],
			messages: [],
		});

		let client = makeClient("blog_id");
		let result = await client.create("blog.example.com", "blog-9", "weur");

		expect(calls).toHaveLength(1);
		expect(calls[0]?.url).toBe(
			"https://api.cloudflare.com/client/v4/zones/zone-123/custom_hostnames",
		);
		let sent = sentBody(calls[0]);
		expect(sent.custom_metadata).toEqual({ blog_id: "blog-9", region: "weur" });
		expect(sent.hostname).toBe("blog.example.com");
		expect(sent.ssl.method).toBe("txt");

		expect(result.id).toBe("cf-1");
		expect(result.status).toBe("pending");
		expect(result.sslStatus).toBe("pending_validation");
	});

	test("defaults region to wnam when omitted", async () => {
		let calls = mockFetch({
			result: activeHostname(),
			success: true,
			errors: [],
			messages: [],
		});

		await makeClient().create("blog.example.com", "tenant-1");

		let sent = sentBody(calls[0]);
		expect(sent.custom_metadata).toEqual({ tenant_id: "tenant-1", region: "wnam" });
	});

	test("sends the bearer token header", async () => {
		let calls = mockFetch({
			result: activeHostname(),
			success: true,
			errors: [],
			messages: [],
		});

		await makeClient().create("blog.example.com", "tenant-1");

		let headers = new Headers(calls[0]?.init?.headers);
		expect(headers.get("authorization")).toBe("Bearer test-token");
	});
});

describe("HostnameClient error handling", () => {
	test("throws HostnameApiError with status and errors on API failure", async () => {
		mockFetch({ success: false, errors: [{ code: 1001, message: "Invalid hostname" }] }, 400);

		let client = makeClient();
		let error: unknown;
		try {
			await client.create("bad", "tenant-1");
		} catch (caught) {
			error = caught;
		}

		expect(error).toBeInstanceOf(HostnameApiError);
		let apiError = error as HostnameApiError;
		expect(apiError.statusCode).toBe(400);
		expect(apiError.message).toBe("Invalid hostname");
		expect(apiError.errors?.[0]?.code).toBe(1001);
		expect(apiError.name).toBe("CloudflareApiError");
	});

	test("throws HostnameApiError when the payload fails schema validation", async () => {
		mockFetch({ success: true, result: { id: 123 }, errors: [], messages: [] });

		let client = makeClient();
		let promise = client.status("cf-1");
		expect(promise).rejects.toBeInstanceOf(HostnameApiError);
	});
});

describe("HostnameClient.status", () => {
	test("fetches by id and exposes both flat and nested ssl views", async () => {
		let calls = mockFetch({
			result: activeHostname({
				ssl: {
					status: "pending_validation",
					validation_records: [{ txt_name: "_cf.blog", txt_value: "abc123" }],
				},
			}),
			success: true,
			errors: [],
			messages: [],
		});

		let result = await makeClient().status("cf-1");

		expect(calls[0]?.url).toBe(
			"https://api.cloudflare.com/client/v4/zones/zone-123/custom_hostnames/cf-1",
		);
		expect(result.sslStatus).toBe("pending_validation");
		expect(result.ssl.status).toBe("pending_validation");
		expect(result.validationTxtName).toBe("_cf.blog");
		expect(result.validationTxtValue).toBe("abc123");
		expect(result.ssl.validationRecords[0]?.txt_name).toBe("_cf.blog");
	});

	test("falls back to ownership_verification for the validation record", async () => {
		mockFetch({
			result: activeHostname({
				ssl: { status: "pending_validation" },
				ownership_verification: { name: "_own.blog", value: "own-value" },
			}),
			success: true,
			errors: [],
			messages: [],
		});

		let result = await makeClient().status("cf-1");
		expect(result.validationTxtName).toBe("_own.blog");
		expect(result.validationTxtValue).toBe("own-value");
	});
});

describe("HostnameClient.getByName", () => {
	test("returns the first match", async () => {
		let calls = mockFetch({
			result: [activeHostname()],
			success: true,
			errors: [],
			messages: [],
			result_info: { page: 1, per_page: 50, total_count: 1, total_pages: 1 },
		});

		let result = await makeClient().getByName("blog.example.com");
		expect(calls[0]?.url).toContain("?hostname=blog.example.com");
		expect(result?.id).toBe("cf-1");
	});

	test("returns null when there are no matches", async () => {
		mockFetch({
			result: [],
			success: true,
			errors: [],
			messages: [],
			result_info: { page: 1, per_page: 50, total_count: 0, total_pages: 1 },
		});

		let result = await makeClient().getByName("missing.example.com");
		expect(result).toBeNull();
	});
});

describe("HostnameClient.listByEntity", () => {
	test("paginates and filters client-side by the configured metadata key", async () => {
		let responses = [
			{
				result: [
					activeHostname({ id: "a", custom_metadata: { blog_id: "blog-1", region: "wnam" } }),
					activeHostname({ id: "b", custom_metadata: { blog_id: "other", region: "wnam" } }),
				],
				success: true,
				errors: [],
				messages: [],
				result_info: { page: 1, per_page: 50, total_count: 3, total_pages: 2 },
			},
			{
				result: [
					activeHostname({ id: "c", custom_metadata: { blog_id: "blog-1", region: "wnam" } }),
				],
				success: true,
				errors: [],
				messages: [],
				result_info: { page: 2, per_page: 50, total_count: 3, total_pages: 2 },
			},
		];
		let index = 0;
		globalThis.fetch = mock(() => {
			let body = responses[index++];
			return Promise.resolve(
				new Response(JSON.stringify(body), {
					status: 200,
					headers: { "content-type": "application/json" },
				}),
			);
		}) as unknown as typeof fetch;

		let result = await makeClient("blog_id").listByEntity("blog-1");
		expect(result.map((r) => r.id)).toEqual(["a", "c"]);
	});
});

describe("HostnameClient.delete", () => {
	test("issues a DELETE and resolves on success", async () => {
		let calls = mockFetch({ success: true, result: null, errors: [], messages: [] });

		await makeClient().delete("cf-1");
		expect(calls[0]?.init?.method).toBe("DELETE");
		expect(calls[0]?.url).toBe(
			"https://api.cloudflare.com/client/v4/zones/zone-123/custom_hostnames/cf-1",
		);
	});

	test("throws HostnameApiError with 404 when the hostname is gone", async () => {
		mockFetch({ success: false, errors: [{ code: 1436, message: "not found" }] }, 404);

		let error: unknown;
		try {
			await makeClient().delete("cf-1");
		} catch (caught) {
			error = caught;
		}
		expect(error).toBeInstanceOf(HostnameApiError);
		expect((error as HostnameApiError).statusCode).toBe(404);
	});
});

describe("HostnameClient.createDefaultSubdomain", () => {
	test("builds a subdomain under the platform domain", () => {
		expect(makeClient().createDefaultSubdomain("acme")).toBe("acme.auth.example.com");
	});

	test("throws when platformDomain is not configured", () => {
		let client = new HostnameClient({ apiToken: "t", zoneId: "z" });
		expect(() => client.createDefaultSubdomain("acme")).toThrow(TypeError);
	});
});

describe("HostnameClient static helpers", () => {
	function result(overrides: Partial<HostnameResult> = {}): HostnameResult {
		return {
			id: "cf-1",
			hostname: "blog.example.com",
			status: "active",
			sslStatus: "active",
			validationTxtName: null,
			validationTxtValue: null,
			sslValidationErrors: [],
			createdAt: null,
			entityId: "tenant-1",
			region: "wnam",
			ssl: { status: "active", validationRecords: [], validationErrors: [] },
			...overrides,
		};
	}

	test("isActive is true only when hostname and ssl are both active", () => {
		expect(HostnameClient.isActive(result())).toBe(true);
		expect(HostnameClient.isActive(result({ sslStatus: "pending_validation" }))).toBe(false);
		expect(HostnameClient.isActive(result({ status: "pending" }))).toBe(false);
	});

	test("isPendingValidation reflects hostname or ssl pending states", () => {
		expect(HostnameClient.isPendingValidation(result({ status: "pending" }))).toBe(true);
		expect(
			HostnameClient.isPendingValidation(result({ status: "x", sslStatus: "pending_validation" })),
		).toBe(true);
		expect(HostnameClient.isPendingValidation(result())).toBe(false);
	});

	test("getValidationTxtRecord returns the TXT record only while pending", () => {
		let pending = result({
			sslStatus: "pending_validation",
			validationTxtName: "_cf.blog",
			validationTxtValue: "abc",
		});
		expect(HostnameClient.getValidationTxtRecord(pending)).toEqual({
			name: "_cf.blog",
			value: "abc",
		});
		expect(HostnameClient.getValidationTxtRecord(result())).toBeNull();
	});

	test("getStatusMessage maps statuses to human-readable strings", () => {
		expect(HostnameClient.getStatusMessage(result())).toBe("Active");
		expect(
			HostnameClient.getStatusMessage(
				result({ status: "pending", sslStatus: "pending_validation" }),
			),
		).toBe("Pending DNS validation");
		expect(
			HostnameClient.getStatusMessage(result({ status: "pending", sslStatus: "pending_issuance" })),
		).toBe("SSL certificate being issued");
		expect(
			HostnameClient.getStatusMessage(
				result({
					status: "pending",
					sslStatus: "failed",
					sslValidationErrors: [{ message: "boom" }],
				}),
			),
		).toBe("Validation failed: boom");
	});
});
