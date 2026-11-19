/**
 * Money as text: integer minor units written with `Intl` in any locale, with a true minus,
 * a statement-style sign for money in and out, and the parts split out so a component can
 * set the decimals apart.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { toMajor } from "./currency.js";

/** U+2212, the minus sign typography uses for numbers, which lines up with the plus. */
const MINUS = "−";

/**
 * How the sign shows: `auto` marks a negative amount, `always` marks both directions,
 * `never` shows the magnitude alone, and `ledger` marks money in with a plus while money
 * out reads as a plain figure, the way a statement lists it.
 */
export type SignDisplay = "auto" | "always" | "never" | "ledger";

/** Options accepted by {@link formatAmount} and {@link amountParts}. */
export interface FormatOptions {
	/** @default "en-US" */
	locale?: string;
	/** @default "auto" */
	sign?: SignDisplay;
	/** Abbreviates a large amount (`€12K`), for a chart axis or a tight tile. @default false */
	compact?: boolean;
	/** `symbol` (`$`), `narrowSymbol` (`$` for every dollar) or `code` (`USD`). @default "narrowSymbol" */
	display?: "symbol" | "narrowSymbol" | "code";
}

/** The `Intl` sign display a {@link SignDisplay} maps to for one amount. */
function intlSign(sign: SignDisplay, amount: number): "auto" | "never" | "exceptZero" {
	if (sign === "always") return "exceptZero";
	if (sign === "never") return "never";
	if (sign === "ledger") return amount > 0 ? "exceptZero" : "never";
	return "auto";
}

/**
 * The formatted amount split into `Intl`'s parts (`currency`, `integer`, `group`, `decimal`,
 * `fraction`, `minusSign`, …), with the hyphen-minus swapped for a true minus, so a
 * component can style one part, such as smaller decimals.
 *
 * @param amount The amount in minor units.
 * @param currency The ISO 4217 code.
 * @param options Locale, sign, compact notation and how the currency shows.
 */
export function amountParts(
	amount: number,
	currency: string,
	options: FormatOptions = {},
): Intl.NumberFormatPart[] {
	let { locale = "en-US", sign = "auto", compact = false, display = "narrowSymbol" } = options;
	let format = new Intl.NumberFormat(locale, {
		style: "currency",
		currency,
		currencyDisplay: display,
		signDisplay: intlSign(sign, amount),
		...(compact ? { notation: "compact" as const, maximumFractionDigits: 1 } : {}),
	});
	return format
		.formatToParts(toMajor(amount, currency))
		.map((part) => (part.type === "minusSign" ? { ...part, value: MINUS } : part));
}

/**
 * Integer minor units as text in a locale, for a label, a toast, a title or an axis.
 *
 * @param amount The amount in minor units.
 * @param currency The ISO 4217 code.
 * @param options Locale, sign, compact notation and how the currency shows.
 * @example formatAmount(-129900, "EUR", { locale: "en-IE" }) // "−€1,299.00"
 * @example formatAmount(4500, "GBP", { sign: "ledger" }) // "+£45.00"
 * @example formatAmount(128000, "JPY") // "¥128,000"
 */
export function formatAmount(
	amount: number,
	currency: string,
	options: FormatOptions = {},
): string {
	return amountParts(amount, currency, options)
		.map((part) => part.value)
		.join("");
}
