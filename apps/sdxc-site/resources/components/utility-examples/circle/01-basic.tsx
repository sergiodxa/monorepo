/**
 * The opening `circle` example: avatars at three sizes, where one width is all each
 * needs because the call squares and rounds the box.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { circle, fit, is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** One width per avatar; the circle supplies the rest. */
export default {
	title: "Basic example",
	description: "Use `circle()` with a width to draw a circular frame, like an avatar:",
	render: () => (
		<div mix={[demo.row()]}>
			<img src={demo.photoUrl()} alt="" mix={[circle(), is(12), fit("cover")]} />
			<img src={demo.photoUrl()} alt="" mix={[circle(), is(16), fit("cover")]} />
			<img src={demo.photoUrl()} alt="" mix={[circle(), is(20), fit("cover")]} />
		</div>
	),
} satisfies UtilityExampleModule;
