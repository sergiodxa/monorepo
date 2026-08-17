/**
 * Integration tests for the session middleware factory. They exercise the real
 * cookie + KV-backed session pipeline `createSessionMiddleware` builds — the
 * `uptime:session` cookie's attributes (path, httpOnly, SameSite, one-year
 * lifetime, and the `secure` flag it forwards), round-tripping session data
 * through KV under the `session:` prefix, and rejecting a cookie signed with a
 * different secret.
 *
 * These run inside workerd against the real `KV` binding the app declares. The fake they
 * replaced stubbed `list()` to an empty result, so the prefix assertion below had to reach
 * into the fake's own Map; it now reads the namespace's listing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:test";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

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

		router.get("/read", (ctx) => {
			// Session values are untyped, so only the string `/set` wrote is echoed back —
			// anything else reads as empty and shows up as a mismatch rather than as a
			// default stringification.
			let probe = ctx.session.get("probe");
			return new Response(typeof probe === "string" ? probe : "");
		});

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
		let router = buildRouter(env.KV, "s3cr3t", false);

		let response = await router.fetch(new Request("https://example.com/set?value=hello"));
		let setCookie = findSessionCookie(response);

		expect(setCookie).toContain("Path=/");
		expect(setCookie).toContain("HttpOnly");
		expect(setCookie).toContain("SameSite=Lax");
		expect(setCookie).not.toContain("Secure");
		expect(setCookie).toContain(`Max-Age=${60 * 60 * 24 * 365}`);
	});

	test("marks the cookie Secure only when the secure flag is true", async () => {
		let router = buildRouter(env.KV, "s3cr3t", true);

		let response = await router.fetch(new Request("https://example.com/set?value=hello"));
		let setCookie = findSessionCookie(response);

		expect(setCookie).toContain("Secure");
	});

	test("persists session data in KV under the session: prefix and round-trips it", async () => {
		let router = buildRouter(env.KV, "s3cr3t", false);

		let setResponse = await router.fetch(new Request("https://example.com/set?value=hello"));
		let cookieValue = findSessionCookie(setResponse).split(";")[0]!;

		let listed = await env.KV.list({ prefix: "session:" });
		expect(listed.keys).not.toHaveLength(0);

		let readResponse = await router.fetch(
			new Request("https://example.com/read", { headers: { Cookie: cookieValue } }),
		);

		expect(await readResponse.text()).toBe("hello");
	});

	test("rejects a session cookie signed with a different secret, starting a fresh session", async () => {
		let writer = buildRouter(env.KV, "secret-a", false);
		let reader = buildRouter(env.KV, "secret-b", false);

		let setResponse = await writer.fetch(new Request("https://example.com/set?value=hello"));
		let cookieValue = findSessionCookie(setResponse).split(";")[0]!;

		let readResponse = await reader.fetch(
			new Request("https://example.com/read", { headers: { Cookie: cookieValue } }),
		);

		expect(await readResponse.text()).toBe("");
	});
});
