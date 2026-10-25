/**
 * Covers the two claims `AccessToken` reshapes and the question a resource server
 * asks of them. Scope splitting is asserted against the untidy strings providers
 * actually send, since a scope check that silently misses is an authorization bug.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { JWK } from "@sdxc/jwt";
import { beforeAll, describe, expect, test } from "vitest";

import { AccessToken } from "./access-token.js";

let keys: JWK.KeyPair[];

beforeAll(async () => {
	keys = [await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256))];
});

describe("scopes", () => {
	test("splits the space-separated claim into a list", () => {
		expect(new AccessToken({ scope: "openid monitors:read monitors:write" }).scopes).toEqual([
			"openid",
			"monitors:read",
			"monitors:write",
		]);
	});

	test("reads a single scope as a one-element list", () => {
		expect(new AccessToken({ scope: "openid" }).scopes).toEqual(["openid"]);
	});

	test("drops the empty segments extra whitespace produces", () => {
		expect(new AccessToken({ scope: "  openid   monitors:read " }).scopes).toEqual([
			"openid",
			"monitors:read",
		]);
	});

	test("answers an empty list when absent", () => {
		expect(new AccessToken({ sub: "user-123" }).scopes).toEqual([]);
	});

	test("answers an empty list for an empty claim", () => {
		expect(new AccessToken({ scope: "" }).scopes).toEqual([]);
	});
});

describe("clientId", () => {
	test("reads `client_id`, which names the caller when `sub` is a person", () => {
		expect(new AccessToken({ sub: "user-123", client_id: "client-1" }).clientId).toBe("client-1");
	});

	test("answers null when absent", () => {
		expect(new AccessToken({ sub: "user-123" }).clientId).toBeNull();
	});
});

describe("issuedToService", () => {
	test("reports a service when `sub` carries the client id", () => {
		expect(new AccessToken({ sub: "client-1", client_id: "client-1" }).issuedToService).toBe(true);
	});

	test("reports a person when `sub` names someone other than the client", () => {
		expect(new AccessToken({ sub: "user-123", client_id: "client-1" }).issuedToService).toBe(false);
	});

	test("reports a person when `sub` is present and `client_id` is absent", () => {
		expect(new AccessToken({ sub: "user-123" }).issuedToService).toBe(false);
	});

	test("reports a person when `client_id` is present and `sub` is absent", () => {
		expect(new AccessToken({ client_id: "client-1" }).issuedToService).toBe(false);
	});

	test("reports a person when both claims are absent, so two absences never read as a match", () => {
		expect(new AccessToken({ scope: "monitors:read" }).issuedToService).toBe(false);
	});

	test("answers for every combination of the two claims without throwing", () => {
		let payloads = [
			{ sub: "client-1", client_id: "client-1" },
			{ sub: "user-123", client_id: "client-1" },
			{ sub: "user-123" },
			{ client_id: "client-1" },
			{},
		];

		for (let payload of payloads) {
			expect(() => new AccessToken(payload).issuedToService).not.toThrow();
		}
	});
});

describe("has", () => {
	test("answers whether the scope was granted", () => {
		let token = new AccessToken({ scope: "monitors:read monitors:write" });

		expect(token.has("monitors:read")).toBe(true);
		expect(token.has("monitors:delete")).toBe(false);
	});

	test("compares whole scope values", () => {
		let token = new AccessToken({ scope: "monitors:read" });

		expect(token.has("monitors")).toBe(false);
	});

	test("answers false for every scope when the claim is absent", () => {
		expect(new AccessToken({ sub: "user-123" }).has("monitors:read")).toBe(false);
	});
});

describe("audience", () => {
	test("reads the client id an authorization-code token carries", () => {
		expect(new AccessToken({ sub: "user-123", aud: "client-1" }).audience).toBe("client-1");
	});

	test("reads the several audiences a client-credentials token carries", () => {
		let token = new AccessToken({
			sub: "client-1",
			client_id: "client-1",
			aud: ["https://auth.test", "https://api.test"],
		});

		expect(token.audience).toEqual(["https://auth.test", "https://api.test"]);
	});
});

describe("tryDecode", () => {
	test("decodes a compact JWT the same way decode does", async () => {
		let signed = await new AccessToken({ sub: "user-123", scope: "monitors:read" }).sign(
			JWK.Algorithm.ES256,
			keys,
		);

		let decoded = AccessToken.tryDecode(signed);

		expect(decoded).toBeInstanceOf(AccessToken);
		expect(decoded?.scopes).toEqual(["monitors:read"]);
	});

	test("answers null for an opaque string with no JWT shape at all", () => {
		expect(AccessToken.tryDecode("ya29.opaque-provider-access-token")).toBeNull();
	});

	test("answers null for an empty string", () => {
		expect(AccessToken.tryDecode("")).toBeNull();
	});

	test("answers null for a string with the right number of segments but no valid JSON inside", () => {
		expect(AccessToken.tryDecode("not-base64.not-base64.not-base64")).toBeNull();
	});
});

describe("verify", () => {
	test("returns an AccessToken, so the subclass's accessors survive verification", async () => {
		let signed = await new AccessToken({
			sub: "user-123",
			iss: "https://auth.test",
			aud: "uptime",
			client_id: "client-1",
			scope: "monitors:read monitors:write",
			exp: "1h",
		}).sign(JWK.Algorithm.ES256, keys);

		let verified = await AccessToken.verify(signed, keys, {
			issuer: "https://auth.test",
			audience: "uptime",
		});

		expect(verified).toBeInstanceOf(AccessToken);
		expect(verified.clientId).toBe("client-1");
		expect(verified.scopes).toEqual(["monitors:read", "monitors:write"]);
		expect(verified.has("monitors:write")).toBe(true);
	});
});

describe("step-up claims", () => {
	test("reads acr and auth_time", () => {
		let token = new AccessToken({ acr: "mfa", auth_time: 1_700_000_000 });

		expect(token.acr).toBe("mfa");
		expect(token.authTime).toEqual(new Date(1_700_000_000_000));
	});

	test("reads absent claims as null", () => {
		let token = new AccessToken({});

		expect(token.acr).toBeNull();
		expect(token.authTime).toBeNull();
	});
});

describe("meets", () => {
	let now = new Date(1_700_000_600_000);

	test("accepts a token whose acr is one of the accepted values", () => {
		let token = new AccessToken({ acr: "mfa" });
		expect(token.meets({ acrValues: ["phr", "mfa"] }, now)).toBe(true);
	});

	test("refuses a token with another acr", () => {
		let token = new AccessToken({ acr: "pwd" });
		expect(token.meets({ acrValues: ["mfa"] }, now)).toBe(false);
	});

	test("refuses a token carrying no acr when classes are required", () => {
		expect(new AccessToken({}).meets({ acrValues: ["mfa"] }, now)).toBe(false);
	});

	test("accepts an authentication within max_age, counted in seconds", () => {
		let token = new AccessToken({ auth_time: 1_700_000_300 });
		expect(token.meets({ maxAge: 300 }, now)).toBe(true);
	});

	test("refuses an authentication older than max_age", () => {
		let token = new AccessToken({ auth_time: 1_700_000_299 });
		expect(token.meets({ maxAge: 300 }, now)).toBe(false);
	});

	test("reads a duration string as max_age", () => {
		let token = new AccessToken({ auth_time: 1_700_000_000 });
		expect(token.meets({ maxAge: "10 minutes" }, now)).toBe(true);
		expect(token.meets({ maxAge: "5 minutes" }, now)).toBe(false);
	});

	test("refuses a token carrying no auth_time when max_age is required", () => {
		expect(new AccessToken({ acr: "mfa" }).meets({ maxAge: 300 }, now)).toBe(false);
	});

	test("accepts any token for an empty requirement", () => {
		expect(new AccessToken({}).meets({}, now)).toBe(true);
	});
});
