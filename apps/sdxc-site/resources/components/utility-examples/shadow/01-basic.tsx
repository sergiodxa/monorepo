/**
 * The opening `shadow` example: the same card at each step of the shadow scale, so the
 * reader sees how far each named step lifts it off the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { shadow } from "@sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Each named step of the shadow scale on the same card. */
export default {
	title: "Basic example",
	description:
		'Use `shadow("sm")`, `shadow("md")`, `shadow("lg")` or `shadow("xl")` to give an element a box shadow from the shadow scale:',
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[shadow("sm"), demo.panel()]}>shadow("sm")</div>
			<div mix={[shadow("md"), demo.panel()]}>shadow("md")</div>
			<div mix={[shadow("lg"), demo.panel()]}>shadow("lg")</div>
			<div mix={[shadow("xl"), demo.panel()]}>shadow("xl")</div>
		</div>
	),
} satisfies UtilityExampleModule;
