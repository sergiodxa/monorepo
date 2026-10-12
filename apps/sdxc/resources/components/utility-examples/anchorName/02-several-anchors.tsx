/**
 * An `anchorName` example with two anchors side by side, so a reader sees that each
 * positioned element follows the name it asks for rather than the nearest element.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	absolute,
	anchorName,
	center,
	gap,
	positionAnchor,
	positionArea,
	relative,
} from "@sdxc/u/layout";
import { bs, is, mbs } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Two buttons with their own anchor names, each with a label attached by name. */
export default {
	title: "Naming several anchors",
	description:
		"Give each anchor its own name so every positioned element can pick the one it belongs to:",
	render: () => (
		<div mix={[relative(), center(), gap(16), is(96), bs(32)]}>
			<button mix={[anchorName("edit-button"), demo.button()]}>Edit</button>
			<button mix={[anchorName("delete-button"), demo.button()]}>Delete</button>
			<span
				mix={[
					absolute(),
					positionAnchor("edit-button"),
					positionArea("bottom"),
					mbs(2),
					demo.caption(),
				]}
			>
				edit-button
			</span>
			<span
				mix={[
					absolute(),
					positionAnchor("delete-button"),
					positionArea("bottom"),
					mbs(2),
					demo.caption(),
				]}
			>
				delete-button
			</span>
		</div>
	),
} satisfies UtilityExampleModule;
