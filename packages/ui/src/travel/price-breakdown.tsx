/**
 * A receipt block as a `<dl>`: one line per charge with its working beneath, discounts in
 * green with a minus, and a bold total under a rule. Amounts arrive formatted and sit
 * end-aligned in tabular figures, and a named line wraps its amount in an `<output>`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { border, fg } from "@sdxc/u/color";
import { raw, mergeMix } from "@sdxc/u/general";
import { vstack } from "@sdxc/u/layout";
import { m, minIs, p } from "@sdxc/u/size";
import { leading, tabularNums, text, weight } from "@sdxc/u/typography";

/** The sign a discount's amount gains when the caller formatted it without one. */
const MINUS = "−";

/**
 * Prop types for {@link PriceBreakdown} and its compound parts.
 */
export namespace PriceBreakdown {
	/** `"discount"` colours the line green and signs its amount with a minus. */
	export type Tone = "default" | "discount";

	/** Every native `<div>` attribute, plus the lines and an optional note under them. */
	export interface Props extends TagProps<"div"> {
		/**
		 * Small muted text under the total, such as "You won't be charged yet"; it sits
		 * after the `<dl>`, since a description list holds only label/value groups.
		 */
		note?: RemixNode;
	}

	/** What every amount-bearing line takes. */
	export interface AmountProps extends Omit<TagProps<"div">, "children"> {
		/** What the charge is, such as "Cleaning fee". */
		label: RemixNode;
		/** The amount, formatted by the caller, such as "$728.00". */
		amount: string;
		/**
		 * Wraps the amount in `<output name>`, so a script finds it by name
		 * (`form.elements.namedItem("nights-total")`) and updates it in place.
		 */
		name?: string;
		/** Written to `data-line`, a key a script can find the whole line by. */
		line?: string;
	}

	/** Props accepted by {@link PriceBreakdown.Line}. */
	export interface LineProps extends AmountProps {
		/** How the amount was worked out, such as "$182 × 4 nights", in small type beneath. */
		detail?: RemixNode;
		/** @default "default" */
		tone?: Tone;
	}

	/** Props accepted by {@link PriceBreakdown.Total}. */
	export interface TotalProps extends AmountProps {}
}

/**
 * Signs a discount's amount with a minus unless it already carries one.
 *
 * @param amount The amount as the caller formatted it.
 * @returns The amount led by exactly one minus sign.
 */
function asDiscount(amount: string): string {
	let trimmed = amount.trim();
	return /^[-−–]/.test(trimmed) ? trimmed : `${MINUS}${trimmed}`;
}

/** Props {@link AmountValue} reads. */
interface AmountValueProps {
	amount: string;
	name?: string;
}

/**
 * The amount itself, inside an `<output>` when it has a name. An output keeps the text it
 * is given and is reachable through its form's `elements`, which is how an island prices
 * a changed stay without re-rendering the receipt.
 *
 * @param handle Runtime handle carrying the amount and its name.
 * @returns The render function producing the amount's markup.
 */
function AmountValue(handle: Handle<AmountValueProps>) {
	return () => {
		let { amount, name } = handle.props;
		if (name === undefined) return <>{amount}</>;
		return <output name={name}>{amount}</output>;
	};
}

/**
 * Renders the receipt: a `<dl>` whose lines each pair a `<dt>` label with a `<dd>` amount,
 * so the pairing survives in the accessibility tree, and the `note` centred beneath it.
 *
 * @param handle Runtime handle carrying the wrapper's props.
 * @returns The render function producing the receipt's markup.
 * @example
 * <PriceBreakdown note="You won't be charged yet">
 * 	<PriceBreakdown.Line label="4 nights" detail="$182 × 4 nights" amount="$728.00" name="nights" />
 * 	<PriceBreakdown.Line label="Weekly stay discount" amount="$72.80" tone="discount" />
 * 	<PriceBreakdown.Total label="Total" amount="$745.20" name="total" />
 * </PriceBreakdown>
 */
