/**
 * The opening `transformOrigin` example: the same rotation pivoting on three points,
 * each over a striped ghost of the unrotated tile, so the pivot reads as the fixed corner.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { rotate, transformOrigin } from "sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The pivot of a rotation moved with corner and centre keywords. */
export default {
	title: "Basic example",
	description:
		'Use `transformOrigin()` to set the point an element\'s transforms pivot on, like `transformOrigin("top left")`:',
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[demo.track()]}>
				<div mix={[rotate(20), transformOrigin("center"), demo.tile()]}>center</div>
			</div>
			<div mix={[demo.track()]}>
				<div mix={[rotate(20), transformOrigin("top left"), demo.tile()]}>top left</div>
			</div>
			<div mix={[demo.track()]}>
				<div mix={[rotate(20), transformOrigin("bottom right"), demo.tile()]}>bottom right</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
