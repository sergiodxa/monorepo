/**
 * A `transitionDelay` example that staggers a row of dots with increasing delays, so the
 * reader sees one shared transition ripple across items in turn.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { transition, transitionDelay } from "sdxc/u/effects";
import { when } from "sdxc/u/state";
import { translateY } from "sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Dots that rise one after another when their row is hovered. */
export default {
	title: "Staggering items",
	description:
		"Give each item an increasing delay to stagger one transition across a group. Hover the row:",
	render: () => (
		<div mix={[demo.gallery(), demo.track()]}>
			<div
				mix={[
					transition("transform", { duration: 300 }),
					transitionDelay("0ms"),
					when(":hover > &", translateY(-4)),
					demo.dot(),
				]}
			/>
			<div
				mix={[
					transition("transform", { duration: 300 }),
					transitionDelay("75ms"),
					when(":hover > &", translateY(-4)),
					demo.dot(),
				]}
			/>
			<div
				mix={[
					transition("transform", { duration: 300 }),
					transitionDelay("150ms"),
					when(":hover > &", translateY(-4)),
					demo.dot(),
				]}
			/>
			<div
				mix={[
					transition("transform", { duration: 300 }),
					transitionDelay("225ms"),
					when(":hover > &", translateY(-4)),
					demo.dot(),
				]}
			/>
		</div>
	),
} satisfies UtilityExampleModule;
