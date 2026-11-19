/**
 * Live preview for `PackageSavings`: return flights, five nights and a compact car to Vellis,
 * each struck through at what it costs alone, beside the bundled price and its "You save $212"
 * badge.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { Button } from "@sdxc/ui";
import { PackageSavings } from "@sdxc/ui/travel/package-savings";

/** The source the page shows, matching the markup below. */
const CODE = `<PackageSavings
	title="Flight + Hotel + Car"
	savings="You save $212"
	bundleLabel="Package price"
	bundlePrice="$1,486"
	bundleDetail="2 travellers · taxes included"
	separateTotal="$1,698"
	separateLabel="Booked separately"
	action={<Button>Book package</Button>}
>
	<PackageSavings.Part kind="flight" label="Return flights MRW ⇄ VLS" detail="Larkwing Air · Economy" price="$684" />
	<PackageSavings.Part kind="stay" label="5 nights at Hotel Saltmarsh" detail="Double room · breakfast" price="$824" />
	<PackageSavings.Part kind="car" label="Compact car, 5 days" detail="Tallow Rent" price="$190" />
</PackageSavings>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div
			mix={[
				raw({
					inlineSize: "100%",
					maxInlineSize: "44rem",
					marginBlock: "1.5rem",
					padding: "1.25rem",
					border: "1px solid var(--ui-neutral-border)",
					borderRadius: "0.75rem",
				}),
			]}
		>
			<PackageSavings
				title="Flight + Hotel + Car"
				savings="You save $212"
				bundleLabel="Package price"
				bundlePrice="$1,486"
				bundleDetail="2 travellers · taxes included"
				separateTotal="$1,698"
				separateLabel="Booked separately"
				action={<Button type="button">Book package</Button>}
			>
				<PackageSavings.Part
					kind="flight"
					label="Return flights MRW ⇄ VLS"
					detail="Larkwing Air · Economy"
					price="$684"
				/>
				<PackageSavings.Part
					kind="stay"
					label="5 nights at Hotel Saltmarsh"
					detail="Double room · breakfast"
					price="$824"
				/>
				<PackageSavings.Part
					kind="car"
					label="Compact car, 5 days"
					detail="Tallow Rent"
					price="$190"
				/>
			</PackageSavings>
		</div>
	),
};
