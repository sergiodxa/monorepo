/**
 * A `perspective` example with string lengths, which pass through unchanged, so a
 * reader can size the distance in rem or any other CSS unit.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { perspective, rotateX } from "sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Viewer distances from CSS lengths in other units. */
export default {
	title: "Using other lengths",
	description: 'Pass a string to use any CSS length, like `perspective("12rem")`:',
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[perspective("12rem"), demo.track()]}>
				<div mix={[rotateX(45), demo.tile()]}>perspective("12rem")</div>
			</div>
			<div mix={[perspective("40rem"), demo.track()]}>
				<div mix={[rotateX(45), demo.tile()]}>perspective("40rem")</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
