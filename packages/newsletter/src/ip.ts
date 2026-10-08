/**
 * Reads the visitor address a subscribe was handed, which arrives either as an
 * `IP` or as the `Result` of parsing one, so a caller passes `IP.parse(header)`
 * as it is and every provider sees the same `IP | null`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { IP } from "@sdxc/ip";

import type { SubscribeInput } from "./types.js";

/**
 * The address to record for a subscribe. A failed parse reads as no address,
 * since a malformed header is a visitor without a known IP, not a reason to
 * refuse the sign-up.
 *
 * @param input - The subscribe's `ip` field.
 * @returns The parsed address, or `null` when none was given or it did not parse.
 */
export function visitorIP(input: SubscribeInput["ip"]): IP | null {
	if (input === undefined || input === null) return null;
	if (!("status" in input)) return input;
	return input.status === "success" ? input.data : null;
}
