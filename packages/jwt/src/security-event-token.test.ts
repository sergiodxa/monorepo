/**
 * Covers `SecurityEventToken` against RFC 8417's figures, RFC 8935's transmitted SET and
 * RFC 9493's subject identifiers: building, signing and verifying a SET, the claims RFC
 * 8417 requires and forbids, and the typed accessors over `events`, `txn`, `toe`, `sub_id`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as jose from "jose";
import { beforeAll, describe, expect, test } from "vitest";

import {
	BACKCHANNEL_LOGOUT,
	CONSENT,
	EMAIL_SUBJECT,
	ISSUER_SUBJECT,
	OPAQUE_SUBJECT,
	PHONE_SUBJECT,
	RISC_ACCOUNT_DISABLED,
	SCIM_CREATE,
	SCIM_PASSWORD_RESET,
	TRANSMITTED_RISC_EVENT,
	UNSECURED_SCIM_CREATE,
} from "./fixtures/rfc8417.js";
import { JWK } from "./jwk.js";
import { JWT } from "./jwt.js";
import { SecurityEventToken } from "./security-event-token.js";

/** Verification options requiring the ES256 algorithm the tests sign with. */
const VERIFY = { algorithms: [JWK.Algorithm.ES256] };

let keys: JWK.KeyPair[];

beforeAll(async () => {
	keys = [await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256))];
});

/**
 * Signs a claim set as a SET, the way an issuer that wrote it by hand would.
 *
 * @param payload - The claims
 */
function signSet(payload: JWT.Payload): Promise<string> {
	return new SecurityEventToken(payload).sign(JWK.Algorithm.ES256, keys);
}

describe("RFC 8417 examples", () => {
	test.each([
		["Figure 1, SCIM password reset", SCIM_PASSWORD_RESET],
		["Figure 2, back-channel logout", BACKCHANNEL_LOGOUT],
		["Figure 3, consent", CONSENT],
		["Figure 4, RISC account disabled", RISC_ACCOUNT_DISABLED],
		["Figure 5, SCIM create", SCIM_CREATE],
	])("verifies %s and reads its events", async (_, claims) => {
		let set = await SecurityEventToken.verify(await signSet(claims), keys, {
			...VERIFY,
			issuer: claims.iss,
		});

		expect(set).toBeInstanceOf(SecurityEventToken);
		expect(set.events).toEqual(claims.events);
		expect(set.id).toBe(claims.jti);
		expect(set.issuedAt).toEqual(new Date(claims.iat * 1000));
	});

	test("decodes Figure 6, the unsecured SCIM create", () => {
		let set = SecurityEventToken.decode(UNSECURED_SCIM_CREATE);

		expect(set.payload).toEqual(SCIM_CREATE);
		expect(jose.decodeProtectedHeader(UNSECURED_SCIM_CREATE)).toEqual({
			typ: "secevent+jwt",
			alg: "none",
		});
	});

	test("refuses Figure 6 on verification, since it is unsigned", async () => {
		await expect(SecurityEventToken.verify(UNSECURED_SCIM_CREATE, keys)).rejects.toThrow();
	});

	test("decodes the SET RFC 8935 Figure 1 transmits", () => {
		let set = SecurityEventToken.decode(TRANSMITTED_RISC_EVENT);

		expect(set.issuer).toBe("https://idp.example.com/");
		expect(set.audience).toBe("636C69656E745F6964");
		expect(Object.keys(set.events)).toEqual([
			"https://schemas.openid.net/secevent/risc/event-type/account-disabled",
		]);
	});
});

