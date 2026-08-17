/**
 * Behavioural tests for platform session hardening: signed-token creation and the
 * verification path that must reject tampered payloads, forged signatures, wrong
 * secrets, malformed tokens, and expired sessions. Also covers the Set-Cookie
 * builders and the Cookie-header parser.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { base64UrlDecode, base64UrlEncode, hmacSign } from "./crypto-utils";
import {
	PLATFORM_SESSION_COOKIE,
	PLATFORM_SESSION_MAX_AGE,
	clearSessionCookie,
	createSessionCookie,
	createSessionToken,
	getCookie,
	isPlatformSessionActive,
	verifySessionToken,
} from "./platform-session";

let SECRET = "test-session-secret";

describe("createSessionToken", () => {
	test("produces a two-part payload.signature token", async () => {
		let token = await createSessionToken("user-123", "user@example.test", SECRET);
		let parts = token.split(".");
		expect(parts).toHaveLength(2);
		expect(parts[0]!.length).toBeGreaterThan(0);
		expect(parts[1]!.length).toBeGreaterThan(0);
	});

	test("embeds the subject, email, and issued/expiry timestamps", async () => {
		let before = Math.floor(Date.now() / 1000);
		let token = await createSessionToken("user-123", "user@example.test", SECRET);
		let after = Math.floor(Date.now() / 1000);

		let payload = JSON.parse(base64UrlDecode(token.split(".")[0]!)) as {
			sub: string;
			email: string;
			iat: number;
			exp: number;
			sid?: string;
		};

		expect(payload.sub).toBe("user-123");
		expect(payload.email).toBe("user@example.test");
		expect(payload.iat).toBeGreaterThanOrEqual(before);
		expect(payload.iat).toBeLessThanOrEqual(after);
		expect(payload.exp).toBe(payload.iat + PLATFORM_SESSION_MAX_AGE);
	});

	test("includes the tenant session id when provided", async () => {
		let token = await createSessionToken("user-123", "user@example.test", SECRET, "sid-abc");
		let payload = JSON.parse(base64UrlDecode(token.split(".")[0]!)) as {
			sub: string;
			email: string;
			iat: number;
			exp: number;
			sid?: string;
		};
		expect(payload.sid).toBe("sid-abc");
	});

	test("signs the encoded payload with the given secret", async () => {
		let token = await createSessionToken("user-123", "user@example.test", SECRET);
		let [encodedPayload, signature] = token.split(".");
		let expected = await hmacSign(encodedPayload!, SECRET);
		expect(signature).toBe(expected);
	});
});

describe("verifySessionToken", () => {
	test("round-trips a freshly created token", async () => {
		let token = await createSessionToken("user-123", "user@example.test", SECRET, "sid-abc");
		let result = await verifySessionToken(token, SECRET);
		expect(result).toEqual({
			subjectId: "user-123",
			email: "user@example.test",
			sessionId: "sid-abc",
		});
	});

	test("returns sessionId undefined when the token had no sid", async () => {
		let token = await createSessionToken("user-123", "user@example.test", SECRET);
		let result = await verifySessionToken(token, SECRET);
		expect(result).toEqual({
			subjectId: "user-123",
			email: "user@example.test",
			sessionId: undefined,
		});
	});

	test("rejects a token signed with a different secret", async () => {
		let token = await createSessionToken("user-123", "user@example.test", SECRET);
		let result = await verifySessionToken(token, "a-different-secret");
		expect(result).toBeNull();
	});

	test("rejects a token whose payload was tampered with", async () => {
		let token = await createSessionToken("user-123", "user@example.test", SECRET);
		let [, signature] = token.split(".");

		// Swap in a forged payload (escalating the subject) while keeping the old signature.
		let forgedPayload = base64UrlEncode(
			JSON.stringify({
				sub: "attacker",
				email: "attacker@example.test",
				iat: Math.floor(Date.now() / 1000),
				exp: Math.floor(Date.now() / 1000) + 1000,
			}),
		);
		let forgedToken = `${forgedPayload}.${signature}`;

		let result = await verifySessionToken(forgedToken, SECRET);
		expect(result).toBeNull();
	});

	test("rejects a token whose signature was tampered with", async () => {
		let token = await createSessionToken("user-123", "user@example.test", SECRET);
		let [encodedPayload] = token.split(".");
		let forgedToken = `${encodedPayload}.not-a-valid-signature`;

		let result = await verifySessionToken(forgedToken, SECRET);
		expect(result).toBeNull();
	});

	test("rejects a token missing the signature part", async () => {
		let token = await createSessionToken("user-123", "user@example.test", SECRET);
		let [encodedPayload] = token.split(".");
		let result = await verifySessionToken(encodedPayload!, SECRET);
		expect(result).toBeNull();
	});

	test("rejects a token with more than two parts", async () => {
		let token = await createSessionToken("user-123", "user@example.test", SECRET);
		let result = await verifySessionToken(`${token}.extra`, SECRET);
		expect(result).toBeNull();
	});

	test("rejects a token with an empty payload segment", async () => {
		let signature = await hmacSign("", SECRET);
		let result = await verifySessionToken(`.${signature}`, SECRET);
		expect(result).toBeNull();
	});

	test("rejects an expired token", async () => {
		// Hand-craft a correctly-signed token whose exp is in the past.
		let past = Math.floor(Date.now() / 1000) - 10;
		let payload = {
			sub: "user-123",
			email: "user@example.test",
			iat: past - PLATFORM_SESSION_MAX_AGE,
			exp: past,
		};
		let encodedPayload = base64UrlEncode(JSON.stringify(payload));
		let signature = await hmacSign(encodedPayload, SECRET);

		let result = await verifySessionToken(`${encodedPayload}.${signature}`, SECRET);
		expect(result).toBeNull();
	});

	test("accepts a correctly-signed token expiring in the future", async () => {
		let now = Math.floor(Date.now() / 1000);
		let payload = { sub: "user-123", email: "user@example.test", iat: now, exp: now + 60 };
		let encodedPayload = base64UrlEncode(JSON.stringify(payload));
		let signature = await hmacSign(encodedPayload, SECRET);

		let result = await verifySessionToken(`${encodedPayload}.${signature}`, SECRET);
		expect(result).toEqual({
			subjectId: "user-123",
			email: "user@example.test",
			sessionId: undefined,
		});
	});

	test("rejects a token whose payload is not valid JSON", async () => {
		let encodedPayload = base64UrlEncode("this is not json");
		let signature = await hmacSign(encodedPayload, SECRET);
		let result = await verifySessionToken(`${encodedPayload}.${signature}`, SECRET);
		expect(result).toBeNull();
	});

	test("rejects a token whose payload is missing required fields", async () => {
		// Correctly signed but the payload omits `exp`/`iat`, so schema validation fails.
		let encodedPayload = base64UrlEncode(JSON.stringify({ sub: "user-123" }));
		let signature = await hmacSign(encodedPayload, SECRET);
		let result = await verifySessionToken(`${encodedPayload}.${signature}`, SECRET);
		expect(result).toBeNull();
	});
});

describe("createSessionCookie", () => {
	test("sets the session name, path, HttpOnly and Lax attributes", () => {
		let cookie = createSessionCookie("the-token", false);
		expect(cookie).toContain(`${PLATFORM_SESSION_COOKIE}=the-token`);
		expect(cookie).toContain("Path=/");
		expect(cookie).toContain("HttpOnly");
		expect(cookie).toContain("SameSite=Lax");
		expect(cookie).toContain(`Max-Age=${PLATFORM_SESSION_MAX_AGE}`);
	});

	test("adds Secure in production", () => {
		let cookie = createSessionCookie("the-token", true);
		expect(cookie).toContain("Secure");
	});

	test("omits Secure outside production", () => {
		let cookie = createSessionCookie("the-token", false);
		expect(cookie).not.toContain("Secure");
	});
});

describe("clearSessionCookie", () => {
	test("expires the session cookie with Max-Age=0", () => {
		let cookie = clearSessionCookie();
		expect(cookie).toContain(`${PLATFORM_SESSION_COOKIE}=;`);
		expect(cookie).toContain("Max-Age=0");
		expect(cookie).toContain("HttpOnly");
	});
});

describe("getCookie", () => {
	test("extracts a cookie value by name", () => {
		expect(getCookie("a=1; b=2; c=3", "b")).toBe("2");
	});

	test("extracts the first cookie in the header", () => {
		expect(getCookie("first=one; second=two", "first")).toBe("one");
	});

	test("extracts the session cookie among others", () => {
		let header = `other=x; ${PLATFORM_SESSION_COOKIE}=session-value; more=y`;
		expect(getCookie(header, PLATFORM_SESSION_COOKIE)).toBe("session-value");
	});

	test("returns null when the cookie is absent", () => {
		expect(getCookie("a=1; b=2", "missing")).toBeNull();
	});

	test("returns null for an empty header", () => {
		expect(getCookie("", "anything")).toBeNull();
	});

	test("does not match a name that is only a suffix of another cookie", () => {
		// "token" must not match "session_token".
		expect(getCookie("session_token=abc", "token")).toBeNull();
	});

	test("returns an empty string for a present but empty cookie", () => {
		expect(getCookie("empty=; other=1", "empty")).toBe("");
	});
});

describe("isPlatformSessionActive", () => {
	test("accepts when the sid exists server-side", async () => {
		let active = await isPlatformSessionActive("sid-abc", async () => true);
		expect(active).toBe(true);
	});

	test("rejects when the sid no longer exists (revoked/logged out)", async () => {
		let active = await isPlatformSessionActive("sid-abc", async () => false);
		expect(active).toBe(false);
	});

	test("rejects a token with no sid (cannot be revoked, fail closed)", async () => {
		let checked = false;
		let active = await isPlatformSessionActive(undefined, async () => {
			checked = true;
			return true;
		});
		expect(active).toBe(false);
		// The store must not even be consulted for a sid-less token.
		expect(checked).toBe(false);
	});

	test("fails open when the session store is unreachable", async () => {
		let active = await isPlatformSessionActive("sid-abc", async () => {
			throw new Error("network");
		});
		expect(active).toBe(true);
	});

	test("passes the sid through to the checker", async () => {
		let seen = "";
		await isPlatformSessionActive("sid-xyz", async (sid) => {
			seen = sid;
			return true;
		});
		expect(seen).toBe("sid-xyz");
	});
});
