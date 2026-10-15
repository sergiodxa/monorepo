/**
 * A `rotate` example with string angles, which pass through unchanged, so a reader sees
 * turns, radians and gradians work wherever a number of degrees would.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { rotate } from "sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Rotation from an angle written in another CSS unit. */
export default {
	title: "Using other angle units",
	description:
		'Pass a string to use any CSS angle unit, like `rotate("0.125turn")` or `rotate("1rad")`:',
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[demo.track()]}>
				<div mix={[rotate("0.125turn"), demo.tile()]}>rotate("0.125turn")</div>
			</div>
			<div mix={[demo.track()]}>
				<div mix={[rotate("1rad"), demo.tile()]}>rotate("1rad")</div>
			</div>
			<div mix={[demo.track()]}>
				<div mix={[rotate("50grad"), demo.tile()]}>rotate("50grad")</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
