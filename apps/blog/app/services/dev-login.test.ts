/**
 * The development login's switch: both the `DEV_LOGIN=true` flag and a loopback host are
 * needed, so a deployed Worker, which never sets the flag, keeps the route closed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test, vi } from "vitest";

/** The `DEV_LOGIN` value the Worker reads; unset by default. */
let devLoginFlag: string | undefined;

vi.doMock("cloudflare:workers", async (importOriginal) => {
	let original = await importOriginal<typeof import("cloudflare:workers")>();
	return {
		...original,
		env: new Proxy(original.env, {
			get: (target, property) =>
				property === "DEV_LOGIN" ? devLoginFlag : Reflect.get(target, property),
		}),
	};
});

let { isDevLoginEnabled } = await import("~/app/services/dev-login");

afterEach(() => {
	devLoginFlag = undefined;
});

describe("isDevLoginEnabled", () => {
	test.each(["http://localhost:3011", "http://127.0.0.1:3011", "http://blog.localhost"])(
		"opens on %s with the flag set",
		(origin) => {
			devLoginFlag = "true";
			expect(isDevLoginEnabled(new URL(origin))).toBe(true);
		},
	);

	test("stays closed on the production host even with the flag set", () => {
		devLoginFlag = "true";
		expect(isDevLoginEnabled(new URL("https://sergiodxa.com"))).toBe(false);
	});

	test("stays closed on loopback without the flag", () => {
		expect(isDevLoginEnabled(new URL("http://localhost:3011"))).toBe(false);
	});
});
