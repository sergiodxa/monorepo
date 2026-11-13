/**
 * Live preview for `PriceList`: a corner bakery's counter as two boards of items and prices,
 * each name joined to its price by a dotted leader, so the groups sit side by side on a wide
 * container and stack into one column on a narrow one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is } from "@sdxc/u/size";
import { PriceList } from "@sdxc/ui/landing";

/** The source the page shows, matching the markup below. */
const CODE = `<PriceList>
	<PriceList.Group title="Bread" description="From 7 am until it runs out">
		<PriceList.Item name="Country sourdough" price="$9">
			Two-day ferment, big and crackly.
		</PriceList.Item>
		<PriceList.Item name="Seeded rye" price="$10">
			Sunflower, flax and pumpkin seeds.
		</PriceList.Item>
	</PriceList.Group>
	<PriceList.Group title="Pastry" description="From 7 am">
		<PriceList.Item name="Butter croissant" price="$4.25">
			Three days from dough to plate.
		</PriceList.Item>
		<PriceList.Item name="Cardamom bun" price="$4.50">
			Our most-asked-for bake.
		</PriceList.Item>
	</PriceList.Group>
</PriceList>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full")]}>
			<PriceList>
				<PriceList.Group title="Bread" description="From 7 am until it runs out">
					<PriceList.Item name="Country sourdough" price="$9">
						Two-day ferment, big and crackly.
					</PriceList.Item>
					<PriceList.Item name="Seeded rye" price="$10">
						Sunflower, flax and pumpkin seeds.
					</PriceList.Item>
				</PriceList.Group>
				<PriceList.Group title="Pastry" description="From 7 am">
					<PriceList.Item name="Butter croissant" price="$4.25">
						Three days from dough to plate.
					</PriceList.Item>
					<PriceList.Item name="Cardamom bun" price="$4.50">
						Our most-asked-for bake.
					</PriceList.Item>
				</PriceList.Group>
			</PriceList>
		</div>
	),
};
