/**
 * Cloudflare Turnstile's server side: posts a widget's token to `siteverify` and maps
 * Cloudflare's answer onto the shared `Captcha` contract, keeping a token the visitor
 * must re-solve apart from a call that failed on Cloudflare's or the operator's side.
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
 * Cloudflare's endpoint and the codes that mean the visitor must act: a token reused or
 * older than 300 seconds is expired, a malformed or missing one is rejected.
 */
const TURNSTILE: SiteverifyProvider = {
	url: "https://challenges.cloudflare.com/turnstile/v0/siteverify",
	expired: new Set(["timeout-or-duplicate"]),
	rejected: new Set(["invalid-input-response", "missing-input-response"]),
};

/**
 * Verifies Turnstile tokens with one widget's secret key.
 *
 * @example let turnstile = new Turnstile({ secretKey: env.TURNSTILE_SECRET_KEY });
 */
export class Turnstile implements Captcha {
	/** The form field the widget submits, `cf-turnstile-response` by default. */
	readonly field: string;

	#secretKey: string;
	#timeout: number;

	/**
	 * @param options - The widget's secret key, plus the field and timeout to use
	 */
	constructor(options: Turnstile.Options) {
		this.#secretKey = options.secretKey;
		this.field = options.field ?? "cf-turnstile-response";
		this.#timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
	}

	/**
	 * Asks Cloudflare whether `token` is genuine, consuming it: a second call with the same
	 * token answers `expired`. An unreachable endpoint, a non-OK status, an unreadable body
	 * and a secret-key or Cloudflare-side error all answer `unavailable`.
	 *
	 * @param token - The `cf-turnstile-response` value a form submitted
	 * @param options - The visitor's address, which Cloudflare cross-checks against the token
	 * @returns The hostname, action and solve time Cloudflare confirmed, or why it refused
	 */
	async verify(
		token: string,
		options: Captcha.VerifyOptions = {},
	): Promise<Result<Captcha.Verification, CaptchaError>> {
		if (token === "") return failure(new CaptchaError("missing-token"));

		let body = new URLSearchParams({ secret: this.#secretKey, response: token });
		if (options.remoteIp) body.set("remoteip", options.remoteIp);

		let answer = await siteverify(TURNSTILE, body, this.#timeout);
		if (isFailure(answer)) return answer;
		return success(sharedVerification(answer.data));
	}
}

/** The options a {@link Turnstile} is built with. */
export namespace Turnstile {
	/** Configuration for one Turnstile widget's server side. */
	export interface Options {
		/** The widget's secret key; it never reaches the browser. */
		secretKey: string;
		/**
		 * The field the widget submits, matching the widget's `data-response-field-name`.
		 *
		 * @default "cf-turnstile-response"
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
