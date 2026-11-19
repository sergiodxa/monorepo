/**
 * Reads an amount a person typed into integer minor units, using the locale's own decimal
 * and grouping marks, so "1.234,50" in German and "1,234.50" in English mean the same and a
 * typed amount never passes through a float.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { currencyExponent } from "./currency.js";

/** Options accepted by {@link parseAmount}. */
export interface ParseOptions {
	/** The locale whose decimal and grouping marks the text uses. @default "en-US" */
	locale?: string;
	/** Accepts zero, for a field where nothing is a valid answer. @default false */
	allowZero?: boolean;
}

/** The decimal and grouping marks a locale writes numbers with, read from `Intl`. */
function marks(locale: string): { decimal: string; group: string } {
	let parts = new Intl.NumberFormat(locale).formatToParts(12345.5);
	return {
		decimal: parts.find((part) => part.type === "decimal")?.value ?? ".",
		group: parts.find((part) => part.type === "group")?.value ?? ",",
	};
}

/** Escapes a mark for use in a regular expression, inside or outside a character class. */
function escape(mark: string): string {
	return mark.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
}

/**
 * Reads typed text as minor units of a currency. Currency symbols, spaces and grouping marks
 * are ignored; the locale's decimal mark separates the minor digits. Text with more decimals
 * than the currency has, a sign, or anything else reads as `null`, so the caller asks again.
 *
 * @param input What the field held.
 * @param currency The ISO 4217 code the amount is in.
 * @param options The locale, and whether zero counts.
 * @returns The minor units, or `null` for anything that is not a positive amount.
 * @example parseAmount("1,204.50", "EUR") // 120450
 * @example parseAmount("1.204,50 €", "EUR", { locale: "de-DE" }) // 120450
 * @example parseAmount("500", "JPY") // 500
 */
export function parseAmount(
	input: string,
	currency: string,
	options: ParseOptions = {},
): number | null {
	let { locale = "en-US", allowZero = false } = options;
	let { decimal, group } = marks(locale);
	let text = input
		.trim()
		.replace(/^[A-Z]{3}(?=[\s\d\p{Sc}])|(?<=[\s\d])[A-Z]{3}$/gu, "")
		.replace(/[\s\p{Sc}]/gu, "");
	let allowed = new RegExp(`^[\\d${escape(group)}'’]*(${escape(decimal)}\\d*)?$`);
	if (text === "" || !allowed.test(text)) return null;
	let [whole = "", fraction = ""] = text.split(decimal);
	whole = whole.replace(/\D/g, "");
	if (whole === "" && fraction === "") return null;
	let exponent = currencyExponent(currency);
	if (fraction.length > exponent) return null;
	let minor = Number(whole || "0") * 10 ** exponent + Number(fraction.padEnd(exponent, "0") || "0");
	if (!Number.isSafeInteger(minor) || minor < 0 || (minor === 0 && !allowZero)) return null;
	return minor;
}
