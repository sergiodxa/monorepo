/**
 * An in-memory `Captcha` for tests: it verifies nothing, answers each token the way the
 * test scripted it, and records every call, so a test drives the pass and failure paths
 * of code guarded by a CAPTCHA without a network or a real widget.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { Captcha } from "./index.js";

import { CaptchaError } from "./index.js";

/** How a verification is answered: the facts it reports, or the failure it returns. */
type Outcome =
	| { verification: Captcha.Verification }
	| { code: Captcha.ErrorCode; providerCodes: readonly string[] };

/**
 * A scriptable provider. A call is answered, in order, by the next queued outcome
 * (`passNext`/`failNext`), then by the token's own rule (`accept`/`reject`), then by the
 * default: every non-empty token passes, or is `rejected` under `unknownTokens: "reject"`.
 *
 * @example
 * let captcha = new MemoryCaptcha();
 * captcha.failNext("unavailable");
 * let response = await router.fetch(signUpRequest);
 * expect(captcha.last).toEqual({ token: "t", remoteIp: "203.0.113.7" });
 */
export class MemoryCaptcha implements Captcha {
	/** The form field read by the middleware, `captcha-response` by default. */
	readonly field: string;

	#verification: Captcha.Verification;
	#rejectUnknown: boolean;
	#queue: Outcome[] = [];
	#rules = new Map<string, Outcome>();
	#calls: MemoryCaptcha.Call[] = [];

	/**
	 * @param options - The field, the facts a passing call reports, and the default for unknown tokens
	 */
	constructor(options: MemoryCaptcha.Options = {}) {
		this.field = options.field ?? "captcha-response";
		this.#verification = options.verification ?? {};
		this.#rejectUnknown = options.unknownTokens === "reject";
	}

	/** Every call so far, oldest first. */
	get calls(): readonly MemoryCaptcha.Call[] {
		return this.#calls;
	}

	/** The most recent call, or `undefined` before the first. */
	get last(): MemoryCaptcha.Call | undefined {
		return this.#calls.at(-1);
	}

	/**
	 * Queues a passing answer for the next call, whatever its token.
	 *
	 * @param verification - The facts to report, the constructor's by default
	 * @returns This provider, to chain further outcomes
	 */
	passNext(verification: Captcha.Verification = this.#verification): this {
		this.#queue.push({ verification });
		return this;
	}

	/**
	 * Queues a failing answer for the next call, whatever its token.
	 *
	 * @param code - The neutral reason to fail with
	 * @param providerCodes - Provider codes to carry, as a real provider would
	 * @returns This provider, to chain further outcomes
	 */
	failNext(code: Captcha.ErrorCode, providerCodes: readonly string[] = []): this {
		this.#queue.push({ code, providerCodes });
		return this;
	}

	/**
	 * Passes `token` on every call that no queued outcome answers.
	 *
	 * @param token - The token to accept
	 * @param verification - The facts to report, the constructor's by default
	 * @returns This provider, to chain further rules
	 */
	accept(token: string, verification: Captcha.Verification = this.#verification): this {
		this.#rules.set(token, { verification });
		return this;
	}

	/**
	 * Fails `token` on every call that no queued outcome answers.
	 *
	 * @param token - The token to refuse
	 * @param code - The neutral reason to fail with
	 * @param providerCodes - Provider codes to carry
	 * @returns This provider, to chain further rules
	 */
	reject(token: string, code: Captcha.ErrorCode, providerCodes: readonly string[] = []): this {
		this.#rules.set(token, { code, providerCodes });
		return this;
	}

	/** Forgets calls, queued outcomes and token rules, keeping the constructor's options. */
	reset(): void {
		this.#calls.length = 0;
		this.#queue.length = 0;
		this.#rules.clear();
	}

	/**
	 * Records the call and answers it as scripted. An empty token is `missing-token` and is
	 * recorded but never consumes a queued outcome, as a real provider refuses it unasked.
	 *
	 * @param token - The submitted token
	 * @param options - The visitor's address, recorded for assertions
	 * @returns The scripted outcome
	 */
	async verify(
		token: string,
		options: Captcha.VerifyOptions = {},
	): Promise<Result<Captcha.Verification, CaptchaError>> {
		this.#calls.push(
			options.remoteIp === undefined ? { token } : { token, remoteIp: options.remoteIp },
		);
		if (token === "") return failure(new CaptchaError("missing-token"));

		let outcome = this.#queue.shift() ?? this.#rules.get(token) ?? this.#fallback();
		if ("verification" in outcome) return success({ ...outcome.verification });
		return failure(new CaptchaError(outcome.code, outcome.providerCodes));
	}

	/**
	 * The answer for a token nothing scripted.
	 *
	 * @returns A pass with the constructor's facts, or a `rejected` failure
	 */
	#fallback(): Outcome {
		if (this.#rejectUnknown) return { code: "rejected", providerCodes: [] };
		return { verification: this.#verification };
	}
}

/** The types a {@link MemoryCaptcha} is configured with and records. */
export namespace MemoryCaptcha {
	/** Configuration for a memory provider. */
	export interface Options {
		/**
		 * The field the middleware reads, to match a real provider's widget in a form.
		 *
		 * @default "captcha-response"
		 */
		field?: string;
		/** The facts a passing call reports unless one is scripted with its own. */
		verification?: Captcha.Verification;
		/**
		 * Whether a token with no rule passes or is `rejected`.
		 *
		 * @default "accept"
		 */
		unknownTokens?: "accept" | "reject";
	}

	/** One recorded call. */
	export interface Call {
		token: string;
		remoteIp?: string;
	}
}
