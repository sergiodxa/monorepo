/**
 * The opening `anchorSize` example: a dropdown at least as wide as the button that opens
 * it, with the browser tracking the button's width instead of a measured number.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { listStyle } from "@sdxc/u/general";
import {
	absolute,
	anchorName,
	anchorSize,
	flex,
	items,
	justify,
	positionAnchor,
	positionArea,
	relative,
} from "@sdxc/u/layout";
import { bs, is, mbe, mbs, minIs } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A listbox whose minimum inline size tracks its trigger's with `anchorSize()`. */
export default {
	title: "Basic example",
	description:
		'Use `anchorSize(name, "inline")` as a size value to make a positioned element at least as wide as its anchor:',
	render: () => (
		<div mix={[relative(), flex(), items("start"), justify("center"), is(80), bs(48)]}>
			<button mix={[anchorName("country-select"), is(56), demo.button()]}>Country</button>
			<ul
				mix={[
					absolute(),
					positionAnchor("country-select"),
					positionArea("bottom"),
					minIs(anchorSize("country-select", "inline")),
					mbs(1),
					mbe(0),
					listStyle("none"),
					demo.panel(),
				]}
			>
				<li>Argentina</li>
				<li>Canada</li>
				<li>Peru</li>
			</ul>
		</div>
	),
} satisfies UtilityExampleModule;
