/**
 * The opening `fillOpacity` example: overlapping circles at growing fill opacities,
 * where a number is read on a 0 to 100 scale.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fill, fillOpacity } from "sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

/** One filled circle at four fill opacities. */
export default {
	title: "Basic example",
	description:
		"Use `fillOpacity` with a number from 0 to 100 to make the fill of an SVG shape see-through, leaving its stroke alone:",
	render: () => (
		<svg width={240} height={64} viewBox="0 0 240 64" aria-hidden="true">
			<circle cx={32} cy={32} r={28} mix={[fill("brand"), fillOpacity(25)]} />
			<circle cx={88} cy={32} r={28} mix={[fill("brand"), fillOpacity(50)]} />
			<circle cx={144} cy={32} r={28} mix={[fill("brand"), fillOpacity(75)]} />
			<circle cx={200} cy={32} r={28} mix={[fill("brand"), fillOpacity(100)]} />
		</svg>
	),
} satisfies UtilityExampleModule;
