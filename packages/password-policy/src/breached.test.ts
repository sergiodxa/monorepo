/**
 * Covers the Pwned Passwords range lookup against an MSW stand-in for the API: what
 * leaves the process (a five-character prefix and the padding header), how a response is
 * read, and how each way the lookup can fail is reported.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isSuccess } from "@sdxc/result";
import { delay, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { checkBreachedPassword, PWNED_PASSWORDS_RANGE_URL } from "./breached.js";

/** SHA-1 of `password`, split where the range API splits it. */
const PASSWORD_PREFIX = "5BAA6";
const PASSWORD_SUFFIX = "1E4C9B93F3F0682250B6CF8331B7EE68FD8";

/** The range route every handler answers, matching any prefix. */
const RANGE_ROUTE = `${PWNED_PASSWORDS_RANGE_URL}:prefix`;

/** Suffixes that are never the candidate's, filling a response the way real ones are filled. */
const UNRELATED_LINES = [
	"003D68EB55068C33ACE09247EE4C639306B:3",
	"012C192B2F16F82EA0EB9EF18D9D539B0DD:1",
	"FFFFB2F8F7CC32F3B8E1B6D8A9E0C6F1A10:12",
];

/** What each intercepted request carried. */
interface Recorded {
	url: string;
	addPadding: string | null;
	userAgent: string | null;
}

/** Requests seen by the current test, emptied after each one. */
const REQUESTS: Recorded[] = [];

/** The Pwned Passwords stand-in; an unhandled request fails the test. */
const SERVER = setupServer();

beforeAll(() => SERVER.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
	SERVER.resetHandlers();
	REQUESTS.length = 0;
});
afterAll(() => SERVER.close());

/** Answers the range route with the given body lines, recording each request. */
function answerWith(lines: string[]) {
	SERVER.use(
		http.get(RANGE_ROUTE, ({ request }) => {
			REQUESTS.push({
				url: request.url,
				addPadding: request.headers.get("Add-Padding"),
				userAgent: request.headers.get("User-Agent"),
			});
			return new HttpResponse(lines.join("\r\n"), {
				headers: { "Content-Type": "text/plain" },
			});
		}),
	);
}

describe("checkBreachedPassword", () => {
	test("refuses a password whose suffix the range lists, with its occurrence count", async () => {
		answerWith([...UNRELATED_LINES, `${PASSWORD_SUFFIX}:10434004`]);

		let result = await checkBreachedPassword("password");

		if (isSuccess(result)) throw new Error("expected a failure");
		expect(result.error.issue).toEqual({ reason: "breached", occurrences: 10434004 });
	});

	test("matches a suffix the API answers in lowercase", async () => {
		answerWith([`${PASSWORD_SUFFIX.toLowerCase()}:3`]);

		let result = await checkBreachedPassword("password");

		if (isSuccess(result)) throw new Error("expected a failure");
		expect(result.error.issue).toEqual({ reason: "breached", occurrences: 3 });
	});

	test("accepts a password whose suffix is absent from the range", async () => {
		answerWith(UNRELATED_LINES);

		expect(isSuccess(await checkBreachedPassword("password"))).toBe(true);
	});

	test("ignores a padding entry, which carries a zero count", async () => {
		answerWith([...UNRELATED_LINES, `${PASSWORD_SUFFIX}:0`]);

		expect(isSuccess(await checkBreachedPassword("password"))).toBe(true);
	});

	test("sends only the five-character prefix of the hash", async () => {
		answerWith(UNRELATED_LINES);

		await checkBreachedPassword("password");

		expect(REQUESTS).toHaveLength(1);
		let url = new URL(REQUESTS[0]!.url);
		expect(url.origin + url.pathname).toBe(`${PWNED_PASSWORDS_RANGE_URL}${PASSWORD_PREFIX}`);
		expect(url.search).toBe("");
		expect(REQUESTS[0]!.url).not.toContain(PASSWORD_SUFFIX);
		expect(REQUESTS[0]!.url.toUpperCase()).not.toMatch(/[0-9A-F]{6,}/);
	});

	test("sends the padding header and a User-Agent", async () => {
		answerWith(UNRELATED_LINES);

		await checkBreachedPassword("password");

		expect(REQUESTS[0]!.addPadding).toBe("true");
		expect(REQUESTS[0]!.userAgent).toBe("@sdxc/password-policy");
	});

	test("sends a caller's own User-Agent", async () => {
		answerWith(UNRELATED_LINES);

		await checkBreachedPassword("password", { userAgent: "example-app/1.0" });

		expect(REQUESTS[0]!.userAgent).toBe("example-app/1.0");
	});

	test("hashes the NFC form, so either spelling of an accent looks up the same range", async () => {
		answerWith(UNRELATED_LINES);

		await checkBreachedPassword("café-au-lait");
		await checkBreachedPassword("café-au-lait");

		expect(REQUESTS).toHaveLength(2);
		expect(REQUESTS[0]!.url).toBe(REQUESTS[1]!.url);
	});

	test("reports a network failure as the lookup being unavailable", async () => {
		SERVER.use(http.get(RANGE_ROUTE, () => HttpResponse.error()));

		let result = await checkBreachedPassword("password");

		if (isSuccess(result)) throw new Error("expected a failure");
		expect(result.error.issue).toEqual({
			reason: "breach-check-unavailable",
			failure: "network",
			status: null,
		});
	});

	test("reports a non-OK answer as the lookup being unavailable, with its status", async () => {
		SERVER.use(http.get(RANGE_ROUTE, () => new HttpResponse("busy", { status: 503 })));

		let result = await checkBreachedPassword("password");

		if (isSuccess(result)) throw new Error("expected a failure");
		expect(result.error.issue).toEqual({
			reason: "breach-check-unavailable",
			failure: "status",
			status: 503,
		});
	});

	test("reports a lookup that outlasts its timeout as the lookup being unavailable", async () => {
		SERVER.use(
			http.get(RANGE_ROUTE, async () => {
				await delay("infinite");
				return HttpResponse.text("");
			}),
		);

		let result = await checkBreachedPassword("password", { timeout: 20 });

		if (isSuccess(result)) throw new Error("expected a failure");
		expect(result.error.issue).toEqual({
			reason: "breach-check-unavailable",
			failure: "timeout",
			status: null,
		});
	});
});
