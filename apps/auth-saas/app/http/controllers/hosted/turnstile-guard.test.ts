/**
 * Unit tests for the two Turnstile submission policies over a verification outcome: sign-up's
 * closed policy refuses a missing, refused or unverifiable token alike, while the challenged
 * screens' open policy refuses a missing or refused token but lets an unreachable Turnstile through.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CaptchaOutcome } from "@sdxc/captcha/middleware";

import { CaptchaError } from "@sdxc/captcha";
import { createAnalyticsEngine } from "@sdxc/cloudflare-mocks";
import { failure, success } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import {
	passesConditionalTurnstileChallenge,
	passesUnconditionalTurnstileChallenge,
} from "./turnstile-guard";

/** A `TurnstileAttackSignal` over a recording dataset. */
function attackSignal() {
	let analytics = createAnalyticsEngine();
	return { attackSignal: { env: { ANALYTICS: analytics }, tenantId: "ten_1" }, analytics };
}

/** A verification that failed with `code`. */
function failed(code: CaptchaError["code"]): CaptchaOutcome {
	return failure(new CaptchaError(code));
}

let VERIFIED: CaptchaOutcome = success({ hostname: "acme.example.com" });

describe("passesUnconditionalTurnstileChallenge", () => {
	test("passes a submission whose token Turnstile confirms", () => {
		expect(passesUnconditionalTurnstileChallenge(VERIFIED)).toBe(true);
	});

	test.each(["missing-token", "rejected", "expired", "unavailable"] as const)(
		"refuses a submission whose verification failed with %s",
		(code) => {
			expect(passesUnconditionalTurnstileChallenge(failed(code))).toBe(false);
		},
	);

	test("records a refused-turnstile attack signal named by the failure's code", () => {
		let { attackSignal: signal, analytics } = attackSignal();

		passesUnconditionalTurnstileChallenge(failed("rejected"), signal);

		expect(analytics.dataPoints).toEqual([
			{
				indexes: ["ten_1"],
				blobs: ["attack_signal", "ten_1", "credential", "refused-turnstile", "rejected", ""],
				doubles: [1],
			},
		]);
	});

	test("records no attack signal for a submission Turnstile confirms", () => {
		let { attackSignal: signal, analytics } = attackSignal();

		passesUnconditionalTurnstileChallenge(VERIFIED, signal);

		expect(analytics.dataPoints).toHaveLength(0);
	});
});

describe("passesConditionalTurnstileChallenge", () => {
	test("passes a submission whose token Turnstile confirms", () => {
		expect(passesConditionalTurnstileChallenge(VERIFIED)).toBe(true);
	});

	test.each(["missing-token", "rejected", "expired"] as const)(
		"refuses a submission whose verification failed with %s",
		(code) => {
			expect(passesConditionalTurnstileChallenge(failed(code))).toBe(false);
		},
	);

	test("passes a submission when Turnstile could not be reached", () => {
		expect(passesConditionalTurnstileChallenge(failed("unavailable"))).toBe(true);
	});

	test("records a refused-turnstile attack signal for a missing token", () => {
		let { attackSignal: signal, analytics } = attackSignal();

		passesConditionalTurnstileChallenge(failed("missing-token"), signal);

		expect(analytics.dataPoints).toEqual([
			{
				indexes: ["ten_1"],
				blobs: ["attack_signal", "ten_1", "credential", "refused-turnstile", "missing-token", ""],
				doubles: [1],
			},
		]);
	});

	test("records no attack signal when Turnstile could not be reached", () => {
		let { attackSignal: signal, analytics } = attackSignal();

		passesConditionalTurnstileChallenge(failed("unavailable"), signal);

		expect(analytics.dataPoints).toHaveLength(0);
	});
});
