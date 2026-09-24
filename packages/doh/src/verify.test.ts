/**
 * Covers the two domain-ownership checks: a TXT token, including one a resolver splits
 * into several character-strings, and a CNAME followed hop by hop to its target.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { ServerFailureError } from "./errors.js";
import { CLOUDFLARE } from "./resolvers.js";
import { checkCname, verifyTxtRecord } from "./verify.js";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** A resolver serving a fixed zone: `zone[name][type]` is the data list, an absent name is NXDOMAIN. */
function serveZone(zone: Record<string, Record<string, string[]>>, status?: number) {
	let codes: Record<string, number> = { CNAME: 5, TXT: 16 };
	server.use(
		http.get(CLOUDFLARE.url, ({ request }) => {
			let url = new URL(request.url);
			let name = (url.searchParams.get("name") ?? "").toLowerCase().replace(/\.$/, "");
			let type = url.searchParams.get("type") ?? "";
			let records = zone[name];
			if (status !== undefined) return HttpResponse.json({ Status: status });
			if (!records) return HttpResponse.json({ Status: 3 });
			let code = codes[type] ?? 0;
			let Answer = (records[type] ?? []).map((data) => ({
				name: `${name}.`,
				type: code,
				TTL: 60,
				data,
			}));
			return HttpResponse.json({ Status: 0, Answer });
		}),
	);
}

describe("verifyTxtRecord", () => {
	test("matches a token the resolver split into two character-strings", async () => {
		serveZone({ "_verify.example.com": { TXT: ['"v=spf1 include:x"', '"ping_" "abc123"'] } });
		expect(unwrap(await verifyTxtRecord("_verify.example.com", "ping_abc123"))).toBe(true);
	});

	test("matches an escaped token", async () => {
		serveZone({ "_verify.example.com": { TXT: ['"say \\"hi\\""'] } });
		expect(unwrap(await verifyTxtRecord("_verify.example.com", 'say "hi"'))).toBe(true);
	});

	test("is false when no record matches exactly", async () => {
		serveZone({ "_verify.example.com": { TXT: ['"ping_abc1234"'] } });
		expect(unwrap(await verifyTxtRecord("_verify.example.com", "ping_abc123"))).toBe(false);
	});

	test("is false while the name does not exist yet", async () => {
		serveZone({});
		expect(unwrap(await verifyTxtRecord("_verify.example.com", "ping_abc123"))).toBe(false);
	});

	test("keeps a resolver failure a failure", async () => {
		serveZone({}, 2);
		let result = await verifyTxtRecord("_verify.example.com", "ping_abc123");
		expect(isFailure(result) && result.error).toBeInstanceOf(ServerFailureError);
	});
});

describe("checkCname", () => {
	test("matches a direct CNAME, case-insensitively and ignoring the trailing dot", async () => {
		serveZone({ "shop.example.com": { CNAME: ["Custom.Hosting.example."] } });
		expect(unwrap(await checkCname("shop.example.com", "custom.hosting.example."))).toBe(true);
	});

	test("matches a target reached through the chain", async () => {
		serveZone({
			"shop.example.com": { CNAME: ["alias.example.com."] },
			"alias.example.com": { CNAME: ["custom.hosting.example."] },
		});
		expect(unwrap(await checkCname("shop.example.com", "custom.hosting.example"))).toBe(true);
	});

	test("is false for a CNAME elsewhere, a name with none, or a missing name", async () => {
		serveZone({
			"shop.example.com": { CNAME: ["other.example."] },
			"other.example": {},
			"plain.example.com": {},
		});
		expect(unwrap(await checkCname("shop.example.com", "custom.hosting.example"))).toBe(false);
		expect(unwrap(await checkCname("plain.example.com", "custom.hosting.example"))).toBe(false);
		expect(unwrap(await checkCname("missing.example.com", "custom.hosting.example"))).toBe(false);
	});

	test("stops on a CNAME loop", async () => {
		serveZone({
			"a.example": { CNAME: ["b.example."] },
			"b.example": { CNAME: ["a.example."] },
		});
		expect(unwrap(await checkCname("a.example", "custom.hosting.example"))).toBe(false);
	});

	test("keeps a resolver failure a failure", async () => {
		serveZone({}, 2);
		expect(isFailure(await checkCname("shop.example.com", "custom.hosting.example"))).toBe(true);
	});
});
