/**
 * Live preview for `CarOffer`: a compact electric car from Tallow Rent at Merrow Airport, with
 * its spec chips, two perks, the company's rating, and the daily price over the total and a
 * "View deal" button.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { Badge, Button } from "@sdxc/ui";
import { CarOffer } from "@sdxc/ui/travel/car-offer";

/** The source the page shows, matching the markup below. */
const CODE = `<CarOffer
	art={<CarArt />}
	category="Compact"
	model="Velo C3 or similar"
	badges={<Badge color="success" variant="secondary">Great value</Badge>}
	specs={[
		{ kind: "seats", label: "5 seats" },
		{ kind: "bags", label: "2 bags" },
		{ kind: "transmission", label: "Automatic" },
		{ kind: "electric", label: "Electric · 380 km" },
		{ kind: "ac", label: "A/C" },
	]}
	perks={["Free cancellation", "Unlimited mileage"]}
	vendor="Tallow Rent"
	rating="8.6 · Excellent"
	pickup="In terminal · Merrow Airport"
	price="$38"
	priceUnit="/ day"
	total="$266 total for 7 days"
	actions={<Button>View deal</Button>}
/>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[raw({ inlineSize: "100%", maxInlineSize: "48rem", marginBlock: "1.5rem" })]}>
			<CarOffer
				art={<CarArt />}
				category="Compact"
				model="Velo C3 or similar"
				badges={
					<Badge color="success" variant="secondary">
						Great value
					</Badge>
				}
				specs={[
					{ kind: "seats", label: "5 seats" },
					{ kind: "bags", label: "2 bags" },
					{ kind: "transmission", label: "Automatic" },
					{ kind: "electric", label: "Electric · 380 km" },
					{ kind: "ac", label: "A/C" },
				]}
				perks={["Free cancellation", "Unlimited mileage"]}
				vendor="Tallow Rent"
				rating="8.6 · Excellent"
				pickup="In terminal · Merrow Airport"
				price="$38"
				priceUnit="/ day"
				total="$266 total for 7 days"
				actions={<Button type="button">View deal</Button>}
			/>
		</div>
	),
};

/**
 * A side view of an invented hatchback in the theme's colours, standing in for a photo.
 *
 * @returns The render function producing the drawing.
 */
function CarArt() {
	return () => (
		<svg viewBox="0 0 200 110" role="img" aria-label="Compact hatchback">
			<ellipse cx="100" cy="96" rx="86" ry="6" fill="var(--ui-neutral-border)" />
			<path
				d="M18 78c0-10 6-16 18-18l26-4 20-20c5-5 11-7 19-7h40c8 0 14 3 19 9l14 17 12 3c9 2 14 8 14 16v8c0 4-3 6-6 6H24c-4 0-6-2-6-6z"
				fill="var(--ui-brand-bg-solid)"
			/>
			<path
				d="M70 56l17-16c3-3 7-4 11-4h17v20zM121 36h20c5 0 9 2 12 6l11 14h-43z"
				fill="var(--ui-brand-bg-tint)"
			/>
			<circle cx="56" cy="88" r="14" fill="var(--ui-neutral-fg-emphasis)" />
			<circle cx="56" cy="88" r="6" fill="var(--ui-neutral-border)" />
			<circle cx="150" cy="88" r="14" fill="var(--ui-neutral-fg-emphasis)" />
			<circle cx="150" cy="88" r="6" fill="var(--ui-neutral-border)" />
		</svg>
	);
}
