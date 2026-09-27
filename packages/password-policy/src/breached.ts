/**
 * The breached-password rule, answered by Have I Been Pwned's Pwned Passwords range API
 * under k-anonymity: only the first five hex characters of the SHA-1 leave the process,
 * padded responses hide which range was asked for, and the suffix is compared locally.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import { PasswordPolicyError } from "./password-policy-error.js";

/** The range endpoint; a request appends the five-character hash prefix. */
export const PWNED_PASSWORDS_RANGE_URL = "https://api.pwnedpasswords.com/range/";

/** How long a lookup may take before it is reported as a `timeout`, in milliseconds. */
export const DEFAULT_BREACH_CHECK_TIMEOUT = 3000;

/** Sent when the caller names no User-Agent; the HIBP API asks every client to send one. */
const DEFAULT_USER_AGENT = "@sdxc/password-policy";

/** How a caller tunes the lookup. */
export interface BreachedPasswordOptions {
	/** Identifies the calling app to HIBP; defaults to the package name. */
	userAgent?: string;
	/** @default DEFAULT_BREACH_CHECK_TIMEOUT */
	timeout?: number;
}

/**
 * The uppercase SHA-1 hex of the candidate's NFC form, the normalization NIST prescribes
 * before a password is hashed, so either spelling of an accent looks up one range. Web
 * Crypto alone computes it, so this entry point runs wherever `crypto.subtle` exists.
 */
async function sha1Hex(candidate: string): Promise<string> {
	let bytes = new TextEncoder().encode(candidate.normalize("NFC"));
	let digest = await crypto.subtle.digest("SHA-1", bytes);
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0"))
		.join("")
		.toUpperCase();
}

/**
 * Reads a range body's `SUFFIX:COUNT` lines for the candidate's suffix. A zero count is
 * padding and never a match.
 */
function occurrencesIn(body: string, suffix: string): number {
	for (let line of body.split("\n")) {
		let separator = line.indexOf(":");
		if (separator === -1) continue;
		if (line.slice(0, separator).trim().toUpperCase() !== suffix) continue;

		let count = Number.parseInt(line.slice(separator + 1), 10);
		return Number.isFinite(count) ? count : 0;
	}

	return 0;
}

/** The unavailable issue for a request that produced no response. */
function unavailable(error: unknown): PasswordPolicyError {
	let timedOut = error instanceof Error && error.name === "TimeoutError";

	return new PasswordPolicyError(
		{ reason: "breach-check-unavailable", failure: timedOut ? "timeout" : "network", status: null },
		{ cause: error },
	);
}

/**
 * Looks the candidate up in Pwned Passwords. A `breach-check-unavailable` failure means no
 * answer arrived; the caller decides whether that accepts the candidate or refuses it.
 *
 * @returns `breached` with the occurrence count, `breach-check-unavailable`, or success.
 * @example await checkBreachedPassword(candidate, { userAgent: "example-app" });
 */
export async function checkBreachedPassword(
	candidate: string,
	options: BreachedPasswordOptions = {},
): Promise<Result<void, PasswordPolicyError>> {
	let hash = await sha1Hex(candidate);
	let prefix = hash.slice(0, 5);
	let suffix = hash.slice(5);

	let body: string;

	try {
		let response = await fetch(`${PWNED_PASSWORDS_RANGE_URL}${prefix}`, {
			headers: {
				"Add-Padding": "true",
				"User-Agent": options.userAgent ?? DEFAULT_USER_AGENT,
			},
			signal: AbortSignal.timeout(options.timeout ?? DEFAULT_BREACH_CHECK_TIMEOUT),
		});

		if (!response.ok) {
			return failure(
				new PasswordPolicyError({
					reason: "breach-check-unavailable",
					failure: "status",
					status: response.status,
				}),
			);
		}

		body = await response.text();
	} catch (error) {
		return failure(unavailable(error));
	}

	let occurrences = occurrencesIn(body, suffix);
	if (occurrences > 0) return failure(new PasswordPolicyError({ reason: "breached", occurrences }));

	return success(undefined);
}
