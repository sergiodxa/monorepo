/**
 * A `mis` example with a negative step, stacking avatars so each one overlaps the one
 * before it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack } from "sdxc/u/layout";
import { circle, fit, is, mis } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A negative inline-start margin overlaps a row of avatars. */
export default {
	title: "Overlapping items",
	description:
		"Pass a negative step, like `mis(-4)`, to pull each item over the one before it, like a stack of avatars:",
	render: () => (
		<div mix={[hstack()]}>
			<img src={demo.photoUrl()} alt="" mix={[circle(), is(14), fit("cover"), demo.avatarRing()]} />
			<img
				src={demo.photoUrl()}
				alt=""
				mix={[circle(), is(14), mis(-4), fit("cover"), demo.avatarRing()]}
			/>
			<img
				src={demo.photoUrl()}
				alt=""
				mix={[circle(), is(14), mis(-4), fit("cover"), demo.avatarRing()]}
			/>
			<div mix={[circle(), is(14), mis(-4), demo.fill(), demo.avatarRing()]}>+5</div>
		</div>
	),
} satisfies UtilityExampleModule;
