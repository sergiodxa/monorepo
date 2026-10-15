/**
 * The opening `objectPosition` example: one wide photograph cropped into squares, each
 * keeping a different side of it, with the tree on the left and the sun on the right.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "sdxc/u/layout";
import { bs, fit, is, objectPosition } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Which side of a cropped image stays in frame. */
export default {
	title: "Basic example",
	description:
		'Use `objectPosition()` with `fit("cover")` to choose which part of a cropped image stays visible, like `"left"`, `"center"` or `"right"`:',
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[vstack({ gap: 2, align: "center" })]}>
				<img
					src={demo.photoUrl()}
					alt=""
					mix={[fit("cover"), objectPosition("left"), is(32), bs(32), demo.track()]}
				/>
				<span mix={[demo.caption()]}>left</span>
			</div>
			<div mix={[vstack({ gap: 2, align: "center" })]}>
				<img
					src={demo.photoUrl()}
					alt=""
					mix={[fit("cover"), objectPosition("center"), is(32), bs(32), demo.track()]}
				/>
				<span mix={[demo.caption()]}>center</span>
			</div>
			<div mix={[vstack({ gap: 2, align: "center" })]}>
				<img
					src={demo.photoUrl()}
					alt=""
					mix={[fit("cover"), objectPosition("right"), is(32), bs(32), demo.track()]}
				/>
				<span mix={[demo.caption()]}>right</span>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
