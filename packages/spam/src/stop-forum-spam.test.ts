/**
 * Exercises the StopForumSpam check against answers served through MSW: scaled scores per
 * field, stale reports, the fields it sends, and every way the lookup can fail.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { isFailure, success, unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import type { Signal, SpamCheckError, Submission } from "./check.js";

import { STOP_FORUM_SPAM_ENDPOINT, stopForumSpam } from "./stop-forum-spam.js";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** `lastseen` as the API writes it, `days` before now. */
function daysAgo(days: number): string {
	return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 19).replace("T", " ");
}

/** Serves `body` for every lookup and records the requests. */
function answerWith(body: Record<string, unknown>, init?: ResponseInit) {
	let requests: URL[] = [];
	server.use(
		http.get(STOP_FORUM_SPAM_ENDPOINT, ({ request }) => {
			requests.push(new URL(request.url));
			return HttpResponse.json(body, init);
		}),
	);
	return requests;
}

/** Runs the check with a fresh abort signal, as the filter would. */
async function run(
	submission: Submission,
	options?: stopForumSpam.Options,
): Promise<Result<Signal[], SpamCheckError>> {
	let answer = await stopForumSpam(options).check(submission, {
		signal: new AbortController().signal,
		score: 0,
		signals: [],
	});
	return Array.isArray(answer) ? success(answer) : answer;
}

/** The signals of a successful run. */
async function signalsOf(
	submission: Submission,
	options?: stopForumSpam.Options,
): Promise<Signal[]> {
	return unwrap(await run(submission, options));
}

/** The error code of a failed run, `null` when it succeeded. */
async function errorOf(submission: Submission): Promise<SpamCheckError | null> {
	let outcome = await run(submission);
	return isFailure(outcome) ? outcome.error : null;
}

const AUTHOR: Submission.Author = { ip: "203.0.113.7", email: "bot@example.com", name: "bot" };

describe("stopForumSpam", () => {
	test("scores each reported field by its weight scaled by confidence", async () => {
		answerWith({
			success: 1,
			ip: { appears: 1, frequency: 40, confidence: 90, lastseen: daysAgo(2) },
			email: { appears: 1, frequency: 3, confidence: 50, lastseen: daysAgo(5) },
			username: { appears: 0, frequency: 0 },
		});
		let signals = await signalsOf({ content: "hi", author: AUTHOR });
		expect(signals.map(({ check, score }) => ({ check, score }))).toEqual([
			{ check: "stop-forum-spam.ip", score: 4.5 },
			{ check: "stop-forum-spam.email", score: 3 },
		]);
		expect(signals[0]?.detail).toContain("reported 40 times");
		expect(signals[0]?.detail).toContain("90% confidence");
	});

	test("answers nothing for a clean author", async () => {
		answerWith({
			success: 1,
			ip: { appears: 0, frequency: 0 },
			email: { appears: 0, frequency: 0 },
			username: { appears: 0, frequency: 0 },
		});
		expect(await signalsOf({ content: "hi", author: AUTHOR })).toEqual([]);
	});

	test("ignores reports older than maxAgeDays", async () => {
		answerWith({
			success: 1,
			ip: { appears: 1, frequency: 9, confidence: 99, lastseen: daysAgo(120) },
			email: { appears: 1, frequency: 9, confidence: 99, lastseen: daysAgo(20) },
		});
		let author = { ip: AUTHOR.ip, email: AUTHOR.email };
		expect((await signalsOf({ content: "hi", author })).map((s) => s.check)).toEqual([
			"stop-forum-spam.email",
		]);
		answerWith({
			success: 1,
			ip: { appears: 1, frequency: 9, confidence: 99, lastseen: daysAgo(120) },
			email: { appears: 1, frequency: 9, confidence: 99, lastseen: daysAgo(20) },
		});
		expect(await signalsOf({ content: "hi", author }, { maxAgeDays: 10 })).toEqual([]);
	});

	test("caps the total at maxScore", async () => {
		answerWith({
			success: 1,
			ip: { appears: 1, frequency: 9, confidence: 100, lastseen: daysAgo(1) },
			email: { appears: 1, frequency: 9, confidence: 100, lastseen: daysAgo(1) },
			username: { appears: 1, frequency: 9, confidence: 100, lastseen: daysAgo(1) },
		});
		let signals = await signalsOf({ content: "hi", author: AUTHOR });
		expect(signals.reduce((sum, signal) => sum + signal.score, 0)).toBe(10);
		expect(signals.map((s) => s.score)).toEqual([5, 5]);
	});

	test("reads numbers the API sends as strings", async () => {
		answerWith({
			success: "1",
			ip: { appears: "1", frequency: "255", confidence: "100", lastseen: daysAgo(1) },
		});
		expect(await signalsOf({ content: "hi", author: { ip: AUTHOR.ip } })).toMatchObject([
			{ check: "stop-forum-spam.ip", score: 5 },
		]);
	});

	test("sends only the fields the submission has", async () => {
		let requests = answerWith({ success: 1, email: { appears: 0, frequency: 0 } });
		await signalsOf({ content: "hi", author: { email: "a@example.com", name: "  " } });
		let params = requests[0]?.searchParams;
		expect(params?.has("json")).toBe(true);
		expect(params?.get("email")).toBe("a@example.com");
		expect(params?.has("ip")).toBe(false);
		expect(params?.has("username")).toBe(false);
	});

	test("makes no request without an IP, email or name", async () => {
		let requests = answerWith({ success: 1 });
		expect(await signalsOf({ content: "hi" })).toEqual([]);
		expect(await signalsOf({ content: "hi", author: { url: "https://example.com" } })).toEqual([]);
		expect(requests).toHaveLength(0);
	});

	test("fails unavailable on an HTTP error, a network error or an API refusal", async () => {
		answerWith({ success: 0 }, { status: 503 });
		expect((await errorOf({ content: "hi", author: AUTHOR }))?.code).toBe("unavailable");

		server.use(http.get(STOP_FORUM_SPAM_ENDPOINT, () => HttpResponse.error()));
		expect((await errorOf({ content: "hi", author: AUTHOR }))?.code).toBe("unavailable");

		answerWith({ success: 0, error: "rate limit exceeded" });
		let refused = await errorOf({ content: "hi", author: AUTHOR });
		expect(refused?.code).toBe("unavailable");
		expect(refused?.message).toContain("rate limit exceeded");
	});

	test("fails invalid-response on a body it cannot read", async () => {
		server.use(http.get(STOP_FORUM_SPAM_ENDPOINT, () => HttpResponse.text("<html>oops</html>")));
		expect((await errorOf({ content: "hi", author: AUTHOR }))?.code).toBe("invalid-response");

		answerWith({ success: 1, ip: { frequency: 3 } });
		expect((await errorOf({ content: "hi", author: AUTHOR }))?.code).toBe("invalid-response");
	});
});
