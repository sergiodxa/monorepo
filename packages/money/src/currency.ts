/**
 * How many minor-unit digits a currency has, read from the platform's own ISO 4217 data,
 * and the moves between a major-unit number and integer minor units that every other part
 * of the package builds on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * The digits after the decimal point a currency uses, as `Intl` defines it: 2 for euros,
 * 0 for yen, 3 for Bahraini dinars. A code `Intl` does not recognise but that is well formed
 * reads as 2; a malformed code throws `Intl`'s own `RangeError`.
 *
 * @param currency The ISO 4217 code, such as `EUR`.
 * @example currencyExponent("JPY") // 0
 */
export function currencyExponent(currency: string): number {
	return (
		new Intl.NumberFormat("en-US", { style: "currency", currency }).resolvedOptions()
			.maximumFractionDigits ?? 2
	);
}

/**
 * Rounds half away from zero, so a positive and a negative amount of the same size round to
 * the same magnitude.
 *
 * @param value Any finite number.
 */
export function roundHalfAway(value: number): number {
	return Math.sign(value) * Math.round(Math.abs(value));
}

/**
 * An amount in major units (`12.5` euros) as integer minor units (`1250` cents), rounded
 * half away from zero to the currency's own precision.
 *
 * @param major The amount in major units.
 * @param currency The ISO 4217 code.
 * @example toMinor(12.345, "EUR") // 1235
 */
export function toMinor(major: number, currency: string): number {
	let scale = 10 ** currencyExponent(currency);
	return roundHalfAway(Number((major * scale).toPrecision(15)));
}

/**
 * Integer minor units as a major-unit number, for a chart axis or a `<data value>`.
 *
 * @param minor The amount in minor units.
 * @param currency The ISO 4217 code.
 * @example toMajor(1250, "EUR") // 12.5
 */
export function toMajor(minor: number, currency: string): number {
	return minor / 10 ** currencyExponent(currency);
}
