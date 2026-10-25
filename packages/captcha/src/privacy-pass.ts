/**
 * Privacy Pass as a `Captcha`: the client proves an issuer vouched for it by answering a
 * `WWW-Authenticate: PrivateToken` challenge with a token in its `Authorization` header,
 * so a client holding tokens passes with no widget to solve.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { PrivacyPass, PrivacyPassErrorCode } from "@sdxc/privacy-pass";
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { Captcha } from "./index.js";

import { CaptchaError } from "./index.js";

/** The credentials scheme a token arrives under, compared case-insensitively. */
const PRIVATE_TOKEN_SCHEME = /^privatetoken[ \t]/i;

/**
 * The neutral reason for each redemption failure: a token for a spent or expired challenge
 * is `expired`, an issuer or origin misconfiguration is `unavailable`, and the rest are
 * tokens the client must replace.
 */
const ERROR_CODES: Record<PrivacyPassErrorCode, Captcha.ErrorCode> = {
	"missing-token": "missing-token",
	"malformed-token": "rejected",
	"unsupported-token-type": "rejected",
	"unknown-key": "rejected",
	"invalid-signature": "rejected",
	"unknown-challenge": "expired",
	"double-spend": "expired",
	"invalid-challenge": "unavailable",
	"invalid-key": "unavailable",
	"issuer-unavailable": "unavailable",
};

/**
 * Redeems Privacy Pass tokens through a configured `PrivacyPass`. With the `captcha`
 * middleware it reads the `Authorization` header and refuses a failure with a `401`
 * challenge, which a client holding tokens answers by retrying.
 *
 * @example captcha(new PrivacyPassCaptcha(new PrivacyPass({ issuer: "demo-pat.issuer.cloudflare.com", store })))
 */
export class PrivacyPassCaptcha implements Captcha {
	/** The header the token arrives in. */
	readonly field = "Authorization";

	/** The origin's challenger and redeemer, for an `onFailure` that writes its own challenge. */
	readonly privacyPass: PrivacyPass;

	/** @param privacyPass - The issuer, store and challenge shape to redeem against */
	constructor(privacyPass: PrivacyPass) {
		this.privacyPass = privacyPass;
	}

	/**
	 * The request's `PrivateToken` credentials, whole.
	 *
	 * @param request - The incoming request
	 * @returns The `Authorization` value, or `null` when it is absent or another scheme
	 */
	readToken(request: Request): string | null {
		let authorization = request.headers.get("Authorization");
		return authorization !== null && PRIVATE_TOKEN_SCHEME.test(authorization.trim())
			? authorization
			: null;
	}

	/**
	 * Redeems the credentials, spending the token: a second call with them answers
	 * `expired`. A token vouches for no hostname, action, score or solve time, so the
	 * verification reports none, and `remoteIp` is ignored.
	 *
	 * @param token - The `Authorization` value {@link PrivacyPassCaptcha.readToken} found
	 * @returns An empty verification, or why the token was refused, with the Privacy Pass code
	 * in `providerCodes`
	 */
	async verify(token: string): Promise<Result<Captcha.Verification, CaptchaError>> {
		if (token === "") return failure(new CaptchaError("missing-token"));
		let redeemed = await this.privacyPass.redeem(token);
		if (isFailure(redeemed)) {
			return failure(new CaptchaError(ERROR_CODES[redeemed.error.code], [redeemed.error.code]));
		}
		return success({});
	}

	/**
	 * Answers a failure with a `401` carrying a fresh challenge, or the middleware's plain
	 * `403` when the issuer's keys cannot be read to write one.
	 *
	 * @returns The refusal
	 */
	async refuse(): Promise<Response> {
		let challenge = await this.privacyPass.challenge();
		if (isFailure(challenge)) return new Response("CAPTCHA verification failed", { status: 403 });
		return new Response("Privacy Pass token required", {
			status: 401,
			headers: { "WWW-Authenticate": challenge.data },
		});
	}
}
