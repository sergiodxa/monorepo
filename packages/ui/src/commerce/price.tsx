/**
 * A product's price as a shop shows it: the amount, an optional "From" before it, the
 * compare-at price struck through with how much is saved, and the cost of each instalment.
 * Every figure comes from integer minor units, so the line never rounds differently twice.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { allocate } from "@sdxc/money";
import { visuallyHidden } from "@sdxc/u/a11y";
import { raw } from "@sdxc/u/general";

import { Amount } from "../components/amount.js";

/** The words a price reads with when `labels` leaves them out. */
const DEFAULT_LABELS: Price.Labels = {
	from: "From",
	was: "Was",
	save: "Save {percent}%",
	installments: "or {n} × {amount}",
};

/** The font size of the current amount at each size. */
const SIZES = { sm: "0.875rem", md: "1rem", lg: "1.5rem" } as const;

/** Prop types for {@link Price}. */
export namespace Price {
	/** The words around the figures; `{percent}`, `{n}` and `{amount}` are filled in. */
	export interface Labels {
		/** Leads a starting price, such as "From". */
		from: string;
		/** Read before the struck-through price by assistive tech, such as "Was". */
		was: string;
		/** The saving tag, such as "Save {percent}%". */
		save: string;
		/** The instalments line, such as "or {n} × {amount}". */
		installments: string;
	}

	/** Props accepted by {@link Price}. */
	export interface Props {
		/** The price in the currency's minor units. */
		amount: number;
		/** The ISO 4217 code, such as `USD`. */
		currency: string;
		/** @default "en-US" */
		locale?: string;
		/** The earlier price in minor units; drawn struck through only when above `amount`. */
		compareAt?: number;
		/** Marks `amount` as the lowest of several prices, such as the smallest size. */
		from?: boolean;
		/** Splits the price into this many payments; a line shows the first share when 2 or more. */
		installments?: number;
		/** @default "md" */
		size?: "sm" | "md" | "lg";
		labels?: Partial<Labels>;
		/** Draws the price as a `<span>`, for a price inside a line of text. @default false */
		inline?: boolean;
		id?: string;
	}
}

/**
 * Fills each `{name}` in a template with its value, keeping nodes as nodes so an amount
 * stays a `<data>` element inside the sentence.
 *
 * @example fill("or {n} × {amount}", { n: "4", amount: <Amount … /> })
 */
function fill(template: string, values: Record<string, RemixNode>): RemixNode[] {
	return template
		.split(/(\{\w+\})/)
		.filter((part) => part !== "")
		.map((part) => {
			let key = /^\{(\w+)\}$/.exec(part)?.[1];
			return key !== undefined && key in values ? values[key] : part;
		});
}

/**
 * The whole percent saved going from `compareAt` to `amount`, rounded down so the tag
 * never promises more than the shopper saves.
 */
function savedPercent(amount: number, compareAt: number): number {
	if (compareAt <= 0 || amount >= compareAt) return 0;
	return Math.floor(((compareAt - amount) / compareAt) * 100);
}

/**
 * Renders the price. A compare-at price at or below `amount` is ignored, so a stale sale
 * price never shows a negative saving.
 *
 * @example <Price amount={4500} currency="USD" compareAt={6000} />
 * @example <Price amount={2900} currency="EUR" locale="de-DE" from installments={4} />
 */
export function Price(handle: Handle<Price.Props>) {
	return () => {
		let {
			amount,
			compareAt,
			currency,
			from = false,
			id,
			inline = false,
			installments,
			labels,
			locale,
			size = "md",
		} = handle.props;
		let words = { ...DEFAULT_LABELS, ...labels };
		let percent = compareAt === undefined ? 0 : savedPercent(amount, compareAt);
		let was = compareAt !== undefined && compareAt > amount ? compareAt : undefined;
		let onSale = was !== undefined;
		let parts = installments !== undefined && installments >= 2 ? installments : 0;
		let share = parts === 0 ? 0 : (allocate(amount, parts)[0] ?? 0);

		let content = [
			<span
				data-slot="price-current"
				mix={[
					raw({
						fontSize: SIZES[size],
						fontWeight: "650",
						color: onSale
							? "var(--ui-danger-fg, var(--ui-neutral-fg-emphasis))"
							: "var(--ui-neutral-fg-emphasis)",
					}),
				]}
			>
				{from ? <span data-slot="price-from">{`${words.from} `}</span> : null}
				<Amount value={amount} currency={currency} locale={locale} />
			</span>,
			was !== undefined ? (
				<s
					data-slot="price-compare"
					mix={[
						raw({
							fontSize: size === "lg" ? "1rem" : "0.875em",
							color: "var(--ui-neutral-fg-muted)",
						}),
					]}
				>
					<span mix={[visuallyHidden()]}>{`${words.was} `}</span>
					<Amount value={was} currency={currency} locale={locale} />
				</s>
			) : null,
			onSale && percent > 0 ? (
				<span
					data-slot="price-save"
					mix={[
						raw({
							alignSelf: "center",
							paddingInline: "0.4375rem",
							paddingBlock: "0.0625rem",
							borderRadius: "999px",
							fontSize: "0.75rem",
							fontWeight: "650",
							lineHeight: "1.4",
							color: "var(--ui-success-fg, var(--ui-neutral-fg-emphasis))",
							backgroundColor: "var(--ui-success-bg-tint, var(--ui-neutral-bg-tint))",
						}),
					]}
				>
					{fill(words.save, { percent: String(percent) })}
				</span>
			) : null,
			parts === 0 ? null : (
				<span
					data-slot="price-installments"
					mix={[
						raw({
							flexBasis: "100%",
							fontSize: "0.8125rem",
							color: "var(--ui-neutral-fg-muted)",
						}),
					]}
				>
					{fill(words.installments, {
						n: String(parts),
						amount: <Amount value={share} currency={currency} locale={locale} />,
					})}
				</span>
			),
		];

		let styles = [
			raw({
				display: inline ? "inline-flex" : "flex",
				flexWrap: "wrap",
				alignItems: "baseline",
				columnGap: "0.5rem",
				rowGap: "0.125rem",
				margin: "0",
				fontVariantNumeric: "tabular-nums",
			}),
		];

		return inline ? (
			<span id={id} data-slot="price" data-size={size} mix={styles}>
				{content}
			</span>
		) : (
			<p id={id} data-slot="price" data-size={size} mix={styles}>
				{content}
			</p>
		);
	};
}
