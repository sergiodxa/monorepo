/**
 * Tests the digest unsubscribe token's keys: new tokens are signed with the dedicated
 * Secrets Store key, links mailed under the session secret keep verifying and are counted,
 * and a token signed with any other key verifies under neither.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Log } from "@sdxc/logger";
import { signUnsubscribeToken, verifyUnsubscribeToken } from "@sdxc/mail/unsubscribe";
import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { env } from "cloudflare:workers";
import { afterEach, describe, expect, test, vi } from "vitest";

import {
	UNSUBSCRIBE_SECRET,
	UNSUBSCRIBE_SECRET_VALUE,
	withUnsubscribeSecret,
} from "~/app/lib/test/unsubscribe-secret";

import { signDigestUnsubscribeToken, verifyDigestUnsubscribeToken } from "./unsubscribe-token";

vi.mock("cloudflare:workers", async (importOriginal) => {
	let original = await importOriginal<typeof import("cloudflare:workers")>();
	let { withUnsubscribeSecret: overlay } = await import("~/app/lib/test/unsubscribe-secret");
	return { ...original, env: overlay(original.env) };
});

/** The purpose every digest token is signed under, with either key. */
const PURPOSE = { purpose: "digest-unsubscribe:v1:" };

/** One member's daily digest. */
const CLAIMS = { subject: "subject-1", list: "teamDailyDigest" };

afterEach(() => UNSUBSCRIBE_SECRET.reset());

describe("signDigestUnsubscribeToken", () => {
	test("signs with the dedicated key, which verifies it and the session secret does not", async () => {
		let token = unwrap(await signDigestUnsubscribeToken(CLAIMS));

		let dedicated = await verifyUnsubscribeToken(UNSUBSCRIBE_SECRET_VALUE, token, PURPOSE);
		let session = await verifyUnsubscribeToken(env.COOKIE_SESSION_SECRET, token, PURPOSE);

		expect(isSuccess(dedicated) && dedicated.data).toMatchObject(CLAIMS);
		expect(isFailure(session)).toBe(true);
	});

	test("fails when the dedicated key cannot be read", async () => {
		UNSUBSCRIBE_SECRET.fail();

		expect(isFailure(await signDigestUnsubscribeToken(CLAIMS))).toBe(true);
	});
});

describe("verifyDigestUnsubscribeToken", () => {
	test("accepts a token signed with the dedicated key", async () => {
		let token = unwrap(await signDigestUnsubscribeToken(CLAIMS));

		let claims = await verifyDigestUnsubscribeToken(token);

		expect(isSuccess(claims) && claims.data).toMatchObject(CLAIMS);
	});

	test("accepts a link mailed under the session secret, and counts it", async () => {
		let token = unwrap(await signUnsubscribeToken(env.COOKIE_SESSION_SECRET, CLAIMS, PURPOSE));
		let record: Record<string, unknown> = {};
		let log = new Log({ kind: "request", sink: (emitted) => void (record = emitted) });

		let claims = await log.run(() => verifyDigestUnsubscribeToken(token));

		expect(isSuccess(claims) && claims.data).toMatchObject(CLAIMS);
		expect(JSON.stringify(record)).toContain("legacy_secret");
	});

	test("accepts a session-secret link while the dedicated key cannot be read", async () => {
		let token = unwrap(await signUnsubscribeToken(env.COOKIE_SESSION_SECRET, CLAIMS, PURPOSE));
		UNSUBSCRIBE_SECRET.fail();

		expect(isSuccess(await verifyDigestUnsubscribeToken(token))).toBe(true);
	});

	test("refuses a token signed with neither key", async () => {
		let token = unwrap(await signUnsubscribeToken("some-other-key", CLAIMS, PURPOSE));

		expect(isFailure(await verifyDigestUnsubscribeToken(token))).toBe(true);
	});

	test("refuses a session-secret token signed under another purpose", async () => {
		let token = unwrap(await signUnsubscribeToken(env.COOKIE_SESSION_SECRET, CLAIMS));

		expect(isFailure(await verifyDigestUnsubscribeToken(token))).toBe(true);
	});
});

/** Keeps the overlay helper's own contract honest: every other binding passes through. */
test("leaves every other binding on its placeholder", () => {
	expect(withUnsubscribeSecret({ OTHER: "x" }).OTHER).toBe("x");
	expect(env.COOKIE_SESSION_SECRET).toBe("test-COOKIE_SESSION_SECRET");
});
