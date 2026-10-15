/**
 * The opening `scaleProperty` example: tiles resized through the standalone `scale`
 * property, over striped ghosts of their original size.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { scaleProperty } from "sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Scaling through the standalone `scale` property. */
export default {
	title: "Basic example",
	description:
		"Use `scaleProperty(n)` to set the standalone CSS `scale` property, which resizes an element apart from its `transform`:",
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[demo.track()]}>
				<div mix={[scaleProperty(0.75), demo.tile()]}>0.75</div>
			</div>
			<div mix={[demo.track()]}>
				<div mix={[scaleProperty(1), demo.tile()]}>1</div>
			</div>
			<div mix={[demo.track()]}>
				<div mix={[scaleProperty(1.25), demo.tile()]}>1.25</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
