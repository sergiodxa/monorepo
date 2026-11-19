/**
 * An amount of money given as integer minor units and an ISO 4217 code, written by
 * `@sdxc/money` in any locale: the currency's own decimals (none for yen), a true minus, an
 * incoming-money tone, and smaller cents for a balance that leads a screen.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SignDisplay } from "@sdxc/money";
import type { Handle, Props as TagProps } from "remix/component";

import { amountParts, currencyExponent } from "@sdxc/money";
import { fg } from "@sdxc/u/color";
import { mergeMix, raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { nowrap, tabularNums } from "@sdxc/u/typography";

/** Prop types for {@link Amount}. */
export namespace Amount {
	/**
	 * How the sign shows: `auto` marks a negative amount, `always` marks both directions,
	 * `never` shows the magnitude alone, and `ledger` marks money in with a plus and the
	 * success tone while money out reads as a plain figure, the way a statement lists them.
	 */
	export type Sign = SignDisplay;

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
}

/** Which way money moved, for styling a row by direction: `in`, `out`, or `zero`. */
function direction(value: number): "in" | "out" | "zero" {
	if (value > 0) return "in";
	if (value < 0) return "out";
	return "zero";
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
		let parts = amountParts(value, currency, { locale: locale ?? "en-US", sign, compact, display });
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