export function PriceBreakdown(handle: Handle<PriceBreakdown.Props>) {
	return () => {
		let { note, children, mix, ...rest } = handle.props;

		return (
			<div
				data-slot="price-breakdown"
				{...rest}
				mix={mergeMix([minIs(0), vstack({ gap: 4 }), text("sm")], mix)}
			>
				<dl mix={[m(0), vstack({ gap: 3 })]}>{children}</dl>
				{note === undefined ? null : (
					<p
						data-slot="price-breakdown-note"
						mix={[m(0), text("xs"), fg("neutral.muted"), raw({ textAlign: "center" })]}
					>
						{note}
					</p>
				)}
			</div>
		);
	};
}

/** Columns every line shares: the label takes what is left, the amount what it needs. */
const LINE_COLUMNS = raw({
	display: "grid",
	gridTemplateColumns: "minmax(0, 1fr) auto",
	columnGap: "1rem",
	alignItems: "baseline",
});

/**
 * Renders one charge: its label, the working under it in muted small type, and its amount
 * at the end. A discount is green and its amount is signed with a minus.
 *
 * @param handle Runtime handle carrying the line's props.
 * @returns The render function producing the line's markup.
 * @example
 * <PriceBreakdown.Line label="Cleaning fee" amount="$45.00" />
 * @example
 * <PriceBreakdown.Line label="Early-bird discount" amount="$30.00" tone="discount" line="discount" />
 */
PriceBreakdown.Line = function PriceBreakdownLine(handle: Handle<PriceBreakdown.LineProps>) {
	return () => {
		let { label, amount, name, line, detail, tone, mix, ...rest } = handle.props;
		let discount = tone === "discount";

		return (
			<div
				data-slot="price-breakdown-line"
				data-line={line}
				data-tone={discount ? "discount" : undefined}
				{...rest}
				mix={mergeMix([LINE_COLUMNS, discount ? fg("success") : fg("neutral.emphasis")], mix)}
			>
				<dt mix={[m(0), minIs(0), leading("1.4")]}>
					{label}
					{detail === undefined ? null : (
						<span
							data-slot="price-breakdown-detail"
							mix={[raw({ display: "block" }), text("xs"), fg("neutral.muted"), tabularNums()]}
						>
							{detail}
						</span>
					)}
				</dt>
				<dd mix={[m(0), tabularNums(), raw({ textAlign: "end", whiteSpace: "nowrap" })]}>
					<AmountValue amount={discount ? asDiscount(amount) : amount} name={name} />
				</dd>
			</div>
		);
	};
};

/**
 * Renders the total: the same columns as a line, set bold and a step larger under a rule
 * that closes off the charges above it.
 *
 * @param handle Runtime handle carrying the total's props.
 * @returns The render function producing the total's markup.
 * @example
 * <PriceBreakdown.Total label="Total (USD)" amount="$745.20" name="total" />
 */
PriceBreakdown.Total = function PriceBreakdownTotal(handle: Handle<PriceBreakdown.TotalProps>) {
	return () => {
		let { label, amount, name, line, mix, ...rest } = handle.props;

		return (
			<div
				data-slot="price-breakdown-total"
				data-line={line}
				{...rest}
				mix={mergeMix(
					[
						LINE_COLUMNS,
						border({ color: "neutral.border", width: 0 }),
						raw({ borderBlockStartWidth: "1px", borderBlockStartStyle: "solid" }),
						p(0),
						raw({ paddingBlockStart: "0.75rem" }),
						text("base"),
						weight("semibold"),
						fg("neutral.emphasis"),
					],
					mix,
				)}
			>
				<dt mix={[m(0), minIs(0)]}>{label}</dt>
				<dd mix={[m(0), tabularNums(), raw({ textAlign: "end", whiteSpace: "nowrap" })]}>
					<AmountValue amount={amount} name={name} />
				</dd>
			</div>
		);
	};
};
