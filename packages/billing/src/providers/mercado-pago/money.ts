/**
 * The one place amounts cross between our integer minor units and the decimal
 * major units Mercado Pago's API carries, and the one place an offset page
 * becomes an opaque cursor. Both conversions live here so a rounding rule or a
 * cursor format is decided once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Currency, Money } from "../../core/types.js";

import { minorUnitDigits } from "../../core/types.js";

/** Radix the minor-unit exponent is taken against. */
const DECIMAL_RADIX = 10;

/** Marks a cursor as one this provider issued, so a foreign string is rejected. */
const CURSOR_PREFIX = "mp";

/** Shape a decoded cursor must match before its offset is trusted. */
const CURSOR_PATTERN = /^mp:(\d+)$/;

/**
 * Renders an amount the way the API reads prices: a decimal in the currency's
 * own units, whole for a currency with no minor unit.
 *
 * @param money - Amount in minor units, as every model carries it.
 * @returns The major-unit decimal to put on the wire.
 *
 * @example
 * toMajorUnits({ amount: 10050, currency: "ars" }); // 100.5
 */
export function toMajorUnits(money: Money): number {
	let digits = minorUnitDigits(money.currency);
	if (digits === 0) return money.amount;

	return money.amount / DECIMAL_RADIX ** digits;
}

/**
 * Reads a major-unit decimal back into minor units, rounding to the currency's
 * own precision so a value that arrived as `100.49999999` still lands on the
 * integer it was sent as.
 *
 * @param amount - Major-unit decimal as the API reported it.
 * @param currency - Currency the amount is denominated in, in any letter case.
 * @returns The amount in minor units, alongside the lowercased currency code.
 *
 * @example
 * toMinorUnits(100.5, "ARS"); // { amount: 10050, currency: "ars" }
 */
export function toMinorUnits(amount: number, currency: Currency): Money {
	let code = currency.toLowerCase();
	let digits = minorUnitDigits(code);

	return {
		amount: digits === 0 ? Math.round(amount) : Math.round(amount * DECIMAL_RADIX ** digits),
		currency: code,
	};
}

/** Encodes text as base64url, which is what keeps a cursor URL-safe and opaque. */
function encodeBase64Url(text: string): string {
	return btoa(text).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

/** Decodes base64url text, answering `null` for anything that is not valid base64url. */
function decodeBase64Url(text: string): string | null {
	try {
		return atob(text.replaceAll("-", "+").replaceAll("_", "/"));
	} catch {
		return null;
	}
}

/**
 * Turns the offset of the next page into the cursor a caller passes back, so
 * the API's offset paging never reaches a call site.
 *
 * @param offset - Index the next page starts at.
 * @returns An opaque string to hand back as {@link Page.cursor}.
 */
export function encodeCursor(offset: number): string {
	return encodeBase64Url(`${CURSOR_PREFIX}:${offset}`);
}

/**
 * Reads the offset back out of a cursor.
 *
 * @param cursor - Cursor as a caller supplied it; omitting it starts at zero.
 * @returns The offset, or `null` for a cursor this provider did not issue.
 */
export function decodeCursor(cursor: string | undefined): number | null {
	if (cursor === undefined) return 0;

	let decoded = decodeBase64Url(cursor);
	if (decoded === null) return null;

	let matched = CURSOR_PATTERN.exec(decoded);
	if (matched === null) return null;

	return Number(matched[1]);
}
