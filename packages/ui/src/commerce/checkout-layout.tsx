/**
 * The frame of a checkout page: the form with its steps on one side and the order summary on
 * the other, held in view as the form scrolls. On a phone the summary comes first, folded, so
 * the buyer sees the total before the steps and the form.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { mergeMix, raw } from "@sdxc/u/general";

/** From this width the summary moves into its own column. */
const WIDE = "(min-width: 56rem)";

/** Prop types for {@link CheckoutLayout}. */
export namespace CheckoutLayout {
	/** Props accepted by {@link CheckoutLayout}; the host is a `<div>`. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		/** The progress through checkout, such as a step indicator. */
		steps?: RemixNode;
		/** The order, usually a collapsible `OrderSummary`. */
		summary: RemixNode;
		/** The form of the current step. */
		children: RemixNode;
		/** Under the summary, such as payment marks or a returns promise. */
		aside?: RemixNode;
	}
}

/**
 * Renders one column on a phone, summary then steps then form. From 56rem the form takes the
 * flexible column and the summary a 24rem column on a tinted band, sticky to the top so the
 * total stays in view; the whole frame stops at 70rem.
 *
 * @example
 * <CheckoutLayout steps={<StepIndicator … />} summary={<OrderSummary collapsible … />}><form method="post">…</form></CheckoutLayout>
 */
export function CheckoutLayout(handle: Handle<CheckoutLayout.Props>) {
	return () => {
		let { aside, children, mix, steps, summary, ...rest } = handle.props;
		return (
			<div
				{...rest}
				data-slot="checkout-layout"
				mix={mergeMix(
					[
						raw({
							display: "grid",
							gridTemplateColumns: "minmax(0, 1fr)",
							gridTemplateAreas: '"summary" "steps" "main"',
							gap: "1.5rem",
							inlineSize: "100%",
							maxInlineSize: "70rem",
							marginInline: "auto",
							boxSizing: "border-box",
							[`@media ${WIDE}`]: {
								gridTemplateColumns: "minmax(0, 1fr) 24rem",
								gridTemplateAreas: '"steps summary" "main summary"',
								gridTemplateRows: "auto 1fr",
								columnGap: "3rem",
							},
						}),
					],
					mix,
				)}
			>
				<div
					data-slot="checkout-layout-summary"
					mix={[
						raw({
							gridArea: "summary",
							display: "grid",
							alignContent: "start",
							gap: "1.25rem",
							padding: "1rem",
							borderRadius: "var(--ui-radius-lg, 0.75rem)",
							backgroundColor: "var(--ui-neutral-bg-tint)",
							[`@media ${WIDE}`]: {
								position: "sticky",
								insetBlockStart: "1.5rem",
								alignSelf: "start",
								padding: "1.5rem",
							},
						}),
					]}
				>
					{summary}
					{aside === undefined ? null : <div data-slot="checkout-layout-aside">{aside}</div>}
				</div>
				{steps === undefined ? null : (
					<div data-slot="checkout-layout-steps" mix={[raw({ gridArea: "steps" })]}>
						{steps}
					</div>
				)}
				<div data-slot="checkout-layout-main" mix={[raw({ gridArea: "main", minInlineSize: "0" })]}>
					{children}
				</div>
			</div>
		);
	};
}
