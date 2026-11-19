/**
 * What a checkout is buying: the lines and the price breakdown. On a phone it folds behind a
 * "Show order summary · €48.00" row so the form leads; from 56rem it is always open beside the
 * form. Both come from one `<details>`, so the fold works without script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { ChevronDownIcon } from "@sdxc/icons";
import { mergeMix, raw } from "@sdxc/u/general";
import { motionReduce } from "@sdxc/u/responsive";

/** From this width the summary sits open beside the form. */
const WIDE = "(min-width: 56rem)";

/** Prop types for {@link OrderSummary}. */
export namespace OrderSummary {
	/** The words the summary carries. */
	export interface Labels {
		/** The folded row's words, such as "Show order summary". */
		show: string;
		/** The summary's heading, such as "Order summary". */
		heading: string;
	}

	/** Props accepted by {@link OrderSummary}; the host is a `<details>` or a `<section>`. */
	export interface Props extends Omit<TagProps<"section">, "children"> {
		/** The lines, usually a `<ul>` of `CartLine`. */
		lines: RemixNode;
		/** The charges, usually a `PriceBreakdown` ending in its total. */
		breakdown: RemixNode;
		/** The order total, shown on the folded row so a phone sees it before unfolding. */
		total: RemixNode;
		/** Folds the summary below 56rem. @default false */
		collapsible?: boolean;
		/** Starts a collapsible summary unfolded on a phone. @default false */
		open?: boolean;
		labels: Labels;
	}
}

/**
 * Renders the heading, lines and breakdown. A collapsible summary is a `<details>` whose
 * summary row shows on narrow screens only; from 56rem the row hides and the content shows
 * whether or not the disclosure is open, through `::details-content`.
 *
 * @example
 * <OrderSummary collapsible lines={<ul>…</ul>} breakdown={<PriceBreakdown>…</PriceBreakdown>} total="€48.00" labels={{ show: "Show order summary", heading: "Order summary" }} />
 */
export function OrderSummary(handle: Handle<OrderSummary.Props>) {
	return () => {
		let { breakdown, collapsible = false, labels, lines, mix, open, total, ...rest } = handle.props;
		let body = (
			<div data-slot="order-summary-body" mix={[raw({ display: "grid", gap: "1rem" })]}>
				<p
					data-slot="order-summary-heading"
					mix={[
						raw({
							margin: "0",
							fontSize: "1rem",
							fontWeight: "650",
							color: "var(--ui-neutral-fg-emphasis)",
						}),
					]}
				>
					{labels.heading}
				</p>
				<div
					data-slot="order-summary-lines"
					mix={[raw({ "& > ul": { margin: "0", padding: "0", listStyle: "none" } })]}
				>
					{lines}
				</div>
				<div data-slot="order-summary-breakdown">{breakdown}</div>
			</div>
		);
		if (!collapsible) {
			return (
				<section
					{...rest}
					aria-label={labels.heading}
					data-slot="order-summary"
					mix={mergeMix([raw({ display: "block" })], mix)}
				>
					{body}
				</section>
			);
		}
		return (
			<details
				{...(rest as TagProps<"details">)}
				open={open}
				data-slot="order-summary"
				data-collapsible=""
				mix={mergeMix(
					[
						raw({
							display: "block",
							"&[open] > summary [data-chevron]": { rotate: "180deg" },
							"&[open] > summary": { marginBlockEnd: "1rem" },
							[`@media ${WIDE}`]: {
								"&::details-content": {
									contentVisibility: "visible",
									display: "contents",
								},
							},
						}),
					],
					mix,
				)}
			>
				<summary
					data-slot="order-summary-toggle"
					mix={[
						raw({
							display: "flex",
							alignItems: "center",
							gap: "0.5rem",
							minBlockSize: "2.75rem",
							fontSize: "0.9375rem",
							fontWeight: "600",
							color: "var(--ui-brand-fg)",
							cursor: "pointer",
							listStyle: "none",
							"&::-webkit-details-marker": { display: "none" },
							"& [data-chevron]": {
								inlineSize: "1rem",
								blockSize: "1rem",
								transition: "rotate 160ms ease",
							},
							"&:focus-visible": {
								outline: "2px solid var(--ui-brand-ring)",
								outlineOffset: "2px",
								borderRadius: "0.25rem",
							},
							[`@media ${WIDE}`]: { display: "none" },
						}),
						motionReduce(raw({ "& [data-chevron]": { transition: "none" } })),
					]}
				>
					<span>{labels.show}</span>
					<ChevronDownIcon aria-hidden="true" data-chevron="" />
					<span
						data-slot="order-summary-total"
						mix={[
							raw({
								marginInlineStart: "auto",
								fontSize: "1rem",
								fontWeight: "700",
								fontVariantNumeric: "tabular-nums",
								color: "var(--ui-neutral-fg-emphasis)",
							}),
						]}
					>
						{total}
					</span>
				</summary>
				{body}
			</details>
		);
	};
}
