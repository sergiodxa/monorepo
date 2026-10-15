/**
 * A `perspective` example with `none`, which removes the depth: a 3D rotation under it
 * reads as a flat squash, set beside the same rotation with depth.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { perspective, rotateX } from "sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The same rotation with the perspective removed and with it set. */
export default {
	title: "Removing perspective",
	description:
		'Use `perspective("none")` to remove the depth, so a 3D rotation reads as a flat squash:',
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[perspective("none"), demo.track()]}>
				<div mix={[rotateX(45), demo.tile()]}>perspective("none")</div>
			</div>
			<div mix={[perspective(300), demo.track()]}>
				<div mix={[rotateX(45), demo.tile()]}>perspective(300)</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
