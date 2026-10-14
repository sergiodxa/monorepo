/**
 * The opening `isolate` example: two identical cards with a `z(-1)` glow, only one of them
 * isolated, so the reader sees the glow vanish behind the card that does not contain it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg } from "@sdxc/u/color";
import { blur } from "@sdxc/u/effects";
import { absolute, inset, relative } from "@sdxc/u/layout";
import { isolate, z } from "@sdxc/u/stacking";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The glow stays inside the isolated card and drops behind the other card's background. */
export default {
	title: "Basic example",
	description:
		"Use `isolate()` to start a new stacking context, so a negative `z()` inside stays above the element's own background:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[relative(), demo.panel()]}>
				<div mix={[absolute(), inset(4), z(-1), blur("lg"), bg("brand.solid")]} />
				<p mix={[demo.caption()]}>without isolate()</p>
			</div>
			<div mix={[relative(), isolate(), demo.panel()]}>
				<div mix={[absolute(), inset(4), z(-1), blur("lg"), bg("brand.solid")]} />
				<p mix={[demo.caption()]}>isolate()</p>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
