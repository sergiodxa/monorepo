/**
 * An amount of money given as integer minor units and an ISO 4217 code, formatted by the
 * platform's `Intl` for any locale: the currency's own decimals (none for yen), a true minus,
 * an incoming-money tone, and smaller cents for a balance that leads a screen.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/component";

import { fg } from "@sdxc/u/color";
import { mergeMix, raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { nowrap, tabularNums } from "@sdxc/u/typography";

/** The locale an amount formats in when the caller names none. */
const DEFAULT_LOCALE = "en-US";

/** U+2212, the minus sign typography uses for numbers, which lines up with the plus. */
const MINUS = "−";

/** Prop types for {@link Amount}. */
export namespace Amount {
	/**
	 * How the sign shows: `auto` marks a negative amount, `always` marks both directions,
	 * `never` shows the magnitude alone, and `ledger` marks money in with a plus and the
	 * success tone while money out reads as a plain figure, the way a statement lists them.
	 */
	export type Sign = "auto" | "always" | "never" | "ledger";

	/** Props accepted by {@link Amount}. */
	export interface Props extends Omit<TagProps<"data">, "value" | "children"> {
		/** The amount in the currency's minor units (cents, pence; whole yen), as an integer. */
		value: number;
		/** The ISO 4217 code, such as `EUR` or `JPY`. */
		currency: string;
		/** @default "en-US" */
		locale?: string;
		/** @default "auto" */
		sign?: Sign;
		/** Sets the decimals in a smaller size, for a balance that heads a screen. @default false */
		smallMinor?: boolean;
		/** Abbreviates large amounts (`€12K`), for a chart axis or a tight tile. @default false */
		compact?: boolean;
		/** `symbol` (`$`), `narrowSymbol` (`$` for every dollar) or `code` (`USD`). @default "narrowSymbol" */
		display?: "symbol" | "narrowSymbol" | "code";
	}

	/** Options accepted by {@link formatAmount}. */
	export interface FormatOptions {
		/** @default "en-US" */
		locale?: string;
		/** @default "auto" */
		sign?: Sign;
		/** @default false */
		compact?: boolean;
		/** @default "narrowSymbol" */
		display?: "symbol" | "narrowSymbol" | "code";
	}
}

/**
 * The number of minor-unit digits a currency uses, as the platform's currency data defines
 * it: 2 for euros, 0 for yen, 3 for dinars.
 *
 * @param currency The ISO 4217 code.
 * @example currencyExponent("JPY") // 0
 */
export function currencyExponent(currency: string): number {
	return (
		new Intl.NumberFormat(DEFAULT_LOCALE, { style: "currency", currency }).resolvedOptions()
			.maximumFractionDigits ?? 2
	);
}

/** The `Intl` sign display a {@link Amount.Sign} maps to. */
function signDisplay(sign: Amount.Sign, value: number): "auto" | "always" | "never" | "exceptZero" {
	if (sign === "always") return "exceptZero";
	if (sign === "never") return "never";
	if (sign === "ledger") return value > 0 ? "exceptZero" : "never";
	return "auto";
}

/** The formatter one amount's options need, with the currency's own decimals. */
function amountFormat(value: number, currency: string, options: Amount.FormatOptions) {
	let {
		locale = DEFAULT_LOCALE,
		sign = "auto",
		compact = false,
		display = "narrowSymbol",
	} = options;
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency,
		currencyDisplay: display,
		signDisplay: signDisplay(sign, value),
		...(compact ? { notation: "compact", maximumFractionDigits: 1 } : {}),
	});
}

/** Which way money moved, for styling a row by direction: `in`, `out`, or `zero`. */
function direction(value: number): "in" | "out" | "zero" {
	if (value > 0) return "in";
	if (value < 0) return "out";
	return "zero";
}

/** The parts of a formatted amount, with the hyphen-minus swapped for a true minus. */
function amountParts(value: number, currency: string, options: Amount.FormatOptions) {
	let major = value / 10 ** currencyExponent(currency);
	return amountFormat(value, currency, options)
		.formatToParts(major)
		.map((part) => (part.type === "minusSign" ? { ...part, value: MINUS } : part));
}

/**
 * Formats minor units as text, for a title, a toast, an `aria-label` or a chart axis, with
 * the same rules {@link Amount} draws with.
 *
 * @param value The amount in minor units.
 * @param currency The ISO 4217 code.
 * @param options Locale, sign, compact notation and how the currency shows.
 * @example formatAmount(-129900, "EUR", { locale: "en-IE" }) // "−€1,299.00"
 * @example formatAmount(4500, "EUR", { sign: "ledger" }) // "+€45.00"
 */
export function formatAmount(
	value: number,
	currency: string,
	options: Amount.FormatOptions = {},
): string {
	return amountParts(value, currency, options)
		.map((part) => part.value)
		.join("");
}

/**
 * Renders an amount in a native `<data>` element whose `value` is the decimal figure, so a
 * script or a crawler reads the number while a person reads the formatted one. Figures are
 * tabular, so a column of amounts lines up, and the amount never wraps.
 *
 * @example <Amount value={-1299} currency="EUR" locale="en-IE" />
 * @example <Amount value={4500} currency="GBP" sign="ledger" />
 * @example <Amount value={1284056} currency="EUR" smallMinor />
 */
export function Amount(handle: Handle<Amount.Props>) {
	return () => {
		let {
			value,
			currency,
			locale,
			sign = "auto",
			smallMinor = false,
			compact = false,
			display,
			mix,
			...rest
		} = handle.props;
		let exponent = currencyExponent(currency);
		let parts = amountParts(value, currency, { locale, sign, compact, display });
		let credit = sign === "ledger" && value > 0;
		return (
			<data
				{...rest}
				value={(value / 10 ** exponent).toFixed(exponent)}
				data-slot="amount"
				data-currency={currency}
				data-direction={direction(value)}
				data-credit={credit ? "" : undefined}
				mix={mergeMix([tabularNums(), nowrap(), when("&[data-credit]", fg("success"))], mix)}
			>
				{smallMinor
					? parts.map((part) =>
							part.type === "fraction" || part.type === "decimal" ? (
								<span data-slot="amount-minor" mix={raw({ fontSize: "0.62em" })}>
									{part.value}
								</span>
							) : (
								part.value
							),
						)
					: parts.map((part) => part.value).join("")}
			</data>
		);
	};
}
