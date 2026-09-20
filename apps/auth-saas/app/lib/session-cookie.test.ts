/**
 * Behavioural tests for the `__Host-session` cookie: it round-trips a value through
 * `serialize`/`parse`, carries the attributes `__Host-` and a bearer credential both
 * require, and refuses a value tampered with after signing. `cloudflare:workers` is
 * mocked with a fixed `SESSION_SECRET` before the module under test is imported,
 * because that module captures `env` at load time, the way `hostname-cache.test.ts`
 * mocks `HOSTNAMES_KV` for the same reason.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createEnv } from "@sdxc/cloudflare-mocks";
import { describe, expect, test, vi } from "vitest";

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Cloudflare.Env>({ SESSION_SECRET: "test-session-secret" }),
}));

let { sessionCookie } = await import("./session-cookie");

describe("sessionCookie", () => {
	test("is named with the __Host- prefix", () => {
		expect(sessionCookie.name).toBe("__Host-session");
	});

	test("carries the attributes a __Host- bearer cookie requires", () => {
		expect(sessionCookie.httpOnly).toBe(true);
		expect(sessionCookie.secure).toBe(true);
		expect(sessionCookie.sameSite).toBe("Lax");
		expect(sessionCookie.path).toBe("/");
		expect(sessionCookie.signed).toBe(true);
	});

	test("round-trips a value through serialize and parse", async () => {
		let setCookie = await sessionCookie.serialize("a-session-token");
		let cookieHeader = setCookie.split(";")[0] ?? "";

		expect(await sessionCookie.parse(cookieHeader)).toBe("a-session-token");
	});

	test("rejects a value tampered with after signing", async () => {
		let setCookie = await sessionCookie.serialize("a-session-token");
		let [name, ...rest] = (setCookie.split(";")[0] ?? "").split("=");
		let tampered = `${name}=${rest.join("=")}tampered`;

		expect(await sessionCookie.parse(tampered)).toBeNull();
	});

	test("answers null for a request with no cookie header", async () => {
		expect(await sessionCookie.parse(null)).toBeNull();
	});
});
