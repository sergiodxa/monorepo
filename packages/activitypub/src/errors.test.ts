/**
 * The retry verdict each failure carries, which a job consumer reads to decide between
 * retrying and acknowledging.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { ActivityPubError, ActivityPubFetchError, ActivityPubParseError } from "./errors.js";

/** The URL every fetch failure here concerns. */
const URL = "https://mastodon.social/users/alice";

describe("ActivityPubFetchError", () => {
	test.each([
		["timeout", null, true],
		["network", null, true],
		["http", 503, true],
		["http", 429, true],
		["http", 400, false],
		["gone", 410, false],
		["not-found", 404, false],
		["refused-url", null, false],
		["id-mismatch", 200, false],
	] as const)("%s with status %s is retryable: %s", (code, status, retryable) => {
		let error = new ActivityPubFetchError(code, URL, "failed", { status });
		expect(error).toBeInstanceOf(ActivityPubError);
		expect(error).toMatchObject({ code, url: URL, status, retryable });
	});

	test("takes an explicit verdict and keeps the cause", () => {
		let cause = new Error("boom");
		let error = new ActivityPubFetchError("http", URL, "failed", {
			status: 500,
			retryable: false,
			cause,
		});
		expect(error.retryable).toBe(false);
		expect(error.cause).toBe(cause);
	});
});

describe("ActivityPubParseError", () => {
	test("summarizes the first issue and counts the rest", () => {
		let error = new ActivityPubParseError("actor", [
			{ at: "/inbox", message: '"inbox" must be a string IRI.' },
			{ at: "/preferredUsername", message: '"preferredUsername" is required.' },
		]);
		expect(error.message).toBe(
			'Invalid actor at /inbox: "inbox" must be a string IRI. (and 1 more)',
		);
		expect(error).toMatchObject({
			code: "invalid-document",
			retryable: false,
			name: "ActivityPubParseError",
		});
	});
});
