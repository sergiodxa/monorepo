/**
 * Covers every claim `IdToken` names, in both the present and the absent case, because
 * a nullability contract is what the call sites are written against. A signed round-trip
 * is asserted beside them, so verification keeps answering with a checked `IdToken`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { JWK } from "@pkg/jwt";
import { beforeAll, describe, expect, test } from "vitest";

import { AUTHENTICATION_METHODS, IdToken } from "./id-token";

/** Seconds since the epoch, the unit `auth_time` travels in. */
const AUTH_TIME = 1_700_000_000;

let keys: JWK.KeyPair[];
let otherKeys: JWK.KeyPair[];

beforeAll(async () => {
	keys = [await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256))];
	otherKeys = [await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256))];
});

describe("subject", () => {
	test("reads `sub` as a plain string", () => {
		expect(new IdToken({ sub: "user-123" }).subject).toBe("user-123");
	});

	test("throws for a token with no `sub`, since an ID token without one is malformed", () => {
		expect(() => new IdToken({}).subject).toThrow(/sub/);
	});
});

describe("nonce", () => {
	test("reads the claim", () => {
		expect(new IdToken({ nonce: "n-abc" }).nonce).toBe("n-abc");
	});

	test("answers null when absent", () => {
		expect(new IdToken({ sub: "user-123" }).nonce).toBeNull();
	});
});

describe("authTime", () => {
	test("turns the seconds in the claim into a Date", () => {
		expect(new IdToken({ auth_time: AUTH_TIME }).authTime).toEqual(new Date(AUTH_TIME * 1000));
	});

	test("answers null when absent", () => {
		expect(new IdToken({ sub: "user-123" }).authTime).toBeNull();
	});
});

describe("sessionId", () => {
	test("reads `sid`", () => {
		expect(new IdToken({ sid: "session-1" }).sessionId).toBe("session-1");
	});

	test("answers null when absent", () => {
		expect(new IdToken({ sub: "user-123" }).sessionId).toBeNull();
	});
});

describe("atHash", () => {
	test("reads `at_hash`", () => {
		expect(new IdToken({ at_hash: "hash-1" }).atHash).toBe("hash-1");
	});

	test("answers null when absent, which is what our own provider sends", () => {
		expect(new IdToken({ sub: "user-123" }).atHash).toBeNull();
	});
});

describe("amr", () => {
	test("reads the methods that took part", () => {
		expect(new IdToken({ amr: ["pwd", "otp"] }).amr).toEqual(["pwd", "otp"]);
	});

	test("answers an empty list when absent", () => {
		expect(new IdToken({ sub: "user-123" }).amr).toEqual([]);
	});

	test("accepts a value outside the RFC 8176 registry", () => {
		expect(new IdToken({ amr: ["urn:passkey"] }).amr).toEqual(["urn:passkey"]);
	});

	test("answers an empty list for a claim that is not a list of strings", () => {
		expect(new IdToken({ amr: "pwd" }).amr).toEqual([]);
		expect(new IdToken({ amr: ["pwd", 1] }).amr).toEqual(["pwd"]);
	});
});

describe("acr", () => {
	test("reads the claim", () => {
		expect(new IdToken({ acr: "urn:mace:incommon:iap:silver" }).acr).toBe(
			"urn:mace:incommon:iap:silver",
		);
	});

	test("answers null when absent", () => {
		expect(new IdToken({ sub: "user-123" }).acr).toBeNull();
	});
});

describe("profile claims", () => {
	test("read the claims the `profile` and `email` scopes add", () => {
		let token = new IdToken({
			sub: "user-123",
			name: "Sergio",
			email: "sergio@example.com",
			preferred_username: "sergiodxa",
			picture: "https://example.com/avatar.png",
		});

		expect(token.name).toBe("Sergio");
		expect(token.email).toBe("sergio@example.com");
		expect(token.username).toBe("sergiodxa");
		expect(token.picture).toBe("https://example.com/avatar.png");
	});

	test("answer null when the scope was not granted", () => {
		let token = new IdToken({ sub: "user-123" });

		expect(token.name).toBeNull();
		expect(token.email).toBeNull();
		expect(token.username).toBeNull();
		expect(token.picture).toBeNull();
	});

	test("leaves `picture` a string, so a value that is no URL reaches the caller intact", () => {
		expect(new IdToken({ picture: "not a url" }).picture).toBe("not a url");
	});
});

describe("emailVerified", () => {
	test("reads a boolean claim", () => {
		expect(new IdToken({ email_verified: true }).emailVerified).toBe(true);
		expect(new IdToken({ email_verified: false }).emailVerified).toBe(false);
	});

	test("normalizes a provider that serializes the claim as a string", () => {
		expect(new IdToken({ email_verified: "true" }).emailVerified).toBe(true);
		expect(new IdToken({ email_verified: "false" }).emailVerified).toBe(false);
	});

	test("answers false when absent, so `missing` is not a third state", () => {
		expect(new IdToken({ sub: "user-123" }).emailVerified).toBe(false);
	});
});

describe("claims with no accessor", () => {
	test("read through by name, and answer null when absent", () => {
		let token = new IdToken({ sub: "user-123", groups: ["admin"] });

		expect(token.groups).toEqual(["admin"]);
		expect(token.department).toBeNull();
	});

	test("keep the registered claim accessors working", () => {
		let token = new IdToken({ sub: "user-123", iss: "https://auth.test", aud: "client-1" });

		expect(token.issuer).toBe("https://auth.test");
		expect(token.audience).toBe("client-1");
	});
});

describe("AUTHENTICATION_METHODS", () => {
	test("registers the twenty values RFC 8176 §2 defines", () => {
		expect(Object.values(AUTHENTICATION_METHODS)).toEqual([
			"face",
			"fpt",
			"geo",
			"hwk",
			"iris",
			"kba",
			"mca",
			"mfa",
			"otp",
			"pin",
			"pwd",
			"rba",
			"retina",
			"sc",
			"sms",
			"swk",
			"tel",
			"user",
			"vbm",
			"wia",
		]);
	});
});

describe("verify", () => {
	test("returns an IdToken, so the subclass's accessors survive verification", async () => {
		let signed = await new IdToken({
			sub: "user-123",
			iss: "https://auth.test",
			aud: "client-1",
			nonce: "n-abc",
			auth_time: AUTH_TIME,
			email_verified: "true",
			amr: ["pwd", "mfa"],
			exp: "1h",
		}).sign(JWK.Algorithm.ES256, keys);

		let verified = await IdToken.verify(signed, keys, {
			issuer: "https://auth.test",
			audience: "client-1",
		});

		expect(verified).toBeInstanceOf(IdToken);
		expect(verified.subject).toBe("user-123");
		expect(verified.nonce).toBe("n-abc");
		expect(verified.authTime).toEqual(new Date(AUTH_TIME * 1000));
		expect(verified.emailVerified).toBe(true);
		expect(verified.amr).toEqual(["pwd", "mfa"]);
	});

	test("refuses a token signed by another key", async () => {
		let signed = await new IdToken({ sub: "user-123", exp: "1h" }).sign(
			JWK.Algorithm.ES256,
			otherKeys,
		);

		await expect(IdToken.verify(signed, keys)).rejects.toThrow();
	});
});
