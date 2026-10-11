/**
 * Standalone cookies the HTTP layer reads. `options` remembers the reader's pick in
 * each named option group — the package manager the install strips spell commands in
 * — so the server renders the strip the reader already chose rather than a default the
 * browser corrects after hydration.
 *
 * The browser is what writes it, so it is readable from script and its value is left
 * human-readable rather than wrapped, which keeps one encoding for both sides.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCookie } from "remix/cookie";

import type { OptionSelections } from "~/app/services/option-groups";

import {
	OPTIONS_COOKIE_MAX_AGE,
	OPTIONS_COOKIE_NAME,
	parseOptionSelections,
} from "~/app/services/option-groups";

export const options = createCookie(OPTIONS_COOKIE_NAME, {
	path: "/",
	maxAge: OPTIONS_COOKIE_MAX_AGE,
	httpOnly: false,
	sameSite: "Lax",
	secure: import.meta.env.PROD,
	encode: encodeURIComponent,
	decode: decodeURIComponent,
});

/**
 * The option groups the reader has chosen in.
 *
 * @param request - The request being answered.
 * @returns The selections the cookie carries, which is empty when it is absent, and
 * empty again when its contents name nothing this site offers.
 * @example (await readOptionSelections(request)).get("package-manager") // "bun"
 */
export async function readOptionSelections(request: Request): Promise<OptionSelections> {
	let value = await options.parse(request.headers.get("Cookie"));
	return parseOptionSelections(typeof value === "string" ? value : null);
}
