/**
 * Integration tests for the session middleware factory. They exercise the real
 * cookie + KV-backed session pipeline `createSessionMiddleware` builds — the
 * `uptime:session` cookie's attributes (path, httpOnly, SameSite, one-year
 * lifetime, and the `secure` flag it forwards), round-tripping session data
 * through a fake KV namespace under the `session:` prefix, and rejecting a
 * cookie signed with a different secret — using a fake `KVNamespace` instead of
 * a real Cloudflare binding.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { createRouter } from "remix/fetch-router";

import { createSessionMiddleware } from "~/app/http/middleware/session";

describe("createSessionMiddleware", () => {
	function buildRouter(kv: KVNamespace, secret: string, secure: boolean) {
		let router = createRouter({
			middleware: [createSessionMiddleware(kv, secret, secure)],
		});

		router.get("/set", (ctx) => {
			let value = new URL(ctx.request.url).searchParams.get("value") ?? "";
			ctx.session.set("probe", value);
			return new Response("ok");
		});

		router.get("/read", (ctx) => new Response(String(ctx.session.get("probe") ?? "")));

		return router;
	}

	function findSessionCookie(response: Response): string {
		let setCookie = response.headers
			.getSetCookie()
			.find((value) => value.startsWith("uptime:session="));
		if (!setCookie) throw new Error("Expected a uptime:session Set-Cookie header");
		return setCookie;
	}

	test("sets a signed, httpOnly, Lax session cookie with a one-year lifetime", async () => {
		let kv = createFakeKV();
		let router = buildRouter(kv.kv, "s3cr3t", false);

		let response = await router.fetch(new Request("https://example.com/set?value=hello"));
		let setCookie = findSessionCookie(response);

		expect(setCookie).toContain("Path=/");
		expect(setCookie).toContain("HttpOnly");
		expect(setCookie).toContain("SameSite=Lax");
		expect(setCookie).not.toContain("Secure");
		expect(setCookie).toContain(`Max-Age=${60 * 60 * 24 * 365}`);
	});

	test("marks the cookie Secure only when the secure flag is true", async () => {
		let kv = createFakeKV();
		let router = buildRouter(kv.kv, "s3cr3t", true);

		let response = await router.fetch(new Request("https://example.com/set?value=hello"));
		let setCookie = findSessionCookie(response);

		expect(setCookie).toContain("Secure");
	});

	test("persists session data in KV under the session: prefix and round-trips it", async () => {
		let kv = createFakeKV();
		let router = buildRouter(kv.kv, "s3cr3t", false);

		let setResponse = await router.fetch(new Request("https://example.com/set?value=hello"));
		let cookieValue = findSessionCookie(setResponse).split(";")[0]!;

		expect([...kv.keys()].some((key) => key.startsWith("session:"))).toBe(true);

		let readResponse = await router.fetch(
			new Request("https://example.com/read", { headers: { Cookie: cookieValue } }),
		);

		expect(await readResponse.text()).toBe("hello");
	});

	test("rejects a session cookie signed with a different secret, starting a fresh session", async () => {
		let kv = createFakeKV();
		let writer = buildRouter(kv.kv, "secret-a", false);
		let reader = buildRouter(kv.kv, "secret-b", false);

		let setResponse = await writer.fetch(new Request("https://example.com/set?value=hello"));
		let cookieValue = findSessionCookie(setResponse).split(";")[0]!;

		let readResponse = await reader.fetch(
			new Request("https://example.com/read", { headers: { Cookie: cookieValue } }),
		);

		expect(await readResponse.text()).toBe("");
	});
});

/** Builds an in-memory `KVNamespace` fake for exercising the middleware without a real KV binding. */
function createFakeKV() {
	let values = new Map<string, string>();

	let kv = {
		async get(key: string) {
			return values.get(key) ?? null;
		},
		async getWithMetadata(key: string) {
			return { value: values.get(key) ?? null, metadata: null, cacheStatus: null };
		},
		async put(key: string, value: string | ArrayBuffer | ReadableStream | ArrayBufferView) {
			if (typeof value !== "string") return;
			values.set(key, value);
		},
		async delete(key: string) {
			values.delete(key);
		},
		async list() {
			return { keys: [], list_complete: true, cursor: "" };
		},
	} as unknown as KVNamespace;

	return {
		kv,
		keys() {
			return values.keys();
		},
	};
}
