/**
 * Tests for the Akismet check against a stubbed REST API: the form it sends, how each answer
 * becomes a signal, every way a call fails, the no-IP short circuit, and the reports that
 * forward a moderator's decision to `submit-spam` and `submit-ham`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, isSuccess } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import type { Signal, SpamCheckError, Submission } from "./check.js";

import { akismet } from "./akismet.js";

const API_URL = "https://rest.akismet.com/1.1";

const OPTIONS: akismet.Options = { apiKey: "key-123", blog: "https://example.com" };

const SUBMISSION: Submission = {
	content: "Great post, thanks!",
	author: {
		name: "Ada",
		email: "ada@example.com",
		url: "https://ada.example",
		ip: "203.0.113.7",
		userAgent: "Mozilla/5.0",
	},
	submittedAt: new Date("2026-09-28T12:00:00.000Z"),
};

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Answers every call to `endpoint` with `body`, recording each form it received. */
function answer(endpoint: string, body: string, init?: ResponseInit): URLSearchParams[] {
	let received: URLSearchParams[] = [];
	server.use(
		http.post(`${API_URL}/${endpoint}`, async ({ request }) => {
			received.push(new URLSearchParams(await request.text()));
			return new HttpResponse(body, init);
		}),
	);
	return received;
}

/** The signals a check answered, failing the test when it failed. */
async function signals(
	options: akismet.Options = OPTIONS,
	submission = SUBMISSION,
): Promise<Signal[]> {
	let result = await akismet(options).check(submission, {
		signal: new AbortController().signal,
		score: 0,
		signals: [],
	});
	if (Array.isArray(result)) return result;
	if (!isSuccess(result)) return expect.unreachable(`expected signals, got ${result.error.code}`);
	return result.data;
}

/** The error a check failed with, failing the test when it answered signals. */
async function refusal(options: akismet.Options = OPTIONS): Promise<SpamCheckError> {
	let result = await akismet(options).check(SUBMISSION, {
		signal: new AbortController().signal,
		score: 0,
		signals: [],
	});
	if (Array.isArray(result) || !isFailure(result)) {
		return expect.unreachable("expected the check to fail");
	}
	return result.error;
}

