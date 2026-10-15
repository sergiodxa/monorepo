/**
 * A `scaleY` example with `-1`, which mirrors an element top to bottom, the flip a
 * chevron takes when its panel opens.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { scaleY } from "sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A vertical mirror from a factor of -1. */
export default {
	title: "Mirroring vertically",
	description: "Use `scaleY(-1)` to flip an element upside down:",
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[demo.track()]}>
				<div mix={[scaleY(1), demo.tile()]}>▾ menu</div>
			</div>
			<div mix={[demo.track()]}>
				<div mix={[scaleY(-1), demo.tile()]}>▾ menu</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
