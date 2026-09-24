/**
 * Tests the receiving side of one-click unsubscribe: signed tokens that round-trip,
 * refuse tampering, a foreign key, a foreign purpose and expiry, and the recognizer
 * for the RFC 8058 POST body in both the encodings a form can arrive in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Base64Url, Hex, hmac } from "@sdxc/crypto";
import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { afterEach, describe, expect, test, vi } from "vitest";

import { MailError } from "./errors.js";
import {
	InvalidUnsubscribeTokenError,
	isOneClickUnsubscribe,
	signUnsubscribeToken,
	verifyUnsubscribeToken,
} from "./unsubscribe.js";

/** Secret every test signs with. */
const SECRET = "test-unsubscribe-secret";

/** Claims for a member leaving the daily digest. */
const CLAIMS = { subject: "member_01H", list: "teamDailyDigest" };

afterEach(() => {
	vi.useRealTimers();
});

describe("signUnsubscribeToken", () => {
	test("produces a single URL path segment", async () => {
		let token = unwrap(await signUnsubscribeToken(SECRET, CLAIMS));
		expect(token).toMatch(/^[0-9a-f]{64}[A-Za-z0-9_-]+$/);
		expect(encodeURIComponent(token)).toBe(token);
	});

	test.each([
		["an email address as subject", { subject: "ada@example.com", list: "digest" }],
		["an empty subject", { subject: "", list: "digest" }],
		["an empty list", { subject: "member_01H", list: "" }],
		["a colon in the list", { subject: "member_01H", list: "team:digest" }],
		["a line break in the subject", { subject: "member\n01H", list: "digest" }],
	])("refuses %s", async (_, claims) => {
		let token = await signUnsubscribeToken(SECRET, claims);
		expect(isFailure(token) && token.error).toBeInstanceOf(MailError);
	});
});

describe("verifyUnsubscribeToken", () => {
	test("round-trips the claims with the time the token was issued", async () => {
		vi.useFakeTimers({ now: new Date("2026-09-24T12:00:00.000Z") });
		let token = unwrap(await signUnsubscribeToken(SECRET, CLAIMS));

		vi.setSystemTime(new Date("2031-01-01T00:00:00.000Z"));
		let claims = await verifyUnsubscribeToken(SECRET, token);
		expect(isSuccess(claims) && claims.data).toEqual({
			...CLAIMS,
			issuedAt: new Date("2026-09-24T12:00:00.000Z"),
		});
	});

	test("keeps a colon inside the subject", async () => {
		let token = unwrap(await signUnsubscribeToken(SECRET, { subject: "tenant:42", list: "d" }));
		let claims = await verifyUnsubscribeToken(SECRET, token);
		expect(isSuccess(claims) && claims.data.subject).toBe("tenant:42");
	});

	test("refuses a token whose payload was changed", async () => {
		let token = unwrap(await signUnsubscribeToken(SECRET, CLAIMS));
		let forged = `${token.slice(0, 64)}${Base64Url.encode("teamDailyDigest:member_02X")}`;
		let claims = await verifyUnsubscribeToken(SECRET, forged);
		expect(isFailure(claims) && claims.error).toBeInstanceOf(InvalidUnsubscribeTokenError);
	});

	test("refuses a token whose signature was changed", async () => {
		let token = unwrap(await signUnsubscribeToken(SECRET, CLAIMS));
		let flipped = `${token[0] === "0" ? "1" : "0"}${token.slice(1)}`;
		expect(isFailure(await verifyUnsubscribeToken(SECRET, flipped))).toBe(true);
	});

	test("refuses a token signed with another secret", async () => {
		let token = unwrap(await signUnsubscribeToken("another-secret", CLAIMS));
		expect(isFailure(await verifyUnsubscribeToken(SECRET, token))).toBe(true);
	});

	test("refuses a token signed for another purpose under the same secret", async () => {
		let token = unwrap(await signUnsubscribeToken(SECRET, CLAIMS, { purpose: "digest:v1:" }));
		expect(isFailure(await verifyUnsubscribeToken(SECRET, token))).toBe(true);
		expect(isSuccess(await verifyUnsubscribeToken(SECRET, token, { purpose: "digest:v1:" }))).toBe(
			true,
		);
	});

	test.each([
		["an empty string", ""],
		["a signature alone", "a".repeat(64)],
		["a short token", "abc"],
		["undecodable base64url", `${"a".repeat(64)}!!!`],
	])("refuses %s", async (_, token) => {
		let claims = await verifyUnsubscribeToken(SECRET, token);
		expect(isFailure(claims) && claims.error).toBeInstanceOf(InvalidUnsubscribeTokenError);
	});

	test("accepts a token until its expiry and refuses it after", async () => {
		vi.useFakeTimers({ now: new Date("2026-09-24T12:00:00.000Z") });
		let token = unwrap(
			await signUnsubscribeToken(SECRET, CLAIMS, {
				expiresAt: new Date("2026-10-24T12:00:00.000Z"),
			}),
		);

		vi.setSystemTime(new Date("2026-10-24T11:59:59.000Z"));
		expect(isSuccess(await verifyUnsubscribeToken(SECRET, token))).toBe(true);

		vi.setSystemTime(new Date("2026-10-24T12:00:00.000Z"));
		expect(isFailure(await verifyUnsubscribeToken(SECRET, token))).toBe(true);
	});

	test("verifies a token that names only the list and subject, with no issue time", async () => {
		let purpose = "digest-unsubscribe:v1:";
		let payload = "teamDailyDigest:member_01H";
		let mac = unwrap(await hmac.sign(SECRET, `${purpose}${payload}`));
		let token = `${Hex.encode(mac)}${Base64Url.encode(payload)}`;

		let claims = await verifyUnsubscribeToken(SECRET, token, { purpose });
		expect(isSuccess(claims) && claims.data).toEqual({ ...CLAIMS, issuedAt: null });
	});
});

describe("isOneClickUnsubscribe", () => {
	test("recognizes the RFC 8058 body sent URL-encoded", async () => {
		let request = new Request("https://example.com/u", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: "List-Unsubscribe=One-Click",
		});
		expect(isOneClickUnsubscribe(await request.formData())).toBe(true);
	});

	test("recognizes the RFC 8058 body sent as multipart", async () => {
		let form = new FormData();
		form.set("List-Unsubscribe", "One-Click");
		let request = new Request("https://example.com/u", { method: "POST", body: form });
		expect(isOneClickUnsubscribe(await request.formData())).toBe(true);
	});

	test("tells a person's confirmation form apart from the provider's request", () => {
		let form = new FormData();
		form.set("confirm", "yes");
		expect(isOneClickUnsubscribe(form)).toBe(false);

		form.set("List-Unsubscribe", "one-click");
		expect(isOneClickUnsubscribe(form)).toBe(false);
	});
});
