/**
 * A `scale` example applied on hover with a transition, the lift a card or thumbnail
 * gives as the pointer reaches it, so the reader can try it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { transition } from "sdxc/u/effects";
import { hover } from "sdxc/u/state";
import { scale } from "sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Growth as a hover state, animated by a transform transition. */
export default {
	title: "Applying on hover",
	description:
		'Wrap it in `hover()` and add a `transition("transform")` to grow an element under the pointer. Hover the tile to try it:',
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[demo.track()]}>
				<div mix={[hover(scale(1.15)), transition("transform"), demo.tile()]}>hover me</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