describe("building a SET", () => {
	test("fills `jti` and `iat` and signs with the secevent+jwt type", async () => {
		let before = Math.floor(Date.now() / 1000);
		let token = SecurityEventToken.create({
			issuer: CONSENT.iss,
			audience: CONSENT.aud,
			events: CONSENT.events,
		});

		expect(token.id).toMatch(/^[0-9a-f-]{36}$/);
		expect(token.payload.iat).toBeGreaterThanOrEqual(before);
		expect(token.payload.exp).toBeUndefined();

		let signed = await token.sign(JWK.Algorithm.ES256, keys);
		expect(jose.decodeProtectedHeader(signed).typ).toBe("secevent+jwt");
	});

	test("writes the claims Figure 1 carries from the builder input", () => {
		let token = SecurityEventToken.create({
			issuer: SCIM_PASSWORD_RESET.iss,
			audience: SCIM_PASSWORD_RESET.aud,
			id: SCIM_PASSWORD_RESET.jti,
			issuedAt: new Date(SCIM_PASSWORD_RESET.iat * 1000),
			subject: SCIM_PASSWORD_RESET.sub,
			events: SCIM_PASSWORD_RESET.events,
		});

		expect(token.payload).toEqual(SCIM_PASSWORD_RESET);
	});

	test("writes `txn`, `toe` and `sub_id` when given", () => {
		let token = SecurityEventToken.create({
			issuer: "https://idp.example.com/",
			audience: "https://rp.example.com/",
			events: { "https://example.com/event": {} },
			transaction: "txn-1",
			timeOfEvent: new Date(1508184800 * 1000),
			subjectId: EMAIL_SUBJECT,
		});

		expect(token.payload).toMatchObject({ txn: "txn-1", toe: 1508184800, sub_id: EMAIL_SUBJECT });
		expect(token.transaction).toBe("txn-1");
		expect(token.timeOfEvent).toEqual(new Date(1508184800 * 1000));
		expect(token.subjectId).toEqual(EMAIL_SUBJECT);
	});

	test("builds the subclass it is called on", () => {
		/** A SET profile with an accessor of its own. */
		class LogoutToken extends SecurityEventToken {
			get sessionId() {
				return this.parser.string("sid");
			}
		}

		let token = LogoutToken.create({
			issuer: BACKCHANNEL_LOGOUT.iss,
			audience: BACKCHANNEL_LOGOUT.aud,
			events: BACKCHANNEL_LOGOUT.events,
		});

		expect(token).toBeInstanceOf(LogoutToken);
	});
});

describe("RFC 8417 claim checks on verification", () => {
	test.each(["iss", "iat", "jti", "aud"])("refuses a SET missing `%s`", async (claim) => {
		let claims: JWT.Payload = { ...CONSENT };
		delete claims[claim];

		await expect(SecurityEventToken.verify(await signSet(claims), keys, VERIFY)).rejects.toThrow(
			jose.errors.JWTClaimValidationFailed,
		);
	});

	test("refuses a SET carrying `exp`, which a statement of fact never has", async () => {
		let signed = await signSet({ ...CONSENT, exp: Math.floor(Date.now() / 1000) + 3600 });

		await expect(SecurityEventToken.verify(signed, keys, VERIFY)).rejects.toMatchObject({
			claim: "exp",
		});
	});

	test.each([
		["absent", undefined],
		["empty", {}],
		["an array", [{}]],
		["holding a non-object event", { "https://example.com/event": "yes" }],
	])("refuses a SET whose `events` is %s", async (_, events) => {
		let signed = await signSet({ ...CONSENT, events });

		await expect(SecurityEventToken.verify(signed, keys, VERIFY)).rejects.toMatchObject({
			claim: "events",
		});
	});

	test("refuses a JWT of another type carrying SET claims", async () => {
		let signed = await new JWT(CONSENT).sign(JWK.Algorithm.ES256, keys);

		await expect(SecurityEventToken.verify(signed, keys, VERIFY)).rejects.toMatchObject({
			claim: "typ",
		});
	});

	test("refuses a SET through a class typed for another kind of token", async () => {
		/** An access token typed as RFC 9068 requires. */
		class AccessToken extends JWT {
			static override type = "at+jwt";
		}

		await expect(AccessToken.verify(await signSet(CONSENT), keys, VERIFY)).rejects.toMatchObject({
			claim: "typ",
		});
	});

	test("still enforces the caller's issuer and audience", async () => {
		let signed = await signSet(CONSENT);

		await expect(
			SecurityEventToken.verify(signed, keys, { ...VERIFY, audience: "https://other.example" }),
		).rejects.toMatchObject({ claim: "aud" });
	});
});

describe("RFC 9493 subject identifiers", () => {
	test.each([
		["email", EMAIL_SUBJECT],
		["iss_sub", ISSUER_SUBJECT],
		["opaque", OPAQUE_SUBJECT],
		["phone_number", PHONE_SUBJECT],
	])("reads an `%s` identifier", (_, subjectId) => {
		expect(new SecurityEventToken({ sub_id: subjectId }).subjectId).toEqual(subjectId);
	});

	test.each([
		["an email identifier without `email`", { format: "email" }],
		["an iss_sub identifier with an empty `sub`", { format: "iss_sub", iss: "https://a", sub: "" }],
		["an opaque identifier with a numeric `id`", { format: "opaque", id: 7 }],
		["an identifier without `format`", { email: "user@example.com" }],
		["a string", "user@example.com"],
	])("reads %s as null", (_, subjectId) => {
		expect(new SecurityEventToken({ sub_id: subjectId }).subjectId).toBeNull();
	});
});

describe("accessors on a token missing the optional claims", () => {
	test("answer null and an empty event map", () => {
		let token = new SecurityEventToken({});

		expect(token.events).toEqual({});
		expect(token.transaction).toBeNull();
		expect(token.timeOfEvent).toBeNull();
		expect(token.subjectId).toBeNull();
	});
});