describe("akismet", () => {
	test("runs as a remote check", () => {
		let check = akismet(OPTIONS);
		expect(check.name).toBe("akismet");
		expect(check.stage).toBe("remote");
	});

	test("sends the key, the site, the author and the content", async () => {
		let received = answer("comment-check", "false");

		await signals({ ...OPTIONS, commentType: "reply", blogLang: "en", isTest: true });

		expect(received).toHaveLength(1);
		expect(Object.fromEntries(received[0] ?? [])).toEqual({
			api_key: "key-123",
			blog: "https://example.com",
			user_ip: "203.0.113.7",
			user_agent: "Mozilla/5.0",
			comment_type: "reply",
			comment_content: "Great post, thanks!",
			comment_author: "Ada",
			comment_author_email: "ada@example.com",
			comment_author_url: "https://ada.example",
			blog_lang: "en",
			comment_date_gmt: "2026-09-28T12:00:00.000Z",
			is_test: "1",
		});
	});

	test("defaults the comment type and leaves unknown fields out", async () => {
		let received = answer("comment-check", "false");

		await signals(OPTIONS, { content: "Hello", author: { ip: "203.0.113.7" } });

		expect(Object.fromEntries(received[0] ?? [])).toEqual({
			api_key: "key-123",
			blog: "https://example.com",
			user_ip: "203.0.113.7",
			comment_type: "comment",
			comment_content: "Hello",
		});
	});

	test("answers a spam signal when Akismet says true", async () => {
		answer("comment-check", "true");

		expect(await signals()).toEqual([expect.objectContaining({ check: "akismet.spam", score: 8 })]);
	});

	test("answers a larger signal that clears the spam threshold on discard", async () => {
		answer("comment-check", "true", { headers: { "X-akismet-pro-tip": "discard" } });

		let [signal] = await signals();
		expect(signal).toEqual(expect.objectContaining({ check: "akismet.discard", score: 12 }));
		expect(signal?.score).toBeGreaterThanOrEqual(10);
	});

	test("answers a negative signal when Akismet says false", async () => {
		answer("comment-check", "false");

		expect(await signals()).toEqual([expect.objectContaining({ check: "akismet.ham", score: -2 })]);
	});

	test("uses the weights it is given", async () => {
		answer("comment-check", "true");

		expect(await signals({ ...OPTIONS, spamScore: 4 })).toEqual([
			expect.objectContaining({ check: "akismet.spam", score: 4 }),
		]);
	});

	test("makes no request and answers nothing without an author IP", async () => {
		let received = answer("comment-check", "true");

		expect(await signals(OPTIONS, { content: "Hello", author: { name: "Ada" } })).toEqual([]);
		expect(await signals(OPTIONS, { content: "Hello" })).toEqual([]);
		expect(received).toHaveLength(0);
	});

	test("fails misconfigured on an invalid key", async () => {
		answer("comment-check", "invalid", {
			headers: { "X-akismet-debug-help": "We were unable to parse your blog URI" },
		});

		let error = await refusal();
		expect(error.code).toBe("misconfigured");
		expect(error.message).toContain("unable to parse your blog URI");
	});

	test("fails misconfigured on an invalid body without the debug header", async () => {
		answer("comment-check", "invalid");

		expect((await refusal()).code).toBe("misconfigured");
	});

	test("fails unavailable on a server error", async () => {
		answer("comment-check", "oops", { status: 500 });

		expect((await refusal()).code).toBe("unavailable");
	});

	test("fails unavailable when the network fails", async () => {
		server.use(http.post(`${API_URL}/comment-check`, () => HttpResponse.error()));

		expect((await refusal()).code).toBe("unavailable");
	});

	test("fails invalid-response on a body Akismet never sends", async () => {
		answer("comment-check", "maybe");

		expect((await refusal()).code).toBe("invalid-response");
	});

	test("passes the filter's signal to fetch", async () => {
		answer("comment-check", "true");
		let controller = new AbortController();
		controller.abort();

		let result = await akismet(OPTIONS).check(SUBMISSION, {
			signal: controller.signal,
			score: 0,
			signals: [],
		});

		if (Array.isArray(result) || !isFailure(result))
			return expect.unreachable("expected a failure");
		expect(result.error.code).toBe("unavailable");
	});
});

describe("akismet report", () => {
	test("sends spam to submit-spam with the checked fields", async () => {
		let received = answer("submit-spam", "Thanks for making the web a better place.");

		let result = await akismet(OPTIONS).report?.(SUBMISSION, "spam");

		expect(result && isSuccess(result)).toBe(true);
		expect(received).toHaveLength(1);
		expect(received[0]?.get("user_ip")).toBe("203.0.113.7");
		expect(received[0]?.get("comment_content")).toBe("Great post, thanks!");
		expect(received[0]?.get("api_key")).toBe("key-123");
	});

	test("sends ham to submit-ham", async () => {
		let received = answer("submit-ham", "Thanks for making the web a better place.");

		let result = await akismet(OPTIONS).report?.(SUBMISSION, "ham");

		expect(result && isSuccess(result)).toBe(true);
		expect(received).toHaveLength(1);
		expect(received[0]?.get("comment_author_email")).toBe("ada@example.com");
	});

	test("fails misconfigured when the key is refused", async () => {
		answer("submit-spam", "invalid", { headers: { "X-akismet-debug-help": "Invalid API key" } });

		let result = await akismet(OPTIONS).report?.(SUBMISSION, "spam");

		if (result === undefined || !isFailure(result)) return expect.unreachable("expected a failure");
		expect(result.error.code).toBe("misconfigured");
	});

	test("succeeds without a request when the submission has no author IP", async () => {
		let received = answer("submit-ham", "Thanks for making the web a better place.");

		let result = await akismet(OPTIONS).report?.({ content: "Hello" }, "ham");

		expect(result && isSuccess(result)).toBe(true);
		expect(received).toHaveLength(0);
	});
});
