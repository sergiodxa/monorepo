/**
 * Tests `createAuthProvider`: it builds an OIDC provider named "sergiodxa"
 * (the literal name `remix/auth` routes callbacks by), keeping that name
 * stable across any client credentials and redirect URI, and always
 * returning a provider successfully. The provider's public shape is
 * limited to that name — the only thing these tests assert on directly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { createAuthProvider } from "./oauth";

describe("createAuthProvider", () => {
	test("returns a provider named 'sergiodxa'", () => {
		let provider = createAuthProvider({
			clientId: "client-id",
			clientSecret: "client-secret",
			redirectUri: "https://uptime.test/auth/callback",
		});

		expect(provider.name).toBe("sergiodxa");
	});

	test("keeps the provider name stable across different client credentials", () => {
		let first = createAuthProvider({
			clientId: "client-a",
			clientSecret: "secret-a",
			redirectUri: "https://a.test/auth/callback",
		});
		let second = createAuthProvider({
			clientId: "client-b",
			clientSecret: "secret-b",
			redirectUri: "https://b.test/auth/callback",
		});

		expect(first.name).toBe("sergiodxa");
		expect(second.name).toBe("sergiodxa");
	});

	test("doesn't throw when building the provider", () => {
		expect(() =>
			createAuthProvider({
				clientId: "client-id",
				clientSecret: "client-secret",
				redirectUri: "https://uptime.test/auth/callback",
			}),
		).not.toThrow();
	});
});
