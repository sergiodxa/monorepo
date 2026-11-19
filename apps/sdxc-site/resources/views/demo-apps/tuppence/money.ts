/**
 * Money arithmetic for Tuppence in integer minor units: reading what a visitor types into
 * minor units, splitting a bill into shares that add back to the total exactly, and
 * converting between currencies at a fixed rate, so no amount ever drifts by a cent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { currencyExponent } from "@sdxc/ui/app/amount";

/**
 * Reads an amount a person typed ("12", "12.5", "1,204.50", "€ 30") as minor units of a
 * currency. Commas group thousands and a dot marks the decimals, the way the app's English
 * interface shows amounts. More decimals than the currency has reads as unreadable.
 *
 * @param input What the field held.
 * @param currency The ISO 4217 code the amount is in.
 * @returns The minor units, or `null` for anything that is not a positive amount.
 * @example parseAmount("1,204.50", "EUR") // 120450
 * @example parseAmount("500", "JPY") // 500
 */
export function parseAmount(input: string, currency: string): number | null {
	let cleaned = input.replace(/[^\d.,]/g, "").replace(/,(?=\d{3}(\D|$))/g, "");
	if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
	let [whole = "0", fraction = ""] = cleaned.split(".");
	let exponent = currencyExponent(currency);
	if (fraction.length > exponent) return null;
	let minor = Number(whole) * 10 ** exponent + Number(fraction.padEnd(exponent, "0") || "0");
	if (!Number.isSafeInteger(minor) || minor <= 0) return null;
	return minor;
}

/**
 * Splits an amount into `parts` shares that add up to it exactly: every share gets the
 * even part, and the leftover minor units go one each to the first shares.
 *
 * @param total The amount in minor units; a negative total splits into negative shares.
 * @param parts How many shares, at least 1.
 * @example allocate(1000, 3) // [334, 333, 333]
 */
export function allocate(total: number, parts: number): number[] {
	let count = Math.max(1, Math.floor(parts));
	let sign = total < 0 ? -1 : 1;
	let magnitude = Math.abs(total);
	let base = Math.floor(magnitude / count);
	let left = magnitude - base * count;
	return Array.from({ length: count }, (_, index) => sign * (base + (index < left ? 1 : 0)));
}

/**
 * Converts minor units of one currency into another at a rate quoted per major unit,
 * rounding half away from zero to the target's own minor unit.
 *
 * @param value The amount in minor units of `from`.
 * @param from The ISO code it is in.
 * @param to The ISO code wanted.
 * @param rate How many units of `to` one unit of `from` buys.
 * @example convert(10000, "GBP", "EUR", 1.1712) // 11712
 * @example convert(30000, "EUR", "JPY", 163.8) // 49140
 */
export function convert(value: number, from: string, to: string, rate: number): number {
	let major = (value / 10 ** currencyExponent(from)) * rate;
	let scaled = major * 10 ** currencyExponent(to);
	return Math.sign(scaled) * Math.round(Math.abs(scaled));
}
