/**
 * The opening `backdropBlur` example: a see-through pane over a photograph at each step
 * of the blur scale, so the reader sees the pane blur only what shows through it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { backdropBlur } from "@sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Each named step of the blur scale behind a see-through pane. */
export default {
	title: "Basic example",
	description:
		'Use `backdropBlur("sm")`, `backdropBlur("md")` or `backdropBlur("lg")` to blur whatever shows through an element:',
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[demo.scene()]}>
				<div mix={[backdropBlur("sm"), demo.pane()]}>backdropBlur("sm")</div>
			</div>
			<div mix={[demo.scene()]}>
				<div mix={[backdropBlur("md"), demo.pane()]}>backdropBlur("md")</div>
			</div>
			<div mix={[demo.scene()]}>
				<div mix={[backdropBlur("lg"), demo.pane()]}>backdropBlur("lg")</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
