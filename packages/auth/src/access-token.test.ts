/**
 * Covers the two claims `AccessToken` reshapes and the question a resource server
 * asks of them. Scope splitting is asserted against the untidy strings providers
 * actually send, since a scope check that silently misses is an authorization bug.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { JWK } from "@pkg/jwt";
import { beforeAll, describe, expect, test } from "vitest";

import { AccessToken } from "./access-token";

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
