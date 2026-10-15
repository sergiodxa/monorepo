/**
 * An `aspect` example with every named ratio side by side at one width, so the shapes
 * the names stand for can be compared at a glance.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { aspect, is } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Each named ratio drawn at the same width. */
export default {
	title: "Named ratios",
	description:
		'Pass a name for the common shapes: `"square"`, `"photo"`, `"video"`, `"widescreen"`, `"portrait"` or `"story"`:',
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[aspect("square"), is(28), demo.cell()]}>square</div>
			<div mix={[aspect("photo"), is(28), demo.cell()]}>photo</div>
			<div mix={[aspect("video"), is(28), demo.cell()]}>video</div>
			<div mix={[aspect("widescreen"), is(28), demo.cell()]}>widescreen</div>
			<div mix={[aspect("portrait"), is(28), demo.cell()]}>portrait</div>
			<div mix={[aspect("story"), is(28), demo.cell()]}>story</div>
		</div>
	),
} satisfies UtilityExampleModule;
