/**
 * A `z` example with a negative value, which sends a decoration behind its siblings, so
 * the reader sees a shape tucked under the card it decorates.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { absolute, inset, relative } from "@sdxc/u/layout";
import { isolate, z } from "@sdxc/u/stacking";
import { rotate } from "@sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A rotated tint behind the card, kept from falling behind the page by `isolate()`. */
export default {
	title: "Negative values",
	description:
		"Pass a negative number, like `z(-1)`, to place an element under its siblings. `isolate()` on the parent keeps it above the page:",
	render: () => (
		<div mix={[relative(), isolate()]}>
			<div mix={[absolute(), inset(0), z(-1), rotate(-4), rounded("lg"), bg("brand.solid")]} />
			<div mix={[demo.card()]}>
				<p mix={[demo.prose()]}>Card content sits above z(-1).</p>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
