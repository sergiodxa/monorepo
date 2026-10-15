/**
 * A `zstack` example with everything centred: a play button laid over the middle of a
 * video still, the overlay a player draws.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { zstack } from "sdxc/u/layout";
import { bs, is } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Centring on both axes lays an overlay over the middle of what it covers. */
export default {
	title: "Centering an overlay",
	description:
		'Set both `align` and `justify` to `"center"` to lay an overlay over the middle of the content under it:',
	render: () => (
		<div mix={[zstack({ align: "center", justify: "center" })]}>
			<div mix={[is(80), bs(48), demo.photo()]} />
			<button type="button" mix={[demo.button()]}>
				▶ Play
			</button>
		</div>
	),
} satisfies UtilityExampleModule;
