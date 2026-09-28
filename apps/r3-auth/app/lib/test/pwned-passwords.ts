/**
 * MSW handlers standing in for Have I Been Pwned's Pwned Passwords range API, so a test
 * decides which passwords count as breached, or that the API is down, and no test ever
 * sends a password-hash prefix over the network.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { http, HttpResponse } from "msw";

/** The range endpoint the breach lookup requests, with the five-character prefix as a param. */
const RANGE_URL = "https://api.pwnedpasswords.com/range/:prefix";

/** Uppercase hex SHA-1 of a password's NFC form, the digest the range API is keyed on. */
async function sha1Hex(candidate: string): Promise<string> {
	let bytes = new TextEncoder().encode(candidate.normalize("NFC"));
	let digest = await crypto.subtle.digest("SHA-1", bytes);
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0"))
		.join("")
		.toUpperCase();
}

/**
 * Answers every range request the way the padded API does: the suffixes of the given
 * passwords that share the prefix, plus a zero-count padding entry, so every other
 * password reads as never breached.
 *
 * @param breached - Passwords the API reports as seen in a breach.
 */
export function pwnedPasswords(breached: string[] = []) {
	return http.get(RANGE_URL, async ({ params }) => {
		let prefix = String(params.prefix).toUpperCase();
		let lines = ["0000000000000000000000000000000000A:0"];

		for (let candidate of breached) {
			let hash = await sha1Hex(candidate);
			if (hash.startsWith(prefix)) lines.push(`${hash.slice(5)}:4213`);
		}

		return new HttpResponse(lines.join("\r\n"), { headers: { "content-type": "text/plain" } });
	});
}

/** Answers every range request with a 503, the outage a breach lookup must survive. */
export function pwnedPasswordsUnavailable() {
	return http.get(RANGE_URL, () => new HttpResponse(null, { status: 503 }));
}
