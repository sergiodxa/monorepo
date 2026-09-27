/**
 * The provider-neutral CAPTCHA contract: a `Captcha` names the form field its widget
 * submits and verifies that field's token into the facts the provider vouches for, so
 * the middleware and the app's policy work the same over any provider.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

/**
 * A CAPTCHA provider's server side. Every field of a verification the provider cannot
 * vouch for stays `undefined`, so a caller comparing an expected action or hostname sees
 * the gap instead of an invented value.
 *
 * @example let outcome = await captcha.verify(token, { remoteIp: "203.0.113.7" });
 */
export interface Captcha {
	/** The form field the provider's widget writes its token into. */
	readonly field: string;

	/**
	 * Checks one token. A provider that verifies locally ignores `remoteIp`; a provider
	 * whose tokens are single-use consumes the token here, so call it once per submission.
	 *
	 * @param token - The value the widget submitted in {@link Captcha.field}
	 * @param options - Request facts some providers use as a risk signal
	 * @returns The facts the provider confirmed, or the reason it refused
	 */
	verify(
		token: string,
		options?: Captcha.VerifyOptions,
	): Promise<Result<Captcha.Verification, CaptchaError>>;
}

/** The types shared by every {@link Captcha} implementation. */
export namespace Captcha {
	/** Request facts passed to {@link Captcha.verify}. */
	export interface VerifyOptions {
		/** The visitor's address; hosted providers cross-check it against the token. */
		remoteIp?: string;
	}

	/** What the provider confirmed about a solved challenge. */
	export interface Verification {
		/** The site the challenge was solved on, when the provider reports one. */
		hostname?: string;
		/** The action the widget was rendered with, when the provider supports actions. */
		action?: string;
		/** The provider's likelihood the visitor is human, from `0` to `1`, when it scores. */
		score?: number;
		/** When the challenge was solved, when the provider reports it. */
		challengedAt?: Date;
	}

	/**
	 * Why a verification failed. `rejected` and `expired` are the visitor's to fix by
	 * solving a new challenge, and `low-score` is a genuine token the provider scored as a
	 * likely bot; `unavailable` is the provider or its configuration failing, which an app
	 * may let through; a mismatch is a token minted for another action or site.
	 */
	export type ErrorCode =
		| "missing-token"
		| "rejected"
		| "expired"
		| "low-score"
		| "unavailable"
		| "action-mismatch"
		| "hostname-mismatch";
}

/**
 * A failed verification. `providerCodes` keeps the provider's own error codes verbatim
 * for logging, while `code` is what a caller branches on.
 *
 * @example if (error.code === "unavailable") log.warn("captcha.unavailable", { codes: error.providerCodes });
 */
export class CaptchaError extends Error {
	override name = "CaptchaError";

	/** The provider-neutral reason, the value to branch on. */
	readonly code: Captcha.ErrorCode;

	/** The provider's own error codes, empty when it reported none. */
	readonly providerCodes: readonly string[];

	/**
	 * @param code - The provider-neutral reason
	 * @param providerCodes - The provider's own error codes, for logging
	 */
	constructor(code: Captcha.ErrorCode, providerCodes: readonly string[] = []) {
		super(
			providerCodes.length === 0
				? `CAPTCHA verification failed: ${code}`
				: `CAPTCHA verification failed: ${code} (${providerCodes.join(", ")})`,
		);
		this.code = code;
		this.providerCodes = providerCodes;
	}
}
