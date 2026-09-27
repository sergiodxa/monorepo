/**
 * The `siteverify` call Turnstile, hCaptcha and reCAPTCHA share: a form POST of the secret
 * and token, a JSON answer with `success` and `error-codes`, and the mapping of that answer
 * onto the neutral error codes through each provider's own code tables.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";

import type { Captcha } from "../index.js";

import { CaptchaError } from "../index.js";

/** How long a `siteverify` call may take before it counts as unavailable. */
export const DEFAULT_TIMEOUT_MS = 10_000;

/** A parsed JSON body, whatever its shape, as the input `validate` checks it from. */
type ValidateInput = Parameters<typeof validate>[0];

/**
 * The answer fields the three providers share; anything else they add is dropped. `score`
 * is `null` on an hCaptcha plan without scoring, so both absent and `null` are accepted.
 */
const SITEVERIFY_ANSWER = s.object({
	success: s.boolean(),
	"error-codes": s.optional(s.array(s.string())),
	hostname: s.optional(s.string()),
	action: s.optional(s.string()),
	challenge_ts: s.optional(s.string()),
	score: s.optional(s.nullable(s.number())),
});

/** A successful `siteverify` answer, validated. */
export type SiteverifyAnswer = s.InferOutput<typeof SITEVERIFY_ANSWER>;

/** One provider's endpoint and the codes that mean the visitor must act. */
export interface SiteverifyProvider {
	url: string;
	/** Codes for a token that is stale or already used. */
	expired: ReadonlySet<string>;
	/** Codes for a token the provider refused as not genuine. */
	rejected: ReadonlySet<string>;
}

/**
 * Posts `body` to the provider and validates the answer. A refusal naming no code, or only
 * token codes, is the visitor's to fix; any other code (a bad secret, a malformed request,
 * a provider-side error), an unreachable endpoint, a non-OK status, a timeout and an
 * unreadable body all answer `unavailable`.
 *
 * @param provider - The endpoint and its code tables
 * @param body - The form fields, `secret` and `response` included
 * @param timeout - Milliseconds before the call is abandoned
 * @returns The answer of a successful verification, or the neutral reason it failed
 */
export async function siteverify(
	provider: SiteverifyProvider,
	body: URLSearchParams,
	timeout: number,
): Promise<Result<SiteverifyAnswer, CaptchaError>> {
	let json: ValidateInput;
	try {
		let response = await fetch(provider.url, {
			method: "POST",
			body,
			signal: AbortSignal.timeout(timeout),
		});
		if (!response.ok) {
			return failure(new CaptchaError("unavailable", [`http-${response.status}`]));
		}
		json = (await response.json()) as ValidateInput;
	} catch {
		return failure(new CaptchaError("unavailable"));
	}

	let parsed = await validate(json, SITEVERIFY_ANSWER);
	if (isFailure(parsed)) return failure(new CaptchaError("unavailable", ["malformed-response"]));

	let answer = parsed.data;
	if (answer.success) return success(answer);

	let codes = answer["error-codes"] ?? [];
	return failure(new CaptchaError(classify(provider, codes), codes));
}

/**
 * The facts every siteverify provider reports alike: hostname, action and solve time. An
 * empty string is the provider's way of saying "none", so it stays unreported.
 *
 * @param answer - A successful answer
 * @returns The shared part of the verification
 */
export function sharedVerification(answer: SiteverifyAnswer): Captcha.Verification {
	let verification: Captcha.Verification = {};
	if (answer.hostname) verification.hostname = answer.hostname;
	if (answer.action) verification.action = answer.action;
	if (answer.challenge_ts) {
		let challengedAt = new Date(answer.challenge_ts);
		if (!Number.isNaN(challengedAt.getTime())) verification.challengedAt = challengedAt;
	}
	return verification;
}

/**
 * The neutral reason for a provider's refusal codes.
 *
 * @param provider - The provider's code tables
 * @param codes - The provider's `error-codes`
 * @returns The provider-neutral reason
 */
function classify(provider: SiteverifyProvider, codes: readonly string[]): Captcha.ErrorCode {
	if (codes.some((code) => provider.expired.has(code))) return "expired";
	if (codes.every((code) => provider.rejected.has(code))) return "rejected";
	return "unavailable";
}
