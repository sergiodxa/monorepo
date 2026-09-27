/**
 * hCaptcha's server side: posts a widget's token to `siteverify` and maps the answer onto
 * the shared `Captcha` contract. hCaptcha scores risk (`1` is a confirmed threat), so an
 * Enterprise score is reported inverted, as the shared likelihood the visitor is human.
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
 * hCaptcha's endpoint and the codes that mean the visitor must act: a token older than
 * its lifetime or already verified is expired, a malformed or missing one is rejected.
 */
const HCAPTCHA: SiteverifyProvider = {
	url: "https://api.hcaptcha.com/siteverify",
	expired: new Set(["expired-input-response", "already-seen-response"]),
	rejected: new Set(["invalid-input-response", "missing-input-response"]),
};

/**
 * Verifies hCaptcha tokens with one account's secret key.
 *
 * @example let hcaptcha = new HCaptcha({ secretKey: env.HCAPTCHA_SECRET, siteKey: env.HCAPTCHA_SITE_KEY });
 */
export class HCaptcha implements Captcha {
	/** The form field the widget submits. */
	readonly field: string;

	#secretKey: string;
	#siteKey: string | undefined;
	#maxRiskScore: number | undefined;
	#timeout: number;

	/**
	 * @param options - The secret key, plus the expected site key, risk threshold, field and timeout
	 */
	constructor(options: HCaptcha.Options) {
		this.#secretKey = options.secretKey;
		this.#siteKey = options.siteKey;
		this.#maxRiskScore = options.maxRiskScore;
		this.field = options.field ?? "h-captcha-response";
		this.#timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
	}

	/**
	 * Asks hCaptcha whether `token` is genuine, consuming it. A risk score above
	 * `maxRiskScore` answers `low-score`; an answer without a score skips the threshold.
	 *
	 * @param token - The `h-captcha-response` value a form submitted
	 * @param options - The visitor's address, which hCaptcha cross-checks against the token
	 * @returns The hostname, solve time and score hCaptcha confirmed, or why it refused
	 */
	async verify(
		token: string,
		options: Captcha.VerifyOptions = {},
	): Promise<Result<Captcha.Verification, CaptchaError>> {
		if (token === "") return failure(new CaptchaError("missing-token"));

		let body = new URLSearchParams({ secret: this.#secretKey, response: token });
		if (options.remoteIp) body.set("remoteip", options.remoteIp);
		if (this.#siteKey) body.set("sitekey", this.#siteKey);

		let answer = await siteverify(HCAPTCHA, body, this.#timeout);
		if (isFailure(answer)) return answer;

		let verification = sharedVerification(answer.data);
		let risk = answer.data.score;
		if (typeof risk === "number") {
			if (this.#maxRiskScore !== undefined && risk > this.#maxRiskScore) {
				return failure(new CaptchaError("low-score"));
			}
			verification.score = 1 - risk;
		}
		return success(verification);
	}
}

/** The options an {@link HCaptcha} is built with. */
export namespace HCaptcha {
	/** Configuration for one hCaptcha site's server side. */
	export interface Options {
		/** The account's secret key; it never reaches the browser. */
		secretKey: string;
		/** The site key tokens must come from, so a token solved for another site is refused. */
		siteKey?: string;
		/**
		 * The highest Enterprise risk score (`0` safe to `1` threat) that still passes, in
		 * hCaptcha's own terms. Unset, every score passes.
		 */
		maxRiskScore?: number;
		/**
		 * The field the widget submits.
		 *
		 * @default "h-captcha-response"
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
