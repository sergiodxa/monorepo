/**
 * A `fit` example comparing an image kept at its own size with one scaled down only when
 * it is larger than its box.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "sdxc/u/layout";
import { bs, fit, is } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Natural size against scale-down, side by side. */
export default {
	title: "Original size",
	description:
		'Use `fit("none")` to keep an image at its own size, or `fit("scale-down")` to shrink it to fit only when it is larger than its box:',
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[vstack({ gap: 2, align: "center" })]}>
				<img src={demo.photoUrl()} alt="" mix={[fit("none"), is(40), bs(40), demo.track()]} />
				<span mix={[demo.caption()]}>fit("none")</span>
			</div>
			<div mix={[vstack({ gap: 2, align: "center" })]}>
				<img src={demo.photoUrl()} alt="" mix={[fit("scale-down"), is(40), bs(40), demo.track()]} />
				<span mix={[demo.caption()]}>fit("scale-down")</span>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
