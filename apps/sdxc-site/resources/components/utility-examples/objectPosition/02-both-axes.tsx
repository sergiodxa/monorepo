/**
 * An `objectPosition` example on an image kept at its own size, so both axes crop and a
 * corner or a percentage picks the window shown.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "sdxc/u/layout";
import { bs, fit, is, objectPosition } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Corner and percentage positions on an uncropped-size image. */
export default {
	title: "Corners and percentages",
	description:
		'With `fit("none")` both axes crop, so a corner like `"top right"` or a percentage pair like `"15% 70%"` picks the part of the image in view:',
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[vstack({ gap: 2, align: "center" })]}>
				<img
					src={demo.photoUrl()}
					alt=""
					mix={[fit("none"), objectPosition("top right"), is(40), bs(40), demo.track()]}
				/>
				<span mix={[demo.caption()]}>top right</span>
			</div>
			<div mix={[vstack({ gap: 2, align: "center" })]}>
				<img
					src={demo.photoUrl()}
					alt=""
					mix={[fit("none"), objectPosition("bottom left"), is(40), bs(40), demo.track()]}
				/>
				<span mix={[demo.caption()]}>bottom left</span>
			</div>
			<div mix={[vstack({ gap: 2, align: "center" })]}>
				<img
					src={demo.photoUrl()}
					alt=""
					mix={[fit("none"), objectPosition("15% 70%"), is(40), bs(40), demo.track()]}
				/>
				<span mix={[demo.caption()]}>15% 70%</span>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
