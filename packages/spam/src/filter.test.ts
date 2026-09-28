/**
 * Tests the scoring pipeline's contract: stage order, the short-circuit past the spam threshold,
 * escalation limited to the unsure band, timeouts and thrown checks reported as failures, and
 * moderator reports reaching every learning check.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { success } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { SpamCheck } from "./check.js";

import { createSpamFilter, verdictFor } from "./filter.js";
import { MemoryCheck } from "./memory.js";

/** A submission no check here reads. */
const SUBMISSION = { content: "hello" };

/** A local check answering one signal of `score`. */
function localScore(score: number, name = "local"): SpamCheck {
	return { name, stage: "local", check: () => [{ check: name, score }] };
}

describe("verdictFor", () => {
	test.each([
		[4.9, "ham"],
		[5, "unsure"],
		[9.9, "unsure"],
		[10, "spam"],
		[-3, "ham"],
	] as const)("%d is %s", (score, verdict) => {
		expect(verdictFor(score, { unsure: 5, spam: 10 })).toBe(verdict);
	});

	test("an unsure threshold at the spam threshold leaves no unsure band", () => {
		expect(verdictFor(7, { unsure: 7, spam: 7 })).toBe("spam");
	});
});

describe("check", () => {
	test("adds every signal and keeps each as a reason", async () => {
		let remote = new MemoryCheck({ signals: [{ check: "remote", score: 2 }] });
		let filter = createSpamFilter({ checks: [localScore(4), remote] });

		let assessment = await filter.check(SUBMISSION);

		expect(assessment).toEqual({
			verdict: "unsure",
			score: 6,
			signals: [
				{ check: "local", score: 4 },
				{ check: "remote", score: 2 },
			],
			failures: [],
		});
	});

	test("passes remote checks the score the local stage reached", async () => {
		let seen: number[] = [];
		let remote: SpamCheck = {
			name: "remote",
			stage: "remote",
			check: async (_submission, options) => {
				seen.push(options.score);
				return success([]);
			},
		};
		await createSpamFilter({ checks: [localScore(3), remote] }).check(SUBMISSION);
		expect(seen).toEqual([3]);
	});

	test("skips remote and escalation checks once local rules reach the spam threshold", async () => {
		let remote = new MemoryCheck();
		let escalation = new MemoryCheck({ stage: "escalation" });
		let filter = createSpamFilter({ checks: [localScore(10), remote, escalation] });

		let assessment = await filter.check(SUBMISSION);

		expect(assessment.verdict).toBe("spam");
		expect(remote.calls).toEqual([]);
		expect(escalation.calls).toEqual([]);
	});

	test("escalates only a submission in the unsure band", async () => {
		let escalation = new MemoryCheck({
			stage: "escalation",
			signals: [{ check: "llm", score: 5 }],
		});

		let ham = await createSpamFilter({ checks: [localScore(2), escalation] }).check(SUBMISSION);
		expect(ham.verdict).toBe("ham");
		expect(escalation.calls).toHaveLength(0);

		let unsure = await createSpamFilter({ checks: [localScore(6), escalation] }).check(SUBMISSION);
		expect(unsure.verdict).toBe("spam");
		expect(escalation.calls).toHaveLength(1);
	});

	test("lets a negative signal pull a submission out of the unsure band", async () => {
		let vouch = new MemoryCheck({ signals: [{ check: "reputation", score: -4 }] });
		let assessment = await createSpamFilter({ checks: [localScore(6), vouch] }).check(SUBMISSION);
		expect(assessment).toMatchObject({ verdict: "ham", score: 2 });
	});

	test("reports a failed check and scores without it", async () => {
		let down = new MemoryCheck({ name: "provider" }).failNext("unavailable");
		let assessment = await createSpamFilter({ checks: [localScore(6), down] }).check(SUBMISSION);

		expect(assessment.verdict).toBe("unsure");
		expect(assessment.failures).toHaveLength(1);
		expect(assessment.failures[0]).toMatchObject({
			check: "provider",
			error: { code: "unavailable" },
		});
	});

	test("fails a remote check that overruns the timeout, aborting its signal", async () => {
		let aborted = false;
		let slow: SpamCheck = {
			name: "slow",
			stage: "remote",
			check: (_submission, options) =>
				new Promise(() => {
					options.signal.addEventListener("abort", () => (aborted = true));
				}),
		};

		let assessment = await createSpamFilter({ checks: [slow], timeout: 10 }).check(SUBMISSION);

		expect(assessment.failures[0]).toMatchObject({ check: "slow", error: { code: "timeout" } });
		expect(aborted).toBe(true);
	});

	test("turns a check that throws into an unavailable failure", async () => {
		let broken: SpamCheck = {
			name: "broken",
			stage: "remote",
			check: async () => {
				throw new Error("boom");
			},
		};

		let assessment = await createSpamFilter({ checks: [broken] }).check(SUBMISSION);

		expect(assessment.verdict).toBe("ham");
		expect(assessment.failures[0]?.error.code).toBe("unavailable");
		expect(assessment.failures[0]?.error.message).toContain("boom");
	});

	test("honors custom thresholds", async () => {
		let filter = createSpamFilter({ checks: [localScore(3)], thresholds: { unsure: 2, spam: 3 } });
		expect((await filter.check(SUBMISSION)).verdict).toBe("spam");
	});
});

describe("report", () => {
	test("sends the decision to every check that learns and returns the failures", async () => {
		let learner = new MemoryCheck({ name: "learner" });
		let failing = new MemoryCheck({ name: "failing" }).failReports("misconfigured");
		let filter = createSpamFilter({ checks: [localScore(1), learner, failing] });

		let failures = await filter.report(SUBMISSION, "spam");

		expect(learner.reports).toEqual([{ submission: SUBMISSION, label: "spam" }]);
		expect(failing.reports).toHaveLength(1);
		expect(failures).toHaveLength(1);
		expect(failures[0]).toMatchObject({ check: "failing", error: { code: "misconfigured" } });
	});
});
