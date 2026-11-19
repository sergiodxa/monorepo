/**
 * Live preview for `PriceBreakdown`: four nights at a cabin with a cleaning fee, a weekly
 * discount in green and the total under a rule, the nightly line and the total in named
 * outputs a booking form's script could reprice.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { PriceBreakdown } from "@sdxc/ui/travel/price-breakdown";

/** The source the page shows, matching the markup below. */
const CODE = `<PriceBreakdown note="You won't be charged yet">
	<PriceBreakdown.Line label="4 nights" detail="$182 × 4 nights" amount="$728.00" name="nights" />
	<PriceBreakdown.Line label="Cleaning fee" amount="$45.00" />
	<PriceBreakdown.Line label="Service fee" amount="$61.10" />
	<PriceBreakdown.Line label="Weekly stay discount" amount="$72.80" tone="discount" />
	<PriceBreakdown.Total label="Total (USD)" amount="$761.30" name="total" />
</PriceBreakdown>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<form
			action="#reserve"
			mix={[
				raw({
					inlineSize: "100%",
					maxInlineSize: "22rem",
					marginBlock: "1.5rem",
					padding: "1.25rem",
					border: "1px solid var(--ui-neutral-border)",
					borderRadius: "0.75rem",
				}),
			]}
		>
			<PriceBreakdown note="You won't be charged yet">
				<PriceBreakdown.Line
					label="4 nights"
					detail="$182 × 4 nights"
					amount="$728.00"
					name="nights"
					line="nights"
				/>
				<PriceBreakdown.Line label="Cleaning fee" amount="$45.00" line="cleaning" />
				<PriceBreakdown.Line label="Service fee" amount="$61.10" line="service" />
				<PriceBreakdown.Line
					label="Weekly stay discount"
					amount="$72.80"
					tone="discount"
					line="discount"
				/>
				<PriceBreakdown.Total label="Total (USD)" amount="$761.30" name="total" />
			</PriceBreakdown>
		</form>
	),
};
