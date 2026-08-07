/**
 * Tests for reading the claims of an access token out of this server's own session.
 * Every malformed shape has to answer `null` rather than throw, because the caller's
 * only sane reaction to an unreadable token is to treat the session as signed out.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import {
	decodeAccessToken,
	getSubjectFromAccessToken,
	isAccessTokenExpiringSoon,
} from "~/app/services/access-token-claims";

/** Builds an unsigned compact JWT carrying the given payload. */
function tokenFor(payload: Record<string, unknown>): string {
	let encode = (value: object) =>
		btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

	return `${encode({ alg: "ES256", typ: "JWT" })}.${encode(payload)}.signature`;
}

/** A complete, currently valid claim set. */
function validClaims(overrides: Record<string, unknown> = {}) {
	return {
		sub: "subject-1",
		exp: Math.floor(Date.now() / 1000) + 3600,
		iat: Math.floor(Date.now() / 1000),
		iss: "auth.sergiodxa.com",
		aud: "client-1",
		...overrides,
	};
}

describe("decodeAccessToken", () => {
	test("reads a complete claim set", () => {
		let claims = validClaims();
		expect(decodeAccessToken(tokenFor(claims))).toEqual(claims);
	});

	test("answers null for anything that is not a readable token", () => {
		expect(decodeAccessToken("")).toBeNull();
		expect(decodeAccessToken("not-a-token")).toBeNull();
		expect(decodeAccessToken("header.!!!.signature")).toBeNull();
		expect(decodeAccessToken(`header.${btoa("not json")}.signature`)).toBeNull();
	});

	test("answers null when a required claim is missing or the wrong type", () => {
		for (let claim of ["sub", "exp", "iat", "iss", "aud"]) {
			let claims: Record<string, unknown> = validClaims();
			delete claims[claim];
			expect(decodeAccessToken(tokenFor(claims))).toBeNull();
		}

		expect(decodeAccessToken(tokenFor(validClaims({ exp: "soon" })))).toBeNull();
		expect(decodeAccessToken(tokenFor(validClaims({ sub: 1 })))).toBeNull();
	});
});

describe("getSubjectFromAccessToken", () => {
	test("returns the subject", () => {
		expect(getSubjectFromAccessToken(tokenFor(validClaims()))).toBe("subject-1");
	});

	test("returns null for an unreadable token instead of throwing", () => {
		expect(getSubjectFromAccessToken("nonsense")).toBeNull();
	});
});

describe("isAccessTokenExpiringSoon", () => {
	test("is false for a token with an hour left", () => {
		expect(isAccessTokenExpiringSoon(tokenFor(validClaims()))).toBe(false);
	});

	test("is true within the refresh threshold", () => {
		let exp = Math.floor(Date.now() / 1000) + 60;
		expect(isAccessTokenExpiringSoon(tokenFor(validClaims({ exp })))).toBe(true);
	});

	test("is true for an already expired token", () => {
		let exp = Math.floor(Date.now() / 1000) - 60;
		expect(isAccessTokenExpiringSoon(tokenFor(validClaims({ exp })))).toBe(true);
	});

	test("is true for an unreadable token, so the caller refreshes or signs out", () => {
		expect(isAccessTokenExpiringSoon("nonsense")).toBe(true);
	});
});
