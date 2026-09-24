/**
 * Checks the placement rules: RFC 8414 and RFC 9728 insert the suffix before an
 * identifier's path, OpenID Connect Discovery appends it, and a terminating slash
 * never doubles up in either.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { WellKnownParseError, wellKnownUrl } from "./index.js";

describe(wellKnownUrl, () => {
	test("inserts after the host for an identifier with no path", () => {
		expect(wellKnownUrl("https://as.example", "oauth-authorization-server").href).toBe(
			"https://as.example/.well-known/oauth-authorization-server",
		);
	});

	test("drops the terminating slash after the host before inserting (RFC 9728 §3.1)", () => {
		expect(wellKnownUrl("https://api.example/", "oauth-protected-resource").href).toBe(
			"https://api.example/.well-known/oauth-protected-resource",
		);
	});

	test("inserts between the host and the path (RFC 8414 §3.1)", () => {
		expect(wellKnownUrl("https://as.example/issuer1", "oauth-authorization-server").href).toBe(
			"https://as.example/.well-known/oauth-authorization-server/issuer1",
		);
	});

	test("keeps the path's own trailing slash and the query when inserting", () => {
		expect(
			wellKnownUrl(new URL("https://api.example/v1/?tenant=a"), "oauth-protected-resource").href,
		).toBe("https://api.example/.well-known/oauth-protected-resource/v1/?tenant=a");
	});

	test("defaults to inserting", () => {
		expect(wellKnownUrl("https://example.com/x", "security.txt").pathname).toBe(
			"/.well-known/security.txt/x",
		);
	});

	test("appends after the path for OpenID Connect Discovery (§4)", () => {
		expect(wellKnownUrl("https://op.example/tenant", "openid-configuration", "append").href).toBe(
			"https://op.example/tenant/.well-known/openid-configuration",
		);
	});

	test("appends without doubling a trailing slash", () => {
		expect(wellKnownUrl("https://op.example/tenant/", "openid-configuration", "append").href).toBe(
			"https://op.example/tenant/.well-known/openid-configuration",
		);
		expect(wellKnownUrl("https://op.example", "openid-configuration", "append").href).toBe(
			"https://op.example/.well-known/openid-configuration",
		);
	});
});

describe(WellKnownParseError, () => {
	test("summarizes the first issue and counts the rest", () => {
		let error = new WellKnownParseError("jwks.json", [
			{ at: "/keys", message: "First." },
			{ at: "/keys/0", message: "Second." },
		]);
		expect(error.message).toBe("jwks.json: First. (and 1 more)");
		expect(error.format).toBe("jwks.json");
		expect(error.issues).toHaveLength(2);
		expect(error.name).toBe("WellKnownParseError");
	});
});
