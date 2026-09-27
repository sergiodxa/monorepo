/**
 * Google reCAPTCHA's server side for v2 and v3 keys, which share one `siteverify`: v3
 * answers carry a score and an action, so a v3 score under the threshold fails with
 * `low-score` while a v2 answer, which has no score, passes on `success` alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { SiteverifyProvider } from "./lib/siteverify.js";

import { DEFAULT_TIMEOUT_MS, sharedVerification, siteverify } from "./lib/siteverify.js";

import type { Captcha } from "./index.js";

import { CaptchaError } from "./index.js";

/**
 * Google's endpoint and the codes that mean the visitor must act: a token older than two
 * minutes or already verified is expired, a malformed or missing one is rejected.
 */
const RECAPTCHA: SiteverifyProvider = {
	url: "https://www.google.com/recaptcha/api/siteverify",
	expired: new Set(["timeout-or-duplicate"]),
	rejected: new Set(["invalid-input-response", "missing-input-response"]),
};

/**
 * Verifies reCAPTCHA v2 or v3 tokens with one key's secret. Hold a v3 token to the form's
 * action with the middleware's `action` option, since Google accepts a token from any.
 *
 * @example let recaptcha = new ReCaptcha({ secretKey: env.RECAPTCHA_SECRET, minScore: 0.7 });
 */
export class ReCaptcha implements Captcha {
	/** The form field the widget submits. */
	readonly field: string;

	#secretKey: string;
	#minScore: number;
	#timeout: number;

	/**
	 * @param options - The secret key, plus the v3 score threshold, field and timeout
	 */
	constructor(options: ReCaptcha.Options) {
		this.#secretKey = options.secretKey;
		this.#minScore = options.minScore ?? 0.5;
		this.field = options.field ?? "g-recaptcha-response";
		this.#timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
	}

	/**
	 * Asks Google whether `token` is genuine, consuming it. A v3 score under `minScore`
	 * answers `low-score`, so an app can fall back to a v2 challenge.
	 *
	 * @param token - The `g-recaptcha-response` value a form submitted
	 * @param options - The visitor's address, passed on to Google
	 * @returns The hostname, solve time, and for v3 the score and action, or why it refused
	 */
	async verify(
		token: string,
		options: Captcha.VerifyOptions = {},
	): Promise<Result<Captcha.Verification, CaptchaError>> {
		if (token === "") return failure(new CaptchaError("missing-token"));

		let body = new URLSearchParams({ secret: this.#secretKey, response: token });
		if (options.remoteIp) body.set("remoteip", options.remoteIp);

		let answer = await siteverify(RECAPTCHA, body, this.#timeout);
		if (isFailure(answer)) return answer;

		let verification = sharedVerification(answer.data);
		let score = answer.data.score;
		if (typeof score === "number") {
			if (score < this.#minScore) return failure(new CaptchaError("low-score"));
			verification.score = score;
		}
		return success(verification);
	}
}

/** The options a {@link ReCaptcha} is built with. */
export namespace ReCaptcha {
	/** Configuration for one reCAPTCHA key's server side. */
	export interface Options {
		/** The key's secret; it never reaches the browser. */
		secretKey: string;
		/**
		 * The lowest v3 score (`0` bot to `1` human) that passes; Google suggests starting at
		 * `0.5` and tuning from the admin console. v2 answers carry no score.
		 *
		 * @default 0.5
		 */
		minScore?: number;
		/**
		 * The field the widget submits.
		 *
		 * @default "g-recaptcha-response"
		 */
		field?: string;
		/**
		 * Milliseconds a `siteverify` call may take before it answers `unavailable`.
		 *
		 * @default 10000
		 */
		timeout?: number;
	}
}
